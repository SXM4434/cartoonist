# Cartoonist — PRD

**Status:** draft, updated for Phase 1 build approval
**Owner:** you
**Surface:** web app, desktop-first

---

## 1. What it is

A live meeting room where people talk (or chat) and an AI mediator draws the conversation onto an infinite editable whiteboard in real time — wireframes, user journeys, flows, charts, quotes, callouts. Everything the AI draws is fully editable. Everything participants draw is respected by the AI. A drafter agent writes the PRD, journey doc, and decision log in parallel. The mediator speaks back on pause or when called.

It is **not** a Figma replacement, not a transcription tool, not a generic whiteboard. It is a *meeting medium* — the artifact of the conversation is the meeting.

---

## 2. Who it's for

- **Product trios** (PM + design + eng) running scoping or kickoff sessions where the deliverable today is sticky notes someone else has to type up later.
- **Founders + customers** running discovery calls where the founder wants a wireframe and a journey map by the end of the call, not a week later.
- **Strategy / consulting pairs** running working sessions where frameworks (2×2s, decision matrices, journey maps) are the thinking tool, not the output.

Common thread: the conversation is the work, and the diagram is what makes the conversation rigorous.

---

## 3. Problems we are solving

| Problem today | What Cartoonist does |
|---|---|
| Whiteboarding requires one person to stop participating and draw | AI draws while everyone talks |
| Notes get typed up after; details are lost | Drafter writes the PRD/journey/decisions live |
| Diagrams in meetings are low-fidelity blobs | Native wireframe / journey / chart shapes at real fidelity |
| AI canvases overdraw your edits | Soft-riff lock model: AI augments, never overwrites user-touched shapes |
| Long meetings exceed the AI's memory window | Rolling summary + entity graph fed back as context |
| Voice-only excludes people in noisy rooms or who prefer text | Dual-mode participants: voice, chat, or both, one identity |
| Talking to AI is one-way | TTS mediator that speaks on pause or wake phrase |
| Generic SaaS whiteboards feel like generic SaaS | Editorial theming: off-black, Fraunces titles, square corners, one orange accent |

---

## 4. Principles

1. **The conversation is the work.** Every feature serves the live meeting, not a post-hoc cleanup.
2. **Riff, don't overwrite.** AI and humans are co-authors on the same canvas. AI never silently changes what a human touched.
3. **Fidelity matters.** A wireframe should look like a wireframe. A journey should look like a journey. Not boxes with labels.
4. **Editorial discipline.** Disciplined systems with human residue. Print-influenced, not generic SaaS. Borders, not drop-shadows.
5. **Transparency over magic.** Live cost meter. Visible "AI is thinking." Lock-from-AI is a real control. Replay shows exactly what was said when.
6. **One identity per person.** Whether you joined by voice or chat, on phone or laptop, in this room or last week's — you are one thread.
7. **Participant Layer.** Cartoonist should not only understand the conversation; it should understand the people in the room. Each participant has a lightweight profile — role today, strengths, preferred contribution mode, feedback style, blockers, what they need from the team — that the mediator uses to facilitate more inclusively. The humans are visible in the room while the work happens, not buried in a settings panel. Specced in `feature-human-layer.md` and `feature-team-desk.md`; sequenced in `cartoonist-roadmap-v2.md`.
8. **Every mark has a moment.** Every shape on the canvas — AI-drawn, human-drawn, or post-session — carries provenance: a pointer to the transcript span it belongs to (with confidence when inferred). Replay, memory, and cross-time relations all depend on this. No exceptions; never fabricate provenance. Doctrine + data model in `feature-canvas-memory.md` §2.
9. **Draw, fetch, or note — pick the right one.** Sketching is a first-class output, not a fallback. The AI chooses per utterance between fetching a real reference, instantiating a template, free-sketching, typing a note, annotating an existing shape, or staying silent. Decision rules in `feature-contextual-drawing.md`.

---

## 5. Functional scope

### Live room
- Audio capture per participant (existing).
- Chat composer per participant (existing).
- Dual-mode participants — voice, chat, or both — with identity merging across modes (existing).
- Infinite editable whiteboard (tldraw v3).
- Toolbar: select, pan, pen, sticky, text, rect, ellipse, arrow, frame, image, eraser.
- Right-click context menu with lock-from-AI.
- Cursor presence for other participants.
- Live cost meter HUD with optional soft cap.

### AI mediator
- Runs the **contextual drawing loop** per utterance: classify → resolve references → pick modality → render. Full spec in `feature-contextual-drawing.md`.
- Licensed modalities: `fetch_card`, `template_shape`, `free_sketch`, `typed_note`, `annotation`, `skip`. Silence is a valid output.
- Reference resolution order: current canvas → workspace memory → connected docs → web search → null (never fabricate a citation).
- Respects shape lock state: open / augment-only / hard.
- Canvas is organized by **threads, not frames** — linear by default, non-linear when an utterance re-opens an older thread. Model in `feature-canvas-memory.md` §3.
- Speaks back on pause or wake phrase ("hey cartoonist").
- Drafts PRD / journey / decisions live into a Documents tab.

### Memory
- Rolling 60s summary per session: topics, decisions, open questions, entity graph.
- Per-room cost log.
- Op-based canvas event log (drives sync and replay), with required provenance per Principle 8.
- **Workspace artifact memory + reference memory** — every accepted shape and every fetched external reference is indexed per workspace, embedding-searchable, feeds the contextual loop and the few-shot pack. Tables and eviction rules in `feature-canvas-memory.md` §6.

