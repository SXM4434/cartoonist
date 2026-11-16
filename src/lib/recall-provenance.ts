export type Citation = { text: string; speaker: string; threadId?: string; shapeIds?: string[] };
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function matchRecallDrawings(quotes: Citation[], events: Array<{ thread_id: string | null; transcript_span: unknown; op: unknown }>): Citation[] {
  return quotes.map((quote) => {
    const text = normalize(quote.text);
    if (text.length < 10) return quote;
    const match = events.find((event) => {
      const span = event.transcript_span as { latest?: string } | null;
      const latest = normalize(span?.latest ?? "");
      return latest.length >= 10 && (latest.includes(text) || text.includes(latest));
    });
    if (!match?.thread_id) return quote;
    const ids = events.filter(e => e.thread_id === match.thread_id).flatMap(e => {
      const op = e.op as { id?: string; type?: string; shapes?: Array<{ id?: string }>; shape?: { id?: string } } | null;
      return [...(op?.shapes ?? []), ...(op?.shape ? [op.shape] : []), ...(op?.type && op.id ? [op] : [])].flatMap(s => s.id ? [s.id] : []);
    });
    return { ...quote, threadId: match.thread_id, shapeIds: [...new Set(ids)] };
  });
}