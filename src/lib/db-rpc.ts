import { supabase } from "@/integrations/supabase/client";

/**
 * Capability-scoped database RPCs.
 *
 * Session tables are no longer readable table-wide: anon can only reach rows
 * of a live room, and everything historical goes through these SECURITY
 * DEFINER functions, which require the caller to already know the exact room
 * id(s). That removes room enumeration and cross-room harvesting while
 * keeping the "anyone with the link can join" model intact.
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
  op: unknown;
  source: string | null;
  transcript_span: unknown;
  thread_id: string | null;
  t_offset_ms: number;
  created_at: string;
};

export const canvasEventsForRoom = (roomId: string, limit = 2000) =>
  rpc<CanvasEventRow[]>("canvas_events_for_room", { p_room: roomId, p_limit: limit });
