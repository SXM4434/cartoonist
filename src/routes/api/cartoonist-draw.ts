import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Cartoonist, an AI that listens to a live meeting and DRAWS what is being discussed on a shared whiteboard — like a sketch artist at a strategy session.

You receive the recent transcript and what is already on the canvas. You output a JSON patch of sketch primitives to ADD to the canvas. Think like an architect at a whiteboard: boxes for components/screens/steps, arrows for flow, diamonds for decisions, ellipses for actors/personas, short text labels.

Return STRICT JSON: { "shapes": [...], "rationale": "<one short sentence>" }.

Each shape is one of (ids must be globally unique strings, prefix with kind):
- { "type": "rect",    "id": "r_xxx", "x": <num>, "y": <num>, "w": <num>, "h": <num>, "label": "<short>" }
- { "type": "ellipse", "id": "e_xxx", "x": <num>, "y": <num>, "w": <num>, "h": <num>, "label": "<short>" }
- { "type": "diamond", "id": "d_xxx", "x": <num>, "y": <num>, "w": <num>, "h": <num>, "label": "<short>" }
- { "type": "arrow",   "id": "a_xxx", "x1": <num>, "y1": <num>, "x2": <num>, "y2": <num>, "label": "<optional>" }
- { "type": "text",    "id": "t_xxx", "x": <num>, "y": <num>, "text": "<short>", "size": 14, "weight": "regular|bold" }

Coordinates: canvas is ~1600 x 1000. Origin (0,0) is top-left. Lay shapes out cleanly so arrows connect to the edges of boxes. Standard box: w=160 h=70. Leave ~80px gaps. Group related shapes spatially.

Rules:
- Be SPARSE: 0-6 shapes per call. Skip entirely if nothing visual was added.
- DO NOT redraw shapes already on the canvas — only ADD what's new.
- Labels are short (1-4 words). No paragraphs.
- Pick the right kind: flow→rects+arrows, decision→diamond, actor/persona→ellipse, freeform note→text.
- Return ONLY valid JSON, no commentary.`;

export const Route = createFileRoute("/api/cartoonist-draw")({
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

        let body: { transcript?: string; existing?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const transcript = (body.transcript ?? "").trim();
        if (transcript.length < 12) {
          return new Response(JSON.stringify({ shapes: [], rationale: "not enough transcript" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const userMsg = `# Already on canvas\n${body.existing || "(empty)"}\n\n# Recent transcript\n${transcript}`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
          return new Response(JSON.stringify({ error: "AI call failed", detail: text, shapes: [] }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: { shapes?: unknown } = {};
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = { shapes: [] };
        }

        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
