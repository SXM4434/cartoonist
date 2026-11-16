import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadSessions, type StoredSession } from "@/lib/profile";
import { roomsByIds, rpc, sessionStats } from "@/lib/db-rpc";

export type SessionStats = {
  participants: number;
  shapes: number;
  messages: number;
  lastActivity: number | null;
};

export type WorkspaceSession = StoredSession & {
  goalFromDb?: string | null;
  endedAt?: string | null;
  stats: SessionStats;
};

const EMPTY: SessionStats = { participants: 0, shapes: 0, messages: 0, lastActivity: null };

type TeamRoom = { id: string; name: string; goal: string | null; outputs: string[] | null; join_code: string | null; ended_at: string | null; created_at: string };

/** Load team meetings from membership-scoped database rows, then add valid local rooms. */
export function useWorkspaceSessions() {
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const local = loadSessions();
    const ids = local.map((s) => s.roomId).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    const { data: auth } = await supabase.auth.getUser();
    const [rooms, teamRooms] = await Promise.all([
      ids.length ? roomsByIds(ids) : Promise.resolve([]),
      auth.user ? rpc<TeamRoom[]>("workspace_rooms") : Promise.resolve([]),
    ]);
    const allowedLocal = new Map((rooms ?? []).map((r) => [r.id, r]));
    const combined = new Map<string, WorkspaceSession>();
    for (const room of teamRooms ?? []) {
      combined.set(room.id, {
        roomId: room.id, joinCode: room.join_code ?? "", name: room.name,
        goal: room.goal ?? "", outputs: room.outputs ?? [],
        createdAt: new Date(room.created_at).getTime(),
        goalFromDb: room.goal, endedAt: room.ended_at, stats: { ...EMPTY },
      });
    }
    for (const stored of local) {
      const room = allowedLocal.get(stored.roomId);
      if (!room || combined.has(stored.roomId)) continue;
      combined.set(stored.roomId, {
        ...stored, name: room.name, joinCode: room.join_code ?? stored.joinCode,
        goalFromDb: room.goal, endedAt: room.ended_at, stats: { ...EMPTY },
      });
    }
    const sessionIds = [...combined.keys()];
    const rows = sessionIds.length ? await sessionStats(sessionIds) : [];

    const stats = new Map<string, SessionStats>();
    (rows ?? []).forEach((r) => {
      stats.set(r.room_id, {
        participants: Number(r.participants ?? 0),
        shapes: Number(r.shapes ?? 0),
        messages: Number(r.messages ?? 0),
        lastActivity: r.last_activity ? new Date(r.last_activity).getTime() : null,
      });
    });

    setSessions([...combined.values()].map((s) => ({ ...s, stats: stats.get(s.roomId) ?? { ...EMPTY } })));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, loading, refresh };
}

export function relativeTime(ts: number | null): string {
  if (!ts) return "no activity yet";
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "live just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
