import type { SketchPrimitive } from "./sketch-types";

export type WebReference = {
  id: string;
  query: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  shapeId?: string;
};

export type ReferenceOrigin = { x: number; y: number };

const MAX_RESULTS = 5;

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function referenceId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  return `ref_${hash.toString(16)}`;
}

export function parseWebResults(raw: unknown, query: string): WebReference[] {
  const rows = Array.isArray((raw as { results?: unknown })?.results)
    ? ((raw as { results: unknown[] }).results)
    : [];
  const seen = new Set<string>();
  const out: WebReference[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { title?: unknown; url?: unknown; snippet?: unknown; source?: unknown };
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    const title = typeof rec.title === "string" ? rec.title.replace(/\s+/g, " ").trim().slice(0, 160) : "";
    const snippet = typeof rec.snippet === "string" ? rec.snippet.replace(/\s+/g, " ").trim().slice(0, 400) : "";
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    const source = typeof rec.source === "string" && rec.source.trim()
      ? rec.source.trim().slice(0, 80)
      : host;
    if (!title) continue;
    out.push({
      id: referenceId(url),
      query: query.trim().slice(0, 300),
      title,
      url,
      snippet,
      source,
    });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

export function referenceToShape(ref: WebReference, origin: ReferenceOrigin): Extract<SketchPrimitive, { type: "note" }> {
  const lines = [
    "REF",
    ref.title,
    ref.url,
    ref.snippet.slice(0, 140),
  ].filter((line) => line.length > 0);
  return {
    type: "note",
    id: ref.shapeId ?? `n_ref_${ref.id}`,
    x: origin.x,
    y: origin.y,
    w: 240,
    h: 180,
    text: lines.join("\n"),
    color: "green",
  };
}

export function referenceCanvasEvent(
  roomId: string,
  shape: Extract<SketchPrimitive, { type: "note" }>,
  ref: WebReference,
  tOffsetMs: number,
) {
  return {
    room_id: roomId,
    op: { ...shape },
    t_offset_ms: tOffsetMs,
    source: "reference",
    transcript_span: {
      origin: "web_reference",
      latest: ref.title,
      url: ref.url,
      query: ref.query,
    },
    confidence: 1,
    thread_id: `thread_ref_${ref.id}`.slice(0, 40),
  };
}
