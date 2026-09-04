import { useCallback, useRef, useState } from "react";

/**
 * Phase 3.3 — Historian recall (client side).
 * Asks the session what it already said. Answers are grounded: the server
 * drops any quote that isn't a verbatim substring of the transcript, so an
 * empty quote list means "nobody said that".
 */

export type RecallQuote = { text: string; speaker: string };

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

  const transcriptRef = useRef(opts.transcript);
  transcriptRef.current = opts.transcript;
  const memoryRef = useRef(opts.memoryBlock);
  memoryRef.current = opts.memoryBlock;

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || asking) return;
      setAsking(true);
      try {
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
        const entry: RecallEntry = {
          id: crypto.randomUUID().slice(0, 8),
          question: q,
          answer: typeof data?.answer === "string" ? data.answer : (data?.error ?? "Could not search the session."),
          quotes: Array.isArray(data?.quotes) ? (data.quotes as RecallQuote[]) : [],
          at: Date.now(),
        };
        setEntries((current) => [entry, ...current].slice(0, 12));
      } catch {
        /* recall is advisory — never block the room */
      } finally {
        setAsking(false);
      }
    },
    [roomId, asking],
  );

  const clear = useCallback(() => setEntries([]), []);

  return { entries, asking, ask, clear };
}
