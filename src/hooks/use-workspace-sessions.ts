import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadSessions, type StoredSession } from "@/lib/profile";
import { roomsByIds, sessionStats } from "@/lib/db-rpc";

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

/**
 * Hydrates the locally-remembered session list with live counts from the
 * backend so the workspace home shows real weight, not just names.
 */
export function useWorkspaceSessions() {
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const local = loadSessions();
    if (local.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }
    // Show names instantly, hydrate stats after.
    setSessions(local.map((s) => ({ ...s, stats: EMPTY })));

    const ids = local.map((s) => s.roomId).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    const [rooms, rows] = await Promise.all([roomsByIds(ids), sessionStats(ids)]);

    const stats = new Map<string, SessionStats>();
    (rows ?? []).forEach((r) => {
      stats.set(r.room_id, {
        participants: Number(r.participants ?? 0),
        shapes: Number(r.shapes ?? 0),
        messages: Number(r.messages ?? 0),
        lastActivity: r.last_activity ? new Date(r.last_activity).getTime() : null,
      });
    });

    const roomMap = new Map((rooms ?? []).map((r) => [r.id, r]));

    setSessions(
      local.map((s) => {
        const r = roomMap.get(s.roomId);
        return {
          ...s,
          name: r?.name ?? s.name,
          joinCode: r?.join_code ?? s.joinCode,
          goalFromDb: r?.goal ?? null,
          endedAt: r?.ended_at ?? null,
          stats: stats.get(s.roomId) ?? { ...EMPTY },
        };
      }),
    );
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
