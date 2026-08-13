
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

/** Threads, rendered inline inside the right panel — never as a blocking overlay. */
export function ThreadList({ threads, echoes = [] }: { threads: CanvasThread[]; echoes?: ThreadEcho[] }) {
  const ordered = [...threads].sort((a, b) => (b.reopenedAt ?? b.at) - (a.reopenedAt ?? a.at));

  return (
    <div className="space-y-2 px-2.5 py-2.5">
      {ordered.length === 0 && (
        <p className="border border-dashed border-border px-3 py-6 text-center text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
          No threads yet. Speak, or ask Cartoonist to draw something.
        </p>
      )}
      {ordered.map((t) => {
        const reopened = (t.reopenCount ?? 0) > 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => focusShapes(t.shapeIds)}
            className="flex w-full flex-col gap-1 border border-border bg-background px-2.5 py-2 text-left transition hover:border-foreground"
          >
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5 truncate">
                <span className="truncate">{t.source === "seed" ? "Session brief" : t.modality ?? "mediator"}</span>
                {reopened && <span className="border border-foreground px-1 text-foreground">↺{t.reopenCount}</span>}
                {t.relation && <span className="border border-border px-1">{relationCopy[t.relation]}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{timeAgo(t.reopenedAt ?? t.at)}</span>
            </div>
            <p className="text-foreground" style={{ fontSize: "var(--step-1)", lineHeight: 1.35 }}>
              {t.latest || "(no transcript)"}
            </p>
          </button>
        );
      })}

      {echoes.length > 0 && (
        <div className="pt-3">
          <p className="eyebrow text-muted-foreground">Echoes from earlier sessions</p>
          <div className="mt-2 space-y-2">
            {echoes.map((e) => (
              <a
                key={`${e.roomId}:${e.threadId}`}
                href={`/r/${e.roomId}`}
                className="block border border-dashed border-border bg-secondary/40 px-2.5 py-2 opacity-80 transition hover:border-foreground hover:opacity-100"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="truncate">↗ {relationCopy[e.relation]} · {e.roomName}</span>
                  <span className="shrink-0 tabular-nums">{Math.round(e.score * 100)}%</span>
                </div>
                <p className="mt-1 text-foreground" style={{ fontSize: "var(--step-1)", lineHeight: 1.35 }}>{e.text || "(no transcript)"}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
