
# Cartoonist — focused rebuild plan

You're right: sticky-box demos aren't the product. The product is **a real whiteboard where the AI draws what's being said, in real time**, and you can clearly see/hear that the mic is listening. I want to nail that loop first, then layer everything else on top. Trying to ship all 4 phases in one pass is what's caused the blank-screen churn — so I'll do it in **three tight passes**, each one verifiable in the preview before the next.

---

## Pass 1 — A whiteboard that actually draws (no fake demo)

**Goal:** Speak (or type) a sentence → within ~2s an actual sketch appears on the canvas. No sticky-note rectangles.

- Rip out the current demo overlay + "sticky note" cards from `canvas-room.tsx`. They're misleading.
- Replace the canvas with **two real surfaces stacked**:
  1. **SVG sketch layer** (the "drawing") — the AI returns sketch primitives (`stroke` polylines, `arrow`, `box`, `circle`, `label`, `connector`) with hand-drawn jitter applied client-side via `rough.js`. This is what makes it feel like a whiteboard, not a Kanban.
  2. **Freehand layer** — you can draw with mouse/touch using `perfect-freehand`, so humans + AI share the same surface.
- Mic feedback that you can't miss:
  - Big pulsing red dot + live waveform bar driven by `AnalyserNode` (so you *see* your voice level moving).
  - Live partial transcript ribbon at the bottom ("…hearing: 'so the user lands on…'") updating as you speak.
  - Toast on permission denied / no-speech / browser unsupported.
- Web Speech API wired with `interimResults: true`, auto-restart on `end`, Chrome-only banner.

**Verify:** I open preview, click mic, say "draw a login flow with email and Google", and see strokes appear within a couple seconds. If that doesn't work, I don't move on.

---

## Pass 2 — The AI "cartoonist" brain

**Goal:** The drawings come from real AI, not scripted demos.

- Edge function `cartoonist-draw` (Lovable AI, `google/gemini-3-flash-preview`, structured tool-call output) that takes the last ~30s of transcript + current canvas state and returns a JSON patch of sketch primitives to add/update/remove. Runs on a debounce (every ~3s while someone's talking, or on "pause detected").
- Edge function `mediator-monitor` returns short cards: surfaced quiet ideas, agreements, disagreements, open questions. Renders in the right rail (not as canvas cards).
- Both write to existing `canvas_events` / `transcript_chunks` tables so multiple participants see the same drawing via Supabase Realtime.
- Failures show a clear inline error in the mediator rail — never blank the screen.

**Verify:** Two browser tabs in the same room both see the same drawing evolve.

---

## Pass 3 — Wrap-up: docs, votes, action items, team alignment

Only after passes 1+2 feel good:
- `generate-artifact` edge function → Documents tab (summary, PRD, user journey, flow, timeline, problem statement, decisions, action items, team alignment). Editable + copy-to-markdown.
- Polls + live tallies (Realtime on `polls` / `vote_responses` — needs two new tables).
- Action item Kanban (new `action_items` table).
- Uploads & Notes (new `uploads` table + Storage bucket).
- Profile onboarding (personality + strengths) + dashboard list of past sessions.

---

## Design pass (applies across all three)

Kept tight per your locked memory:
- Off-black canvas (`oklch(0.22 0 0)`), warm orange accent for the mic/record state only, everything else desaturated.
- Hand-drawn feel comes from `rough.js` strokes on the canvas itself — **not** from wobbly UI chrome. The app UI stays disciplined editorial; the *drawings* are the playful part. That's the right contrast and matches your "cool on first read, warmer on interaction" north star.
- Fraunces for the masthead, Inter for everything else, locked type ladder.

---

## Technical details

- New deps: `roughjs`, `perfect-freehand`. No React Flow (it was the wrong primitive — it's a node-graph lib, not a sketching surface).
- Edge functions: `cartoonist-draw`, `mediator-monitor`, `generate-artifact`. All call Lovable AI Gateway with `LOVABLE_API_KEY` (already set). Tool-calling for structured sketch output, kept schema small to avoid Gemini's "too many states".
- Migration in Pass 3 only: `polls`, `vote_responses`, `action_items`, `uploads` (+ GRANTs + RLS + Realtime publication).
- Liveblocks stays removed — Supabase Realtime on `canvas_events` is the source of truth, which fixes the blank-screen crashes for good.
- Strict verification after each pass: open the preview, reproduce the user flow, check console + network. No "should work" claims.

---

## One thing I need from you before I start

Pass 1 alone is real work (~the biggest single change in the project so far). Two quick confirmations:

1. **Stack of changes is fine?** I will delete the current demo overlay and the sticky-card rendering. The "Play demo" button goes away — replaced by mic + real AI.
2. **Drawing style:** rough.js "hand-sketched" (wobbly pen lines, like Excalidraw) — that's what I'm assuming based on your "Cartoonist" mascot direction. Confirm or say "cleaner / more architectural" and I'll adjust.

Approve and I'll start Pass 1 immediately.
