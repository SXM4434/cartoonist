export type AgentKind = "scribe" | "historian" | "drafter" | "facilitator" | "advocate" | "librarian";
export type EventStatus = "running" | "completed" | "failed";
export type AgentEvent<T = unknown> = { claimed: boolean; status: EventStatus; result?: T; error?: string | null; token?: string };
export type AgentEventStore = {
  claim<T>(key: string): Promise<AgentEvent<T>>;
  finish<T>(key: string, status: EventStatus, result?: T, error?: string, token?: string): Promise<void>;
};

export function eventKey(kind: AgentKind, roomId: string, trigger: string, task = "work"): string {
  let hash = 2166136261;
  for (let i = 0; i < trigger.length; i++) hash = Math.imul(hash ^ trigger.charCodeAt(i), 16777619);
  return `${kind}:${roomId}:${task}:${trigger.length}:${(hash >>> 0).toString(36)}`;
}

export async function runAgentEvent<T>(store: AgentEventStore, key: string, work: () => Promise<T> | T): Promise<AgentEvent<T>> {
  const event = await store.claim<T>(key);
  if (!event.claimed) return event;
  let result: T;
  try {
    result = await work();
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Agent work failed";
    await store.finish(key, "failed", undefined, error, event.token);
    return { claimed: true, status: "failed", error };
  }
  await store.finish(key, "completed", result, undefined, event.token);
  return { claimed: true, status: "completed", result };
}
