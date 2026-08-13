import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, Loader2, Quote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
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

export function KnownAboutYou({ roomId, buildRequest }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StoredInsight[]>([]);

  const load = useCallback(async () => {
    const data = await rpc<StoredInsight[]>("insights_list", { p_room: roomId });
    setItems(data ?? []);
  }, [roomId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-none border-border" data-testid="memory-trigger">
          <Brain className="h-3.5 w-3.5" /><span className="eyebrow">Memory</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90vw] overflow-y-auto sm:max-w-xl" data-testid="memory-sheet">
        <SheetHeader>
          <SheetTitle className="font-serif" style={{ fontSize: "var(--step-3)" }}>
            What Cartoonist thinks it knows
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between border-y border-border py-2">
          <span className="eyebrow text-muted-foreground">{items.length} remembered</span>
          <Button
            size="sm"
            variant="outline"
            onClick={learn}
            disabled={loading}
            className="h-8 gap-1.5 rounded-none border-border"
            data-testid="memory-learn"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
            <span className="eyebrow">{loading ? "Reading…" : "Learn from this session"}</span>
          </Button>
        </div>

        <ul className="mt-4 space-y-4" data-testid="memory-list">
          {items.map((i) => (
            <li key={i.id} className="border-l-2 border-primary pl-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="eyebrow text-muted-foreground">
                    {i.subject_name} · {i.kind} · {Math.round(i.confidence * 100)}%
                  </div>
                  <p className="mt-1 text-foreground" style={{ fontSize: "var(--step-1)" }}>{i.text}</p>
                  <p className="mt-1.5 flex gap-1.5 text-muted-foreground italic" style={{ fontSize: "var(--step-0)" }}>
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
            <li className="text-muted-foreground italic" style={{ fontSize: "var(--step-1)" }}>
              Nothing remembered yet. Talk for a bit, then hit “Learn from this session”.
            </li>
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
