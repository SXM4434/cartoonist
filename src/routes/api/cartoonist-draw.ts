import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are CARTOONIST — a senior visual thinker and sketch artist embedded in a live meeting. You CONTEXTUALIZE the conversation and then DRAW on a shared whiteboard the way a designer would. Whatever best expresses what people are saying — pick the medium that fits, don't default to one shape.

You receive:
- the FULL recent conversation — use it to understand THEME and INTENT
- the LATEST chunk — what the speaker just added; this is usually what to react to next
- a summary of what's already on the canvas (with ids) — you can REFERENCE those ids to annotate, revise, or remove them

# STEP 1 — CLASSIFY & PICK A MODALITY (planner, do this silently before drawing)
Choose ONE modality for this turn:
- fetch_card    → speaker named an external artifact AND stated a real URL verbatim in the transcript. Emit a text shape with the URL as caption.
- template_shape → process / journey / decision / system / architecture / tradeoff. Emit boxes/arrows/diamonds/notes/icons.
- free_sketch   → an explained concept that doesn't fit a template. Emit 6-14 path primitives, loose and imperfect, plus a short caption text.
- typed_note    → speaker stated a quotable fact / number / decision worth pinning. Emit one 'note' with the exact wording.
- annotation    → speaker is reacting to a shape already on the canvas ("that login step should be biometric"). Emit a small 'text' + 'arrow' anchored NEAR the referenced shape's bbox (use its x/y/w/h from the canvas digest). Prefer this over creating a duplicate.
- skip          → filler, small-talk, ack, repetition of something already drawn, or nothing new to visualize. Return {"shapes":[],"edits":[],"removes":[],"rationale":"skip: <why>"}. Silence is the correct answer most of the time.

# REFERENCE RESOLUTION ORDER (when the speaker names something)
1. Already on canvas? → use 'annotation' modality on the existing shape id.
2. A real URL was spoken verbatim in the transcript? → 'fetch_card' with that URL as caption.
3. Otherwise → 'typed_note' with the speaker's own words in quotes. NEVER fabricate a URL, source, or citation.

# STEP 2 — RETURN STRICT JSON
{
  "modality": "fetch_card"|"template_shape"|"free_sketch"|"typed_note"|"annotation"|"skip",
  "shapes":   [ ...primitives... ],
  "edits":    [ { "id": "<existing id>", "patch": { ...partial fields... } } ],
  "removes":  [ "<existing id>", ... ],
  "rationale": "<one short sentence>"
}

Canvas: 1600x1000, origin top-left. Box w=180 h=80. Sticky w=160 h=140. Leave ~60-80px gutters. Arrows touch box EDGES. Group related shapes spatially. Use empty regions of the canvas — don't pile new shapes on top of old ones.

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

REVISE MODE:
- If the latest chunk expresses dissatisfaction ("redo", "again", "make it simpler", "that's wrong", "fix the flow", "change X to Y", "remove the …", "scrap that", "no, more like …") — DO NOT append a fresh diagram beside the broken one.
  * Prefer 'edits' with { id, patch } to nudge positions, relabel, resize, recolor.
  * Use 'removes' to drop shapes that are wrong or should be replaced.
  * Only add 'shapes' for genuinely new elements the revision needs.
- Only touch ids that appear in "Already on canvas". Never fabricate ids.

OUTPUT BUDGET:
- template_shape: 5–12 shapes.
- free_sketch: 6–14 paths + 1 caption.
- typed_note / fetch_card: 1–2 shapes.
- annotation: 1–3 shapes (text + arrow, optional underline path).
- Revisions: 1–6 edits/removes and 0–4 new shapes.
- Every text/note must have meaningful text drawn from the conversation. Never invent facts, numbers, or names not in the transcript.
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
          liveStates?: Array<{
            name: string;
            focus: "quiet-too-long" | "repeated-ask" | "unresolved-thread";
            last_ms: number | null;
            unresolved_point?: string;
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

        // v2.P2 — live state deltas the facilitator watch emitted. Only
        // non-trivial states (quiet-too-long / repeated-ask / unresolved-thread)
        // arrive here. Mediator may surface these at natural pauses, but must
        // not derail an in-flight thread.
        const states = (body.liveStates ?? []).slice(0, 10);
        const liveStatesBlock = states.length
          ? `# Live state (facilitator watch — surface at natural pauses only, don't derail an active thread)
${states.map((s) => {
  const mins = s.last_ms != null ? Math.round(s.last_ms / 60000) : null;
  const age = mins != null ? `${mins}m since last utterance` : "no utterances yet";
  if (s.focus === "unresolved-thread" && s.unresolved_point) {
    return `- ${s.name}: UNRESOLVED — "${s.unresolved_point}" (raised, no response yet)`;
  }
  if (s.focus === "quiet-too-long") return `- ${s.name}: quiet ${age} — worth a light check-in`;
  if (s.focus === "repeated-ask") return `- ${s.name}: carrying the thread alone — others haven't responded`;
  return `- ${s.name}: ${s.focus}`;
}).join("\n")}
When ready, an 'annotation' anchored on the relevant shape (or a small 'typed_note' near it) is usually the right move to surface an unresolved point. If nothing on canvas maps, prefer 'skip' over inventing a diagram.

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
        let parsed: { shapes?: unknown; edits?: unknown; removes?: unknown; rationale?: unknown; modality?: unknown } = {};
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = {};
        }

        // v2.P1.5 anti-fabrication guard: strip fetch_card shapes whose
        // caption URL never appeared verbatim in the transcript. Model is
        // told never to invent URLs, but a belt on the suspenders.
        const modality = typeof parsed.modality === "string" ? parsed.modality : "";
        const rawShapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
        const transcriptForCheck = `${transcript}\n${latest}`;
        const cleanShapes = rawShapes.filter((s: unknown) => {
          if (modality !== "fetch_card") return true;
          if (!s || typeof s !== "object") return true;
          const shape = s as Record<string, unknown>;
          const text = typeof shape.text === "string" ? shape.text : typeof shape.label === "string" ? shape.label : "";
          const urlMatch = text.match(/https?:\/\/\S+/i);
          if (!urlMatch) return true;
          return transcriptForCheck.includes(urlMatch[0]);
        });

        return json({
          modality,
          shapes: cleanShapes,
          edits: Array.isArray(parsed.edits) ? parsed.edits : [],
          removes: Array.isArray(parsed.removes) ? parsed.removes : [],
          rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
        });
      },
    },
  },
});
