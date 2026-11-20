import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

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

        let body: { transcript?: string; participantsBlock?: string; roomId?: string; requestedUpdate?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "generate-artifacts", maxBytes: 200_000, limit: 10, roomId: body.roomId,
        });
        if (blocked) return blocked;

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

        const userContent = `${body.participantsBlock ? `# Participants\n\n${body.participantsBlock.slice(0, 4000)}\n\n` : ""}${body.requestedUpdate ? `Requested document update: ${body.requestedUpdate.slice(0, 1000)}\nApply this request to the relevant document, using only facts in the transcript.\n\n` : ""}Transcript:\n\n${transcript}`;
        const callModel = () => fetch(
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
                { role: "user", content: userContent },
              ],
              response_format: { type: "json_object" },
            }),
          },
        );

        // Models occasionally wrap JSON in fences, add prose, or leave a
        // trailing comma. Recover what we can before giving up.
        const parseLoose = (raw: string): Record<string, unknown> | null => {
          const stripped = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
          const sliced = stripped.slice(stripped.indexOf("{"), stripped.lastIndexOf("}") + 1);
          for (const c of [stripped, sliced, sliced.replace(/,\s*([}\]])/g, "$1")]) {
            try {
              const v = JSON.parse(c);
              if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
            } catch { /* try next */ }
          }
          return null;
        };

        let parsed: Record<string, unknown> | null = null;
        // One retry when the reply is unusable; no timers (see AGENTS.md).
        for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
          const aiRes = await callModel();
          if (!aiRes.ok) {
            const text = await aiRes.text();
            console.error("AI gateway error", aiRes.status, text);
            const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 503;
            const msg =
              aiRes.status === 429
                ? "Rate limit hit — wait a moment and try again."
                : aiRes.status === 402
                  ? "Out of AI credits — add credits in workspace settings."
                  : "Documents couldn't be drafted right now. Try again in a moment.";
            return new Response(JSON.stringify({ error: msg }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
          const aiJson = (await aiRes.json().catch(() => ({}))) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = aiJson.choices?.[0]?.message?.content ?? "";
          parsed = parseLoose(content);
          if (!parsed) console.warn("[generate-artifacts] unusable reply", attempt, content.slice(0, 300));
        }
        if (!parsed) {
          // The model's fault, not a server crash: report it as unprocessable
          // so the room shows a calm message and keeps the previous documents.
          return new Response(
            JSON.stringify({ error: "Documents couldn't be drafted this time. Try again in a moment." }),
            { status: 422, headers: { "Content-Type": "application/json" } },
          );
        }

        // Normalise so the documents panel always gets every field.
        const str = (v: unknown) => (typeof v === "string" ? v : "");
        parsed = {
          ...parsed,
          summary: str(parsed.summary),
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter((d) => typeof d === "string") : [],
          actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.filter((a) => a && typeof a === "object") : [],
          prd: str(parsed.prd),
          userJourney: str(parsed.userJourney),
          flowMermaid: str(parsed.flowMermaid),
        };

        return Response.json(parsed);
      },
    },
  },
});
