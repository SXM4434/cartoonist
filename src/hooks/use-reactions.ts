import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Reaction = {
  id: string;
  pid: string;
  name: string;
  color: string;
  emoji: string;
  nx: number; // 0..1 relative to canvas stage
  ny: number;
  ts: number;
};

/**
 * useReactions — lightweight ephemeral emoji reactions broadcast over a
 * Supabase Realtime channel. No persistence: each burst lives ~2.4s in
 * client state, then GCs itself. Loop-safe (self=false).
 */
export function useReactions({
  roomId,
  selfPid,
  selfName,
  selfColor,
}: {
  roomId: string | null | undefined;
  selfPid: string | null | undefined;
  selfName: string | undefined;
  selfColor: string | undefined;
}) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`reactions:room:${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "burst" }, ({ payload }) => {
        const r = payload as Reaction;
        if (!r?.pid || r.pid === selfPid) return;
        setReactions((prev) => [...prev, r].slice(-40));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, selfPid]);

  // GC old bursts (> 2.6s).
  useEffect(() => {
    const t = window.setInterval(() => {
      const now = Date.now();
      setReactions((prev) => {
        const kept = prev.filter((r) => now - r.ts < 2600);
        return kept.length === prev.length ? prev : kept;
      });
    }, 700);
    return () => window.clearInterval(t);
  }, []);

  const send = useCallback(
    (emoji: string, nx: number, ny: number) => {
      const pid = selfPid ?? "guest";
      const name = selfName || "Guest";
      const color = selfColor || "#E07A3E";
      const r: Reaction = {
        id: `${pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pid,
        name,
        color,
        emoji,
        nx,
        ny,
        ts: Date.now(),
      };
      // Show locally first (works even before selfPid resolves).
      setReactions((prev) => [...prev, r].slice(-40));
      const ch = channelRef.current;
      if (ch && selfPid) ch.send({ type: "broadcast", event: "burst", payload: r });
    },
    [selfPid, selfName, selfColor],
  );

  return { reactions, send };
}
