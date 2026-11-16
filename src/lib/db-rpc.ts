import { supabase } from "@/integrations/supabase/client";
import { canvasPageCursor, isMissingCanvasRpc } from "@/lib/canvas-event-sync";

/**
 * Room RPCs. A live room link permits guest participation. Historical team
 * rows require database membership, including when a caller knows the room ID.
 *
 * The generated Supabase types don't know about these functions, so calls are
 * funnelled through one narrow cast here instead of sprinkling `as never`.
 */
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

const canvasFallbackKey = "cartoonist_canvas_rpc_missing";
let legacyCanvasEvents = false;

function usingLegacyCanvasEvents(): boolean {
  if (legacyCanvasEvents) return true;
  if (typeof window === "undefined") return false;
  try {
    legacyCanvasEvents = window.sessionStorage.getItem(canvasFallbackKey) === "1";
  } catch (error) {
    console.warn("[canvas] could not read session fallback state", error);
  }
  return legacyCanvasEvents;
}

async function canvasRpcOrLegacy<T>(fn: string, args: Record<string, unknown>, legacy: () => Promise<T>): Promise<T | null> {
  if (usingLegacyCanvasEvents()) return legacy();
  const { data, error } = await (supabase as unknown as RpcClient).rpc(fn, args);
  if (isMissingCanvasRpc(error)) {
    if (!usingLegacyCanvasEvents()) {
      legacyCanvasEvents = true;
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(canvasFallbackKey, "1");
        } catch (storageError) {
          console.warn("[canvas] could not save session fallback state", storageError);
        }
      }
      console.error("[canvas] canvas write order migration is missing; using direct canvas_events access for this session", error);
    }
    return legacy();
  }
  if (error) {
    console.error(`[rpc:${fn}]`, error.message);
    return null;
  }
  return (data ?? null) as T | null;
}

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

export async function canvasEventsAppend(roomId: string, rows: Array<Record<string, unknown>>, expectedClear: string | null, seed: boolean): Promise<boolean> {
  const result = await canvasRpcOrLegacy<boolean>("canvas_events_append", {
    p_room: roomId, p_rows: rows, p_expected_clear: expectedClear, p_seed: seed,
  }, async () => {
    const { error } = await supabase.from("canvas_events").insert(rows as never);
    if (error) throw error;
    return true;
  });
  if (result === null) throw new Error("Canvas write failed");
  return result;
}

export async function canvasEventsClear(roomId: string, row: Record<string, unknown>): Promise<{ id: string; created_at: string }> {
  const clear = await canvasRpcOrLegacy<{ id: string; created_at: string }>("canvas_events_clear", {
    p_room: roomId, p_row: row,
  }, async () => {
    const { data, error } = await supabase.from("canvas_events").insert(row as never).select("id,created_at").single();
    if (error) throw error;
    return data;
  });
  if (!clear) throw new Error("Canvas clear failed");
  return clear;
}

export async function canvasEventsForRoom(roomId: string, limit = Number.MAX_SAFE_INTEGER): Promise<CanvasEventRow[] | null> {
  const rows: CanvasEventRow[] = [];
  while (rows.length < limit) {
    const pageSize = Math.min(500, limit - rows.length);
    let page: CanvasEventRow[] | null;
    try {
      page = await canvasRpcOrLegacy<CanvasEventRow[]>("canvas_events_page", {
        p_room: roomId, ...canvasPageCursor(rows.at(-1)), p_limit: pageSize,
      }, async () => {
        const { data, error } = await supabase.from("canvas_events")
          .select("id,op,source,transcript_span,thread_id,t_offset_ms,created_at")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(rows.length, rows.length + pageSize - 1);
        if (error) throw error;
        return data ?? [];
      });
    } catch (error) {
      console.error("[canvas] event replay failed", error);
      return null;
    }
    if (!page) return null;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
