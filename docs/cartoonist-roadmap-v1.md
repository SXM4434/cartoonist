# Cartoonist — Full Rebuild Plan (Phases 1–5)

Five phases, sequenced. Each ends with a verifiable demo before the next starts. No "post-MVP" parking lot — if it fits the product, it's in a numbered phase.

Locked decisions feeding this plan:
- Canvas engine: **tldraw v3** (mature, Figma-grade editing out of the box).
- AI bridge: **hybrid** — legacy JSON translated to tldraw built-ins; high-fidelity kinds (wireframe, journey, callout, frame, speech bubble) emitted as **native tldraw records**.
- Sync: **Supabase Realtime over `canvas_events`** — drop Liveblocks for the canvas, keep it for nothing (chat/presence already on Supabase Realtime).
- Lock model: **soft-riff** — three states per shape: `open` / `augment-only` / `hard`.
- Theming: **full editorial pass in P1** (off-black, orange accent, Fraunces titles, Inter body, square corners, borders not shadows).
- Legacy rooms: **migrate on first load**; on translator failure, fall back to a static PNG snapshot so no history is lost.
- Cost: **live cost meter** in the room HUD; soft-cap toggle in settings; default degrades from `gemini-2.5-pro` → `gemini-2.5-flash` past the cap.

---

## Phase 1 — Canvas foundation

**Goal:** the whiteboard *feels* like a whiteboard. Pan, zoom, select, edit, draw, no overflow trap, no overdraw, AI respects what you touched.

### 1.1 tldraw mounted as the canvas
- Replace `canvas-board.tsx` + `sketch-canvas.tsx` with a `Canvas.tsx` that mounts tldraw v3.
- Editor instance held in a ref and exposed via a `CanvasContext` so chat panel, voice pipeline, and AI bridge all reach the same store.
- Full editing for every shape, AI-drawn or human: pan, zoom (wheel/pinch), marquee select, resize handles, inline text edit, undo/redo, keyboard nudge, duplicate, delete, lock toggle, send-to-back / bring-to-front.
- Minimap, fit-to-content (Cmd-1), reset zoom (Cmd-0).

### 1.2 Editorial theming
- `src/styles/tldraw.css` overrides:
  - Surfaces: `oklch(0.22 0 0)` off-black; panels `oklch(0.25 0 0)`; borders `oklch(0.32 0 0)`.
  - Accent (selection, active tool): warm orange `oklch(0.72 0.16 55)`.
  - Square corners (`--radius: 2px`), no drop-shadows — borders + lightness only.
  - Toolbar buttons Inter 13/15; eyebrows tracking-wide uppercase 11.
  - Shape default text: Inter 15 body; Fraunces 22 for frame/wireframe titles.
- Hide tldraw branding, watermark, default share menu.

### 1.3 Toolbar (left rail)
Select · Pan · Pen · Sticky · Text · Rect · Ellipse · Arrow · Frame · Image · Eraser. Stroke color + width popover. Tool state persisted per session.

### 1.4 Soft-riff lock model
Per-shape `meta`:
```text
meta: { source: "ai" | "user" | "co", lockMode: "open" | "augment-only" | "hard" }
```
- `open` (default for AI shapes): AI may modify freely.
- Any user edit (move, resize, text, restyle) flips the shape to `source: "co"`, `lockMode: "augment-only"` — AI may add adjacent shapes (label, arrow, sticky) but must not delete, rewrite text, or move >40px.
- Right-click → "Lock from AI" → `hard`: AI hands-off; may still draw arrows *to* the shape.
- Prompt receives a compact `{shapeId, kind, summary, lockMode}` list; rules baked into the system prompt.

### 1.5 AI ↔ tldraw bridge (hybrid)
- `src/lib/canvas/ai-bridge.ts`:
  - `translateLegacy(shape) → TLShapePartial[]` — maps existing rect/note/path/icon/arrow/diamond/ellipse JSON to tldraw built-ins.
  - `applyNative(record) → TLShapePartial` — pass-through for native records (`wireframe`, `journey`, `callout`, `frame`, `speech-bubble`).
