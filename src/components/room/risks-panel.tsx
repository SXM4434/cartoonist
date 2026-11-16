import { Pin, RefreshCw, X } from "lucide-react";
import type { Risk } from "@/hooks/use-devils-advocate";

const KIND_LABEL: Record<Risk["kind"], string> = {
  risk: "Risk",
  gap: "Gap",
  assumption: "Assumption",
  question: "Question",
};

/**
 * Phase 3.1 — Devil's Advocate surface.
 * One idea per row: what it is, the words that triggered it, and the two
 * things you can do with it — put it on the canvas, or drop it.
 */
export function RisksPanel({
  risks,
  thinking,
  checkedAt,
  onCheckNow,
  onPin,
  onDismiss,
}: {
  risks: Risk[];
  thinking: boolean;
  checkedAt: number | null;
  onCheckNow: () => void;
  onPin: (risk: Risk) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-2.5 py-2">
        <span className="eyebrow text-muted-foreground">
          {thinking ? "Pushing back…" : checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Listening"}
        </span>
        <button
          type="button"
          onClick={onCheckNow}
          disabled={thinking}
          title="Challenge the room now"
          className="flex h-6 items-center gap-1 border border-border px-1.5 text-muted-foreground transition hover:bg-foreground hover:text-background active:scale-[0.98] disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${thinking ? "animate-spin" : ""}`} />
          <span className="eyebrow">Challenge</span>
        </button>
      </div>

      {risks.length === 0 ? (
        <p className="px-2.5 py-4 text-[13px] leading-[1.5] text-muted-foreground">
          Nothing to argue with yet. Once the room commits to a direction, the counter-case shows up here.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {risks
            .slice()
            .reverse()
            .map((r) => (
              <li key={r.id} className="border-b border-border px-2.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`eyebrow ${r.severity >= 0.66 ? "text-destructive" : "text-muted-foreground"}`}>
                    {KIND_LABEL[r.kind]}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onPin(r)}
                      disabled={r.pinned}
                      title={r.pinned ? "On the canvas" : "Pin to canvas"}
                      className="flex h-6 w-6 items-center justify-center border border-border text-muted-foreground transition hover:bg-foreground hover:text-background active:scale-[0.98] disabled:opacity-40"
                    >
                      <Pin className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(r.id)}
                      title="Dismiss"
                      className="flex h-6 w-6 items-center justify-center text-muted-foreground transition hover:text-foreground active:scale-[0.98]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[15px] leading-[1.5] text-foreground">{r.text}</p>
                <p className="mt-1 border-l-2 border-border pl-2 text-[13px] leading-[1.5] text-muted-foreground">
                  “{r.source_quote}”
                </p>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
