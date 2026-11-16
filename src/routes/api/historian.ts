import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";
import {
  citeTranscriptSpans,
  matchRecallDrawings,
  supportedCitations,
  UNSUPPORTED_ANSWER,
} from "@/lib/recall-provenance";

/**
 * Phase 3.3 — Historian recall.
 * Answers "what did X say about Y earlier?" strictly from the session's own
 * transcript. Every answer must carry verbatim quotes; a quote that isn't in
 * the transcript is dropped, and with no quotes left the answer is "not said".
 */
const SYSTEM_PROMPT = `You are the HISTORIAN of a live working session. You only remember what was actually said.

You get the running session memory and the transcript. Answer the question about what happened earlier.

HARD RULES:
- "answer" is 1-3 short sentences of plain speech. Never speculate, never advise, never summarise the whole session.
- Every claim must be backed by "quotes": VERBATIM substrings copied exactly from the transcript. Max 3.
- If the transcript does not contain the answer, return {"answer":"That never came up.","quotes":[]}.
- Never invent names, numbers, dates or decisions.

Return STRICT JSON only:
{ "answer": "...", "quotes": [ { "text": "<verbatim>", "speaker": "<name if the transcript labels it, else empty>" } ] }`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const compact = (v: string | undefined, max: number) => {
  const t = (v ?? "").replace(/[ \t]+/g, " ").trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.35);
  return `${t.slice(0, head)} … ${t.slice(-(max - head))}`;
};

type RawQuote = { text?: string; speaker?: string };

export const Route = createFileRoute("/api/historian")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Recall is not configured yet." }, 500);

        let body: { roomId?: string; question?: string; transcript?: string; memoryBlock?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "historian", maxBytes: 200_000, limit: 30, roomId: body.roomId,
        });
        if (blocked) return blocked;

        const question = (body.question ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
        if (!question) return json({ error: "Ask a question first." }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: chunks } = await supabaseAdmin
          .from("transcript_chunks")
          .select("id,text")
          .eq("room_id", body.roomId ?? "")
          .order("created_at", { ascending: true })
          .limit(500);
        const spans = (chunks ?? [])
          .filter((chunk): chunk is { id: string; text: string } => typeof chunk?.id === "string" && typeof chunk?.text === "string")
          .map((chunk) => ({ id: chunk.id, text: chunk.text }));
        const storedText = spans.map((span) => span.text).join("\n");
        const transcript = compact(storedText.length >= 80 ? storedText : body.transcript, 14000);
        if (transcript.length < 80) return json({ answer: "Nothing has been said yet.", quotes: [] });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `${body.memoryBlock ? `# Session memory\n${compact(body.memoryBlock, 1500)}\n\n` : ""}# Transcript\n${transcript}\n\n# Question\n${question}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
        if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
        if (!res.ok) return json({ error: "Could not search the session." }, 502);

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        let parsed: { answer?: string; quotes?: RawQuote[] } = {};
        try {
          parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
        } catch {
          return json({ answer: UNSUPPORTED_ANSWER, quotes: [] });
        }

        const haystack = norm(transcript);
        const rawQuotes = (parsed.quotes ?? [])
          .filter((q): q is RawQuote & { text: string } => typeof q?.text === "string")
          .filter((q) => {
            const n = norm(q.text);
            return n.length >= 10 && haystack.includes(n);
          })
          .slice(0, 3)
          .map((q) => ({
            text: q.text.trim().slice(0, 400),
            speaker: typeof q.speaker === "string" ? q.speaker.trim().slice(0, 40) : "",
          }));

        const cited = citeTranscriptSpans(rawQuotes, spans);
        const quotes = spans.length > 0 ? supportedCitations(cited) : cited;
        const answer =
          quotes.length === 0
            ? UNSUPPORTED_ANSWER
            : (parsed.answer ?? "").replace(/\s+/g, " ").trim().slice(0, 400) || UNSUPPORTED_ANSWER;

        const { data: events } = await supabaseAdmin.from("canvas_events")
          .select("thread_id,transcript_span,op").eq("room_id", body.roomId ?? "").order("created_at", { ascending: false }).limit(2000);
        const linkedQuotes = matchRecallDrawings(quotes, events ?? []);
        const { data: saved, error } = await supabaseAdmin.from("room_recall").insert({
          room_id: body.roomId ?? "", question, answer, quotes: linkedQuotes,
        }).select("id,created_at").single();
        if (error) return json({ error: "Could not save Recall. Please try again." }, 500);
        return json({ answer, quotes: linkedQuotes, id: saved.id, at: new Date(saved.created_at).getTime() });
      },
    },
  },
});
