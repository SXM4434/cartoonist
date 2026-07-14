# Cartoonist — Roadmap v2

**Status:** additive plan. Sits on top of `cartoonist-roadmap-v1.md`.
**Rule:** v2 never reorders or rewrites v1. v1 stays frozen until shipped. v2 phases are numbered `v2.P1, v2.P2…` and each declares which v1 phase it slots *after*.
**Promotion:** when v1 finishes, v2 gets merged into a new `cartoonist-roadmap-v3.md`. No silent merging.

---

## Why v2 exists

v1 builds the **meeting medium** — canvas, mediator, drafter, soft-riff lock, cost meter, replay. v2 builds the **participant layer** on top: the room understands the humans in it, not just the conversation. Together they realize the PRD principle "one identity per person" and unlock the per-user agents already promised in v1 Phase 3.

v2 is not a new product. Anything that would turn Cartoonist into an HR tool, mood tracker, or standalone people-ops app is out of scope and listed at the bottom.

---

## v2.P1 — Human Layer check-in + Team Desk (right rail)

**Slots after:** v1 Phase 2 (long-context renderer + custom shape library).
**Status:** shipped 2026-07-12. `participants` gained `strengths / feedback_style / contribution_modes / role_today / blockers / needs_today / can_help_with / share_blockers / share_needs / human_layer_complete`. `TeamDesk` right rail (hotkey T) + `ParticipantCard` + `ModeDot` mounted. `CheckIn` modal opens after self-intro with 15s voice-fill via Web Speech + manual entry + privacy toggles. Participant block now flows into the `cartoonist-draw` mediator prompt so it references stated preferences by first name.
**Est:** ~2 days build.
**Spec:** `feature-human-layer.md`, `feature-team-desk.md`.

Scope:
- Pre-session check-in screen, skippable, 30–60s. Six fields, voice-fill via Scribe or type.
- New columns on `participants`: `strengths`, `feedback_style`, `blockers`, `needs`, `can_help`, `contribution_modes[]`.
- Right-rail `TeamDesk` component in the room. Collapsible. Mirrors the chat rail pattern.
- `ParticipantCard` per person: avatar, name, role, live mode dot (`speaking | typing | sketching | quiet`), one-line open ask or worry.
- Expanded card on click: full profile, last 3 contributions (from transcript_chunks), AI-inferred current focus.
- Mediator system prompt augmented with a compact participant block (1 line per person).

Verification gate:
- A new room shows the check-in. Skipping works. Filling persists.
- Team Desk renders one card per `participants` row, updates mode dot from transcript + canvas events within 2s.
- Mediator output references a participant's stated preference at least once per 5-minute test session.

Out of v2.P1: live state inference beyond mode dot, unresolved-point detection, per-user agents, learning across sessions.

---

## v2.P1.5 — Contextual drawing loop

