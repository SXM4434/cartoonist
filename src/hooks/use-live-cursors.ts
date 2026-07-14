import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RemoteCursor = {
  pid: string;
  name: string;
  color: string;
  // Normalized 0..1 coordinates relative to the shared canvas container.
  nx: number;
  ny: number;
  ts: number;
};

/**
 * useLiveCursors — broadcasts self pointer position over a Supabase Realtime
 * channel and returns other participants' latest positions.
 *
 * Coordinates are normalized 0..1 against `containerRef` so viewers with
 * different viewport sizes still get a roughly-correct pointer location.
 */
export function useLiveCursors({
  roomId,
  selfPid,
  selfName,
  selfColor,
  containerRef,
}: {
  roomId: string | null | undefined;
  selfPid: string | null | undefined;
  selfName: string | undefined;
  selfColor: string | undefined;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!roomId || !selfPid) return;
    const channel = supabase.channel(`cursors:room:${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const c = payload as RemoteCursor;
        if (!c?.pid || c.pid === selfPid) return;
        setCursors((prev) => ({ ...prev, [c.pid]: c }));
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        const pid = (payload as { pid?: string })?.pid;
        if (!pid) return;
        setCursors((prev) => {
          const { [pid]: _, ...rest } = prev;
          return rest;
        });
      })
      .subscribe();

    // Sweep stale cursors (nothing received for >6s).
    const sweep = window.setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        let changed = false;
        const next: Record<string, RemoteCursor> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 6000) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      window.clearInterval(sweep);
      try { channel.send({ type: "broadcast", event: "leave", payload: { pid: selfPid } }); } catch {}
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, selfPid]);

  useEffect(() => {
    if (!roomId || !selfPid || !selfName || !selfColor) return;
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastSentRef.current < 55) return; // ~18 Hz
      lastSentRef.current = now;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
      const ch = channelRef.current;
      if (!ch) return;
      ch.send({
        type: "broadcast",
        event: "move",
        payload: { pid: selfPid, name: selfName, color: selfColor, nx, ny, ts: Date.now() } satisfies RemoteCursor,
      });
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    return () => el.removeEventListener("pointermove", onMove);
  }, [roomId, selfPid, selfName, selfColor, containerRef]);

  return cursors;
}
