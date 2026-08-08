# Cartoonist — Full Build History

> A chronological record of every feature shipped, decision made, and bug fixed across the project's chat history.
> Generated from the full conversation transcript.

---

## Table of Contents

1. [Genesis — Planning & PRD](#1-genesis--planning--prd)
2. [MVP v1 — Solo Voice → Artifacts](#2-mvp-v1--solo-voice--artifacts)
3. [The Pivot — Collaborative Canvas](#3-the-pivot--collaborative-canvas)
4. [Design System — Editorial Discipline](#4-design-system--editorial-discipline)
5. [Liveblocks Era & Crash Debugging](#5-liveblocks-era--crash-debugging)
6. [Real AI Drawing Pipeline](#6-real-ai-drawing-pipeline)
7. [Session Setup, Onboarding & Join Codes](#7-session-setup-onboarding--join-codes)
8. [The Rebuild Plan — 5 Phases](#8-the-rebuild-plan--5-phases)
9. [Dual-Mode Participants (Voice + Chat)](#9-dual-mode-participants-voice--chat)
10. [Documentation & Roadmap Architecture](#10-documentation--roadmap-architecture)
11. [Security Audit](#11-security-audit)
12. [Phase 1 — tldraw Canvas Foundation](#12-phase-1--tldraw-canvas-foundation)
13. [Voice Enrollment & Add-Person Flow](#13-voice-enrollment--add-person-flow)
14. [tldraw as Headless Engine](#14-tldraw-as-headless-engine)
15. [v2.P — AI Self-Edit & Human Layer](#15-v2p--ai-self-edit--human-layer)
16. [v2.P1–P4 — Team Desk, State Inference, Cost Meter, Mediator Voice](#16-v2p1p4--team-desk-state-inference-cost-meter-mediator-voice)
17. [v2.P6 — Threads, Cross-Time Relations, Realtime Sync](#17-v2p6--threads-cross-time-relations-realtime-sync)
18. [Live Collaboration — Presence, Cursors, Spotlight, Reactions](#18-live-collaboration--presence-cursors-spotlight-reactions)
19. [Hand-Raise Queue & Mediator Voice Response](#19-hand-raise-queue--mediator-voice-response)
20. [Session Recap & Workspace Memory](#20-session-recap--workspace-memory)
21. [Cross-Session Canvas Memory & Ghost Echoes](#21-cross-session-canvas-memory--ghost-echoes)
22. [Session Replay](#22-session-replay)
23. [Wireframe Fidelity — Pushed to the Max](#23-wireframe-fidelity--pushed-to-the-max)
24. [Session Pack — Export Everything](#24-session-pack--export-everything)
25. [Performance Optimization](#25-performance-optimization)
26. [Current State & North Star](#26-current-state--north-star)

---

## 1. Genesis — Planning & PRD

**Date:** June 6, 2026, 16:35–17:20 UTC

The project started with a Google Doc — the "Cartoonist" hackathon plan. The user shared it and asked for a structured build plan: PRD → tech stack → MVP/post-MVP → phased project plan → eval system.

After several rounds of clarification (the user kept saying "don't do anything yet" and rejecting early plans), the scope was locked through a Q&A:

- **MVP scope:** All features (the full vision — not a minimal slice)
- **Timeline:** 1 hour (with a 4–6 person team)
- **Audio approach:** ElevenLabs Scribe realtime
- **Demo shape:** Pre-recorded session + live AI artifact generation

The AI did a reality check — 1 hour with 4–6 people on Lovable = ~3–4 prompts — and proposed a **1-hour solo-voice MVP**: speak into mic → ElevenLabs Scribe transcribes → "Generate" → 6 artifacts stream in (Summary, Decisions, Action Items, PRD, User Journey, Flow diagram).

**Visual direction:** "Neutral elegance" — cream background, light grey surfaces, warm orange accent. Editorial typography (Fraunces display + Inter body). Generous whitespace, no gradients.

**Eval system:** Two layers — automated checks (build passes, smoke tests, end-to-end assertions) + manual GO/NO-GO gates after each phase.

**Connectors linked:** Google Docs (to read the PRD source), ElevenLabs (for Scribe transcription).

---

## 2. MVP v1 — Solo Voice → Artifacts

**Date:** June 6, 2026, 17:20–17:30 UTC

Phases 0–4 shipped in one pass:

- **Design system** in `src/styles.css`: cream/orange/grey palette, Fraunces + Inter fonts
- **Backend:**
  - `src/routes/api/elevenlabs/scribe-token.ts` — mints single-use ElevenLabs Scribe tokens
  - `src/routes/api/generate-artifacts.ts` — POST transcript → Lovable AI Gateway (Gemini 3 Flash) → SSE stream with 6 JSON artifact fields
- **UI components:**
  - `TranscriptPanel` — live transcription display with partial/committed lines
  - `ArtifactTabs` — 6-tab interface (Summary, Decisions, Action Items, PRD, Journey, Flow) with Markdown rendering + copy-to-clipboard
  - `MermaidDiagram` — renders flowcharts
- **Main page** (`src/routes/index.tsx`): `useScribe` hook with `CommitStrategy.VAD`, Start/Stop buttons, "Generate Artifacts" workflow, sample transcript failsafe

**Known issue:** Mermaid Flow tab rendered blank on first open (fixed later in Phase 5).

**PRD exported** to `PRD.md` in project root and `Cartoonist_PRD.md` to `/mnt/documents/`.

---

## 3. The Pivot — Collaborative Canvas

**Date:** June 6, 2026, 17:32–17:42 UTC

The user completely changed direction: **"we want it to be more like a canvas like Figjam"** — a web app where each person introduces themselves, the system knows each person, and as they talk, a live visual version of the transcript is drawn in real time. Think: live storyboarding. People should be able to live-collaborate like Figjam or Miro. The key point: **the tool is an AI mediator that visually creates stuff so the team can focus on discussion.**

**Scope locked:** Full vision — multi-user + intros/personality + anonymous notes + voting + AI mediator prompts.

**Tech decisions:**
- Canvas: `@tldraw/tldraw`
- Realtime: `@liveblocks/client` + `@liveblocks/react` + `@liveblocks/yjs` + `yjs`
- Voice: ElevenLabs Scribe v2 (already wired)
- AI: Lovable AI Gateway → Gemini, JSON tool-call returning canvas commands
- Backend: Supabase — `rooms`, `participants`, `transcript_chunks`, `canvas_events`, `audio_clips`

**Built in one pass (Phases A–D):**
- DB migration: `rooms`, `participants`, `transcript_chunks`, `canvas_events`, `audio_clips` with RLS
- `liveblocks-auth.ts` — access tokens for Liveblocks rooms
- `canvas-ops.ts` — Gemini analyzes transcript, returns JSON ops (`sticky`, `flowStep`, `decision`, `connect`, etc.)
- `CanvasBoard` — infinite canvas with draggable cards + SVG arrows
- `CanvasCard` — type-specific styling (Idea, Decision, Action, etc.)
- `IntroModal` — voice-based participant onboarding via ElevenLabs Scribe
- Routing: `/` (create room), `/r/$roomId` (shared session)
- AI mediator loop: buffers transcription every 10s → `/api/canvas-ops` → applies ops to shared LiveList

---

## 4. Design System — Editorial Discipline

**Date:** June 6, 2026, 17:45 UTC

The user uploaded `design-principles-for-ai.md` and said "use this design skill to refine designs."

**Major design overhaul** — shifted from playful/SaaS to editorial/print-influenced:

- **Off-black ink** (`oklch(0.22 0.012 60)`) on warm paper background — not pure black
- **Locked type ladder:** 11 / 13 / 15 / 22 / 32 / 52 / 84 px — no off-ladder sizes
- **Hairline borders** (1px) for elevation — **never** drop-shadows, glassmorphism, neumorphism, or soft gradients
- **Single warm orange accent** — desaturated supporting cast
- **Tabular numerals** for data, uppercase tracking-wide "eyebrow" labels
- **Asymmetric** layout (8/4 grid), not centered everything
- All radii dropped to 4px (0.25rem)
- Body: 1.5 leading, ragged-right, 45–75ch measure
- Max 2–3 typefaces: Fraunces display, Inter body

**Landing page** refactored to asymmetric editorial masthead with left-weighted hero.
**Room UI** flattened — removed backdrop-blur and floating shadow pills in favor of structural borders + eyebrow labels + tabular nums.

**Saved to project memory:** `mem://design/principles.md` — applies automatically to all future design work.

---

## 5. Liveblocks Era & Crash Debugging

**Date:** June 6, 2026, 17:48–18:10 UTC

Multiple rounds of debugging the **"SSR rendering failed / blank screen"** error:

1. **Storage sync race** — Liveblocks mutations firing before storage initialized. Fixed with `storageReady` state + `room.waitUntilStorageReady()` guard.
2. **Auth failure cascade** — `LIVEBLOCKS_SECRET_KEY` empty/invalid → `authorize-user` endpoint returning 500 → storage-ready promise rejecting uncaught. Added `storageError` state + "Offline canvas" indicator.
3. **Root fix — local-first architecture** — removed the fragile Liveblocks room mount entirely. Created `src/lib/canvas-types.ts` for shared interfaces. Refactored `CanvasBoard` to accept `cards`, `connections`, `participants` as props (no Liveblocks hooks). `CanvasRoom` manages canvas data via standard React `useState`. The `IntroModal` became a non-blocking overlay. Room defaults to "Local canvas" mode.

**Demo mode added** — a "Play" button in the masthead that runs a simulated 9-step conversation (Sam/PM, Alex/Design, Jordan/Eng) with cards appearing on the canvas, bypassing all external services.

---

## 6. Real AI Drawing Pipeline

**Date:** June 6, 2026, 18:11–18:26 UTC

The user rejected the fake sticky-note demo: **"this looks like random crap"** and **"I want it to be able to draw actual visuals as if it was drawing for us on a whiteboard."**

**Pass 1 — Real whiteboard:**
- Integrated `rough.js` for hand-drawn style shapes (rects, ellipses, diamonds, arrows)
- Integrated `perfect-freehand` for user-driven drawing
- Created `useSpeech` hook using **Web Speech API** (`webkitSpeechRecognition`) — free, Chrome/Edge, with `interimResults: true`
- Added live visualizer: 18-bar `AnalyserNode` waveform + pulsing "Hearing" indicator
- Transcription auto-persists to Supabase `transcript_chunks`
- Created `/api/cartoonist-draw` — Gemini 3 Flash analyzes last ~30s of transcript, returns structured `SketchPrimitive` JSON
- Added "Type-to-draw" prompt bar at bottom for manual commands
- Auto-fires every ~6s when new speech arrives

**Bug fixes:**
- Boxes/arrows invisible — rough.js sets `stroke` as SVG attribute, which doesn't evaluate `hsl(var(--foreground))`. Fixed by resolving actual computed color on mount via `getComputedStyle`.
- Canvas overflow — changed from fixed 1600×1000 to `width="100%" height="100%"` with `preserveAspectRatio`.

**Pass 2 — Expanded vocabulary:**
- New primitives: `note` (colored stickies), `text` (stylized labels), `path` (freeform vectors), `icon` (30+ kinds: user, cloud, database, server, etc.)
- Sticky notes rendered via SVG `foreignObject` for text wrapping
- Composite icon rendering using rough.js primitives
- Added Caveat handwriting font for hand-drawn text feel

---

## 7. Session Setup, Onboarding & Join Codes

**Date:** June 6, 2026, 18:50–19:08 UTC

The user wanted the intro flow to match the app's purpose — not generic profile questions.

**Session setup flow built:**
- **Step 1 (Onboarding):** Name + role + color, with audio-to-JSON parsing via new `/api/parse-intro` endpoint (Gemini 2.5 Flash)
- **Step 2 (Session creation):** Goal, desired outputs (PRD / user journey / flow / brainstorm / decisions — multi-select), facilitation mode (Scribe / Facilitator / Devil's Advocate)
- **Whiteboard seeding:** On first load, canvas seeds with title card, yellow "GOAL" sticky, and colored output stickies
- **AI context awareness:** `/api/cartoonist-draw` now ingests `sessionContext` — tailors output to facilitation mode

**Database:**
- `rooms` table extended with `goal`, `facilitation`, `host_role`, and 6-character `join_code` (auto-generated via PL/pgSQL function)
- Enabled Supabase Realtime on `participants` table for live lobby updates

**Lobby** (`sessions.$sessionId.tsx`): Shows session metadata, copyable join code, live participant list.

**Bug fix:** `gen_join_code` function was calling `gen_random_bytes` from pgcrypto (not installed) → every room insert 404'd. Replaced with pure-SQL random generator using `random()` + custom alphabet + retry loop.

---

## 8. The Rebuild Plan — 5 Phases

**Date:** June 6, 2026, 19:37–22:13 UTC

The user laid out a massive list of issues and vision:

> Fidelity too low. Gets cut off on multi-intent requests. Canvas should be editable. Stuff gets drawn over. Can't scroll/pan. Doesn't contextualize the whole conversation. Should save full transcript. Should draw in storyboard linearity as a base. Should craft artifacts live (partial outlines while waiting for context). Multiple agents communicating. AI should talk back. Whiteboard tools. Everything editable. Wow moments where it feels like it's drawing exactly what I'm saying.

**5-phase rebuild plan created:**

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **P1** | Canvas foundation | Infinite pan/zoom, selection+edit on every shape, toolbar, no-overdraw solver, op-based persistence, soft-riff lock model, presence cursors |
| **P2** | Pipeline rebuild | Two-stage classifier→renderer, streaming artifact builder, full-transcript context window, live artifact drafting |
| **P3** | Replay & multi-agent | Scrub timeline with speech bubbles, multi-agent mesh (per-user Past/Present/Future agents in shared knowledge graph) |
| **P4** | Voice mediator | ElevenLabs TTS talkback on pauses + wake phrase, risk surfacing, talkback UI |
| **P5** | Workspace + learning | Teams, workspaces, cross-session memory, AI feedback logging, weekly few-shot packs |

**Canvas engine decision:** tldraw v3 (after extensive Q&A about AI↔tldraw bridge, realtime backbone, custom shapes, lock granularity).

**User's editing philosophy:** "I want that back and forth, bucking and riffing off each other" — AI and human co-create, both fully editable, AI respects what you touched but can riff adjacent.

---

## 9. Dual-Mode Participants (Voice + Chat)

**Date:** June 6, 2026, 20:45 UTC

**"Join via Chat" system** — users can contribute via voice, text, or both while maintaining a single identity:

- `participants` table: added `input_mode` (`voice` / `chat` / `both`) and `linked_participant_id` for identity merging
- `transcript_chunks` table: added `source` (`voice` / `chat`) and `participant_id`
- Enabled Supabase Realtime on both tables
- **Lobby improvements:** Mode picker, identity-merge prompt ("Is that you?")
- **New `ChatPanel` component:** Right-rail stream displaying both transcribed voice and typed chat, resolves canonical identities via `linked_participant_id`, merged users shown as single author with dual glyphs (🎙/⌨)
- **Canvas integration:** Chat messages trigger the same `requestDraw` AI pipeline as voice utterances
- Session persistence via `localStorage` for `selfPid` + `inputMode`

---

## 10. Documentation & Roadmap Architecture

**Date:** June 7, 2026, 02:48–03:12 UTC

The user wanted the plan split into proper docs. Created a documentation architecture:

**Docs created (in `docs/` in repo):**
1. `cartoonist-prd.md` — Product requirements document
2. `cartoonist-roadmap-v1.md` — Frozen v1 plan (Phase 1–5)
3. `cartoonist-roadmap-v2.md` — Additive v2 roadmap (v2.P1–P6)
4. `feature-human-layer.md` — 30–60s pre-session check-in spec (6 fields: role, strengths, contribution modes, feedback style, blockers, needs)
5. `feature-team-desk.md` — Right-rail UI spec (280px, collapses to 44px), ParticipantCard, ModeDot, live state derivation
6. `feature-contextual-drawing.md` — Planner stage (classify → resolve → modality → render), 6 modalities, no-fabrication rule
7. `feature-canvas-memory.md` — Provenance doctrine, threads (replace linear frames), typed cross-time relations, post-session auto-linking
8. `docs/README.md` — Structured index

**Key doctrines established:**
- **Principle 8:** "Every mark has a moment" — every shape carries `{source, transcript_span, confidence, thread_id}`
- **Principle 9:** "Draw, fetch, or note — pick the right one" — per utterance AI picks: fetch reference, template, free-sketch, note, annotate, or stay silent
- **Threads, not frames** — canvas shapes belong to threads (not linear frames), enabling non-linear callbacks
- **v1 frozen, v2 additive** — v2 never reorders v1; v2 phases numbered `v2.P1, v2.P2…`

---

## 11. Security Audit

**Date:** June 8, 2026, 17:01–17:57 UTC

The user asked to ensure no secrets are exposed in git (after uploading to GitHub).

**Scan results:** No real secrets exposed. `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` are publishable/anon keys (designed to be public, protected by RLS). All real secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LIVEBLOCKS_SECRET_KEY`, `ELEVENLABS_API_KEY`, `LOVABLE_API_KEY`) live in Lovable Cloud's secret store, never in git.

**Security scan fixes:**
- Dropped unused `rooms update all` policy (`USING(true)` — pure attack surface)
- Acknowledged Realtime channel authorization issue — app is intentionally anonymous-collab (no auth, join codes only). Room IDs are UUID v4 (~122 bits entropy). Documented in security memory for re-tightening when auth ships.

Added `.env` to `.gitignore`.

---

## 12. Phase 1 — tldraw Canvas Foundation

**Date:** June 8, 2026, 20:31–21:20 UTC

**Chunk A — tldraw mount:**
- Installed `tldraw@5.1.0`
- Created `src/components/canvas/canvas-context.tsx` — `CanvasProvider` / `useCanvas` context exposing the tldraw `Editor`
- Created `src/styles/tldraw.css` — editorial theming (off-black surfaces, warm-orange accent, square corners, no shadows, hidden branding)
- Created `src/components/canvas/Canvas.tsx` — `<Tldraw>` mount
- Wired into `canvas-room.tsx` behind feature flag (`?canvas=tldraw` or `localStorage.cartoonist_canvas = "tldraw"`)

**Crash debugging saga:**
- Canvas disappeared after a few seconds → caused by `persistenceKey` (IndexedDB async-load wiping fresh strokes) + Vite returning 504 for tldraw dependency chunks
- Tried `<TldrawEditor>` (engine-only) — no UI, couldn't draw
- Tried full `<Tldraw />` — but user rejected tldraw's default UI: **"I want our UI while using the tldraw API for the tech"**
- Fixed by mounting only after joining the room (`{useTldraw && joined}`)

**Intro modal rework:**
- Removed auto-open intro popup (was appearing mid-session)
- Auto-join silently if profile exists from onboarding
- Added **"+ Add person"** button in header — opens same modal re-titled "Add someone on this device" for shared-device scenarios
- Modal `mode` prop: `"self"` (host join) vs `"add"` (in-room attendee)

---

## 13. Voice Enrollment & Add-Person Flow

**Date:** June 8, 2026, 20:54–21:01 UTC

The user wanted the system to track who's voice is who when people are added on a shared device.

**Voice enrollment built:**
- `participants` table: added `voice_sample_path` + `voice_sample_transcript` columns
- Created `voice-samples` storage bucket with RLS policies
- `IntroModal` rewritten with `MediaRecorder` (8s webm recording), start/stop/reset controls, audio preview + redo option
- Sample uploaded to `voice-samples/{roomId}/{uuid}.webm`, path saved to participant row
- Added voice-to-form autofill via `/api/parse-intro` — Web Speech API transcribes the 8s sample, Gemini extracts name + role, auto-fills form fields

**Note:** Live diarization + attribution (matching live speech to enrolled samples) was flagged as a follow-up chunk.

---

## 14. tldraw as Headless Engine

**Date:** Following June 8

The user was clear: **use tldraw for the engine, but with our custom editorial styling — not tldraw's default UI.**

**Solution:** tldraw as a "headless engine":
- Re-enabled `hideUi` on `<Tldraw />` so custom app header controls drive the editor
- Rewrote `src/styles/tldraw.css` for "warm paper" look — hairline borders, desaturated note colors, capped text sizes using fixed-size `geo` rectangles
- Custom UI components drive tldraw's store API underneath

**AI drawing pipeline restoration:**
- Added `compressLegacySegments` to convert AI primitives into native tldraw `draw` shapes
- Implemented "multi-stroke" border for notes
- Fixed 502/credit errors in `cartoonist-draw.ts`

**AI self-edit (v2.P):**
- AI can now revise or remove shapes via patches — not purely additive
- Resolved ElevenLabs 401 errors

---

## 15. v2.P — AI Self-Edit & Human Layer

**Built across multiple sessions**

**v2.P1 — Human Layer check-in + Team Desk:**
- `TeamDesk.tsx` — sidebar showing participants
- `CheckIn.tsx` — modal for pre-session check-in
- Participant context integrated into `cartoonist-draw.ts` for attributed AI decisions

**Roster Switcher & Kiosk Mode (for one-computer huddles):**
- **Roster Switcher:** Click any card on Team Desk → "I'm this person" → reassign `selfPid` temporarily → fill their check-in → switch back
- **Kiosk Mode:** "Start check-ins" button walks through each un-checked-in participant one by one on the same device, then prompts "Add the next person" until manually ended
- Recommendation: Kiosk mode is better for huddles around one screen

---

## 16. v2.P1–P4 — Team Desk, State Inference, Cost Meter, Mediator Voice

**v2.P2 — Live state inference:**
- `use-inferred-state.ts` — surfaces dropped threads via AI annotations
- Detects unresolved points in conversation

**v2.P3 — Drafter path:**
- Per-user participant context integrated into `generate-artifacts.ts` for attributed AI decisions
- Unified mediator and drafter on the same agent context

**v2.P4 — Mediator speaks back:**
- Added `allow_voice_mention` to participants
- Integrated `window.speechSynthesis` with "Voice/Muted" toggle
- `speak` strings added to `cartoonist-draw.ts` — AI can interject verbally

**v1 P1.9 — Live cost meter:**
- Created `public.ai_calls` table
- HUD in canvas room tracks Gemini spend in real time

**AI routing optimization:**
- Defaulted to `gemini-2.5-flash` for speed
- Escalates to `gemini-2.5-pro` for complex requests

**High-fidelity TTS:**
- `src/routes/api/mediator-tts.ts` — ElevenLabs `eleven_flash_v2_5` with ~400ms latency
- Web Speech API as fallback

**Provenance groundwork:**
- Added metadata fields to `public.canvas_events`

---

## 17. v2.P6 — Threads, Cross-Time Relations, Realtime Sync

**Threads rail:**
- `ThreadRail.tsx` — sidebar navigator for non-linear content
- Clicking a thread triggers `cartoonist:focus` event in Canvas to zoom to relevant shapes

**Cross-time thread linking:**
- AI can return `thread_ref` with relations (`extends`, `references`)
- `ThreadRail.tsx` tracks reopened threads

**Thread reopen visuals:**
- `cartoonist:reopen` pulsing orange "glow rings" on canvas
- "reopen peek" banner in `canvas-room.tsx`
- `requestAnimationFrame` projection loop keeps glow rings synced during camera zooms

**Canvas relation chips + peek:**
- Orange `↗` chips on related shapes
- Clicking opens `cartoonist-relation-peek` panel

**Canvas hydration:**
- Shape and thread reconstruction from `canvas_events` database on mount

**Realtime canvas sync:**
- Added `public.canvas_events` to Supabase Realtime
- All canvas changes sync across devices in real time

---

## 18. Live Collaboration — Presence, Cursors, Spotlight, Reactions

**Live presence:**
- `use-presence.ts` — tracks active participants
- `TeamDesk.tsx` — green status indicators for active participants

**Live pointer cursors:**
- `use-live-cursors.ts` — 18Hz broadcast
- `CursorsOverlay.tsx` — renders other users' pointers
- Verified: Alice and Bob see each other's pointers

**Shared spotlight:**
- Clicking a thread zooms all peers' canvases to the same spot
- Via `focus:room:{id}` broadcast channel

**Live reactions:**
- `use-reactions.ts` + `ReactionsOverlay.tsx`
- Ephemeral emoji bursts (👍💡❓🔥❤️😂)

---

## 19. Hand-Raise Queue & Mediator Voice Response

**Raise-hand queue:**
- `use-hand-queue.ts` — ✋ toggle
- AI prompt prefers inviting the person at the top of the queue during pauses
- Hand-raise uses guest ID from localStorage if `selfPid` missing (immediate functionality for un-checked-in users)

**Bug fixes:**
- Fixed debounce reset issues + identity fallbacks
- Raising hand reliably triggers "Go ahead" toast + voice prompt
- Verified via Playwright screenshots

**Mediator speech optimization:**
- Refactored to use `localFirst` browser `speechSynthesis` for instant "Go ahead" nudges
- Bypasses API latency for immediate response

---

## 20. Session Recap & Workspace Memory

**Session Recap:**
- `api/session-recap.ts` — Gemini 2.5 Pro synthesizes transcripts/threads into structured summaries
- `session-recap.tsx` — sheet UI with markdown export
- Empty-state handling verified in Playwright

**Workspace Memory (v2.P5):**
- Created `public.participant_insights` table
- `api/infer-insights.ts` — Gemini-powered facts with provenance
- `known-about-you.tsx` — "Memory" sheet to view and manage remembered facts
- "Learn from this session" button triggers fact extraction

---

## 21. Cross-Session Canvas Memory & Ghost Echoes

**The "soul" of Cartoonist v2** — making the whiteboard remember what was discussed in previous sessions.

**Database:**
- Created `public.canvas_relations` table for links between threads in different rooms

**Memory retrieval:**
- `useCrossSessionMemory` hook — client-side scoring against other rooms' `canvas_events`
- Scans historical session transcripts for keyword/topic overlaps

**Ghost callback:**
- When you draw something matching a past session → dashed orange "ghost glow" card appears
- Banner: "This echoes [Previous Session Title]"
- One-click jump to that room

**ThreadRail integration:**
- "Echoes from earlier sessions" section displays related threads from workspace history

**Verified via Playwright:** saying "the onboarding checklist should live on the dashboard sidebar" triggered a ghost callback from a seeded older session.

---

## 22. Session Replay

**Scrub bar that rebuilds the canvas stroke-by-stroke from provenance events:**

- `src/components/session-replay.tsx` — loads all provenance events for the room, reconstructs shape state frame-by-frame
- Scrubbable timeline with playback speeds (1x, 2x, 4x)
- Wired into `canvas-room.tsx` via `replayShapes` state that overrides live canvas during replay

**Bug fix:** Mounted `Toaster` in `src/routes/__root.tsx` so error/success messages are finally visible (was missing, causing silent toast failures).

---

## 23. Wireframe Fidelity — Pushed to the Max

Multiple iterations to push AI wireframe generation to maximum quality:

**Iteration 1 — Strict anatomy spec:**
- `cartoonist-draw.ts` — `ui_wireframe` modality requiring 18+ primitives using Gemini 2.5 Pro
- Chrome, sidebars, toolbars, node cards, rhythm-based layout
- Budget: 45–110 primitives
- Server-side auto-retry for wireframes under 45 primitives

**Iteration 2 — Max model + density:**
- Switched to `gemini-3-pro-preview` for wireframes
- Raised density floor to 60 primitives (range 70–170)
- Increased `max_tokens` to 32k
- Two-pass density ladder: structural layout → micro-detail enrichment (avatars, scrollbars, active-tab underlines, count badges, breadcrumbs)

**Iteration 3 — Progressive rendering (final):**
- Replaced blocking 4-minute density ladder with progressive two-pass system
- First pass (structural layout) returns in ~15–30s
- Client triggers follow-up enrichment pass to add micro-details live
- Switched to `gemini-3-flash-preview` for speed while maintaining fidelity

**Rendering fixes in Canvas.tsx:**
- Labels too wide for boxes auto-lift into separate text primitives (prevents vertical letter wrapping)
- Small icons render as glyphs with labels positioned beside
- `NaN` guard filters out primitives with non-finite coordinates (prevented white-screen crashes)
- `shapeSigRef` Map — only pushes shapes to tldraw store if actually changed (prevents UI lag on 170-shape wireframes)
- Change-detection guards on rAF loops for glow rings and relation chips (prevents 60fps React commit storms)
- AI-driven shape creation set to `{ history: "ignore" }` (prevents bloated undo history)

---

## 24. Session Pack — Export Everything

**One-click "Download all" export:**
- Canvas PNG (2×) + SVG
- Full markdown dossier: goal, participants, decisions, action items, threads, canvas contents, PRD, journey, mermaid flow, transcript
- Raw JSON
- Copy-to-clipboard
- One-click "Download all"

**Implementation:**
- `src/lib/session-pack.ts` — dossier construction
- `src/components/session-pack.tsx` — UI
- Integrated into export sheet in `canvas-room.tsx`
- `canvas-context.tsx` exports `getCanvasEditor()` helper so header-based export can access tldraw editor outside `CanvasProvider`

**Verified live:** Panel renders, `.md` downloaded with real content, PNG exported cleanly.

---

## 25. Performance Optimization

**The user reported the live session felt "clunky and laggy."**

**Root causes found & fixed:**

1. **React commit storms** — `requestAnimationFrame` loops for glow rings and relation chips triggered `setState` 60x/sec regardless of movement. Fixed with change-detection guards + `Math.round` coordinate snapping (only commits when camera actually moves).

2. **Shape diffing** — Rewrote shape-diffing logic using `shapeSigRef` (Map of serialized shapes). Only pushes shapes to tldraw store if they have actually changed. Prevents massive UI lag when AI adds small details to a 170-shape wireframe.

3. **Batched persistence** — `canvas_events` inserts batched into groups of 100 instead of individual network requests.

4. **Undo stack bloat** — AI-driven shape creation set to `{ history: "ignore" }` in tldraw engine.

5. **Progressive wireframes** — Replaced blocking 4-minute density ladder with two-pass system (structural → enrichment) for faster perceived performance.

6. **NaN guard** — Sanity check filters out primitives with non-finite coordinates (prevented white-screen crashes on page load or replay).

7. **Model tuning** — Switched wireframe passes to `gemini-3-flash-preview` to reduce latency.

---

## 26. Current State & North Star

### What exists today

A live meeting room where people talk (voice) or type (chat), and an AI mediator draws onto a shared tldraw-based whiteboard in real time. Features include:

- **Canvas:** tldraw engine with custom editorial styling (no tldraw default UI), infinite pan/zoom, editable shapes, soft-riff lock model
- **AI drawing:** Gemini-powered, progressive two-pass wireframe generation, multi-stroke hand-drawn borders, AI self-edit (can revise/remove shapes)
- **Voice:** Web Speech API transcription, live waveform, voice enrollment with 8s samples, voice-to-form autofill
- **Mediator:** TTS talkback (ElevenLabs + Web Speech fallback), hand-raise queue with instant "Go ahead" response, pause detection
- **Collaboration:** Supabase Realtime sync, live presence, live cursors (18Hz), shared spotlight, live reactions (emoji bursts)
- **Threads:** ThreadRail sidebar, cross-time relations, glow rings on reopen, relation chips with peek panels
- **Memory:** Cross-session canvas memory with ghost echoes, participant insights, "Learn from this session"
- **Session management:** Session recap (Gemini 2.5 Pro), session pack export (PNG/SVG/markdown/JSON), session replay (scrub bar)
- **Participants:** Team Desk sidebar, Human Layer check-in, Kiosk mode + Roster Switcher for shared devices, dual-mode (voice + chat) with identity merging
- **Cost tracking:** Live AI spend HUD

### Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start v1, React 19 |
| Styling | Tailwind v4, shadcn/ui, custom editorial design system |
| Canvas | tldraw v5.1.0 (headless engine, custom UI) |
| Drawing | rough.js, perfect-freehand |
| Backend | Supabase (Postgres, Realtime, Storage, RLS) |
| AI | Lovable AI Gateway — Gemini 2.5 Flash/Pro, Gemini 3 Flash/Pro Preview |
| TTS | ElevenLabs (eleven_flash_v2_5) + Web Speech fallback |
| Transcription | Web Speech API + ElevenLabs Scribe |
| Fonts | Fraunces (display), Inter (body), Caveat (handwritten) |

### North star

A **meeting medium** — not Figma, not transcription, not a generic whiteboard. The full vision:

- **Soft-riff lock model:** shapes go `open → augment-only → hard`. AI respects every human edit but can riff adjacent.
- **Two-stage AI pipeline:** classifier → renderer, with rolling 60s summary + entity graph so it follows long conversations without truncating.
- **Threads, not frames:** canvas grows by topic; non-linear callbacks once entity graph exists. Cross-time relations with glow + audio cues.
- **Contextual drawing loop:** per utterance, AI picks: fetch reference, template, free-sketch, note, annotate, or stay silent.
- **Multi-agent orchestra:** Scribe, Historian, Drafter, Facilitator, Devil's Advocate, Librarian + per-participant Past/Present/Future agents in shared knowledge graph.
- **Workspace memory:** accepted/rejected shapes feed weekly few-shot packs so the system learns each team's visual language.
- **Provenance:** every mark tied to a specific transcript moment — essential for scrubbing.

### Git status

All code is committed to Lovable's internal git. GitHub sync is available via the Plus (+) menu → GitHub → Connect project. This `HISTORY.md` lives in the repo and will sync to GitHub on the next commit.

---

*This document was generated from the full project chat history. It captures every feature shipped, decision made, and bug fixed across the conversation.*
