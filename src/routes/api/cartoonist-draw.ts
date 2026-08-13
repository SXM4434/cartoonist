import { createFileRoute } from "@tanstack/react-router";
import { guardExpensiveRoute } from "@/lib/room-guard.server";

const SYSTEM_PROMPT = `You are CARTOONIST — a senior visual thinker and sketch artist embedded in a live meeting. You CONTEXTUALIZE the conversation and then DRAW on a shared whiteboard the way a designer would. Whatever best expresses what people are saying — pick the medium that fits, don't default to one shape.

You receive:
- the FULL recent conversation — use it to understand THEME and INTENT
- the LATEST chunk — what the speaker just added; this is usually what to react to next
- a summary of what's already on the canvas (with ids) — you can REFERENCE those ids to annotate, revise, or remove them

# STEP 1 — CLASSIFY & PICK A MODALITY (planner, do this silently before drawing)
Choose ONE modality for this turn:
- ui_wireframe  → the speaker asks for a wireframe, mockup, UI screen, interface, app page, dashboard, editor, website, or high-fidelity product concept. Draw ACTUAL SCREENS, never a flowchart describing the screens.
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
  "modality": "ui_wireframe"|"fetch_card"|"template_shape"|"free_sketch"|"typed_note"|"annotation"|"skip",
  "shapes":   [ ...primitives... ],
  "edits":    [ { "id": "<existing id>", "patch": { ...partial fields... } } ],
  "removes":  [ "<existing id>", ... ],
  "speak":    "<optional short spoken interjection, <=140 chars, plain sentence>",
  "thread_ref": "<optional id from openThreads THIS turn extends or references, or null>",
  "relation":   "extends"|"references"|"contradicts"|"resolves"|null,
  "rationale": "<one short sentence>"
}

# CROSS-TIME THREADS (v2.P6)
You will receive an "openThreads" list — past utterances that already have shapes on the canvas. If the LATEST chunk is clearly continuing, answering, contradicting, or resolving one of those threads (not just a new topic), set "thread_ref" to that thread id and pick a "relation":
- extends     → adds detail to the same idea
- references  → touches it in passing
- contradicts → disagrees with what was drawn
- resolves    → closes the question the thread raised
Only set thread_ref when the link is real. If the latest chunk is a genuinely new topic, omit thread_ref (or set null). When you set thread_ref, place new shapes NEAR the referenced shapes' bboxes on the canvas — don't march to the right edge.

# SPEAK (voice — v2.P4)
The mediator has a voice. Include a "speak" string ONLY when a short spoken nudge adds real value:
- surfacing an unresolved-thread from live state ("Priya, we didn't get back to your point about pricing")
- inviting a quiet participant at a natural pause ("Sam — anything to add?")
- reflecting a decision as it lands ("Sounds like we're going with option B")
Rules: <=140 chars, calm and warm, no jargon, first names only. NEVER name a participant who is NOT in the voiceAllowedNames list. If nothing worth saying, OMIT the field or use "". Do not speak on every turn — silence is usually right.

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

Visual fields available on every primitive:
- style: "sketch" | "ui". REQUIRED as "ui" for every ui_wireframe primitive.
- tone: "ink" | "surface" | "subtle" | "accent" | "muted" | "success" | "danger". Use semantic tones to establish real UI hierarchy.

REVISE MODE:
- If the latest chunk expresses dissatisfaction ("redo", "again", "make it simpler", "that's wrong", "fix the flow", "change X to Y", "remove the …", "scrap that", "no, more like …") — DO NOT append a fresh diagram beside the broken one.
  * Prefer 'edits' with { id, patch } to nudge positions, relabel, resize, recolor.
  * Use 'removes' to drop shapes that are wrong or should be replaced.
  * Only add 'shapes' for genuinely new elements the revision needs.
- Only touch ids that appear in "Already on canvas". Never fabricate ids.

OUTPUT BUDGET:
- ui_wireframe: 70–170 shapes arranged inside 1–3 screen frames. Under 60 is a failed answer.
- template_shape: 5–12 shapes.
- free_sketch: 6–14 paths + 1 caption.
- typed_note / fetch_card: 1–2 shapes.
- annotation: 1–3 shapes (text + arrow, optional underline path).
- Revisions: 1–6 edits/removes and 0–4 new shapes.
- Every text/note must have meaningful text drawn from the conversation. Never invent facts, numbers, or names not in the transcript.
- Return ONLY valid JSON, no commentary.`;

