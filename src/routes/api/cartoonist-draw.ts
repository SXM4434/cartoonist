import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are CARTOONIST — a senior visual thinker and sketch artist embedded in a live meeting. You CONTEXTUALIZE the conversation and then DRAW on a shared whiteboard the way a designer would: diagrams, flows, sketches, FigJam-style sticky walls, system maps, journey maps, wireframes, quick illustrations, callouts, headings, arrows, anything. Whatever best expresses what the people are saying — pick the medium that fits, don't default to one shape.

You receive:
- the FULL recent conversation (multiple utterances) — use it to understand the THEME and INTENT, not just the last sentence
- the LATEST chunk — what the speaker just added; this is usually what to draw next
- a summary of what's already on the canvas (with ids) — you can REFERENCE those ids to revise or remove them

Return STRICT JSON with any of these keys (at least one non-empty):
{
  "shapes":  [ ...primitives... ],           // NEW shapes to add
  "edits":   [ { "id": "<existing id>", "patch": { ...partial primitive fields... } } ],  // revise existing AI shapes
  "removes": [ "<existing id>", ... ],        // delete AI shapes that are wrong / superseded
  "rationale": "<one short sentence>"
}

Canvas: 1600x1000, origin top-left. Standard box w=180 h=80. Sticky note w=160 h=140. Leave ~60-80px gutters. Arrows touch box EDGES. Group related shapes spatially. Use the empty regions of the canvas — don't pile new shapes on top of old ones.

Primitives (id globally unique; prefix by kind: r_ e_ d_ a_ l_ t_ n_ p_ i_):
- rect    { type, id, x, y, w, h, label }
- ellipse { type, id, x, y, w, h, label }
- diamond { type, id, x, y, w, h, label }
- arrow   { type, id, x1, y1, x2, y2, label?, dashed? }
- line    { type, id, x1, y1, x2, y2, dashed? }
- text    { type, id, x, y, text, size?, weight?, italic?, align? }
- note    { type, id, x, y, w, h, text, color: yellow|pink|blue|green }
- path    { type, id, points: [[x,y],...], closed?, fill? }
- icon    { type, id, kind, x, y, size?, label? }

HOW TO THINK (pick the format that fits the conversation):
- Process / user flow → boxes + arrows, optional icons, heading on top
- Tradeoffs → two columns of sticky notes with a heading
- Brainstorm → loose cluster of 4-8 sticky notes in different colors
- System architecture → icons connected by arrows, labeled
- Decision point → diamond with yes/no arrows leading to outcomes
- Journey / timeline → horizontal arrow with rects as phases
- Literal sketch → 6-14 separate path contours, loose and imperfect

REVISE MODE (critical):
- If the latest chunk expresses dissatisfaction — "redo", "again", "make it (better|simpler|cleaner)", "that's wrong / bad / off", "fix the flow", "change X to Y", "remove the …", "scrap that", "no, more like …" — DO NOT append a fresh diagram beside the broken one. Revise the existing cluster:
  * Prefer 'edits' with { id, patch } to nudge positions, relabel, resize, recolor.
  * Use 'removes' to drop shapes that are wrong or should be replaced.
  * Only add 'shapes' for genuinely new elements the revision needs.
- Only touch ids that appear in "Already on canvas". Never fabricate ids.
- Patches are partial: include only fields you're changing (e.g. {"label":"Sign in"} or {"x":200,"y":340}).

