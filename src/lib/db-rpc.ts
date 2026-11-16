import { supabase } from "@/integrations/supabase/client";

/**
 * Room RPCs. A live room link permits guest participation. Historical team
 * rows require database membership, including when a caller knows the room ID.
 *
 * The generated Supabase types don't know about these functions, so calls are
 * funnelled through one narrow cast here instead of sprinkling `as never`.
 */
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc(fn, args);
  if (error) {
    console.error(`[rpc:${fn}]`, error.message);
    return null;
  }
  return (data ?? null) as T | null;
}

export type RoomRow = {
  id: string;
  name: string;
  goal: string | null;
  outputs: string[] | null;
  facilitation: string | null;
  host_role: string | null;
  join_code: string | null;
  ended_at: string | null;
};

export const roomGet = async (id: string) =>
  (await rpc<RoomRow[]>("room_get", { p_id: id }))?.[0] ?? null;

export const roomByCode = (code: string) => rpc<string | null>("room_by_code", { p_code: code });

export const roomsByIds = (ids: string[]) =>
  rpc<Array<{ id: string; name: string; goal: string | null; ended_at: string | null; join_code: string | null }>>(
    "rooms_by_ids",
    { p_ids: ids },
  );

export const sessionStats = (ids: string[]) =>
  rpc<Array<{ room_id: string; participants: number; shapes: number; messages: number; last_activity: string | null }>>(
    "session_stats",
    { p_ids: ids },
  );

export type CanvasEventRow = {
  id: string;
  op: unknown;
  source: string | null;
  transcript_span: unknown;
  thread_id: string | null;
  t_offset_ms: number;
  created_at: string;
};

export async function canvasEventsForRoom(roomId: string, limit = Number.MAX_SAFE_INTEGER): Promise<CanvasEventRow[] | null> {
  const rows: CanvasEventRow[] = [];
  while (rows.length < limit) {
    const pageSize = Math.min(500, limit - rows.length);
    const { data: page, error } = await supabase.from("canvas_events")
      .select("id,op,source,transcript_span,thread_id,t_offset_ms,created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(rows.length, rows.length + pageSize - 1);
    if (error) {
      console.error("[canvas] event replay failed", error);
      return null;
    }
    if (!page) return null;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
