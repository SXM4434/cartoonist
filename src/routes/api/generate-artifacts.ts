import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Cartoonist, an AI mediator that converts team conversations into actionable artifacts.

You will receive a transcript and (optionally) a "# Participants" block containing per-user agents — each participant's stated strengths, feedback style, needs, and worries from their check-in, plus their live focus state.

Your job is to return ONE JSON object with the following six fields, all derived from the transcript:

- "summary": 2-4 sentence executive summary of what the team discussed.
- "decisions": array of short strings, each a concrete decision the team reached. When a decision maps onto a participant's stated strength, worry, or need, ATTRIBUTE it inline — e.g. "Ship prototype-first (Sebastian's stated worry re: overbuilding)". Empty array if none.
- "actionItems": array of objects { "task": string, "owner": string | null, "due": string | null }. Prefer owners whose stated strengths or "can help with" match the task. Owner/due may be null if not mentioned.
- "prd": Markdown string with sections: ## Problem, ## Goal, ## Users, ## Requirements (bulleted), ## Success Metrics.
- "userJourney": Markdown string describing a step-by-step user journey, formatted as a numbered list. Each step = "**Step name** — short description."
- "flowMermaid": A valid Mermaid 'flowchart TD' diagram representing the proposed product or process flow. Use simple ASCII node ids (A, B, C…) and short labels. Do NOT include the \`\`\`mermaid fences — just the raw mermaid code starting with "flowchart TD".

Be concise but specific. Use information from the transcript; do not invent facts. Never quote a participant's blocker/need unless it appears in the transcript. Output ONLY valid JSON, no commentary.`;

export const Route = createFileRoute("/api/generate-artifacts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "LOVABLE_API_KEY missing" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { transcript?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const transcript = (body.transcript ?? "").trim();
        if (transcript.length < 20) {
          return new Response(
            JSON.stringify({ error: "Transcript too short (need at least 20 chars)" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (transcript.length > 20000) {
          return new Response(
            JSON.stringify({ error: "Transcript too long (max 20000 chars)" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const aiRes = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Transcript:\n\n${transcript}` },
              ],
              response_format: { type: "json_object" },
            }),
          },
        );

        if (!aiRes.ok) {
          const text = await aiRes.text();
          console.error("AI gateway error", aiRes.status, text);
          const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
          const msg =
            aiRes.status === 429
              ? "Rate limit hit — wait a moment and try again."
              : aiRes.status === 402
                ? "Out of AI credits — add credits in workspace settings."
                : "AI gateway error";
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const aiJson = (await aiRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = aiJson.choices?.[0]?.message?.content ?? "";

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          // Some models wrap in ```json fences; strip and retry.
          const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
          try {
            parsed = JSON.parse(stripped);
          } catch {
            return new Response(
              JSON.stringify({ error: "AI returned invalid JSON", raw: content.slice(0, 500) }),
              { status: 502, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        return Response.json(parsed);
      },
    },
  },
});