const WIREFRAME_SPEC = `# UI WIREFRAME MODE — NON-NEGOTIABLE, MAX FIDELITY
When modality is ui_wireframe you are a product designer drawing REAL, PRODUCTION-READY SCREENS at high fidelity. Never a flowchart, never labelled boxes with arrows, never a process. Every primitive MUST include "style":"ui".

VISUAL SYSTEM (required): use tone:"surface" for the screen and raised controls, tone:"subtle" for sidebars/selected rows/input wells, tone:"accent" only for the primary action and active indicators, tone:"muted" for secondary copy/icons, tone:"danger" only for destructive/error state, and tone:"ink" for outlines/headings. Filled regions need fill:"solid". The result must read like a polished product mockup, not monochrome boxes.

Screen frame: outer rect 520–760 wide, 420–620 tall. 1–3 frames laid out left→right with 80px gutters. Everything else nests INSIDE a frame on an 8px rhythm with 16–24px padding.

Every screen MUST contain, wherever the product implies it:
1. Window chrome: title bar rect (h 34–40) with product name text (size 13) at left, 3 small right-side control rects, and a hairline under it.
2. Navigation: left sidebar rect (w 120–170, tone subtle) OR a top tab strip. Sidebar gets 4–7 row rects (h 26–30) each with its own icon + text label. Mark the active row with tone accent or a 3px accent rail.
3. Toolbar / action rail: 4–8 small rects (28–36 square, or 70x26 buttons) with real verb labels.
4. Main content: the actual thing — canvas with node cards + ports, table with a header row and 4–6 data rows separated by lines, card grid (3–6 cards each with a thumbnail rect, title text 13, meta text 11), chat thread bubbles, timeline track, or media tray. Draw the rows/cards individually; never one empty box labelled "Content".
5. Inputs: field rects (h 30–34, tone surface/subtle) with placeholder text INSIDE, a search field with icon, and at least one primary button rect (tone accent, fill solid) plus one secondary (outline) with real labels ("Generate", "Publish", "Add node").
6. Right panel / inspector when relevant: property rows — label text at left, value/field rect at right, separated by hairlines.
7. Status: footer or status bar with counts, state, or a progress track (two nested rects).
8. Real copy everywhere, drawn from the conversation. No lorem, no "Label", no "Box 1".

Type ladder for wireframes: 11 (meta/caption), 13 (body/labels), 15 (section heads), 22 (screen title). Use text size field accordingly.
TEXT RULE (critical): in ui_wireframe mode rects carry NO label — leave label empty and place a separate 'text' primitive at x = rect.x + 10, y = rect.y + (rect.h/2) - 7. Keep labels under 26 characters, one text per rect, and never place two texts within 16px vertically of each other. A rect narrower than 8 * (label length) must get a shorter label.
NO ARROWS in ui_wireframe except short port-to-port connector 'line' primitives inside a node canvas.
Density: a finished screen is 140–320 coherent primitives across passes. Fidelity is built PROGRESSIVELY — the first pass lays down real structure and later passes add components, micro-detail, copy, and states. Coherence, realistic hierarchy, and precise alignment matter more than raw count. Never emit a handful of labelled boxes and call it a screen.
MICRO-DETAIL (required, this is what separates a real screen from boxes): avatar ellipses on rows, count badges (small rect + 11px number), a scrollbar track rect (w 4–6) on scrollable panes, keyboard-shortcut chips, tab underline (2px filled rect) on the active tab, breadcrumb texts separated by "/" texts, hover/selected row fills, disabled rows in a lighter treatment, at least one empty-state or loading placeholder line rect, tooltips or helper text at 11px under a field, checkbox/toggle rects (14x14) with labels, and per-item meta like "3 min ago" or "v2".
Use hairline 'line' primitives for dividers, 'icon' for glyphs, 'rect' with fill for filled buttons/active states, and text for every label. Do NOT emit arrows between labeled boxes, a user flow, a system diagram, a conceptual process, or boxes named "User Interaction", "AI Tool", "Canvas Tool", "Workflow", or "Desired Output". For a node-canvas product, draw the application chrome plus the actual node canvas, node cards with titled headers and input/output port ellipses, connector lines between ports, media tray thumbnails, a contextual voice-comment marker, and an output preview panel.

# LAYOUT GRID (keeps dense screens legible)
Work on an 8px rhythm. Nothing overlaps: before emitting a primitive, check it does not intersect one you already emitted except as intentional nesting (a child fully inside its parent with >=8px inset). Text baselines never collide — minimum 16px vertical separation between two texts in the same column.

# MAX FIDELITY LADDER
Fidelity is built in additive LAYERS across several passes. Each pass returns ONLY new primitives:
- L1 structure: frames, chrome, nav, panels, main content regions, primary buttons.
- L2 components: every row / card / node / table row drawn individually with its own title, meta and control.
- L3 micro-detail: avatars, badges, scrollbars, tab underlines, breadcrumbs, checkboxes, helper text, dividers, selected/hover fills, port ellipses, connector lines.
- L4 copy + states: real product copy everywhere, empty/loading/error states, tooltips, keyboard chips, counts, timestamps, version tags.
Never stall trying to emit all layers at once — emit this pass's layer densely and well.`;

