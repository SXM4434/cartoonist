import { useCallback, useEffect, useRef, useState } from "react";
import { eventKey, runAgentEvent } from "@/lib/agent-events";
import { listAgentEvents, meetingEventStore } from "@/lib/agent-event-store";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAgentEvents(roomId).then(rows => {
      if (!active) return;
      const saved = rows.filter(row => row.agent === "advocate");
      const risks = saved.filter(row => row.status === "completed").flatMap(row => {
        const result = row.result as { risks?: Risk[] } | null;
        return Array.isArray(result?.risks) ? result.risks : [];
      });
      setRisks(risks.slice(-24));
      setError(saved.find(row => row.status === "failed")?.error ?? null);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load agent events."); });
    return () => { active = false; };
  }, [roomId]);

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
      const event = await runAgentEvent(meetingEventStore(roomId, "advocate"), eventKey("advocate", roomId, text), async () => {
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
        if (!res.ok) throw new Error(data?.error ?? "Could not check risks.");
        const raw = Array.isArray(data?.risks) ? data.risks as Omit<Risk, "id" | "at">[] : [];
        return { risks: raw.map(r => ({ ...r, id: crypto.randomUUID().slice(0, 8), at: Date.now() })) };
      });
      if (event.status === "failed") { setError(event.error ?? "Could not check risks."); return; }
      if (event.status === "running") return;
      setError(null);
      const data = event.result;
      const incoming = Array.isArray(data?.risks) ? data.risks : [];
      if (incoming.length) {
        setRisks((current) => {
          const seen = new Set(current.map((r) => normKey(r.text)));
          const fresh = incoming
            .filter((r) => r?.text && !seen.has(normKey(r.text)))
            .map((r) => r as Risk);
          return fresh.length ? [...current, ...fresh].slice(-24) : current;
        });
      }
      setCheckedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save agent event.");
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

  return { risks, thinking, checkedAt, error, checkNow, dismiss, markPinned };
}
