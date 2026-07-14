import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Hand = {
  pid: string;
  name: string;
  color: string;
  ts: number;
};

/**
 * useHandQueue — a shared "raise hand" queue for the room. Anyone can
 * raise or lower their hand; every peer sees the same ordered queue.
 * Ephemeral: state lives in each client, kept in sync via Realtime
 * broadcast. Auto-lowers after 60s so stale hands don't linger.
 */
export function useHandQueue({
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
  const [queue, setQueue] = useState<Hand[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isRaised = !!selfPid && queue.some((h) => h.pid === selfPid);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`hands:room:${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;
    channel
      .on("broadcast", { event: "raise" }, ({ payload }) => {
        const h = payload as Hand;
        if (!h?.pid) return;
        setQueue((prev) =>
          prev.some((x) => x.pid === h.pid) ? prev : [...prev, h],
        );
      })
      .on("broadcast", { event: "lower" }, ({ payload }) => {
        const { pid } = payload as { pid: string };
        if (!pid) return;
        setQueue((prev) => prev.filter((x) => x.pid !== pid));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId]);

  // Auto-lower after 60s so forgotten hands don't linger.
  useEffect(() => {
    const t = window.setInterval(() => {
      const cutoff = Date.now() - 60_000;
      setQueue((prev) => {
        const kept = prev.filter((h) => h.ts > cutoff);
        return kept.length === prev.length ? prev : kept;
      });
    }, 3000);
    return () => window.clearInterval(t);
  }, []);

  const raise = useCallback(() => {
    if (!selfPid) return;
    const h: Hand = {
      pid: selfPid,
      name: selfName || "Guest",
      color: selfColor || "#E07A3E",
      ts: Date.now(),
    };
    setQueue((prev) => (prev.some((x) => x.pid === h.pid) ? prev : [...prev, h]));
    channelRef.current?.send({ type: "broadcast", event: "raise", payload: h });
  }, [selfPid, selfName, selfColor]);

  const lower = useCallback(
    (pid?: string) => {
      const target = pid ?? selfPid;
      if (!target) return;
      setQueue((prev) => prev.filter((x) => x.pid !== target));
      channelRef.current?.send({ type: "broadcast", event: "lower", payload: { pid: target } });
    },
    [selfPid],
  );

  const toggle = useCallback(() => {
    if (isRaised) lower();
    else raise();
  }, [isRaised, raise, lower]);

  return { queue, isRaised, raise, lower, toggle };
}
