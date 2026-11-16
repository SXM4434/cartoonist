/**
 * Server-only abuse guard for the paid AI / voice endpoints.
 *
 * These routes forward straight to metered providers (Lovable AI Gateway,
 * ElevenLabs), so an unauthenticated caller must not be able to script them.
 * Every guarded route now has to prove:
 *   1. the payload is inside a sane size cap,
 *   2. (where a session exists) the roomId refers to a real, live room,
 *   3. the caller is inside a per-room / per-IP request budget.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export function callerKey(request: Request): string {
  const h = request.headers;
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return ip && ip.length > 0 ? ip : "unknown";
}

/** Fixed-window counter. Returns true when the call is allowed. */
export function withinBudget(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  existing.count += 1;
  return existing.count <= limit;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** A room only counts as callable while its session is open and recent. */
export async function isLiveRoom(roomId: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rooms")
      .select("id,ended_at,created_at")
      .eq("id", roomId)
      .maybeSingle();
    if (error || !data) return false;
    if (data.ended_at) return false;
    return Date.now() - new Date(data.created_at).getTime() < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export type GuardOptions = {
  /** Logical route name — scopes the rate-limit buckets. */
  route: string;
  /** Reject bodies larger than this many bytes. */
  maxBytes: number;
  /** Requests allowed per window, per room (or per IP when roomless). */
  limit: number;
  windowMs?: number;
  /** When false the route is usable before a room exists (onboarding). */
  requireRoom?: boolean;
  roomId?: unknown;
};

/**
 * Returns a Response when the request must be rejected, otherwise null.
 */
export async function guardExpensiveRoute(
  request: Request,
  opts: GuardOptions,
): Promise<Response | null> {
  const windowMs = opts.windowMs ?? 60_000;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > opts.maxBytes) {
    return json({ error: "Payload too large" }, 413);
  }

  const ip = callerKey(request);
  // Always cap per-IP, so a caller cannot fan out across many rooms.
  if (!withinBudget(`ip:${opts.route}:${ip}`, opts.limit * 3, windowMs)) {
    return json({ error: "Rate limit exceeded" }, 429);
  }

  const requireRoom = opts.requireRoom ?? true;
  if (!requireRoom && !isUuid(opts.roomId)) return null;

  if (!isUuid(opts.roomId)) {
    return json({ error: "A valid roomId is required" }, 400);
  }
  if (!(await isLiveRoom(opts.roomId))) {
    return json({ error: "Unknown or closed room" }, 403);
  }
  if (!withinBudget(`room:${opts.route}:${opts.roomId}`, opts.limit, windowMs)) {
    return json({ error: "Rate limit exceeded for this room" }, 429);
  }
  return null;
}
