import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/db-rpc";
import { eventKey, runAgentEvent } from "@/lib/agent-events";
import { meetingEventStore } from "@/lib/agent-event-store";

/**
 * Phase 3.3 — Historian recall (client side).
 * Asks the session what it already said. Answers are grounded: the server
 * drops any quote that isn't a verbatim substring of the transcript, so an
 * empty quote list means "nobody said that".
 */

export type RecallQuote = { text: string; speaker: string; threadId?: string; shapeIds?: string[]; chunkId?: string };

export type RecallEntry = {
  id: string;
  question: string;
  answer: string;
  quotes: RecallQuote[];
  at: number;
};

export function useHistorian(opts: { roomId: string; transcript: string; memoryBlock?: string }) {
  const { roomId } = opts;
  const [entries, setEntries] = useState<RecallEntry[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setEntries([]);
    void rpc<Array<{ id: string; question: string; answer: string; quotes: RecallQuote[]; created_at: string }>>("recall_list", { p_room: roomId }).then(rows => {
      if (!cancelled && rows) setEntries(current => {
        const combined = [...current, ...rows.map(row => ({ ...row, at: new Date(row.created_at).getTime() }))];
        return [...new Map(combined.map(row => [row.id, row])).values()].sort((a, b) => b.at - a.at).slice(0, 50);
      });
    });
    return () => { cancelled = true; };
  }, [roomId]);

  const transcriptRef = useRef(opts.transcript);
  transcriptRef.current = opts.transcript;
  const memoryRef = useRef(opts.memoryBlock);
  memoryRef.current = opts.memoryBlock;

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || pending.current) return null;
      pending.current = true;
      setError(null);
      setAsking(true);
      try {
        const event = await runAgentEvent(meetingEventStore(roomId, "historian"), eventKey("historian", roomId, `${transcriptRef.current}:${q}`), async () => {
          const res = await fetch("/api/historian", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            question: q,
            transcript: transcriptRef.current,
            memoryBlock: memoryRef.current,
          }),
        });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error ?? "Could not search the session.");
          return data;
        });
        if (event.status === "failed") throw new Error(event.error ?? "Could not search the session.");
        if (event.status === "running") return null;
        const data = event.result as { id?: string; answer?: string; error?: string; quotes?: RecallQuote[]; at?: number };
        const entry: RecallEntry = {
          id: data.id ?? crypto.randomUUID(),
          question: q,
          answer: typeof data?.answer === "string" ? data.answer : (data?.error ?? "Could not search the session."),
          quotes: Array.isArray(data?.quotes) ? (data.quotes as RecallQuote[]) : [],
          at: data.at ?? Date.now(),
        };
        setEntries((current) => [entry, ...current].slice(0, 50));
        return entry;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not search the session.");
        return null;
      } finally {
        pending.current = false;
        setAsking(false);
      }
    },
    [roomId],
  );

  const clear = useCallback(() => setEntries([]), []);

  return { entries, asking, error, ask, clear };
}
