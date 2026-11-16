import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

/**
 * Phase 3.1 — Devil's Advocate agent.
 * Reads the live transcript and names the risks, gaps and unexamined
 * assumptions the room is talking past. Every item must cite a verbatim
 * quote from the transcript — no quote, no risk.
 */
const SYSTEM_PROMPT = `You are the DEVIL'S ADVOCATE in a live working session. You do not summarise and you do not agree. You name what the room is glossing over.

Emit only items that a sharp colleague would actually raise out loud:
- risk        → a concrete way the current direction fails
- gap         → something required that nobody has covered (owner, cost, timeline, edge case, dependency)
- assumption  → something being treated as settled fact that was never verified
- question    → the uncomfortable question nobody asked

HARD RULES:
- Every item MUST include "source_quote": a VERBATIM substring copied exactly from the transcript. If you can't copy one, drop the item.
- "text" is ONE short sentence, under 120 chars, in plain speech. No hedging, no "consider whether".
- Never invent numbers, names, dates or facts that are not in the transcript.
- Max 4 items per call. Return [] when the conversation is thin, purely social, or the risks were already stated by the people themselves.
- severity 0..1 — how much it would hurt if ignored.

Return STRICT JSON only:
{ "risks": [ { "kind": "risk|gap|assumption|question", "text": "...", "source_quote": "<verbatim>", "severity": 0.0 } ] }`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const compact = (v: string | undefined, max: number) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.4);
  return `${t.slice(0, head)} … ${t.slice(-(max - head))}`;
};

type RawRisk = { kind?: string; text?: string; source_quote?: string; severity?: number };

const KINDS = ["risk", "gap", "assumption", "question"];

export const Route = createFileRoute("/api/devils-advocate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Devil's advocate is not configured yet." }, 500);

        let body: { transcript?: string; roomId?: string; memoryBlock?: string; known?: string[] };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "devils-advocate", maxBytes: 200_000, limit: 20, roomId: body.roomId,
        });
        if (blocked) return blocked;

        const transcript = compact(body.transcript, 9000);
        if (transcript.length < 200) return json({ risks: [] });

        const known = (body.known ?? []).slice(-12).map((k) => `- ${k}`).join("\n");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `${body.memoryBlock ? `# Session so far\n${compact(body.memoryBlock, 1500)}\n\n` : ""}${
                  known ? `# Already raised — do NOT repeat these\n${known}\n\n` : ""
                }# Transcript\n${transcript}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
        if (res.status === 402) return json({ error: "AI credits exhausted." }, 402);
        if (!res.ok) return json({ error: "Could not read the room." }, 502);

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        let parsed: { risks?: RawRisk[] } = {};
        try {
          parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
        } catch {
          return json({ risks: [] });
        }

        const haystack = norm(transcript);
        const risks = (parsed.risks ?? [])
          .filter((r) => typeof r.text === "string" && typeof r.source_quote === "string")
          .filter((r) => {
            const q = norm(r.source_quote!);
            return q.length >= 12 && haystack.includes(q);
          })
          .slice(0, 4)
          .map((r) => ({
            kind: KINDS.includes(r.kind || "") ? r.kind! : "risk",
            text: r.text!.trim().slice(0, 160),
            source_quote: r.source_quote!.trim(),
            severity: Math.max(0, Math.min(1, Number(r.severity ?? 0.5))),
          }));

        return json({ risks });
      },
    },
  },
});
