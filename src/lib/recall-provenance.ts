export type Citation = {
  text: string;
  speaker: string;
  threadId?: string;
  shapeIds?: string[];
  chunkId?: string;
};

export type TranscriptSpan = { id: string; text: string; speaker?: string };

export const UNSUPPORTED_ANSWER = "That never came up.";

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function spanContainsQuote(spanText: string, quoteText: string): boolean {
  const span = normalize(spanText);
  const quote = normalize(quoteText);
  return quote.length >= 10 && span.length >= 10 && (span.includes(quote) || quote.includes(span));
}

export function citeTranscriptSpans(
  quotes: Array<{ text: string; speaker: string }>,
  spans: TranscriptSpan[],
): Citation[] {
  return quotes.map((quote) => {
    const match = spans.find((span) => span.id && spanContainsQuote(span.text, quote.text));
    if (!match) return { text: quote.text, speaker: quote.speaker };
    return {
      text: quote.text,
      speaker: quote.speaker || match.speaker || "",
      chunkId: match.id,
    };
  });
}

export function supportedCitations(quotes: Citation[]): Citation[] {
  return quotes.filter((quote) => typeof quote.chunkId === "string" && quote.chunkId.length > 0);
}

export function recallAnswer(parsed: string, quotes: Citation[]): string {
  if (supportedCitations(quotes).length === 0) return UNSUPPORTED_ANSWER;
  const trimmed = parsed.replace(/\s+/g, " ").trim().slice(0, 400);
  return trimmed || UNSUPPORTED_ANSWER;
}

export function matchRecallDrawings(
  quotes: Citation[],
  events: Array<{ thread_id: string | null; transcript_span: unknown; op: unknown }>,
): Citation[] {
  return quotes.map((quote) => {
    const text = normalize(quote.text);
    if (text.length < 10) return quote;
    const match = events.find((event) => {
      const span = event.transcript_span as { latest?: string } | null;
      const latest = normalize(span?.latest ?? "");
      return latest.length >= 10 && (latest.includes(text) || text.includes(latest));
    });
    if (!match?.thread_id) return quote;
    const ids = events.filter((e) => e.thread_id === match.thread_id).flatMap((e) => {
      const op = e.op as { id?: string; type?: string; shapes?: Array<{ id?: string }>; shape?: { id?: string } } | null;
      return [...(op?.shapes ?? []), ...(op?.shape ? [op.shape] : []), ...(op?.type && op.id ? [op] : [])].flatMap((s) =>
        s.id ? [s.id] : [],
      );
    });
    return { ...quote, threadId: match.thread_id, shapeIds: [...new Set(ids)] };
  });
}
