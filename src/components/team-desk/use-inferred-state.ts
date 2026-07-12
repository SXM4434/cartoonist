import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * v2.P2 — Live state inference.
 *
 * Watches transcript_chunks for a room and derives, per participant, a coarse
 * focus label plus an "unresolved point" the mediator can surface. Fully
 * client-side + heuristic — no LLM, no persistence. Replay rebuilds from
 * transcript_chunks so this hook stays ephemeral.
 *
 * Focus labels:
 *   engaged           → spoke in the last 60s.
 *   quiet-too-long    → hasn't spoken in >3 min while others are active.
 *   repeated-ask      → same participant said 3+ consecutive chunks with no
 *                       reply from anyone else in between.
 *   unresolved-thread → participant asked a question (chunk ends in "?" or
 *                       contains a clear ask) and >=5 chunks from others have
 *                       passed without touching the same topic keywords.
 *   idle              → default / room hasn't started yet.
 */

export type FocusLabel =
  | "engaged"
  | "quiet-too-long"
  | "repeated-ask"
  | "unresolved-thread"
  | "idle";

export type InferredState = {
  pid: string;
  focus: FocusLabel;
  last_ms: number; // age in ms since this participant last spoke; Infinity if never
  unresolved_point?: string; // short quote of the unanswered question
};

type Chunk = {
  id: string;
  participant_id: string | null;
  text: string;
  created_at: string;
  source: string;
};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes of context
const QUIET_MS = 3 * 60 * 1000; // 3 min without speaking → quiet-too-long
const ENGAGED_MS = 60 * 1000; // 60s recency → engaged
const UNRESOLVED_GAP = 5; // chunks from others without touching topic

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","of","to","in","on","for","is","are","was","were","be","been","being","it","this","that","these","those","i","you","we","they","he","she","them","us","our","your","my","me","him","her","his","hers","its","as","at","by","with","from","so","just","really","kind","sort","like","yeah","ok","okay","um","uh","hmm","right","well","think","thing","things","stuff",
]);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.endsWith("?")) return true;
  return /\b(what|why|how|when|where|who|should we|can we|could we|do we|does anyone|thoughts|any ideas|shall we)\b/i.test(t);
}

export function useInferredState(opts: {
  roomId: string;
  participantIds: string[];
}): Record<string, InferredState> {
  const { roomId, participantIds } = opts;
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [tick, setTick] = useState(0);
  const seen = useRef<Set<string>>(new Set());

  // Load recent window on mount / room change.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const { data } = await supabase
        .from("transcript_chunks")
        .select("id,participant_id,text,created_at,source")
        .eq("room_id", roomId)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(400);
      if (cancelled) return;
      const rows = (data ?? []) as Chunk[];
      seen.current = new Set(rows.map((r) => r.id));
      setChunks(rows);
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // Subscribe to new chunks.
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`inferred-state:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transcript_chunks", filter: `room_id=eq.${roomId}` },
        (payload: { new: Chunk }) => {
          const row = payload.new;
          if (!row?.id || seen.current.has(row.id)) return;
          seen.current.add(row.id);
          setChunks((prev) => {
            const cutoff = Date.now() - WINDOW_MS;
            const kept = prev.filter((c) => new Date(c.created_at).getTime() >= cutoff);
            return [...kept, row];
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [roomId]);

  // Re-evaluate every 5s so time-based labels (quiet-too-long) update.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    void tick; // dep only
    const now = Date.now();
    const out: Record<string, InferredState> = {};

    // Base: last utterance per participant.
    const lastAtByPid: Record<string, number> = {};
    for (const c of chunks) {
      if (!c.participant_id) continue;
      const t = new Date(c.created_at).getTime();
      const prev = lastAtByPid[c.participant_id];
      if (prev === undefined || t > prev) lastAtByPid[c.participant_id] = t;
    }

    // Detect repeated-ask: consecutive tail chunks from same speaker.
    const consecutiveTailPid = (() => {
      let count = 0;
      let pid: string | null = null;
      for (let i = chunks.length - 1; i >= 0; i--) {
        const c = chunks[i];
        if (!c.participant_id) break;
        if (pid === null) { pid = c.participant_id; count = 1; continue; }
        if (c.participant_id === pid) count++;
        else break;
      }
      return pid && count >= 3 ? pid : null;
    })();

    // Detect unresolved: latest question by each participant with no topic
    // response in the following UNRESOLVED_GAP chunks from others.
    const unresolvedByPid: Record<string, string> = {};
    for (let i = 0; i < chunks.length; i++) {
      const q = chunks[i];
      if (!q.participant_id || !looksLikeQuestion(q.text)) continue;
      const kws = keywords(q.text);
      if (kws.length === 0) continue;
      const responders = chunks.slice(i + 1).filter((c) => c.participant_id && c.participant_id !== q.participant_id);
      if (responders.length < UNRESOLVED_GAP) continue; // not enough time to say
      const answered = responders.slice(0, UNRESOLVED_GAP).some((c) => {
        const rk = new Set(keywords(c.text));
        return kws.some((k) => rk.has(k));
      });
      if (!answered) {
        unresolvedByPid[q.participant_id] = q.text.trim().slice(0, 140);
      }
    }

    const someoneActive = Object.values(lastAtByPid).some((t) => now - t < ENGAGED_MS);

    for (const pid of participantIds) {
      const lastAt = lastAtByPid[pid];
      const lastMs = lastAt === undefined ? Infinity : now - lastAt;
      let focus: FocusLabel = "idle";
      if (lastMs < ENGAGED_MS) focus = "engaged";
      else if (someoneActive && lastMs > QUIET_MS) focus = "quiet-too-long";
      if (consecutiveTailPid === pid) focus = "repeated-ask";
      if (unresolvedByPid[pid]) focus = "unresolved-thread";
      const state: InferredState = { pid, focus, last_ms: lastMs };
      if (unresolvedByPid[pid]) state.unresolved_point = unresolvedByPid[pid];
      out[pid] = state;
    }
    return out;
  }, [chunks, participantIds, tick]);
}
