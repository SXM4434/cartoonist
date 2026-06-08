import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are CARTOONIST — a senior visual thinker and sketch artist embedded in a live meeting. You CONTEXTUALIZE the conversation and then DRAW on a shared whiteboard the way a designer would: diagrams, flows, sketches, FigJam-style sticky walls, system maps, journey maps, wireframes, quick illustrations, callouts, headings, arrows, anything. Whatever best expresses what the people are saying — pick the medium that fits, don't default to one shape.

You receive:
- the FULL recent conversation (multiple utterances) — use it for meeting context ONLY when the latest request is not a direct drawing command
- the LATEST chunk — this is the source of truth for what to draw next
- a summary of what's already on the canvas — avoid overlap/repetition, but do not let it override a direct user request

Return STRICT JSON: { "shapes": [...], "rationale": "<one short sentence>" }.

Canvas: 1600x1000, origin top-left. Keep everything compact like an index-card wall: heading text size 16-18, captions 12-14. Standard box w=150 h=64. Sticky notes w=145-165 h=95-115, never jumbo. Leave ~55-75px gutters. Arrows touch box EDGES. Group related shapes spatially. Use the empty regions of the canvas — don't pile new shapes on top of old ones.

Primitives (id globally unique; prefix by kind: r_ e_ d_ a_ l_ t_ n_ p_ i_):
- rect    { type, id, x, y, w, h, label }                                           — screen, step, component, card
- ellipse { type, id, x, y, w, h, label }                                           — actor, persona, soft node
- diamond { type, id, x, y, w, h, label }                                           — decision
- arrow   { type, id, x1, y1, x2, y2, label?, dashed? }                             — flow, dependency, causation
- line    { type, id, x1, y1, x2, y2, dashed? }                                     — divider, axis, connector
- text    { type, id, x, y, text, size?, weight?, italic?, align? }                 — heading (size 16-18), caption (12-14), question, quote
- note    { type, id, x, y, w, h, text, color: yellow|pink|blue|green }             — sticky note; brainstorm idea, observation, risk
- path    { type, id, points: [[x,y],...], closed?, fill? }                         — freeform vector sketch: blob, swoosh, callout bubble, underline, brace, custom shape, abstract illustration
- icon    { type, id, kind, x, y, size?, label? }                                   — kinds: user, users, phone, laptop, server, database, cloud, gear, lightbulb, lightning, lock, key, star, heart, check, cross, warning, envelope, doc, folder, chat, search, eye, calendar, clock, money, chart, sun, moon, tree, house

DIRECT DRAW COMMANDS ARE LITERAL:
- If latest says "draw/sketch/doodle me a <thing>" or asks for a simple object/animal/person/place, draw THAT literal thing. Do NOT turn it into a meeting diagram, user flow, sticky wall, or random summary.
- For animals/objects, use 8-18 path/stroke/ellipse/line primitives to make a recognizable rough illustration: head/body/eyes/ears/limbs/tail/details. Add at most one small caption.
- Example: "draw me a monkey" → rough monkey with round head, ears, eyes, muzzle, body, arms, tail, maybe banana. No product-flow boxes unless the user explicitly says user flow/wireframe/diagram.

HOW TO THINK (pick the format that fits the latest request):
- Discussing a process / user flow → boxes + arrows, optional icons per step, a heading text on top
- Debating tradeoffs → two columns of sticky notes (e.g. "Pros" pink vs "Cons" blue) with a heading
- Brainstorming → a loose cluster of 4-8 sticky notes in different colors, maybe a "path" lasso around the cluster
- System architecture → icons (server, database, cloud, user) connected by arrows, labeled
- Decision point → diamond with yes/no arrows leading to outcomes
- Journey / timeline → horizontal arrow with rects above/below as phases and notes for emotion
- Concept being explained → a quick illustration using path + icons, with a text caption
- Quote / "what someone said" → a text in italic with a path callout bubble around it
- Annotation on existing shapes → text + arrow + path (squiggly underline, circle around important thing)