const REVISE_INTENT = /\b(redo|again|do[-\s]?over|make it (better|simpler|cleaner|smaller|bigger|nicer)|that('?s| is) (wrong|bad|off|ugly|terrible|awful)|fix (the )?(flow|diagram|drawing|sketch|layout)|change .+ to .+|remove (the )?|scrap (that|it)|no,? (more like|not like|try)|not what i (meant|wanted)|wrong|broken|garbage)\b/i;

const UI_WIREFRAME_INTENT = /\b(high[-\s]?fi(?:delity)?|wireframes?|mockups?|ui screens?|interface|dashboard|editor|app (?:screen|page)|website (?:screen|page)|product screen)\b/i;
const MAX_FIDELITY_INTENT = /\b(max(?:imum)?\s*(?:fidelity|detail)|as detailed as possible|most detailed|hi[-\s]?fi|high[-\s]?fi(?:delity)?|pixel[-\s]?perfect|production[-\s]?ready|fully detailed|beautiful|polished|realistic)\b/i;
const NON_SPEECH_TRANSCRIPT = /^\s*\[(?:silence|heartbeat|background noise|music|outro jingle|bell dings?|birds chirping|door squeaking)\]\s*$/i;

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
          roomId?: string;
          transcript?: string;
          latest?: string;
          existing?: string;
          occupied?: { minX: number; minY: number; maxX: number; maxY: number } | null;

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
          agentsBlock?: string | null;
          voiceAllowedNames?: string[] | null;
          openThreads?: Array<{ id: string; latest: string; modality?: string | null }> | null;
          handsUp?: string[] | null;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid draw request", shapes: [], edits: [], removes: [] }, 400);
        }

        const blocked = await guardExpensiveRoute(request, {
          route: "cartoonist-draw", maxBytes: 400_000, limit: 60, roomId: body.roomId,
        });
        if (blocked) return blocked;

        const transcript = compactText(body.transcript, 3200);
        const latest = compactText(body.latest, 1200);
        if (NON_SPEECH_TRANSCRIPT.test(latest)) {
          return json({ modality: "skip", shapes: [], edits: [], removes: [], rationale: "skip: non-speech audio label" });
        }
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

        // v2.P3 follow-up — unified per-user agent block (past/present/future).
        // Prefer it when the client sent one; fall back to the older ad-hoc
        // participant summary for older callers.
        const agentsBlockRaw = typeof body.agentsBlock === "string" ? body.agentsBlock.trim() : "";
        const parts = (body.participants ?? []).slice(0, 10);
        const participantsBlock = agentsBlockRaw
          ? `# Participants (per-user agents — past = what they bring, present = live focus, future = needs/worries. Route questions and calibrate tone from this. Reference by first name.)
${agentsBlockRaw.slice(0, 3000)}

`
          : parts.length
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


        const reviseIntent = REVISE_INTENT.test(latest || "") || /\b(not|isn'?t|aren'?t|doesn'?t).{0,40}\b(high[-\s]?fi(?:delity)?|wireframes?|ui screens?)\b/i.test(latest || "");
        // Progressive enrichment pass requested by the client (1..4).
        const enrichPass = Math.max(0, Math.min(4, Number((body as { enrichPass?: unknown }).enrichPass ?? 0) | 0));
        const clientMaxFidelity = (body as { maxFidelity?: unknown }).maxFidelity === true;
        const uiWireframeIntent = enrichPass > 0 || clientMaxFidelity || UI_WIREFRAME_INTENT.test(`${latest}\n${transcript}`);
        // "max fidelity" language unlocks the full 4-layer ladder; otherwise 2.
        const maxFidelity = clientMaxFidelity || MAX_FIDELITY_INTENT.test(`${latest}\n${transcript}`);
        const maxPasses = maxFidelity ? 4 : 2;
        // The client's render system (lofi | mid | hifi) sets how much visual
        // information each primitive should carry.
        const rawFidelity = String((body as { fidelity?: unknown }).fidelity ?? "mid");
        const renderFidelity: "lofi" | "mid" | "hifi" =
          rawFidelity === "lofi" || rawFidelity === "hifi" ? rawFidelity : "mid";
        const fidelityBlock =
          renderFidelity === "lofi"
            ? `# RENDER FIDELITY — LO-FI\nThink in blocks. No tones except "ink"/"muted", no fills, no micro-copy. Placeholder labels are fine.`
            : renderFidelity === "hifi"
              ? `# RENDER FIDELITY — HI-FI\nUse the full semantic tone set (surface, subtle, accent, success, danger), real product copy, real numbers, and component-level detail.`
              : `# RENDER FIDELITY — MID\nReal structure and real labels, but restrained color: "accent" only for the single primary action, state tones only for status.`;



        const existingBlock = compactText(body.existing, 18000) || "(empty)";
        const canvasHeader = reviseIntent
          ? `# Already on canvas (REVISE MODE — the user is unhappy, prefer edits/removes on these ids over adding new shapes)`
          : `# Already on canvas (extend, don't repeat; you may reference these ids in edits/removes if the user asks to change them)`;

        const voiceNames = Array.isArray(body.voiceAllowedNames) ? body.voiceAllowedNames.filter((s) => typeof s === "string" && s.trim().length > 0) : [];
        const voiceBlock = `# voiceAllowedNames (only these participants have opted in to being named by voice — never speak the name of anyone not on this list)
${voiceNames.length ? voiceNames.map((n) => `- ${n}`).join("\n") : `(nobody has opted in — omit the "speak" field entirely this turn)`}

`;

        // v2.P6 — open threads the model may extend / reference.
        const openThreads = Array.isArray(body.openThreads) ? body.openThreads.slice(-8) : [];
        const openThreadsBlock = openThreads.length
          ? `# openThreads (past utterances with shapes still on canvas — you MAY set thread_ref to one of these ids)
${openThreads.map((t) => `- ${t.id}${t.modality ? ` [${t.modality}]` : ""}: "${(t.latest ?? "").slice(0, 140)}"`).join("\n")}

`
          : "";

        // Raise-hand queue → mediator prefers to invite the first name in
        // the queue during any natural pause, using `speak` (only if that
        // name is in voiceAllowedNames). Never scold anyone for talking too
        // much; just open a lane for the raised hand.
        const handsUp = Array.isArray(body.handsUp) ? body.handsUp.filter((s) => typeof s === "string" && s.trim().length > 0) : [];
        const handsBlock = handsUp.length
          ? `# handsUp (raise-hand queue, in order — at a natural pause, invite the first name via \`speak\` if they are also in voiceAllowedNames; keep it warm, one short sentence)
${handsUp.map((n, i) => `${i + 1}. ${n}`).join("\n")}

`
          : "";

        // Layered enrichment briefs — each pass thickens one layer only, so
        // every call stays fast and the screen fills in live.
        const LAYER_BRIEFS: Record<number, string> = {
          1: `LAYER 2 — COMPONENTS. Use the COMPLETE geometry digest below. Reuse the exact frame/panel coordinates as boundaries. Draw every row, card, node, table row, list item, tab and toolbar button INDIVIDUALLY inside those existing panels: each with its own container rect, title text (13), meta text (11) and any control it owns. Add inputs with placeholder text inside, primary + secondary buttons with real verbs, inspector property rows (label left, field right), hairline dividers between rows.`,
          2: `LAYER 3 — MICRO-DETAIL. Add the detail layer only: avatar ellipses, count badges (small rect + 11px number), scrollbar track rects (w 4–6), active-tab underline (2px filled rect), breadcrumb texts separated by "/", selected/hover row fills, checkbox and toggle rects (14x14) with labels, node input/output port ellipses with connector lines, thumbnail rects inside cards, icon glyphs beside every nav and toolbar label.`,
          3: `LAYER 4 — COPY + STATES. Replace nothing; ADD real product copy and state affordances: helper text (11) under fields, tooltips, keyboard-shortcut chips, timestamps and version tags on items ("3 min ago", "v2"), counts in section headers, one empty-state line group, one loading placeholder row group, one disabled/error row treatment, status-bar text with live counts.`,
          4: `LAYER 5 — POLISH. Final tightening pass: fill any remaining visual gaps inside the frames — section header texts, group labels, sub-dividers, corner controls, resize handles, minimap or overview rect, legend, and any missing labels on unlabeled rects. Keep everything inside existing frames.`,
        };
        const intentOverride = enrichPass > 0 ? `# ENRICHMENT PASS ${enrichPass} of ${maxPasses} (ADDITIVE ONLY)
${LAYER_BRIEFS[enrichPass] ?? LAYER_BRIEFS[2]}
Do NOT redraw the screen and do NOT repeat any primitive already listed on the canvas below. Return ONLY NEW primitives with fresh unique ids, modality "ui_wireframe", empty edits/removes, no "speak". Emit ${maxFidelity ? "35–75" : "30–60"} new primitives. Every primitive must include style:"ui". Children may nest inside their owning panel; siblings and text baselines must not collide.

` : uiWireframeIntent ? `# REQUIRED RENDER MODE${maxFidelity ? " — MAXIMUM FIDELITY REQUESTED" : ""}
The user is requesting UI wireframes. You MUST return modality "ui_wireframe" and draw detailed, nested product screens. Do not return template_shape, a process, or a conceptual box flow. If this is a correction, remove the incorrect flow shapes and replace them with actual screens rather than relabeling them.

LAYER 1 — STRUCTURE. Draw the full screen skeleton now: outer frame(s), window chrome, navigation (sidebar or tab strip), toolbars, the main content region with its real sub-panels, right inspector when relevant, and the primary buttons. Emit 28–45 carefully aligned primitives on this pass so a complete screen appears immediately. ${maxPasses} further additive passes will layer components, micro-detail${maxFidelity ? ", copy/states and polish" : ""} on top. Do not include row-by-row micro-detail yet.

` : "";

        // Hard placement rule: brand-new drawings go in empty canvas space to
        // the right of everything already drawn. Enrichment passes nest inside.
        const occ = body.occupied && typeof body.occupied === "object" ? body.occupied : null;
        const placementBlock =
          enrichPass === 0 && occ && Number.isFinite(occ.maxX)
            ? `# PLACEMENT (HARD RULE)
The canvas is infinite and the region x ${Math.round(occ.minX)}..${Math.round(occ.maxX)}, y ${Math.round(occ.minY)}..${Math.round(occ.maxY)} is ALREADY OCCUPIED.
Every NEW primitive this turn must start at x >= ${Math.round(occ.maxX) + 280}. Never draw on top of, or overlapping, existing work. Lay new screens/diagrams out side by side, left to right.

`
            : "";

        const userMsg = `${intentOverride}${placementBlock}${fidelityBlock}\n\n${ctxBlock}${participantsBlock}${liveStatesBlock}${voiceBlock}${openThreadsBlock}${handsBlock}${canvasHeader}
${existingBlock}


# Full recent conversation
${transcript}

# Latest chunk to react to
${latest || transcript}`;

        // Route to Flash by default for latency; escalate to Pro when the
        // user is asking for a revision (reasoning-heavy) or when there's
        // an unresolved-thread the mediator may need to surface carefully.
        // Wireframes run on Flash-3: fidelity comes from the layered passes,
        // not from one giant slow Pro call.
        const hasUnresolved = states.some((s) => s.focus === "unresolved-thread");
        // Max fidelity is achieved by the complete-geometry additive ladder,
        // not by holding the first visible frame behind a slow model. 2.5
        // Flash produces the bounded structure quickly; Gemini 3 handles the
        // geometry-aware detail layers once users already have a screen.
        const model = uiWireframeIntent
          ? enrichPass > 0 ? "google/gemini-3-flash-preview" : "google/gemini-2.5-flash"
          : reviseIntent || hasUnresolved
            ? "google/gemini-2.5-pro"
            : "google/gemini-2.5-flash";
        // Pricing per 1M tokens (USD)
        const pricing: Record<string, { in: number; out: number }> = {
          "google/gemini-2.5-pro": { in: 1.25, out: 5.0 },
          "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
          "google/gemini-3-flash-preview": { in: 0.5, out: 3.0 },
          "google/gemini-3-pro-preview": { in: 2.0, out: 12.0 },
        };

        type Usage = { prompt_tokens?: number; completion_tokens?: number };
        const callGateway = async (messages: Array<{ role: string; content: string }>) =>
          fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            // Dense structured JSON can legitimately take longer than a chat
            // turn. The old 75s server abort killed valid wireframes before
            // the gateway could deliver them, producing a blank canvas.
            signal: AbortSignal.timeout(uiWireframeIntent ? 210000 : 16000),
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              response_format: { type: "json_object" },
              ...(uiWireframeIntent ? { max_tokens: enrichPass > 0 ? 14000 : 8000 } : { max_tokens: 3000 }),
              messages,
            }),
          });

        // Latency: conversational turns never see the wireframe spec — it is
        // ~2.5k tokens of prompt that only matters when drawing screens.
        const baseMessages = [
          { role: "system", content: uiWireframeIntent ? `${SYSTEM_PROMPT}\n\n${WIREFRAME_SPEC}` : SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ];


        let res: Response;
        try {
          res = await callGateway(baseMessages);
        } catch (error) {
          console.error("AI draw request failed", error);
          const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
          return json({ error: timedOut ? "The drawing took too long. Your request was kept — pause and it will retry." : "AI draw is temporarily unavailable — try again in a moment.", shapes: [], edits: [], removes: [] }, timedOut ? 504 : 502);
        }

        if (!res.ok) {
          const text = await res.text();
          console.error("AI draw gateway error", res.status, text);
          return json({ error: aiDrawErrorMessage(res.status, text), shapes: [], edits: [], removes: [] });
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: Usage;
        };
        const content = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: { shapes?: unknown; edits?: unknown; removes?: unknown; rationale?: unknown; modality?: unknown; speak?: unknown; thread_ref?: unknown; relation?: unknown } = {};
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = {};
        }

        const usageTotals: Usage = {
          prompt_tokens: Number(data.usage?.prompt_tokens ?? 0),
          completion_tokens: Number(data.usage?.completion_tokens ?? 0),
        };

        // PROGRESSIVE DENSITY (was: two blocking full redraws inside this
        // request — that meant 2–4 minutes of a blank canvas before anything
        // appeared). Now the first pass returns immediately and the client
        // asks for additive enrichment passes, so the screen fills in live.





        // v1 P1.9 — live cost meter. Log usage per room so the HUD can sum.
        const inputTokens = Math.max(0, Number(usageTotals.prompt_tokens ?? 0) | 0);
        const outputTokens = Math.max(0, Number(usageTotals.completion_tokens ?? 0) | 0);
        const price = pricing[model] ?? pricing["google/gemini-2.5-pro"];
        const costUsd = (inputTokens * price.in + outputTokens * price.out) / 1_000_000;
        const roomId = typeof body.roomId === "string" ? body.roomId : null;
        if (roomId && (inputTokens || outputTokens)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("ai_calls").insert({
              room_id: roomId,
              stage: "renderer",
              model,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cost_usd: costUsd,
            });
          } catch (err) {
            console.warn("[cartoonist-draw] cost log failed", err);
          }
        }


        // v2.P1.5 anti-fabrication guard: strip fetch_card shapes whose
        // caption URL never appeared verbatim in the transcript. Model is
        // told never to invent URLs, but a belt on the suspenders.
        const modality = typeof parsed.modality === "string" ? parsed.modality : "";
        const rawShapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
        const transcriptForCheck = `${transcript}\n${latest}`;
        // Coerce geometry before it reaches the canvas: tldraw's validator
        // throws on a missing/NaN w or h and takes the whole board down.
        const numOr = (v: unknown, fallback: number) =>
          typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : fallback;
        const sizedShapes = rawShapes.map((s: unknown) => {
          if (!s || typeof s !== "object") return s;
          const shape = s as Record<string, unknown>;
          const t = shape.type;
          if (t === "rect" || t === "ellipse" || t === "diamond" || t === "note") {
            shape.x = numOr(shape.x, 0);
            shape.y = numOr(shape.y, 0);
            shape.w = Math.max(4, numOr(shape.w, t === "note" ? 160 : 160));
            shape.h = Math.max(4, numOr(shape.h, t === "note" ? 140 : 60));
          } else if (t === "arrow" || t === "line") {
            shape.x1 = numOr(shape.x1, 0); shape.y1 = numOr(shape.y1, 0);
            shape.x2 = numOr(shape.x2, 0); shape.y2 = numOr(shape.y2, 0);
          } else if (t === "text" || t === "icon") {
            shape.x = numOr(shape.x, 0);
            shape.y = numOr(shape.y, 0);
          }
          return shape;
        });
        const cleanShapes = sizedShapes.filter((s: unknown) => {
          if (modality !== "fetch_card") return true;
          if (!s || typeof s !== "object") return true;
          const shape = s as Record<string, unknown>;
          const text = typeof shape.text === "string" ? shape.text : typeof shape.label === "string" ? shape.label : "";
          const urlMatch = text.match(/https?:\/\/\S+/i);
          if (!urlMatch) return true;
          return transcriptForCheck.includes(urlMatch[0]);
        });

        // Voice guard: strip speak if it mentions a name not on the allowlist.
        const rawSpeak = typeof parsed.speak === "string" ? parsed.speak.trim().slice(0, 200) : "";
        let safeSpeak = rawSpeak;
        if (safeSpeak) {
          const allowed = new Set(voiceNames.map((n) => n.toLowerCase()));
          const mentions = [...(participantsBlock.match(/- \*\*([^*]+)\*\*/g) ?? [])].map((m) => m.replace(/[-*\s]/g, "").toLowerCase());
          const spoken = safeSpeak.toLowerCase();
          for (const name of mentions) {
            if (name && spoken.includes(name) && !allowed.has(name)) { safeSpeak = ""; break; }
          }
        }

        // v2.P6 — validate thread_ref against openThreads we sent in.
        const openIds = new Set(openThreads.map((t) => t.id));
        const rawRef = typeof parsed.thread_ref === "string" ? parsed.thread_ref.trim() : "";
        const threadRef = rawRef && openIds.has(rawRef) ? rawRef : null;
        const allowedRel = new Set(["extends", "references", "contradicts", "resolves"]);
        const rawRel = typeof parsed.relation === "string" ? parsed.relation.trim() : "";
        const relation = threadRef && allowedRel.has(rawRel) ? rawRel : null;

        return json({
          modality,
          shapes: cleanShapes,
          edits: enrichPass > 0 ? [] : Array.isArray(parsed.edits) ? parsed.edits : [],
          removes: enrichPass > 0 ? [] : Array.isArray(parsed.removes) ? parsed.removes : [],
          speak: enrichPass > 0 ? "" : safeSpeak,
          thread_ref: threadRef,
          relation,
          // Progressive fidelity: tell the client it may ask for another
          // additive pass once these shapes are on screen.
          enrichPass,
          maxPasses,
          maxFidelity,
          enrichable: uiWireframeIntent && enrichPass < maxPasses && cleanShapes.length > 0,

          rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
        });
      },
    },
  },
});
