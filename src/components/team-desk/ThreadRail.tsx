
export type ThreadRelation = "extends" | "references" | "contradicts" | "resolves";

export type CanvasThread = {
  id: string;
  latest: string;
  modality: string | null;
  shapeIds: string[];
  at: number;
  source: "seed" | "mediator";
  reopenedAt?: number;
  reopenCount?: number;
  relation?: ThreadRelation | null;
};

function focusShapes(ids: string[]) {
  if (typeof window === "undefined" || !ids.length) return;
  window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids } }));
}

function timeAgo(ms: number) {
  const d = Math.max(0, Date.now() - ms);
  if (d < 60_000) return `${Math.round(d / 1000)}s`;
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m`;
  return `${Math.round(d / 3_600_000)}h`;
}

const relationCopy: Record<ThreadRelation, string> = {
  extends: "extends",
  references: "refs",
  contradicts: "contradicts",
  resolves: "resolves",
};

export type ThreadEcho = {
  roomId: string;
  roomName: string;
  threadId: string;
  text: string;
  at: number;
  score: number;
  relation: ThreadRelation;
};

