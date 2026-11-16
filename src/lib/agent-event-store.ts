import { supabase } from "@/integrations/supabase/client";
import type { AgentEvent, AgentEventStore, AgentKind, EventStatus } from "./agent-events";

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function meetingEventStore(roomId: string, agent: AgentKind): AgentEventStore {
  return {
    claim: <T>(key: string) => call<AgentEvent<T>>("agent_event_claim", { p_room: roomId, p_key: key, p_agent: agent }),
    finish: async <T>(key: string, status: EventStatus, result?: T, error?: string, token?: string) => {
      if (!token) throw new Error("Agent event has no claim token");
      const saved = await call<boolean>("agent_event_finish", { p_room: roomId, p_key: key, p_token: token, p_status: status, p_result: result ?? null, p_error: error ?? null });
      if (!saved) throw new Error("Agent event result was not saved");
    },
  };
}

export type SavedAgentEvent = { agent: AgentKind; event_key: string; status: EventStatus; result: unknown; error: string | null; created_at: string };
export const listAgentEvents = (roomId: string) => call<SavedAgentEvent[]>("agent_events_list", { p_room: roomId });
