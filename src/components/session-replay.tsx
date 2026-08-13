// Session replay — rebuilds the canvas stroke-by-stroke from provenance
// (public.canvas_events), synced to the utterance that caused each shape.
// Read-only: it never writes, and closing restores the live canvas.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { SketchPrimitive } from "@/lib/sketch-types";
import { canvasEventsForRoom } from "@/lib/db-rpc";

type Frame = {
  at: number;
  shapes: SketchPrimitive[];
  latest: string;
  source: "seed" | "mediator" | "user";
  modality: string | null;
  threadId: string | null;
  op: "create" | "edit" | "remove";
};

const SPEEDS = [1, 2, 4] as const;

export function SessionReplay({
  roomId,
  onFrame,
  embedded = false,
}: {
  roomId: string;
  onFrame: (shapes: SketchPrimitive[] | null) => void;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(embedded);

  const [loading, setLoading] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await canvasEventsForRoom(roomId, 3000);
      const byId = new Map<string, SketchPrimitive>();
      const out: Frame[] = [];
      for (const row of (data ?? []) as Array<{
        op: unknown;
        source: string | null;
        transcript_span: unknown;
        thread_id: string | null;
        created_at: string;
      }>) {
        const op = row.op as { id?: string; type?: string; kind?: string; patch?: Record<string, unknown> } | null;
        if (!op || typeof op !== "object") continue;
        let kind: Frame["op"] = "create";
        if (op.kind === "remove" && typeof op.id === "string") {
          if (!byId.has(op.id)) continue;
          byId.delete(op.id);
          kind = "remove";
        } else if (op.kind === "edit" && typeof op.id === "string" && op.patch) {
          const prev = byId.get(op.id);
          if (!prev) continue;
          byId.set(op.id, { ...prev, ...op.patch, id: prev.id, type: prev.type } as SketchPrimitive);
          kind = "edit";
        } else if (typeof op.id === "string" && typeof op.type === "string") {
          byId.set(op.id, op as unknown as SketchPrimitive);
        } else {
          continue;
        }
        const span = (row.transcript_span ?? {}) as { latest?: string; modality?: string | null; goal?: string | null; origin?: string };
        const source: Frame["source"] = row.source === "seed" ? "seed" : row.source === "user" ? "user" : "mediator";
        out.push({
          at: new Date(row.created_at).getTime(),
          shapes: Array.from(byId.values()),
          latest:
            span.latest ??
            (span.origin === "session_brief" ? `Session brief — ${span.goal ?? "opening"}` : source === "user" ? "hand-drawn stroke" : ""),
          source,
          modality: span.modality ?? null,
          threadId: row.thread_id ?? null,
          op: kind,
        });
      }
      if (!out.length) {
        toast.error("Nothing to replay yet — draw or talk first.");
        setOpen(false);
        return;
      }
      setFrames(out);
      setIdx(0);
      onFrameRef.current(out[0].shapes);
      setPlaying(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load replay");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Playback tick. Compressed time: one step per beat, not wall-clock gaps.
  useEffect(() => {
    if (!open || !playing || frames.length === 0) return;
    const t = window.setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 850 / speed);
    return () => window.clearInterval(t);
  }, [open, playing, speed, frames.length]);

  // Push the current frame up to the canvas.
  useEffect(() => {
    if (!open || !frames.length) return;
    onFrameRef.current(frames[Math.min(idx, frames.length - 1)].shapes);
  }, [idx, frames, open]);

  const close = useCallback(() => {
    setOpen(false);
    setPlaying(false);
    setFrames([]);
    setIdx(0);
    onFrameRef.current(null);
  }, []);

  const current = frames[Math.min(idx, Math.max(frames.length - 1, 0))];
  const elapsed = useMemo(() => {
    if (!frames.length || !current) return "0:00";
    const ms = current.at - frames[0].at;
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, [frames, current]);

  return (
    <>
      {!embedded && (
        <Button
          size="sm"
          variant="outline"
          data-testid="replay-trigger"
          onClick={() => {
            if (open) return close();
            setOpen(true);
            void load();
          }}
          className={`h-8 gap-1.5 rounded-none border-border ${open ? "bg-foreground text-background" : ""}`}
        >
          <History className="h-3.5 w-3.5" />
          <span className="eyebrow">Replay</span>
        </Button>
      )}

      {open && (
        <div
          data-testid="replay-bar"
          className={
            embedded
              ? "border-b border-border px-2.5 py-2.5"
              : "fixed bottom-28 left-1/2 z-50 w-[min(760px,92vw)] -translate-x-1/2 border border-border bg-background/97 px-4 py-3 shadow-sm backdrop-blur"
          }
        >

          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow text-primary">
              {loading ? "Loading provenance…" : `Replay — step ${Math.min(idx + 1, frames.length)} of ${frames.length}`}
            </span>
            <div className="flex items-center gap-2">
              <span className="eyebrow text-muted-foreground" data-numeric>
                {elapsed}
              </span>
              <button type="button" onClick={close} aria-label="Close replay" className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              aria-label="Step back"
              onClick={() => { setPlaying(false); setIdx((i) => Math.max(0, i - 1)); }}
              className="text-foreground/70 hover:text-foreground"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => {
                if (idx >= frames.length - 1) setIdx(0);
                setPlaying((v) => !v);
              }}
              className="flex h-8 w-8 items-center justify-center border border-border bg-foreground text-background"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label="Step forward"
              onClick={() => { setPlaying(false); setIdx((i) => Math.min(frames.length - 1, i + 1)); }}
              className="text-foreground/70 hover:text-foreground"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <input
              type="range"
              aria-label="Replay position"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              value={Math.min(idx, Math.max(frames.length - 1, 0))}
              onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
              className="h-1 flex-1 cursor-pointer appearance-none bg-border accent-[var(--accent-warm,#E07A3E)]"
            />

            <div className="flex items-center gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                    speed === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {current && (
            <div className="mt-2 flex items-start gap-2 border-t border-border pt-2">
              <span
                className="eyebrow shrink-0"
                style={{ color: current.source === "seed" ? "var(--muted-foreground)" : "var(--accent-warm, #E07A3E)" }}
              >
                {current.op} · {current.source}
                {current.modality ? ` · ${current.modality}` : ""}
              </span>
              <p className="truncate font-serif text-foreground" style={{ fontSize: "var(--step-1)" }}>
                {current.latest || "(no transcript for this step)"}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
