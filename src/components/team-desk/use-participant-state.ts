import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ParticipantMode = "speaking" | "typing" | "sketching" | "quiet";

/**
 * Ephemeral per-participant live state. Subscribes to transcript_chunks and
 * canvas_events; the local speaker (selfPid) can be marked speaking directly
 * from the useSpeech listening flag. Never persisted — replay rebuilds from events.
 */
export function useParticipantState(opts: {
  roomId: string;
  selfPid: string | null;
  selfSpeaking: boolean;
  selfTyping: boolean;
}) {
  const { roomId, selfPid, selfSpeaking, selfTyping } = opts;
  const [lastActivity, setLastActivity] = useState<Record<string, { at: number; kind: ParticipantMode }>>({});
  const nowTick = useNowTick(1000);

  const bumpRef = useRef((pid: string, kind: ParticipantMode) => {
    setLastActivity((prev) => ({ ...prev, [pid]: { at: Date.now(), kind } }));
  });

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase
      .channel(`team-desk:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transcript_chunks", filter: `room_id=eq.${roomId}` },
        (payload: { new: { participant_id: string | null; source: string | null } }) => {
          const pid = payload.new.participant_id;
          if (!pid) return;
          const src = (payload.new.source ?? "voice") as string;
          bumpRef.current(pid, src === "chat" ? "typing" : "speaking");
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "canvas_events", filter: `room_id=eq.${roomId}` },
        (payload: { new: { op: unknown } }) => {
          const op = payload.new.op as { source?: string; participant_id?: string } | null;
          if (op && op.source === "user" && op.participant_id) {
            bumpRef.current(op.participant_id, "sketching");
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  // Self overrides: browser knows instantly.
  useEffect(() => {
    if (!selfPid) return;
    if (selfSpeaking) bumpRef.current(selfPid, "speaking");
  }, [selfPid, selfSpeaking]);
  useEffect(() => {
    if (!selfPid) return;
    if (selfTyping) bumpRef.current(selfPid, "typing");
  }, [selfPid, selfTyping]);

  const modeFor = (pid: string): ParticipantMode => {
    const entry = lastActivity[pid];
    if (!entry) return "quiet";
    const age = nowTick - entry.at;
    // fade windows: speaking 3s, sketching 5s, typing 5s
    const window = entry.kind === "speaking" ? 3000 : 5000;
    return age < window ? entry.kind : "quiet";
  };
  return { modeFor };
}

function useNowTick(interval: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