### Replay
- Scrub a session timeline; canvas re-forms; speech bubbles attach to the shapes drawn during each utterance, using `transcript_span` provenance.

### Cross-time relations
- Typed edges (`extends | contradicts | references | resolves`) between shapes within and across sessions. Stored from day one.
- Minimal UI: small ↗ chip on shapes with relations; clicking opens a peek panel. Hover causes related shapes to glow in the accent color (cross-session relations glow in the workspace sidebar as ghosts). A short low-volume audio cue plays when the AI surfaces a cross-time relation live. Full surface in `feature-canvas-memory.md` §4.

### Post-session additions
- Shapes added after a session ends are auto-linked back to the transcript via the contextual loop in reverse. Confidence ≥ 0.7 auto-links; 0.4–0.7 prompts the human; < 0.4 floats with a `manual` tag and null provenance. Spec in `feature-canvas-memory.md` §5.

### Teams (P5)
- Workspace-scoped knowledge graph; cross-session references (consumes `workspace_artifacts` + `workspace_references`).
- Weekly few-shot pack tuned to the team's accepted/rejected drawings.

---

## 6. Non-goals

- Not a Figma replacement. Wireframes are *meeting-grade*, not production-grade.
- Not async. Cartoonist is for live conversations; viewing/editing later is supported but not the primary mode.
- Not a generic whiteboard. Empty-canvas freeform drawing exists but the product earns its keep through the AI.
- Not a transcription product. The transcript exists to feed the AI; raw export is a side door, not the main door.
- Not mobile-first. Mobile viewing works; mobile authoring isn't optimized until post-P5.
- Not a model fine-tuning platform. Few-shot packs are the learning surface in MVP+. Fine-tune is gated on >10k feedback samples per workspace.

---

## 7. Quality bar

- **Fidelity.** A wireframe is identifiable as the screen it represents — labels from the conversation, components in the right places, device chrome present.
- **Latency.** Shape appears <2s after the utterance ends. Skeleton appears <500ms; details fill in.
- **No overdraw.** Zero incidents per session of AI overwriting a user-edited shape.
- **No truncation.** Multi-intent utterances ("wireframe AND user journey AND a tradeoff chart") produce three artifacts, not one.
- **Context retention.** AI can correctly answer "what did <person> say about <topic>?" 5 minutes into the session.
- **Cost visibility.** Cost meter is always visible; soft cap honored within one AI call of crossing the threshold.

---

## 8. Architecture summary

- Client: TanStack Start + React 19 + tldraw v3 + Supabase Realtime.
- Server: TanStack server fns (`createServerFn`) + a small set of server routes (TTS streaming, public webhooks).
- DB: Supabase Postgres with RLS. Op-based `canvas_events` is the source of truth for the canvas and for replay.
- AI: Lovable AI Gateway. Classifier on `gemini-3.1-flash-lite-preview`; renderer on `gemini-2.5-pro`; summary on `gemini-2.5-flash`; drafter on `gpt-5-mini`; TTS on ElevenLabs `eleven_turbo_v2_5`.
- Multi-agent bus (P3) over an in-memory pub/sub with Supabase durability.

---

## 9. Phasing

| Phase | Theme | Verifies when… |
|---|---|---|
| 1 | Canvas foundation (tldraw, editorial theming, soft-riff lock, cost meter, legacy migration) | Whiteboard *feels* like a whiteboard; AI riffs without overdraw |
| 2 | Pipeline rebuild (long-context, two-stage, storyboard frames, partial artifacts, charts/references) | 3-minute session produces 3 distinct high-fidelity frames + a live PRD |
| 3 | Multi-agent orchestra + knowledge graph + replay | Historian recalls earlier quotes; scrubber re-forms the canvas |
| 4 | TTS mediator + wake phrase | "Hey cartoonist, summarize what we decided" → voice answer + decisions card |
| 5 | Teams, workspace memory, eval loop | Second session in a workspace draws in a more team-aligned style |
| v2.P1 | Human Layer check-in + Team Desk right rail | Mediator references a participant's stated preference live |
| v2.P1.5 | Contextual drawing loop (fetch / sketch / note / annotate / skip) | AI fetches real references, free-sketches concepts, stays silent on filler |
| v2.P2–P5 | Live state inference → per-user agents → spoken human context → workspace style learning | See `cartoonist-roadmap-v2.md` |
| v2.P6 | Canvas memory: threads, provenance, cross-time relations, post-session linking | "Remember the auth flow from last week?" surfaces the prior shape with glow + audio cue |

Full per-phase scope and verification gates:
- v1: `cartoonist-roadmap-v1.md` (frozen) / `cartoonist-rebuild-plan.md`
- v2: `cartoonist-roadmap-v2.md`
- Feature specs: `feature-human-layer.md`, `feature-team-desk.md`, `feature-contextual-drawing.md`, `feature-canvas-memory.md`

---

## 10. Open questions (parked, not blocking)

- Per-workspace voice selection for the TTS mediator (one voice for MVP).
- Export formats for Documents tab — Markdown shipped; PDF/Notion later.
- Whether participants can have private side-channels with the mediator (currently no; mediator is a room citizen).
- Mobile authoring — view-only on phones for now; revisit post-P5.
