import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Cartoonist, an AI mediator that watches a live meeting and decides what visual artifacts to draw on a shared canvas.

You receive:
- The recent transcript (with speaker names)
- A summary of what is already on the canvas (existing shape ids + types + labels)
- The list of participants

Return a JSON object: { "ops": [...], "rationale": "one short sentence" }.

Each op is one of:
- { "type": "sticky", "id": "s_<unique>", "text": "...", "author": "<participant name or 'AI'>", "category": "idea|question|risk|decision|action" }
- { "type": "flowStep", "id": "f_<unique>", "label": "short step name", "connectsFrom": "<existing id or null>" }
- { "type": "journeyStep", "id": "j_<unique>", "label": "...", "persona": "..." }
- { "type": "decision", "id": "d_<unique>", "label": "..." }
- { "type": "actionItem", "id": "a_<unique>", "task": "...", "owner": "<name or null>" }
- { "type": "connect", "from": "<id>", "to": "<id>", "label": "" }
- { "type": "section", "id": "sec_<unique>", "title": "...", "kind": "userflow|journey|decisions|ideas" }

Rules:
- Be SPARSE. Only emit 0-3 ops per call. Skip if nothing meaningful was added since the last call.
- Detect intent: if the team is mapping a flow, use flowStep + connect; if discussing user experience, use journeyStep; if voting/choosing, use decision; if assigning work, use actionItem; otherwise sticky.
- DO NOT duplicate ideas already on canvas.
- Ids must be globally unique and stable strings (e.g. timestamp-suffixed).
- Return ONLY valid JSON.`;

export const Route = createFileRoute("/api/canvas-ops")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: {
          transcript?: string;
          canvasSummary?: string;
          participants?: string[];
        };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const transcript = (body.transcript ?? "").trim();
        if (transcript.length < 20) {
          return new Response(JSON.stringify({ ops: [], rationale: "not enough transcript" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const userMsg = `# Participants
${(body.participants ?? []).join(", ") || "(unknown)"}

# Canvas so far
${body.canvasSummary || "(empty)"}

# Recent transcript
${transcript}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          return new Response(
            JSON.stringify({ error: "AI call failed", detail: text }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = { ops: [], rationale: "parse error" };
        }

        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
