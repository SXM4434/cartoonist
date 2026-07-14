import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * useSharedFocus — when the local user clicks a thread (or any UI that
 * dispatches `cartoonist:focus`), rebroadcast that focus to every other
 * peer in the room via a Supabase Realtime broadcast channel. Peers
 * receive the payload, dispatch the same window event so their canvas
 * zooms to the same shapes, and get a small "Name pointed here" toast.
 *
 * Loop-safe: incoming events are marked `remote: true` and skipped by
 * the outgoing listener.
 */
export function useSharedFocus({
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!roomId || !selfPid) return;
    const channel = supabase.channel(`focus:room:${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "focus" }, ({ payload }) => {
        const p = payload as { pid?: string; name?: string; color?: string; ids?: string[] };
        if (!p?.ids?.length || !p.pid || p.pid === selfPid) return;
        applyingRemoteRef.current = true;
        try {
          window.dispatchEvent(new CustomEvent("cartoonist:focus", { detail: { ids: p.ids, remote: true } }));
        } finally {
          // Reset on next tick so our outbound listener sees a clean slate.
          setTimeout(() => { applyingRemoteRef.current = false; }, 50);
        }
        const label = p.name?.trim() || "Someone";
        toast(`${label} pointed here`, {
          duration: 2400,
          style: p.color ? { borderLeft: `3px solid ${p.color}` } : undefined,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, selfPid]);

  useEffect(() => {
    if (!roomId || !selfPid) return;
    const onFocus = (e: Event) => {
      if (applyingRemoteRef.current) return;
      const detail = (e as CustomEvent<{ ids?: string[]; remote?: boolean }>).detail;
      if (!detail || detail.remote) return;
      const ids = detail.ids ?? [];
      if (!ids.length) return;
      const ch = channelRef.current;
      if (!ch) return;
      ch.send({
        type: "broadcast",
        event: "focus",
        payload: { pid: selfPid, name: selfName, color: selfColor, ids },
      });
    };
    window.addEventListener("cartoonist:focus", onFocus as EventListener);
    return () => window.removeEventListener("cartoonist:focus", onFocus as EventListener);
  }, [roomId, selfPid, selfName, selfColor]);
}
