import { useState } from "react";
import { Pin, Search } from "lucide-react";
import type { RecallEntry } from "@/hooks/use-historian";

/**
 * Phase 3.3 — Historian surface.
 * Ask the session what it already said. Every answer shows the exact words it
 * came from, and any answer can be pinned back onto the canvas as a callback.
 */
export function RecallPanel({
  entries,
  asking,
  onAsk,
  onPin,
}: {
  entries: RecallEntry[];
  asking: boolean;
  onAsk: (question: string) => void;
  onPin: (entry: RecallEntry) => void;
}) {
  const [q, setQ] = useState("");

  const submit = () => {
    if (!q.trim() || asking) return;
    onAsk(q);
    setQ("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="What did we say about pricing?"
          className="h-7 min-w-0 flex-1 border border-border bg-background px-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={submit}
          disabled={asking || !q.trim()}
          title="Search the session"
          className="flex h-7 items-center gap-1 border border-border px-1.5 text-muted-foreground transition hover:bg-foreground hover:text-background active:scale-[0.98] disabled:opacity-40"
        >
          <Search className={`h-3 w-3 ${asking ? "animate-pulse" : ""}`} />
          <span className="eyebrow">Recall</span>
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="px-2.5 py-4 text-[13px] leading-[1.5] text-muted-foreground">
          Ask about anything already said in this session. Answers only come back with the exact words behind them.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-border px-2.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="eyebrow text-muted-foreground">{e.question}</span>
                <button
                  type="button"
                  onClick={() => onPin(e)}
                  disabled={e.quotes.length === 0}
                  title="Pin the recall to the canvas"
                  className="flex h-6 w-6 shrink-0 items-center justify-center border border-border text-muted-foreground transition hover:bg-foreground hover:text-background active:scale-[0.98] disabled:opacity-40"
                >
                  <Pin className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-1 text-[15px] leading-[1.5] text-foreground">{e.answer}</p>
              {e.quotes.map((quote, i) => (
                <p key={i} className="mt-1 border-l-2 border-border pl-2 text-[13px] leading-[1.5] text-muted-foreground">
                  {quote.speaker ? <span className="text-foreground">{quote.speaker}: </span> : null}
                  “{quote.text}”
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
