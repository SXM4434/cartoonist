import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, Loader2, Quote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rpc } from "@/lib/db-rpc";

export type StoredInsight = {
  id: string;
  subject_name: string;
  kind: string;
  text: string;
  source_quote: string;
  confidence: number;
};

type Props = {
  roomId: string;
  buildRequest: () => {
    transcript: string;
    participants: Array<{ id?: string; name: string; role?: string | null }>;
  };
};

/**
 * Memory is reference material, not a task — it lives inside the right panel
 * and never dims the canvas.
 */
export function MemoryPanel({ roomId, buildRequest }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StoredInsight[]>([]);

  const load = useCallback(async () => {
    const data = await rpc<StoredInsight[]>("insights_list", { p_room: roomId });
    setItems(data ?? []);
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const learn = useCallback(async () => {
    setLoading(true);
    try {
      const req = buildRequest();
      const res = await fetch("/api/infer-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, ...req }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        insights?: Array<{ subject: string; kind: string; text: string; source_quote: string; confidence: number }>;
      };
      if (!res.ok) throw new Error(data.error || "Could not learn anything");
      const fresh = data.insights ?? [];
      if (!fresh.length) {
        toast.message("Nothing durable to learn yet — keep talking.");
        return;
      }
      const rows = fresh.map((i) => ({
        subject_name: i.subject,
        kind: i.kind,
        text: i.text,
        source_quote: i.source_quote,
        confidence: i.confidence,
      }));
      await rpc<null>("insights_add", { p_room: roomId, p_rows: rows });
      await load();
      toast.success(`Learned ${fresh.length} thing${fresh.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not learn anything");
    } finally {
      setLoading(false);
    }
  }, [buildRequest, load, roomId]);

  const forget = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await rpc<null>("insights_dismiss", { p_room: roomId, p_id: id });
    toast.message("Forgotten");
  }, [roomId]);

  return (
    <div className="px-2.5 py-2.5" data-testid="memory-panel">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <span className="eyebrow text-muted-foreground">{items.length} remembered</span>
        <Button
          size="sm"
          variant="outline"
          onClick={learn}
          disabled={loading}
          className="h-7 gap-1.5 rounded-none border-border"
          data-testid="memory-learn"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
          <span className="eyebrow">{loading ? "Reading…" : "Learn from session"}</span>
        </Button>
      </div>

      <ul className="mt-3 space-y-3.5" data-testid="memory-list">
        {items.map((i) => (
          <li key={i.id} className="border-l-2 border-primary pl-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="eyebrow text-muted-foreground">
                  {i.subject_name} · {i.kind} · {Math.round(i.confidence * 100)}%
                </div>
                <p className="mt-1 text-foreground" style={{ fontSize: "var(--step-0)" }}>{i.text}</p>
                <p className="mt-1.5 flex gap-1.5 italic text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
                  <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>“{i.source_quote}”</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => void forget(i.id)}
                title="Forget this"
                className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
        {!items.length && (
          <li className="italic text-muted-foreground" style={{ fontSize: "var(--step-0)" }}>
            Nothing remembered yet. Talk for a bit, then hit “Learn from session”.
          </li>
        )}
      </ul>
    </div>
  );
}
