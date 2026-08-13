import { useCallback, useEffect, useRef, useState } from "react";

export type SessionMemory = {
  summary: string;
  topics: string[];
  decisions: string[];
  open_questions: string[];
  entities: string[];
};

const EMPTY: SessionMemory = { summary: "", topics: [], decisions: [], open_questions: [], entities: [] };

/**
 * v1 P2.2 — full-session memory.
 * Every 60s (and only when new speech has landed) the newest slice of the
 * transcript is folded into a rolling summary by a cheap model. The mediator
 * gets the whole session's state without paying for the whole transcript.
 */
export function useSessionMemory(roomId: string, finals: string[]) {
  const [memory, setMemory] = useState<SessionMemory>(EMPTY);
  const finalsRef = useRef<string[]>(finals);
  const coveredRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    finalsRef.current = finals;
  }, [finals]);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    const full = finalsRef.current.join(" ");
    if (full.length - coveredRef.current < 300) return;
    // Overlap a little so a sentence split across passes still makes sense.
    const slice = full.slice(Math.max(0, coveredRef.current - 200));
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/session-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, transcript: slice, charsCovered: full.length }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.memory?.summary) {
        setMemory({ ...EMPTY, ...data.memory });
        coveredRef.current = full.length;
      } else if (data?.skipped) {
        coveredRef.current = full.length;
      }
    } catch {
      /* memory is best-effort — never block the room */
    } finally {
      inFlightRef.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return memory;
}

/** Compact prompt block for the mediator. Empty string when there's nothing yet. */
export function sessionMemoryBlock(m: SessionMemory): string {
  if (!m.summary) return "";
  const line = (label: string, items: string[]) => (items.length ? `${label}: ${items.join(" | ")}\n` : "");
  return `# Session memory (everything so far — use for context, don't redraw it)
${m.summary}
${line("Topics", m.topics)}${line("Decided", m.decisions)}${line("Still open", m.open_questions)}${line("Named", m.entities)}
`;
}
