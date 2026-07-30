// v2.P6 — cross-session canvas memory.
// Builds a lightweight index of threads drawn in the workspace's OTHER rooms,
// then scores each new utterance against it. When today's talk echoes an older
// session, we surface a "ghost" callback and persist a typed edge in
// public.canvas_relations. Heuristic on purpose: no LLM call, no latency added
// to the draw loop, and every hit carries provenance (room + thread + text).
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MemoryEntry = {
  roomId: string;
  roomName: string;
  threadId: string;
  text: string;
  modality: string | null;
  at: number;
  tokens: Set<string>;
};

export type MemoryHit = {
  roomId: string;
  roomName: string;
  threadId: string;
  text: string;
  modality: string | null;
  at: number;
  score: number;
  relation: "references" | "extends" | "contradicts" | "resolves";
};

const STOP = new Set(
  ("the a an and or but so if then than that this these those with without for from into onto about over under" +
    " we you they i it he she them us our your their is are was were be been being do does did done have has had" +
    " can could should would will just like really very much more most some any all each every no not yow yeah" +
    " okay ok gonna wanna kinda sorta thing things stuff know think mean say said talk talking let lets make made" +
    " draw drawing show me up out on in to of as at by")
    .split(/\s+/)
    .filter(Boolean),
);

function tokenize(s: string): Set<string> {
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^-+|-+$/g, ""))
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

function pickRelation(text: string): MemoryHit["relation"] {
  const t = text.toLowerCase();
  if (/\b(actually|instead|no longer|changed my mind|disagree|wrong|scrap|opposite)\b/.test(t)) return "contradicts";
  if (/\b(settled|decided|locked|final|resolved|done with)\b/.test(t)) return "resolves";
  if (/\b(also|plus|on top of|extend|build on|another)\b/.test(t)) return "extends";
  return "references";
}

export function useCrossSessionMemory(roomId: string) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [echoes, setEchoes] = useState<MemoryHit[]>([]);
  const [peek, setPeek] = useState<MemoryHit | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const peekTimer = useRef<number | null>(null);

  // Index prior sessions once per room.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: rooms }, { data: events }] = await Promise.all([
        supabase.from("rooms").select("id,name").limit(200),
        supabase
          .from("canvas_events")
          .select("room_id,thread_id,transcript_span,created_at")
          .neq("room_id", roomId)
          .not("thread_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1200),
      ]);
      if (cancelled || !events?.length) return;
      const names = new Map((rooms ?? []).map((r) => [r.id as string, (r.name as string) || "Earlier session"]));
      const byThread = new Map<string, MemoryEntry>();
      for (const row of events as Array<{ room_id: string; thread_id: string | null; transcript_span: unknown; created_at: string }>) {
        const tid = row.thread_id;
        if (!tid || byThread.has(tid)) continue;
        const span = (row.transcript_span ?? {}) as { latest?: string; modality?: string | null; goal?: string | null };
        const text = (span.latest ?? span.goal ?? "").trim();
        if (text.length < 12) continue;
        const tokens = tokenize(text);
        if (tokens.size < 2) continue;
        byThread.set(tid, {
          roomId: row.room_id,
          roomName: names.get(row.room_id) ?? "Earlier session",
          threadId: tid,
          text,
          modality: span.modality ?? null,
          at: new Date(row.created_at).getTime(),
          tokens,
        });
      }
      if (!cancelled) setEntries(Array.from(byThread.values()));
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Also load edges we already recorded for this room (so a reload keeps them).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("canvas_relations")
        .select("to_room_id,to_thread_id,relation,confidence,reason,created_at")
        .eq("from_room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled || !data?.length) return;
      setEchoes(
        data.map((r) => ({
          roomId: r.to_room_id as string,
          roomName: "Earlier session",
          threadId: r.to_thread_id as string,
          text: (r.reason as string) ?? "",
          modality: null,
          at: new Date(r.created_at as string).getTime(),
          score: Number(r.confidence ?? 0.5),
          relation: (r.relation as MemoryHit["relation"]) ?? "references",
        })),
      );
      data.forEach((r) => seen.current.add(r.to_thread_id as string));
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  /** Score an utterance against prior sessions. Returns the best hit or null. */
  const recall = useCallback(
    (utterance: string): MemoryHit | null => {
      const tokens = tokenize(utterance);
      if (tokens.size < 2 || entries.length === 0) return null;
      let best: MemoryHit | null = null;
      for (const e of entries) {
        if (seen.current.has(e.threadId)) continue;
        let shared = 0;
        for (const t of tokens) if (e.tokens.has(t)) shared += 1;
        if (shared < 2) continue;
        const score = shared / Math.sqrt(tokens.size * e.tokens.size);
        if (score < 0.28) continue;
        if (!best || score > best.score) {
          best = {
            roomId: e.roomId,
            roomName: e.roomName,
            threadId: e.threadId,
            text: e.text,
            modality: e.modality,
            at: e.at,
            score: Number(score.toFixed(2)),
            relation: pickRelation(utterance),
          };
        }
      }
      return best;
    },
    [entries],
  );

  /** Persist the edge + surface the ghost callback in the room. */
  const record = useCallback(
    async (hit: MemoryHit, fromThreadId: string) => {
      if (seen.current.has(hit.threadId)) return;
      seen.current.add(hit.threadId);
      setEchoes((prev) => [hit, ...prev].slice(0, 20));
      setPeek(hit);
      if (peekTimer.current) window.clearTimeout(peekTimer.current);
      peekTimer.current = window.setTimeout(() => setPeek(null), 7000);
      await supabase.from("canvas_relations").insert({
        from_room_id: roomId,
        from_thread_id: fromThreadId,
        to_room_id: hit.roomId,
        to_thread_id: hit.threadId,
        relation: hit.relation,
        confidence: hit.score,
        reason: hit.text.slice(0, 240),
      });
    },
    [roomId],
  );

  const dismissPeek = useCallback(() => setPeek(null), []);

  return { indexed: entries.length, echoes, peek, recall, record, dismissPeek };
}
