import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DiarizedSegment = { speaker: string; text: string; start: number; end: number };

export type SpeakerMapRow = { cluster_label: string; participant_id: string };

/**
 * Records the mic in rolling chunks (~CHUNK_MS) and posts each one to
 * /api/transcribe-chunk with diarization on. Maps known speaker clusters
 * to participants via the speaker_map table; surfaces unmapped clusters
 * to the UI for one-tap assignment.
 */
const CHUNK_MS = 8000;

export function useLiveDiarization(opts: {
  roomId: string;
  enabled: boolean;
  startedAtMs: number;
}) {
  const { roomId, enabled, startedAtMs } = opts;

  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});
  const [pendingClusters, setPendingClusters] = useState<string[]>([]);
  const [latestByCluster, setLatestByCluster] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<Record<string, string>>({});

  useEffect(() => { mapRef.current = speakerMap; }, [speakerMap]);

  // Load existing map + subscribe
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("speaker_map")
        .select("cluster_label,participant_id")
        .eq("room_id", roomId);
      if (active && data) {
        const next: Record<string, string> = {};
        for (const r of data as SpeakerMapRow[]) next[r.cluster_label] = r.participant_id;
        setSpeakerMap(next);
      }
    })();
    const channel = supabase
      .channel(`speaker_map_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "speaker_map", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as SpeakerMapRow | undefined;
          if (!row) return;
          setSpeakerMap((prev) => ({ ...prev, [row.cluster_label]: row.participant_id }));
          setPendingClusters((prev) => prev.filter((c) => c !== row.cluster_label));
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const processBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 4000) return; // too small / silent
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", blob, "chunk.webm");
      const res = await fetch("/api/transcribe-chunk", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { segments?: DiarizedSegment[]; error?: string };
      if (!res.ok || !data.segments) return;

      const seenClusters = new Set<string>();
      const tOffset = Date.now() - startedAtMs;

      for (const seg of data.segments) {
        if (!seg.text.trim()) continue;
        seenClusters.add(seg.speaker);
        setLatestByCluster((prev) => ({ ...prev, [seg.speaker]: seg.text }));

        const pid = mapRef.current[seg.speaker] ?? null;
        await supabase.from("transcript_chunks").insert({
          room_id: roomId,
          text: seg.text,
          source: "voice",
          participant_id: pid,
          t_offset_ms: tOffset + Math.round(seg.start * 1000),
        } as never);
      }

      const unmapped = Array.from(seenClusters).filter((c) => !mapRef.current[c]);
      if (unmapped.length) {
        setPendingClusters((prev) => Array.from(new Set([...prev, ...unmapped])));
      }
    } finally {
      setBusy(false);
    }
  }, [roomId, startedAtMs]);

  // Recording lifecycle
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const startCycle = () => {
          if (cancelled) return;
          const mr = new MediaRecorder(stream);
          const chunks: Blob[] = [];
          mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          mr.onstop = () => {
            const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
            void processBlob(blob);
          };
          recorderRef.current = mr;
          mr.start();
          cycleTimerRef.current = setTimeout(() => {
            try { mr.stop(); } catch { /* ignore */ }
            startCycle();
          }, CHUNK_MS) as unknown as ReturnType<typeof setInterval>;
        };

        startCycle();
      } catch {
        /* mic blocked */
      }
    })();

    return () => {
      cancelled = true;
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current as unknown as number);
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled, processBlob]);

  const assignSpeaker = useCallback(async (cluster: string, participantId: string) => {
    setSpeakerMap((prev) => ({ ...prev, [cluster]: participantId }));
    setPendingClusters((prev) => prev.filter((c) => c !== cluster));
    await supabase
      .from("speaker_map")
      .upsert({ room_id: roomId, cluster_label: cluster, participant_id: participantId } as never, { onConflict: "room_id,cluster_label" });
  }, [roomId]);

  return { speakerMap, pendingClusters, latestByCluster, busy, assignSpeaker };
}
