import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type CanvasThread = {
  id: string;
  latest: string;
  modality: string | null;
  shapeIds: string[];
  at: number;
  source: "seed" | "mediator";
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

export function ThreadRail({ threads }: { threads: CanvasThread[] }) {
  const ordered = [...threads].sort((a, b) => b.at - a.at);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-none border-border" title="Threads on canvas (jump-to)">
          <Layers className="h-3.5 w-3.5" />
          <span className="eyebrow">Threads</span>
          {ordered.length > 0 && (
            <span className="ml-1 border border-border px-1 text-[10px] tabular-nums text-muted-foreground">{ordered.length}</span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[92vw] overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-serif" style={{ fontSize: "var(--step-3)" }}>Canvas threads</SheetTitle>
          <p className="text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
            Each thread is one utterance the cartoonist drew from. Click to jump the canvas to those shapes.
          </p>
        </SheetHeader>
        <div className="mt-5 space-y-2">
          {ordered.length === 0 && (
            <p className="border border-dashed border-border px-3 py-6 text-center text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
              No threads yet. Speak or ask Cartoonist to draw something.
            </p>
          )}
          {ordered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => focusShapes(t.shapeIds)}
              className="flex w-full flex-col gap-1 border border-border bg-background px-3 py-2 text-left transition hover:border-foreground"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{t.source === "seed" ? "Session brief" : t.modality ?? "mediator"}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span>{t.shapeIds.length} shape{t.shapeIds.length === 1 ? "" : "s"}</span>
                  <span>·</span>
                  <span>{timeAgo(t.at)} ago</span>
                </span>
              </div>
              <p className="font-serif text-foreground" style={{ fontSize: "var(--step-1)", lineHeight: 1.35 }}>
                {t.latest || "(no transcript)"}
              </p>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