- AI system prompt extended: for fidelity-critical kinds, emit native records with our custom-shape `type`; everything else stays legacy JSON.

### 1.6 Custom shapes shipped in P1
Under `src/components/canvas/shapes/`:
- `WireframeFrame` — device chrome (mobile / desktop variant), title bar, nav slot, content slots; each slot selectable and editable.
- `JourneyStep` — step number, label, emotion bar, touchpoints row; left/right connectable.
- `Callout` — pointer + body, anchors to another shape's id.
- `SpeechBubble` — quote + attribution (registered now, used by P3 replay).

Persona / MermaidNode / Chart deferred to P2.

### 1.7 No-overdraw solver
`src/lib/canvas/layout-solver.ts` runs before committing AI output:
1. Compute bounds of incoming cluster.
2. Hit-test against existing non-`open` shapes.
3. If >30% overlap, spiral-search for a free region inside current viewport; if none, extend right and pan camera.
4. Group new shapes from the same AI call so they move together.

### 1.8 Op-based persistence
- Subscribe to tldraw `store.listen({ source: "user" })`; diff every change; write to `canvas_events` as `{kind, shapeId, payload, actorId, t_offset_ms}`.
- `useCanvasSync(roomId, editor)` hook: Supabase Realtime channel `canvas:{roomId}` broadcasts ops; remote ops replay via `editor.store.mergeRemoteChanges`.
- Op log doubles as the Phase 3 replay timeline.

### 1.9 Live cost meter
- HUD pill bottom-right of canvas room.
- New `ai_calls` table: `{room_id, stage, model, input_tokens, output_tokens, cost_usd, created_at}`. Every cartoonist call records usage.
- HUD subscribes via Realtime, shows running `$0.34` for the session.
- Settings drawer: "Soft cost cap" input (default off). When session sum exceeds cap, AI requests switch from `gemini-2.5-pro` → `gemini-2.5-flash` automatically with a "saving mode" indicator.
- **Status:** partial shipped 2026-07-13. `ai_calls` table + realtime + public-read RLS live. `cartoonist-draw` logs `{input_tokens, output_tokens, cost_usd}` per call (Gemini 2.5 Pro: in $1.25/M, out $5/M). `CostMeter` HUD pill mounted bottom-right of canvas, sums cost live via Realtime INSERT. Completed 2026-08-13: cost pill is now a popover with a soft cap (`src/lib/cost-cap.ts`, per-room localStorage, off by default). Client sends `costCapUsd` with every draw; server sums `ai_calls` for the room and forces `gemini-2.5-flash` once spend >= cap. HUD flips to a "Saving" state at the cap.

### 1.10 Legacy room migration
- On first load of a pre-tldraw room: detect by absence of `rooms.meta.tldraw_schema_version`.
- Replay existing `canvas_events` through `translateLegacy`; write resulting tldraw snapshot; set version = 1.
- On translator error: log to `migration_errors`, snapshot the old SVG to PNG, drop as a single image shape so nothing is lost.

