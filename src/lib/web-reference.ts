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
export const PAGE_BYTE_CAP = 200 * 1024;
export const PAGE_TEXT_BYTES = 20 * 1024;
export const PAGE_CHECK_MS = 8_000;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "how", "if", "in", "into", "is", "it", "its", "of", "on", "or", "our",
  "that", "the", "their", "these", "this", "those", "to", "was", "we",
  "what", "when", "where", "which", "who", "why", "with", "you", "your",
]);

export type FetchedPage = {
  status: number;
  finalUrl: string;
  title: string;
  text: string;
};

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

export function meaningfulWords(value: string): string[] {
  const found = value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return found.filter((word) => !STOP_WORDS.has(word));
}

export function firstTextBytes(value: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= maxBytes) return value;
  let end = maxBytes;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, end));
}

function sharesMeaningfulWord(resultTitle: string, pageTitle: string, pageText: string): boolean {
  const wanted = new Set(meaningfulWords(resultTitle));
  if (wanted.size === 0) return false;
  const haystack = meaningfulWords(`${pageTitle}\n${firstTextBytes(pageText, PAGE_TEXT_BYTES)}`);
  return haystack.some((word) => wanted.has(word));
}

function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/** Keep a model row only when the fetched page agrees. The title becomes the page title. */
export function verifyWebResults(results: WebReference[], pages: FetchedPage[]): WebReference[] {
  const kept: WebReference[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const page = pages[i];
    if (!result || !page) continue;
    if (page.status < 200 || page.status >= 300) continue;
    const finalUrl = page.finalUrl.trim();
    if (!isHttpUrl(finalUrl) || seen.has(finalUrl)) continue;
    const title = page.title.replace(/\s+/g, " ").trim().slice(0, 200);
    if (!title) continue;
    if (!sharesMeaningfulWord(result.title, title, page.text)) continue;
    seen.add(finalUrl);
    kept.push({
      ...result,
      id: referenceId(finalUrl),
      title,
      url: finalUrl,
      source: hostOf(finalUrl) || result.source,
    });
    if (kept.length >= MAX_RESULTS) break;
  }
  return kept;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function pageTitleFromHtml(html: string): string {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return "";
  return decodeEntities(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function pageTextFromHtml(html: string): string {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

export function pageFactsFromHtml(status: number, finalUrl: string, html: string): FetchedPage {
  return {
    status,
    finalUrl,
    title: pageTitleFromHtml(html),
    text: firstTextBytes(pageTextFromHtml(html), PAGE_TEXT_BYTES),
  };
}

function isPublicPageUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const parsed = new URL(value);
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host === "::1" || host === "0.0.0.0" || host === "::") return false;
  if (host.includes(":")) {
    const head = host.split(":").find((part) => part.length > 0) ?? "";
    if (/^f[cd]/i.test(head) || /^fe[89ab]/i.test(head)) return false;
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return true;
  const parts = [1, 2, 3, 4].map((index) => Number(v4[index]));
  if (parts.some((part) => part > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}

async function cancelBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch (err) {
    console.error("page check stopped the extra bytes", err);
  }
}

async function readCappedText(res: Response, cap: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = await res.arrayBuffer();
    const view = buf.byteLength > cap ? buf.slice(0, cap) : buf;
    return new TextDecoder("utf-8", { fatal: false }).decode(view);
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < cap) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const room = cap - received;
      if (value.byteLength > room) {
        chunks.push(value.subarray(0, room));
        received += room;
        break;
      }
      chunks.push(value);
      received += value.byteLength;
    }
  } catch (err) {
    console.error("page check read failed", err);
    throw err;
  } finally {
    try {
      await reader.cancel();
    } catch (err) {
      console.error("page check stopped the extra bytes", err);
    }
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/**
 * Open one suggested URL. One timer per call. The body stops at 200 kB.
 * A private host is refused before the request, including after a redirect.
 */
export async function fetchPageFacts(url: string, timeoutMs = PAGE_CHECK_MS): Promise<FetchedPage> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (!isPublicPageUrl(current)) {
        console.error("page check refused a non-public URL", current);
        return { status: 0, finalUrl: current, title: "", text: "" };
      }
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
          "User-Agent": "Mozilla/5.0 (compatible; CartoonistLibrarian/1.0)",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await cancelBody(res);
        if (!location) return { status: res.status, finalUrl: current, title: "", text: "" };
        current = new URL(location, current).href;
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        await cancelBody(res);
        return { status: res.status, finalUrl: current, title: "", text: "" };
      }
      const html = await readCappedText(res, PAGE_BYTE_CAP);
      return pageFactsFromHtml(res.status, current, html);
    }
    console.error("page check stopped after 5 redirects", current);
    return { status: 0, finalUrl: current, title: "", text: "" };
  } catch (err) {
    console.error("page check failed", current, err);
    return { status: 0, finalUrl: url, title: "", text: "" };
  }
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
