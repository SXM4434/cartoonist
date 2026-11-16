import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Phase 3.1 — Devil's Advocate agent (client side).
 *
 * Watches the running transcript and asks the server agent for the risks,
 * gaps and assumptions the room is skating past. Throttled the same way the
 * live-artifact drafter is: never more than once per `minIntervalMs`, and only
 * after enough new speech has landed to change the answer. Ephemeral — replay
 * rebuilds from the transcript.
 */

export type Risk = {
  id: string;
  kind: "risk" | "gap" | "assumption" | "question";
  text: string;
  source_quote: string;
  severity: number;
  at: number;
  pinned?: boolean;
};

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function useDevilsAdvocate(opts: {
  roomId: string;
  transcript: string;
  memoryBlock?: string;
  enabled?: boolean;
  minNewChars?: number;
  minIntervalMs?: number;
}) {
  const { roomId, transcript, memoryBlock, enabled = true, minNewChars = 600, minIntervalMs = 75_000 } = opts;

  const [risks, setRisks] = useState<Risk[]>([]);
  const [thinking, setThinking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const memoryRef = useRef(memoryBlock);
  memoryRef.current = memoryBlock;
  const risksRef = useRef<Risk[]>([]);
  risksRef.current = risks;
  const coveredRef = useRef(0);
  const lastRunRef = useRef(0);
  const busyRef = useRef(false);

  const checkNow = useCallback(async () => {
    const text = transcriptRef.current.trim();
    if (busyRef.current || text.length < 200) return;
    busyRef.current = true;
    lastRunRef.current = Date.now();
    coveredRef.current = text.length;
    setThinking(true);
    try {
      const res = await fetch("/api/devils-advocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          transcript: text,
          memoryBlock: memoryRef.current,
          known: risksRef.current.slice(-12).map((r) => r.text),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const incoming = Array.isArray(data?.risks) ? (data.risks as Omit<Risk, "id" | "at">[]) : [];
      if (incoming.length) {
        setRisks((current) => {
          const seen = new Set(current.map((r) => normKey(r.text)));
          const fresh = incoming
            .filter((r) => r?.text && !seen.has(normKey(r.text)))
            .map((r) => ({ ...r, id: crypto.randomUUID().slice(0, 8), at: Date.now() }) as Risk);
          return fresh.length ? [...current, ...fresh].slice(-24) : current;
        });
      }
      setCheckedAt(Date.now());
    } catch {
      /* silent — this agent is advisory */
    } finally {
      busyRef.current = false;
      setThinking(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      const text = transcriptRef.current.trim();
      if (text.length - coveredRef.current < minNewChars) return;
      if (Date.now() - lastRunRef.current < minIntervalMs) return;
      void checkNow();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [enabled, checkNow, minNewChars, minIntervalMs]);

  const dismiss = useCallback((id: string) => {
    setRisks((current) => current.filter((r) => r.id !== id));
  }, []);

  const markPinned = useCallback((id: string) => {
    setRisks((current) => current.map((r) => (r.id === id ? { ...r, pinned: true } : r)));
  }, []);

  return { risks, thinking, checkedAt, checkNow, dismiss, markPinned };
}
