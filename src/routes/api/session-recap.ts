import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

const SYSTEM_PROMPT = `You are CARTOONIST closing out a working session. From the transcript, the shape summary, and the roster you receive, return a tight structured recap — the kind of thing a good facilitator hands the team when the meeting ends.

Rules:
- ONLY use facts stated in the transcript. Never invent decisions, owners, dates, or numbers.
- If nothing was actually decided, return decisions:[] — don't pad.
- Actions must have a real owner named in the transcript. If nobody was assigned, put the owner as null.
- Open questions = things people asked or worried about that were never answered.
- Keep every string tight, first-name only, plain sentence.

Return STRICT JSON only:
{
  "summary":       "<2-3 sentences, what happened and where we landed>",
  "decisions":    [ { "text": "...", "attribution": "<name or null>" } ],
  "actions":      [ { "text": "...", "owner": "<name or null>", "due": "<string or null>" } ],
  "openQuestions":[ { "text": "...", "raisedBy": "<name or null>" } ],
  "nextSteps":     "<one sentence — what would make the next session productive>"
}`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const compact = (v: string | undefined, max: number) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.4);
  return `${t.slice(0, head)} … ${t.slice(-(max - head))}`;
};

export const Route = createFileRoute("/api/session-recap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "Recap is not configured yet." }, 500);

        let body: {
          roomId?: string;
          transcript?: string;
          canvasSummary?: string;
          sessionContext?: { name?: string; goal?: string; outputs?: string[] } | null;
          participants?: Array<{ name: string; role?: string | null }> | null;
        };
        try { body = await request.json(); } catch { return json({ error: "Invalid recap request" }, 400); }

        const blocked = await guardExpensiveRoute(request, {
          route: "session-recap", maxBytes: 200_000, limit: 6, roomId: body.roomId,
        });
        if (blocked) return blocked;

        const transcript = compact(body.transcript, 8000);
        if (transcript.length < 40) {
          return json({
            summary: "Not enough conversation yet to summarize.",
            decisions: [], actions: [], openQuestions: [],
            nextSteps: "Have the session, then run recap again.",
          });
        }

        const ctx = body.sessionContext;
        const ctxBlock = ctx && (ctx.goal || ctx.name)
          ? `# Session\nTitle: ${ctx.name || "(untitled)"}\nGoal: ${ctx.goal || "(not set)"}\nDesired outputs: ${(ctx.outputs ?? []).join(", ") || "(none)"}\n\n`
          : "";

        const parts = (body.participants ?? []).slice(0, 12);
        const rosterBlock = parts.length
          ? `# Roster (only these names may appear as owners/attributions)\n${parts.map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ""}`).join("\n")}\n\n`
          : "";

        const canvasBlock = body.canvasSummary
          ? `# On the canvas (shape digest)\n${compact(body.canvasSummary, 2000)}\n\n`
          : "";

        const userMsg = `${ctxBlock}${rosterBlock}${canvasBlock}# Transcript\n${transcript}`;

        let res: Response;
        try {
          res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-pro",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMsg },
              ],
            }),
          });
        } catch (error) {
          console.error("recap request failed", error);
          return json({ error: "Recap is temporarily unavailable — try again in a moment." }, 502);
        }

        if (!res.ok) {
          const text = await res.text();
          console.error("recap gateway error", res.status, text);
          const lower = text.toLowerCase();
          if (res.status === 402 || lower.includes("payment_required") || lower.includes("credits")) {
            return json({ error: "Out of AI credits — add credits in workspace settings, then try again." }, 402);
          }
          if (res.status === 429) return json({ error: "Rate limit hit — wait a moment and try again." }, 429);
          return json({ error: "Recap is temporarily unavailable." }, 502);
        }

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(content); } catch { parsed = {}; }

        return json({
          summary: typeof parsed.summary === "string" ? parsed.summary : "",
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
          actions: Array.isArray(parsed.actions) ? parsed.actions : [],
          openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
          nextSteps: typeof parsed.nextSteps === "string" ? parsed.nextSteps : "",
        });
      },
    },
  },
});
