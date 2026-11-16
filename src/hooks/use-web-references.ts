import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/db-rpc";
import type { WebReference } from "@/lib/web-reference";

type SavedRow = {
  id: string;
  query: string;
  title: string;
  url: string;
  snippet: string | null;
  source: string | null;
  shape_id: string | null;
  created_at: string;
};

function rowToRef(row: SavedRow): WebReference {
  return {
    id: row.id,
    query: row.query,
    title: row.title,
    url: row.url,
    snippet: row.snippet ?? "",
    source: row.source ?? "",
    shapeId: row.shape_id ?? undefined,
  };
}

export function useWebReferences(opts: { roomId: string; transcript: string }) {
  const { roomId } = opts;
  const [results, setResults] = useState<WebReference[]>([]);
  const [saved, setSaved] = useState<WebReference[]>([]);
  const [looking, setLooking] = useState(false);
  const [looked, setLooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const transcriptRef = useRef(opts.transcript);
  transcriptRef.current = opts.transcript;

  useEffect(() => {
    let cancelled = false;
    setResults([]);
    setLooked(false);
    void rpc<SavedRow[]>("reference_list", { p_room: roomId }).then((rows) => {
      if (!cancelled && rows) setSaved(rows.map(rowToRef));
    });
    return () => { cancelled = true; };
  }, [roomId]);

  const lookup = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q || pending.current) return;
    pending.current = true;
    setError(null);
    setLooking(true);
    try {
      const res = await fetch("/api/web-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, query: q, transcript: transcriptRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not look that up.");
      setResults(Array.isArray(data?.results) ? (data.results as WebReference[]) : []);
      setLooked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not look that up.");
    } finally {
      pending.current = false;
      setLooking(false);
    }
  }, [roomId]);

  const save = useCallback(async (ref: WebReference, shapeId: string) => {
    const row = await rpc<SavedRow[]>("reference_save", {
      p_room: roomId,
      p_query: ref.query,
      p_title: ref.title,
      p_url: ref.url,
      p_snippet: ref.snippet,
      p_source: ref.source,
      p_shape_id: shapeId,
    });
    const savedRow = Array.isArray(row) ? row[0] : row;
    if (!savedRow || typeof savedRow !== "object" || !("id" in savedRow)) return null;
    const next = rowToRef(savedRow as SavedRow);
    setSaved((current) => {
      const rest = current.filter((item) => item.url !== next.url);
      return [next, ...rest].slice(0, 50);
    });
    setResults((current) => current.map((item) => item.url === next.url ? { ...item, shapeId: next.shapeId, id: next.id } : item));
    return next;
  }, [roomId]);

  return { results, saved, looking, looked, error, lookup, save };
}
