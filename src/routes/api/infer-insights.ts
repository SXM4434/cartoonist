import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

// v2.P5 — workspace memory: infer working-style facts about people from the session,
// with a verbatim source quote for every fact. No provenance -> no fact.
const SYSTEM_PROMPT = `You are CARTOONIST building a working-style memory of a team.

From the transcript and roster, infer a SMALL number of durable facts about how these people work.
Good facts: how someone gives/receives feedback, what they consistently worry about, what they push for, where they take ownership, recurring team patterns (under-scoping, deciding late, etc).
Bad facts: one-off content of this meeting, opinions on the product, anything you'd forget next week.

HARD RULES:
- Every fact MUST include "source_quote": a VERBATIM substring copied exactly from the transcript. Do not paraphrase the quote.
- If you cannot copy an exact quote, do not emit the fact.
- "subject" must be a name from the roster, or "team" for a team-level pattern.
- Max 6 facts. Return [] if the transcript is thin.
- confidence 0..1 — how durable this is, not how sure you are it was said.

Return STRICT JSON only:
{ "insights": [ { "subject": "<name|team>", "kind": "working-style|strength|concern|pattern", "text": "<one short sentence>", "source_quote": "<verbatim>", "confidence": 0.0 } ] }`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const compact = (v: string | undefined, max: number) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.4);
  return `${t.slice(0, head)} … ${t.slice(-(max - head))}`;
};

type RawInsight = {
  subject?: string;
  kind?: string;
  text?: string;
  source_quote?: string;
  confidence?: number;
};

export const Route = createFileRoute("/api/infer-insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Memory is not configured yet." }, 500);

        let body: {
          transcript?: string;
          participants?: Array<{ name: string; role?: string | null }> | null;
          roomId?: string;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "infer-insights", maxBytes: 200_000, limit: 10, roomId: body.roomId,
        });
        if (blocked) return blocked;

        const transcript = compact(body.transcript, 8000);
        if (transcript.length < 60) return json({ insights: [] });

        const roster = (body.participants ?? [])
          .map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ""}`)
          .join("\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `# Roster\n${roster || "(unknown)"}\n\n# Transcript\n${transcript}` },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
        if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
        if (!res.ok) return json({ error: "Could not read the room." }, 502);

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        let parsed: { insights?: RawInsight[] } = {};
        try {
          parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
        } catch {
          return json({ insights: [] });
        }

        // Anti-fabrication guard: drop any fact whose quote isn't actually in the transcript.
        const haystack = norm(transcript);
        const insights = (parsed.insights ?? [])
          .filter((i) => typeof i.text === "string" && typeof i.source_quote === "string")
          .filter((i) => {
            const q = norm(i.source_quote!);
            return q.length >= 12 && haystack.includes(q);
          })
          .slice(0, 6)
          .map((i) => ({
            subject: (i.subject || "team").trim(),
            kind: ["working-style", "strength", "concern", "pattern"].includes(i.kind || "")
              ? i.kind!
              : "pattern",
            text: i.text!.trim(),
            source_quote: i.source_quote!.trim(),
            confidence: Math.max(0, Math.min(1, Number(i.confidence ?? 0.5))),
          }));

        return json({ insights });
      },
    },
  },
});
