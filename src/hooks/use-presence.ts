import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useRoomPresence — Supabase Realtime presence channel per room.
 * Tracks which participant ids currently have the room open.
 * Returns a Set<pid>. Empty until the channel has joined.
 */
export function useRoomPresence({
  roomId,
  selfPid,
}: {
  roomId: string | null | undefined;
  selfPid: string | null | undefined;
}) {
  const [present, setPresent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roomId || !selfPid) return;
    const channel = supabase.channel(`presence:room:${roomId}`, {
      config: { presence: { key: selfPid } },
    });

    const recompute = () => {
      const state = channel.presenceState<{ pid: string }>();
      const next = new Set<string>();
      for (const key of Object.keys(state)) {
        // The key is the pid we set below; also inspect payload for safety.
        next.add(key);
        for (const meta of state[key]) if (meta.pid) next.add(meta.pid);
      }
      setPresent(next);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ pid: selfPid, at: Date.now() });
        }
      });

    return () => {
      void channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [roomId, selfPid]);

  return present;
}