OUTPUT BUDGET:
- 5 to 12 shapes per call. Mix primitives. Don't return all rects, don't return all notes — combine.
- Always include at least one text heading or label if you're starting a new diagram, so the viewer knows what they're looking at.
- Use color stickies meaningfully (yellow=idea, pink=problem/risk, blue=question, green=decision/agreement).
- Use "path" liberally for hand-drawn touches: a swoosh under a heading, a circle around a key idea, a thought bubble.

HARD RULES:
- DO NOT redraw anything listed under "Already on canvas". Extend, don't repeat.
- DO NOT generate empty shapes; every text/note must have meaningful text drawn from the conversation.
- If the latest chunk is small-talk / filler with no visual content, return shapes:[].
- Return ONLY valid JSON, no commentary.`;

const roughMonkey = () => ({
  shapes: [
    { type: "text", id: `t_monkey_${Date.now()}`, x: 110, y: 555, text: "quick monkey", size: 14, weight: "bold" },
    { type: "ellipse", id: `e_head_${Date.now()}`, x: 130, y: 585, w: 92, h: 76, label: "" },
    { type: "ellipse", id: `e_body_${Date.now()}`, x: 146, y: 655, w: 70, h: 82, label: "" },
    { type: "ellipse", id: `e_ear_l_${Date.now()}`, x: 112, y: 608, w: 34, h: 38, label: "" },
    { type: "ellipse", id: `e_ear_r_${Date.now()}`, x: 207, y: 608, w: 34, h: 38, label: "" },
    { type: "ellipse", id: `e_muzzle_${Date.now()}`, x: 154, y: 625, w: 46, h: 26, label: "" },
    { type: "path", id: `p_eye_l_${Date.now()}`, points: [[158, 615], [160, 617], [162, 615]], closed: false },
    { type: "path", id: `p_eye_r_${Date.now()}`, points: [[189, 615], [191, 617], [193, 615]], closed: false },
    { type: "path", id: `p_smile_${Date.now()}`, points: [[166, 638], [178, 645], [192, 638]], closed: false },
    { type: "path", id: `p_arm_l_${Date.now()}`, points: [[152, 680], [118, 705], [100, 690]], closed: false },
    { type: "path", id: `p_arm_r_${Date.now()}`, points: [[210, 680], [248, 704], [265, 687]], closed: false },
    { type: "path", id: `p_tail_${Date.now()}`, points: [[207, 710], [264, 720], [280, 675], [250, 664]], closed: false },
  ],
  rationale: "drew a literal quick monkey sketch",
});

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

        let body: { transcript?: string; latest?: string; existing?: string; sessionContext?: { name?: string; goal?: string; outputs?: string[]; facilitation?: string; hostRole?: string } | null };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const transcript = (body.transcript ?? "").trim();
        const latest = (body.latest ?? "").trim();
        if ((latest || transcript).length < 12) {
          return new Response(JSON.stringify({ shapes: [], rationale: "not enough transcript" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (/\b(draw|sketch|doodle)\b[\s\S]{0,80}\bmonkey\b/i.test(latest)) {
          return Response.json(roughMonkey());
        }

        const ctx = body.sessionContext;
        const ctxBlock = ctx && (ctx.goal || ctx.name) ? `# Session setup (use this as the through-line for everything you draw)
Title: ${ctx.name || "(untitled)"}
Goal: ${ctx.goal || "(not set)"}
Desired outputs: ${(ctx.outputs ?? []).join(", ") || "(none)"}
Host role: ${ctx.hostRole || "(unspecified)"}
Your mode: ${ctx.facilitation || "scribe"} — ${ctx.facilitation === "facilitator" ? "actively prompt, summarize, push toward decisions visually." : ctx.facilitation === "devils-advocate" ? "surface risks, gaps, and counterpoints as pink stickies and warning icons." : "stay quiet, draw what you hear, don't editorialize."}

` : "";

        const userMsg = `${ctxBlock}# Already on canvas (do NOT repeat any of these)
${body.existing || "(empty)"}

# Full recent conversation
${transcript}

# Latest chunk to react to
${latest || transcript}`;

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
