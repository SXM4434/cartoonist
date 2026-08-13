import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type RecapDecision = { text: string; attribution: string | null };
export type RecapAction = { text: string; owner: string | null; due: string | null };
export type RecapQuestion = { text: string; raisedBy: string | null };
export type RecapPayload = {
  summary: string;
  decisions: RecapDecision[];
  actions: RecapAction[];
  openQuestions: RecapQuestion[];
  nextSteps: string;
};

type Props = {
  roomId: string;
  buildRequest: () => {
    transcript: string;
    canvasSummary: string;
    sessionContext: { name?: string; goal?: string; outputs?: string[] } | null;
    participants: Array<{ name: string; role?: string | null }>;
  };
};

export function SessionRecap({ roomId, buildRequest }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recap, setRecap] = useState<RecapPayload | null>(null);

  const run = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setRecap(null);
    try {
      const req = buildRequest();
      const res = await fetch("/api/session-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, ...req }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Recap failed");
      setRecap(data as RecapPayload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recap failed");
      setRecap(null);
    } finally {
      setLoading(false);
    }
  }, [buildRequest, roomId]);

  const copyMd = useCallback(async () => {
    if (!recap) return;
    const md = recapToMarkdown(recap);
    await navigator.clipboard.writeText(md);
    toast.success("Recap copied as markdown");
  }, [recap]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" onClick={run} className="h-8 gap-1.5 rounded-none border-border">
          <ClipboardList className="h-3.5 w-3.5" /><span className="eyebrow">Wrap up</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90vw] overflow-y-auto sm:max-w-2xl" data-testid="recap-sheet">
        <SheetHeader>
          <SheetTitle className="font-display" style={{ fontSize: "var(--step-3)" }}>Session recap</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the room…
            </div>
          )}

          {!loading && recap && (
            <>
              {recap.summary && (
                <section>
                  <div className="eyebrow mb-2 text-muted-foreground">Summary</div>
                  <p className="font-display text-foreground" style={{ fontSize: "var(--step-2)", lineHeight: 1.4 }}>
                    {recap.summary}
                  </p>
                </section>
              )}

              <Section title="Decisions" empty="No decisions landed yet." count={recap.decisions.length}>
                <ul className="space-y-3">
                  {recap.decisions.map((d, i) => (
                    <li key={i} className="border-l-2 border-primary pl-3">
                      <p className="text-foreground" style={{ fontSize: "var(--step-1)" }}>{d.text}</p>
                      {d.attribution && (
                        <p className="eyebrow mt-1 text-muted-foreground">— {d.attribution}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Actions" empty="No actions assigned." count={recap.actions.length}>
                <ul className="divide-y divide-border border-y border-border">
                  {recap.actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p className="text-foreground" style={{ fontSize: "var(--step-1)" }}>{a.text}</p>
                        <div className="mt-1 flex gap-3 eyebrow text-muted-foreground">
                          <span>Owner: {a.owner ?? "unassigned"}</span>
                          {a.due && <span>Due: {a.due}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Open questions" empty="Nothing left hanging." count={recap.openQuestions.length}>
                <ul className="space-y-2">
                  {recap.openQuestions.map((q, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary" style={{ fontSize: "var(--step-1)" }}>?</span>
                      <div className="flex-1">
                        <p className="text-foreground" style={{ fontSize: "var(--step-1)" }}>{q.text}</p>
                        {q.raisedBy && (
                          <p className="eyebrow mt-0.5 text-muted-foreground">raised by {q.raisedBy}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              {recap.nextSteps && (
                <section>
                  <div className="eyebrow mb-2 text-muted-foreground">Next</div>
                  <p className="text-foreground" style={{ fontSize: "var(--step-1)" }}>{recap.nextSteps}</p>
                </section>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={copyMd} className="h-8 gap-1.5 rounded-none border-border">
                  <Copy className="h-3.5 w-3.5" /><span className="eyebrow">Copy as markdown</span>
                </Button>
              </div>
            </>
          )}

          {!loading && !recap && (
            <p className="text-muted-foreground" style={{ fontSize: "var(--step-1)" }}>No recap yet.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="eyebrow text-muted-foreground">{title}</div>
        <div className="eyebrow text-muted-foreground/60">{count}</div>
      </div>
      {count === 0 ? (
        <p className="text-muted-foreground italic" style={{ fontSize: "var(--step-1)" }}>{empty}</p>
      ) : children}
    </section>
  );
}

function recapToMarkdown(r: RecapPayload): string {
  const lines: string[] = ["# Session recap", ""];
  if (r.summary) { lines.push(r.summary, ""); }
  if (r.decisions.length) {
    lines.push("## Decisions");
    for (const d of r.decisions) lines.push(`- ${d.text}${d.attribution ? ` _(${d.attribution})_` : ""}`);
    lines.push("");
  }
  if (r.actions.length) {
    lines.push("## Actions");
    for (const a of r.actions) lines.push(`- [ ] ${a.text} — **${a.owner ?? "unassigned"}**${a.due ? ` (due ${a.due})` : ""}`);
    lines.push("");
  }
  if (r.openQuestions.length) {
    lines.push("## Open questions");
    for (const q of r.openQuestions) lines.push(`- ${q.text}${q.raisedBy ? ` _(raised by ${q.raisedBy})_` : ""}`);
    lines.push("");
  }
  if (r.nextSteps) { lines.push("## Next", r.nextSteps); }
  return lines.join("\n");
}
