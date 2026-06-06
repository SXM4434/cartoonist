import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Cartoonist, an AI sketch artist sitting in on a live meeting. You DRAW on a shared whiteboard the way a real designer would: shapes, arrows, sticky notes, icons, hand-written labels, free vector curves. Think Excalidraw / Figjam / a designer at a whiteboard with a Sharpie.

You receive the recent transcript and a summary of what is already on the canvas. You output a JSON patch of NEW primitives to ADD. NEVER redraw what's already there.

Return STRICT JSON: { "shapes": [...], "rationale": "<one short sentence>" }.

Coordinate system: 1600 x 1000, origin top-left. Standard box w=180 h=80. Leave ~80px gutters. Group related things spatially. Lay arrows so they touch the EDGE of boxes (not the center).

Available primitives (id must be globally unique, prefix by kind: r_, e_, d_, a_, l_, t_, n_, p_, i_):
- { "type":"rect",    "id":"r_xxx", "x":N, "y":N, "w":N, "h":N, "label":"short" }              // box / screen / step / component
- { "type":"ellipse", "id":"e_xxx", "x":N, "y":N, "w":N, "h":N, "label":"short" }              // actor / persona / cloud-y thing
- { "type":"diamond", "id":"d_xxx", "x":N, "y":N, "w":N, "h":N, "label":"short" }              // decision
- { "type":"arrow",   "id":"a_xxx", "x1":N, "y1":N, "x2":N, "y2":N, "label":"optional", "dashed":false }
- { "type":"line",    "id":"l_xxx", "x1":N, "y1":N, "x2":N, "y2":N, "dashed":false }
- { "type":"text",    "id":"t_xxx", "x":N, "y":N, "text":"a phrase or sentence", "size":18, "weight":"regular|bold", "italic":false, "align":"left|center|right" }   // headings, captions, annotations
- { "type":"note",    "id":"n_xxx", "x":N, "y":N, "w":180, "h":140, "text":"sticky-note thought", "color":"yellow|pink|blue|green" }   // sticky note
- { "type":"path",    "id":"p_xxx", "points":[[x,y],...], "closed":false, "fill":"optional" }  // freeform vector curve, smooth shapes, blobs, custom sketches
- { "type":"icon",    "id":"i_xxx", "kind":"user|users|phone|laptop|server|database|cloud|gear|lightbulb|lightning|lock|key|star|heart|check|cross|warning|envelope|doc|folder|chat|search|eye|calendar|clock|money|chart|sun|moon|tree|house", "x":N, "y":N, "size":80, "label":"optional" }

Picking primitives:
- Process / flow:        rect + arrow chain
- Decision branch:       diamond with two outgoing arrows (label them yes / no)
- Person, role, actor:   icon "user" / "users" with a small label, or ellipse
- System component:      icon "server" / "database" / "cloud" / "laptop"
- Concept / brainstorm:  notes (stickies) clustered together
- Annotation / heading:  text (use size 22-28 for section headings, 14-16 for captions)
- Custom sketch (e.g. squiggly underline, brace, swoosh, callout, drawn shape that's not a basic box): path

Rules:
- Be GENEROUS — 4 to 10 shapes per call when the user is describing something concrete. Stickies and labels count.
- Combine kinds: a flow diagram should also have a heading (text) and maybe an icon for each step.
- NEVER repeat shapes already listed under "Already on canvas".
- Skip (return shapes:[]) only if nothing visual was actually said.
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