OUTPUT BUDGET:
- Additive draws: 5–12 shapes.
- Revisions: tight — 1–6 edits/removes and 0–4 new shapes.
- Every text/note must have meaningful text drawn from the conversation.
- If the latest chunk is small-talk with no visual content, return {"shapes":[]}.
- Return ONLY valid JSON, no commentary.`;

const REVISE_INTENT = /\b(redo|again|do[-\s]?over|make it (better|simpler|cleaner|smaller|bigger|nicer)|that('?s| is) (wrong|bad|off|ugly|terrible|awful)|fix (the )?(flow|diagram|drawing|sketch|layout)|change .+ to .+|remove (the )?|scrap (that|it)|no,? (more like|not like|try)|not what i (meant|wanted)|wrong|broken|garbage)\b/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const compactText = (value: string | undefined, max: number) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.35);
  const tail = max - head;
  return `${text.slice(0, head)} … ${text.slice(-tail)}`;
};

const aiDrawErrorMessage = (status: number, detail: string) => {
  const lower = detail.toLowerCase();
  if (status === 402 || lower.includes("payment_required") || lower.includes("not enough credits")) {
    return "Out of AI credits — add credits in workspace settings, then try drawing again.";
  }
  if (status === 429 || lower.includes("rate limit")) {
    return "Rate limit hit — wait a moment and try drawing again.";
  }
  if (status === 504 || lower.includes("timeout")) {
    return "The sketch model timed out — try a shorter prompt.";
  }
  return "AI draw is temporarily unavailable — try again in a moment.";
};

export const Route = createFileRoute("/api/cartoonist-draw")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return json({ error: "AI draw is not configured yet.", shapes: [], edits: [], removes: [] });
        }

        let body: {
          transcript?: string;
          latest?: string;
          existing?: string;
          sessionContext?: { name?: string; goal?: string; outputs?: string[]; facilitation?: string; hostRole?: string } | null;
          participants?: Array<{
            name: string;
            role?: string | null;
            role_today?: string | null;
            strengths?: string[] | null;
            feedback_style?: string | null;
            contribution_modes?: string[] | null;
            needs_today?: string | null;
            blockers?: string | null;
            can_help_with?: string | null;
            share_blockers?: boolean | null;
            share_needs?: boolean | null;
          }> | null;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid draw request", shapes: [], edits: [], removes: [] }, 400);
        }

        const transcript = compactText(body.transcript, 3200);
        const latest = compactText(body.latest, 1200);
        if ((latest || transcript).length < 12) {
          return json({ shapes: [], edits: [], removes: [], rationale: "not enough transcript" });
        }

        const ctx = body.sessionContext;
        const ctxBlock = ctx && (ctx.goal || ctx.name) ? `# Session setup (use this as the through-line for everything you draw)
Title: ${ctx.name || "(untitled)"}
Goal: ${ctx.goal || "(not set)"}
Desired outputs: ${(ctx.outputs ?? []).join(", ") || "(none)"}
Host role: ${ctx.hostRole || "(unspecified)"}
Your mode: ${ctx.facilitation || "scribe"} — ${ctx.facilitation === "facilitator" ? "actively prompt, summarize, push toward decisions visually." : ctx.facilitation === "devils-advocate" ? "surface risks, gaps, and counterpoints as pink stickies and warning icons." : "stay quiet, draw what you hear, don't editorialize."}

` : "";

        // v2.P1 — compact participant block. Mediator uses stated preferences
        // to route the right question to the right person and calibrate tone.
        const parts = (body.participants ?? []).slice(0, 10);
        const participantsBlock = parts.length
          ? `# Participants in the room (route questions and calibrate tone using these — reference by first name when it helps)
${parts.map((p) => {
  const role = (p.role_today || p.role || "").toString().trim();
  const strengths = (p.strengths ?? []).slice(0, 2).filter(Boolean).join(", ");
  const style = p.feedback_style ? `${p.feedback_style} feedback` : "";
  const modes = (p.contribution_modes ?? []).filter(Boolean).join("/");
  const need = p.share_needs && p.needs_today ? `need: ${p.needs_today}` : "";
  const blk = p.share_blockers && p.blockers ? `worry: ${p.blockers}` : "";
  const help = p.can_help_with ? `help: ${p.can_help_with}` : "";
  const bits = [role, strengths && `strong: ${strengths}`, style, modes && `prefers ${modes}`, need, blk, help].filter(Boolean).join(" · ");
  return `- ${p.name}${bits ? ` (${bits})` : ""}`;
}).join("\n")}

`
          : "";

        const reviseIntent = REVISE_INTENT.test(latest || "");
        const existingBlock = compactText(body.existing, 2400) || "(empty)";
        const canvasHeader = reviseIntent
          ? `# Already on canvas (REVISE MODE — the user is unhappy, prefer edits/removes on these ids over adding new shapes)`
          : `# Already on canvas (extend, don't repeat; you may reference these ids in edits/removes if the user asks to change them)`;

        const userMsg = `${ctxBlock}${participantsBlock}${canvasHeader}
${existingBlock}

# Full recent conversation
${transcript}

# Latest chunk to react to
${latest || transcript}`;

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
          console.error("AI draw request failed", error);
          return json({ error: "AI draw is temporarily unavailable — try again in a moment.", shapes: [], edits: [], removes: [] });
        }

        if (!res.ok) {
          const text = await res.text();
          console.error("AI draw gateway error", res.status, text);
          return json({ error: aiDrawErrorMessage(res.status, text), shapes: [], edits: [], removes: [] });
        }

        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: { shapes?: unknown; edits?: unknown; removes?: unknown; rationale?: unknown } = {};
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = {};
        }

        return json({
          shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
          edits: Array.isArray(parsed.edits) ? parsed.edits : [],
          removes: Array.isArray(parsed.removes) ? parsed.removes : [],
          rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
        });
      },
    },
  },
});