### 1.11 Quality of life
- Cursor presence (other participants' cursors via existing Supabase Realtime channel).
- Snap-to-shape edges + 8px grid (toggle).
- Right-click menu: lock from AI / unlock / send to back / bring to front / duplicate / delete.
- Empty-state hint fades on first shape.
- Fix the dynamic-import crash on `/r/:roomId` (caused by stale chunk reference to the removed legacy canvas modules).

**Phase 1 verify:** open a new room, draw with pen, drop sticky, drag and resize, edit text, zoom out, pan. Speak "wireframe of a login screen" → native WireframeFrame lands in empty space; edit one slot label; speak again → AI adds a callout pointing at it without rewriting your label. Right-click another AI shape → Lock from AI; speak → AI draws around it. Old room loads with migrated content or a PNG fallback. Cost pill shows non-zero after the first AI call.

---

## Phase 2 — Cartoonist pipeline rebuild

**Goal:** fidelity goes way up, no truncation, full transcript context, partial artifacts while listening, storyboard-linear by default, visualization variety (charts, references, illustrations).

### 2.1 Two-stage pipeline (fixes truncation)
- **Classifier** (`gemini-3.1-flash-lite-preview`): "what is the speaker doing right now?" → `{intent: wireframe|journey|flow|architecture|brainstorm|quote|chart|illustration|reference, scope: new|extend|annotate, targetShapeIds?, fidelity}`.
- **Renderer** (`gemini-2.5-pro`, `max_output_tokens: 8192`): given intent + full transcript + canvas summary + shape-state list, returns up to 30 primitives or native records. Robust JSON extraction (markdown strip + trailing-comma repair).

### 2.2 Full-transcript memory
- **Status:** shipped 2026-08-13. `session_summaries` (per room: summary, topics, decisions, open_questions, entities, chars_covered) written server-side by `/api/session-summary` using `google/gemini-2.5-flash-lite`, folding the previous memory with the newest transcript slice. `useSessionMemory` refreshes every 60s only when ≥300 new chars landed; `sessionMemoryBlock` is sent to `cartoonist-draw` as `memoryBlock`, so the mediator has whole-session context without paying for the whole transcript. Entity graph beyond a named-entity list stays scoped to P3.3.
- New `session_summaries` table: rolling summary updated every 60s by `gemini-2.5-flash-lite`. Stores `topics[]`, `decisions[]`, `open_questions[]`, `entity_graph` (people, products, features mentioned).
- Renderer prompt receives: full summary + last 90s verbatim + the specific utterance being reacted to. Solves "doesn't accurately contextualize the whole conversation."

### 2.3 Storyboard frames (default mode)
- **Status:** shipped 2026-08-13. `src/lib/storyboard.ts` defines the 1200px frame grid (200px gutters), title strips (`Frame N · mm:ss · topic`), in-frame stacking, and x→frame mapping. `canvas-room` opens a new frame whenever the rolling session-memory topic changes, left-aligns each fresh batch in the active frame under existing content, files shape ids per frame, and pans the camera there via `cartoonist:focus`. A frame chip strip (top-left of the canvas) jumps to any past frame. Non-linear callbacks stay on the existing thread/relation system; entity-graph callbacks land with P3.3.
- Canvas grows left-to-right in **frames** (1200px wide each). Each new topic starts a new frame with an auto title strip ("Frame 3 · 02:14 · User journey").
- Viewport auto-pans to the active frame; click any past frame to jump there.
- Non-linear callbacks auto-enabled after frame 5 — AI may add callouts back into earlier frames using the entity graph.

### 2.4 Partial artifacts while listening
- `artifact-drafter` agent watches the classifier intent stream. The moment "PRD" / "user journey" / "wireframe" / "chart" is mentioned, it spins up a draft skeleton in the Documents tab (headings, empty sections) and fills progressively via streaming SSE (`openai/gpt-5-mini`).
- Each artifact shows a "drafting…" pulse and live word-count.

### 2.5 Fidelity ladder + visualization variety
Renderer picks the right tool per intent:
- **Wireframe** → detailed `WireframeFrame` with device chrome, real labels from the conversation, real components, real copy.
- **Chart** → new `Chart` custom shape: axes + plotted points. "Tools on a 2×2 cost-vs-power axis" becomes an actual quadrant chart with the tools placed.
- **Reference lookup** → when the conversation names a real thing ("like Linear's command bar"), a `Librarian` worker calls `tavily/web_search`, grabs a quick visual reference, and the renderer sketches an *interpretation* with a "ref:" caption.
- **Illustration** → freeform paths + icons for metaphors.
- **Flow / journey / brainstorm / quote** → as today but sharper, using native records.

### 2.6 New custom shapes added in P2
`Persona`, `MermaidNode`, `Chart`, `ReferenceCard`.

**Phase 2 verify:** speak for 3 minutes covering wireframe → user journey → tradeoff chart. Three distinct frames, no truncation, a PRD draft growing in the Documents tab in parallel, one reference card pulled from the web.

---

## Phase 3 — Multi-agent orchestra

**Goal:** the mediator is an orchestra, not a single voice.

### 3.1 Agent roster (all stream into the same canvas + doc store)
- **Scribe** — drives `canvas_events` (the Phase 2 renderer).
- **Historian** — owns `session_summaries`, builds the entity/knowledge graph.
- **Devil's Advocate** — pink sticky risks and gaps, in right rail and on canvas.
- **Drafter** — owns Documents tab (PRD, journey, action items, decisions).
- **Facilitator** — watches for stalls, agreement, off-topic; produces voice prompts (Phase 4).
- **Librarian** — handles web/reference lookups when something external is named.

### 3.2 Per-user agent triplet (past / present / future)
Each participant gets three lightweight agents that write only into that participant's "lane":
- **Past** — what they've already committed to or said earlier (cited).
- **Present** — what they're currently advocating.
- **Future** — predicted next concerns based on their role/personality (from `participants.personality`).

Used to surface "you said X earlier — does Y still hold?" prompts.

### 3.3 Knowledge graph (Supabase)
- New `knowledge_nodes` (id, kind, label, room_id, props jsonb) and `knowledge_edges` (from, to, kind, weight). Populated by Historian.
- Renderer can query the graph to place a callback arrow from a new shape to an older shape representing the same entity — what enables the non-linear callbacks in 2.3.

### 3.4 Agent bus
Lightweight in-memory pub/sub on the server, durable to Supabase: events `utterance.committed`, `intent.classified`, `shape.added`, `shape.edited.by.user`, `summary.updated`. Each agent subscribes to what it cares about. Adding a new agent is a 30-line change.

### 3.5 Replay / scrub
- New `SessionReplay` route. Op log (P1.8) drives a scrubber.
- Speech bubbles attach to shapes that were drawn during each utterance — scrub to any timestamp, watch the room re-form.

**Phase 3 verify:** during a session, ask "what did Maya say about pricing earlier?" — Historian surfaces the quote, Scribe drops a callout arrow back to the original frame. Open replay, scrub to minute 4, see what the canvas looked like.

---

## Phase 4 — Voice mediator (TTS + wake phrase)

**Goal:** Cartoonist talks back. Lives in every aspect of the app.

### 4.1 TTS pipeline
- New `/api/cartoonist-speak` route → ElevenLabs `eleven_turbo_v2_5` streamed MP3, voice `JBFqnCBsd6RMkjVDRZzb` (George — warm, editorial).
- Client plays through a single audio context with duck-on-user-speech (VAD-driven volume).

### 4.2 When to speak
- **Pause-triggered:** Facilitator agent watches VAD silence + summary state. After >6s silence following a question, offers a nudge ("want me to draft the PRD section now?").
- **Wake phrase:** "hey cartoonist…" — recognized client-side from the existing speech stream; everything until the next 1.5s pause is routed to the Facilitator as a direct query. Orange pulse + transcript ribbon highlights when wake is active.
- **Risk surfacing:** Devil's Advocate may interject only if the user has explicitly enabled it in session setup.

### 4.3 Talkback UI
A persistent "Cartoonist is listening / speaking / thinking" pill bottom-right, expandable to a chat thread so you can also type at the mediator without breaking the meeting. Composes with the existing dual-mode chat panel.

**Phase 4 verify:** say "hey cartoonist, summarize what we decided" → voice answer + a `decisions` card lands in Documents.

---

## Phase 5 — Workspace memory + self-improvement

**Goal:** the system gets smarter as a team uses it.

### 5.1 Teams + workspaces
- `teams`, `team_members`, `workspaces` tables. Rooms attach to a workspace. Knowledge graph nodes carry `workspace_id`.

### 5.2 Cross-session memory
- Historian appends each session's graph to the workspace graph. Renderer in a new session may reference past projects ("you ran into this same pricing question in last week's meeting").
- Documents tab gains a "linked artifacts from this workspace" panel.

### 5.3 Eval + learning loop
- Every AI-drawn shape logs `(prompt, output, kept | edited | deleted, dwell_time)` to `ai_feedback`.
- Weekly batch job builds a workspace-tuned **few-shot pack**: the 50 best-rated drawings + their context, injected into the renderer prompt for that workspace. The system learns the team's visual language without training a model.

### 5.4 Optional fine-tune (later)
- Once a workspace has >10k `ai_feedback` samples, optionally fine-tune a small open model on accumulated examples. Documented and budgeted but gated on signal volume.

**Phase 5 verify:** second session in the same workspace draws in a noticeably more team-aligned style and references prior decisions.

---

## Tech reference

```text
Client
  src/components/canvas/
    Canvas.tsx             — tldraw mount + context (P1)
    Toolbar.tsx            — left rail tools (P1)
    CostMeter.tsx          — HUD pill (P1)
    Frames.tsx             — storyboard frame strips (P2)
    shapes/
      WireframeFrame.tsx   (P1)
      JourneyStep.tsx      (P1)
      Callout.tsx          (P1)
      SpeechBubble.tsx     (P1, used in P3)
      Persona.tsx          (P2)
      Chart.tsx            (P2)
      MermaidNode.tsx      (P2)
      ReferenceCard.tsx    (P2)
  src/lib/canvas/
    ai-bridge.ts           — translateLegacy + applyNative (P1)
    layout-solver.ts       — no-overdraw nudge (P1)
    legacy-to-tldraw.ts    — one-time migrator (P1)
    use-canvas-sync.ts     — Realtime ↔ tldraw store (P1)
    knowledge-graph.ts     — client read API (P3)
  src/lib/agents/
    bus.ts                 — pub/sub client (P3)
  src/styles/tldraw.css    — editorial theming (P1)

Server (TanStack server fns + a few routes)
  src/lib/agents/
    scribe.functions.ts        — renderer (P2)
    classifier.functions.ts    — intent (P2)
    historian.functions.ts     — summary + graph (P2/P3)
    drafter.functions.ts       — streaming artifact (P2)
    devils-advocate.functions.ts (P3)
    facilitator.functions.ts   — pause + wake (P4)
    librarian.functions.ts     — web reference (P2)
  src/routes/api/
    cartoonist-speak.ts        — ElevenLabs TTS stream (P4)

Models
  classify: google/gemini-3.1-flash-lite-preview   (cheap, fast)
  render:   google/gemini-2.5-pro                  (high fidelity, 8k out)
  summary:  google/gemini-2.5-flash                (rolling)
  drafter:  openai/gpt-5-mini                      (long-form prose)
  tts:      elevenlabs eleven_turbo_v2_5

DB
  P1: canvas_events op-shape conventions; ai_calls; migration_errors;
      rooms.meta jsonb; Realtime on ai_calls
  P2: session_summaries
  P3: knowledge_nodes, knowledge_edges, agent_events
  P4: none (TTS is stateless)
  P5: teams, team_members, workspaces, workspace_id FKs,
      ai_feedback, fewshot_packs
```

## Out of scope (and why)

- **Figma plugin / Miro plugin** — different product surface; pursue only after teams ship in P5.
- **Standalone on-device model** — meaningful only after the P5 eval loop produces enough signal; revisit then.
- **Drawing-tablet integration** — tldraw already handles pressure-sensitive input; nothing custom needed.
- **Mobile-first canvas app** — tldraw mobile works, but the editorial theming and AI density are designed for desktop conversations. Mobile is a P5+ effort.