**Slots after:** v1 Phase 2 (renderer this sits in front of) and v2.P1 (so participant context is available to the planner).
**Est:** ~3 days.
**Spec:** `feature-contextual-drawing.md`. Provenance fields it writes are defined in `feature-canvas-memory.md` §2.
**Status:** shipped 2026-07-12 (single-call planner pass). `cartoonist-draw` system prompt now runs the classify → resolve → pick-modality → render loop in one call and returns `modality` alongside `shapes/edits/removes`. Six modalities licensed with explicit rules for `skip` (silence-first), `annotation` (anchor on existing shape's bbox, prefer over duplicates), and `typed_note` fallback when a reference has no verbatim URL. Anti-fabrication guard on the server strips `fetch_card` shapes whose caption URL doesn't appear verbatim in the transcript. Workspace-memory / connected-docs / real web-search stages remain stubbed as scoped — light up in v2.P6.

Scope:
- Planner stage in front of `cartoonist-draw.ts`: classify intent → resolve references → pick modality → render.
- Six licensed modalities: `fetch_card`, `template_shape`, `free_sketch`, `typed_note`, `annotation`, `skip`.
- Reference resolution order: current canvas → workspace memory (stub until v2.P6) → connected docs → web search → null. Never fabricate a citation.
- Cost meter (PRD §5) attributes planner + renderer stages separately.

Verification gate: the 5-test scripted session in `feature-contextual-drawing.md` §8 — fetch real URL, free-sketch novel concept, annotate existing shape, skip on filler, no fabricated citation on missing reference.

Out of v2.P1.5: workspace memory hits (stubbed; lights up in v2.P6), pre-fetching, autonomous research.

---

## v2.P2 — Live state inference + unresolved-point detector

**Slots after:** v2.P1.
**Est:** ~3 days.
**Status:** shipped 2026-07-12. `use-inferred-state` derives per-participant focus (`engaged / quiet-too-long / repeated-ask / unresolved-thread / idle`) client-side from a rolling 15-min transcript_chunks window; realtime INSERTs keep it live and a 5s tick re-evaluates time-based labels. Heuristic — no LLM, no persistence, replay rebuilds from events. `ParticipantCard` shows a focus chip (unresolved question surfaced verbatim; hover for full text). `TeamDesk` publishes the state map upward via `onInferredStates`; `canvas-room` funnels non-idle deltas into `cartoonist-draw` as a `# Live state` block, and the mediator prompt is instructed to surface unresolved points via `annotation` on the relevant shape at natural pauses (or `skip` when nothing maps).

Scope:
- Facilitator agent watches transcript + canvas events, infers per-participant state every ~15s: `engaged | quiet-too-long | repeated-ask | unresolved-thread`.
- Card surfaces an unresolved marker when a participant raised a point that got no response within N turns.
- Mediator prompt receives state deltas, can choose to surface ("Yimeng raised X three minutes ago — worth circling back?").
- Privacy gate: blockers and worries are visible only to the participant and the mediator by default. Opt-in per field to share with the room.

Verification gate: scripted 10-minute session where one participant raises a point and is talked over — detector flags within 2 minutes; mediator surfaces it on next pause.

Out of v2.P2: scoring participants, leaderboards, anything ranked.

---

## v2.P3 — Per-user agents seeded from Human Layer

**Slots after:** v1 Phase 3 (per-user past/present/future agents) **and** v2.P2.
**Est:** ~4 days.
**Status:** shipped 2026-07-14. `src/lib/user-agents.ts` projects each participant into `{past, present, future}` from Human Layer + `useInferredState`. `past` = role today / strengths / feedback style / can-help. `present` = live focus label (+ unresolved-point detail when detected). `future` = needs + blockers, gated by per-field `share_needs` / `share_blockers` so private worries never leak. `userAgentsPromptBlock` emits a compact markdown block; both `canvas-room.generateArtifacts` (→ `/api/generate-artifacts` as `participantsBlock`) AND `canvas-room.requestDraw` (→ `/api/cartoonist-draw` as `agentsBlock`) now forward the same block, so mediator interjections and drafter decisions share one source of truth. Cartoonist-draw prefers `agentsBlock` when present and falls back to the v2.P1 ad-hoc participant summary otherwise. Drafter is instructed to attribute decisions inline to a participant's stated strength/worry/need and bias action-item owners toward "can help with" matches.

Scope:
- v1's per-user agents get their seed context from the Human Layer profile instead of cold-starting from utterances.
- Past agent: workspace memory pull (when v1 Phase 5 lands).
- Present agent: live state from v2.P2 + check-in profile.
- Future agent: open asks, needs, blockers from the profile, projected forward.
- Per-user agent outputs feed the mediator and the drafter.

Verification gate: in a 20-minute session, drafter's decisions doc attributes at least one decision to a participant's stated strength or worry from the check-in.

---

## v2.P4 — Mediator speaks back using human context

**Slots after:** v2.P3 **and** v1 Phase 4 (TTS mediator).
**Est:** ~2 days.

Scope:
- TTS mediator's spoken interjections include human-context references when relevant ("Sebastian, you said direct critique works — quick one: this feels overbuilt").
- Per-participant opt-out for being named in spoken interjections.

Verification gate: opt-out respected in 100% of test runs. Spoken references match stated preferences in manual review of 10 interjections.

---

## v2.P5 — Workspace memory learns team working styles

**Slots after:** v1 Phase 5 (workspace memory).
**Est:** ~5 days.

Scope:
- Human Layer profile becomes a *living* profile per workspace member, updated from session signal with explicit user review.
- Team-level patterns surfaced: "this team consistently under-scopes on day-of kickoffs"; "Amara's worries about ops usually become decisions by end of session."
- All inferences shown in a per-user "what Cartoonist thinks it knows about you" panel. Edit or delete any item.

Verification gate: every inferred fact has a "where did this come from" link to a transcript or session. No fact is stored without provenance.

---

## v2.P6 — Canvas memory (threads, provenance, cross-time relations, post-session linking)

**Slots after:** v1 Phase 3 (replay needs provenance), v1 Phase 5 (workspace memory tables), and v2.P1.5 (planner writes provenance and reads `workspace_references`).
**Est:** ~6 days. Biggest v2 phase.
**Spec:** `feature-canvas-memory.md`.
**Groundwork shipped 2026-07-13:** provenance columns `{source, transcript_span, confidence, thread_id}` added to `public.canvas_events`; every write path in `canvas-room.tsx` (seed + mediator new/edit/remove) now stamps them. `source ∈ {seed, mediator}`, one `thread_id` per draw batch, `transcript_span` carries the triggering utterance + modality. User-authored shapes (SketchCanvas strokes) still to instrument. Thread linking, cross-session relations, `workspace_*` tables remain owned by full v2.P6.

Scope:
- Provenance doctrine enforced at the `canvas_events` write boundary. Every shape carries `{source, transcript_span, confidence, thread_id}`. PRD Principle 8. **[substrate live]**
- Threads replace storyboard frames as the organizing unit. Linear remains the default render; non-linear behavior kicks in when an utterance re-opens an older thread.
- `canvas_relations` table with typed edges (`extends | contradicts | references | resolves`), within and across sessions.
- Minimal cross-time UI: ↗ chip + peek panel + accent-color glow on related shapes (cross-session = ghost glow in workspace sidebar) + short low-volume audio cue when surfaced live.
- Post-session additions run the contextual loop in reverse to infer span. ≥0.7 auto-link, 0.4–0.7 prompt, <0.4 float with `manual` tag.
- `workspace_artifacts` + `workspace_references` tables ship here, lighting up the stubs from v2.P1.5.

Verification gate: the 5-test scripted session in `feature-canvas-memory.md` §8 — cross-session callback with glow + cue within 3s, thread re-open lays shapes back into original region, three confidence bands for post-session additions, replay re-forms canvas via provenance.

Out of v2.P6: animated connector lines, persistent insight cards, graph view, cross-workspace memory sharing, autonomous background memory jobs, model fine-tuning.

---

## Deliberately not in v2

- Standalone Human Layer or Team Desk product. They are layers inside Cartoonist.
- Personality typing (MBTI, DISC, enneagram). Not operational, easy to misuse.
- Mood emojis, energy 1–10 sliders, "how are you feeling today" check-ins.
- Mandatory check-in. Skippable, always.
- Contribution leaderboards, scoring, gamification.
- Sharing blockers or worries to the whole team without per-field consent.
- HR integrations, performance review export, manager dashboards.
- Persistent personality data outside a workspace the participant has joined.

If any of these become real product needs, they belong in a different app or a v3 conversation — not a v2 phase.

---

## Doc set

```
cartoonist-prd.md                    ← product definition, spans v1 + v2
cartoonist-roadmap-v1.md             ← frozen path to live meeting medium
cartoonist-roadmap-v2.md             ← this doc, additive layers
feature-human-layer.md               ← spec, owned by v2.P1
feature-team-desk.md                 ← spec, owned by v2.P1
feature-contextual-drawing.md        ← spec, owned by v2.P1.5
feature-canvas-memory.md             ← spec, owned by v2.P6
```

---

## v2.P-Next — AI self-edit (revise, don't pile) ✅ SHIPPED

**Slots after:** v2.P1.5 (contextual drawing).
**Status:** shipped 2026-07-12. Server response now includes `edits`/`removes`; client applies them in one state update; tldraw reconciles diffs (delete/update/create) inside `editor.run` for one undo step. Revise-intent regex biases the prompt when the latest utterance signals dissatisfaction. AI never touches non-`shape:cartoonist-*` ids (guarded by prefix filter both server-summarize and client-apply).

Problem: today every AI draw call **appends** new shapes. When the user says "nah, that's bad, redo it" or "make the user flow simpler", we just add another diagram next to the broken one and the canvas turns into a graveyard.

Scope:
- Extend the cartoonist-draw contract: response can include `edits: [{ id, patch }]` and `removes: [id]` alongside `shapes: [...]`.
- Pass a richer "Already on canvas" digest to the AI: not just `(empty)` vs a count, but a compact list of `{ id, kind, label, bbox }` so the model can target specific shapes to revise or delete.
- Detect revise-intent in the latest chunk ("redo / make it better / simpler / wrong / fix the flow / change X to Y / remove the…") and bias the prompt toward edit/remove ops on the most recent cluster.
- Client applies `removes` first, then `edits` via `editor.updateShapes`, then `createShapes` for new ones — all in one history entry so undo reverts the whole revision.
- Guard: never edit/remove user-drawn shapes (only shapes whose id starts with `shape:cartoonist-`).

Out of scope:
- Full version history per shape. (Tldraw's undo stack is enough for v2.)
- Letting the AI restructure user sketches. Hands off human strokes.
