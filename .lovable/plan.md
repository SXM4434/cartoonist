# Cartoonist — Hackathon Build Plan (Locked)

## 1. PRD

**Product:** Cartoonist — an AI mediator that listens to a conversation and converts it into actionable team artifacts.

**1-hour MVP:** Solo voice demo. User speaks into the browser mic. ElevenLabs Scribe transcribes live. "Generate" sends the transcript to Lovable AI which streams back 6 artifacts.

**User flow (judge demo, ~90s):**
1. Land on `/` → "Start session" button + brief explainer.
2. Click Start → mic permission → live transcript fills screen.
3. Talk for 30-60s (or play pre-recorded audio into mic).
4. Click Stop → transcript locks.
5. Click "Generate Artifacts" → 6 tabs stream in.
6. Each artifact: rendered Markdown (Flow tab = Mermaid diagram), copy-to-clipboard.

**Success:** Voice → transcript → 6 polished artifacts, no broken UI.

**Non-goals (post-MVP):** auth, rooms, multi-user, anonymous notes, voting, personality types, whiteboard, file uploads.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start (template default) |
| UI | React + Tailwind v4 + shadcn/ui |
| Transcription | ElevenLabs Scribe v2 realtime via `@elevenlabs/react` (`useScribe`) |
| AI | Lovable AI Gateway, `google/gemini-3-flash-preview`, streaming SSE |
| Diagram | `mermaid` (client render) |
| Markdown | `react-markdown` |
| Backend | TanStack server routes — no DB |
| State | In-memory React state |

Connectors to link: **ElevenLabs** (for `ELEVENLABS_API_KEY`). Lovable AI auto-provisioned.

---

## 3. Design Direction

**Neutral elegance**: cream background, light grey surfaces, single warm orange accent. Editorial typography (serif display + clean sans body). Generous whitespace, no gradients, no glow — "thoughtful mediator," not "AI hype."

Tokens (defined in `src/styles.css` via `@theme`):
- `--color-background`: cream `oklch(0.97 0.01 80)`
- `--color-foreground`: near-black `oklch(0.18 0 0)`
- `--color-muted`: light grey `oklch(0.94 0.005 80)`
- `--color-accent`: orange `oklch(0.7 0.18 50)`

---

## 4. MVP vs Post-MVP

**MVP (this build):** single `/` page, mic + Scribe, all 6 artifacts streaming, copy-to-clipboard, demo-transcript failsafe.

**Post-MVP (do not build now):** auth, rooms by code, multi-user chat, live AI mediator interjections, audio rooms (WebRTC), personality types, anonymous notes, voting, whiteboard / live AI visuals, file uploads / MCP, persistence (Lovable Cloud).

---

## 5. Build Phases

Each phase ends with an **eval gate** (automated + manual GO/NO-GO).

### Phase 0 — Setup (5 min)
- 0.1 Link **ElevenLabs** connector
- 0.2 `bun add @elevenlabs/react react-markdown mermaid`
- 0.3 Confirm `LOVABLE_API_KEY` + `ELEVENLABS_API_KEY` available
- 0.4 Apply design tokens in `src/styles.css`, add serif display font via `<link>` in `__root.tsx`

**Eval gate 0:** `fetch_secrets` shows both keys; build passes; cream/orange theme visible on `/`.

### Phase 1 — Backend endpoints (15 min, parallel with Phase 2)
- 1.1 `src/routes/api/elevenlabs/scribe-token.ts` — POST → returns `{ token }` from ElevenLabs `single-use-token/realtime_scribe`
- 1.2 `src/routes/api/generate-artifacts.ts` — POST `{ transcript }` → streams SSE from Lovable AI Gateway. System prompt + tool-calling schema returns JSON: `summary`, `decisions[]`, `actionItems[]`, `prd`, `userJourney`, `flowMermaid`

**Eval gate 1:**
- Automated: `invoke-server-function` POST `/api/elevenlabs/scribe-token` → 200 + token. POST `/api/generate-artifacts` with sample transcript → valid JSON with all 6 keys.
- Manual: artifact content looks reasonable.

### Phase 2 — UI shell (15 min, parallel with Phase 1)
- 2.1 Replace `src/routes/index.tsx` placeholder. Hero: "Cartoonist" wordmark (serif), tagline, "Start session" button.
- 2.2 `<TranscriptPanel />` — partial line (italic muted) + committed lines stack
- 2.3 `<ArtifactTabs />` — 6 tabs with empty states + skeleton shimmer
- 2.4 Polish: spacing, type scale, focus states

**Eval gate 2:** Build passes, `/` renders cleanly, no console errors, design feels on-brief.

### Phase 3 — Wire transcription (10 min)
- 3.1 `useScribe` with `commitStrategy: "vad"`
- 3.2 Fetch token from `/api/elevenlabs/scribe-token`, call `scribe.connect`
- 3.3 Pipe partial + committed transcripts into `<TranscriptPanel />`
- 3.4 Start / Stop buttons wired

**Eval gate 3:** Manual — speak into mic, words appear within ~1s. Stop cleanly disconnects.

### Phase 4 — Wire artifact generation (10 min)
- 4.1 "Generate Artifacts" button → POST transcript to `/api/generate-artifacts`
- 4.2 Stream parser progressively fills each tab as JSON fields arrive
- 4.3 Markdown render for text artifacts, Mermaid render for `flowMermaid` (try/catch fallback to raw code)
- 4.4 Per-tab loading shimmer until that field arrives

**Eval gate 4:**
- Automated: end-to-end script — POST sample transcript, assert all 6 artifacts populated.
- Manual: click Generate, all 6 tabs fill with relevant content.

### Phase 5 — Demo polish (5 min)
- 5.1 "Load demo transcript" button (failsafe if mic fails)
- 5.2 Copy-to-clipboard on each artifact
- 5.3 Final visual pass

**Eval gate 5 (final):** Manual dry-run of full judge flow. If anything stutters, use failsafe.

---

## 6. Eval System

After every phase I post:

```
PHASE N COMPLETE
✅ shipped: <list>
⚠️ broken/skipped: <list>
🤖 automated checks: <pass/fail>
🔜 next: <phase>
GO / NO-GO?
```

**Automated checks I run:** build pass, `invoke-server-function` smoke tests, `server-function-logs` error scan, end-to-end transcript→artifacts assertion in Phase 4.

**Manual gate:** you reply **GO** to continue, **NO-GO** with feedback, or **SKIP** to drop scope. If a phase overruns, I stop and ask before adding time — we cut scope, not quality.

---

## 7. Team Assignments (parallel work for your 4-6 humans)

- **P1:** Write 3 realistic sample transcripts (~200 words each) for demo failsafe
- **P2:** Demo script + judge talking points
- **P3:** Logo/wordmark polish, tagline copy
- **P4:** Post-MVP roadmap doc (1-pager) to show judges "what's next"
- **P5:** Record backup video of working demo

---

## 8. Risk Register

| Risk | Mitigation |
|---|---|
| Mic fails on demo machine | Phase 5.1 failsafe transcript button |
| ElevenLabs rate limits | Test once in Phase 3; have transcript ready |
| AI returns invalid JSON | Tool-calling with strict schema (Phase 1.2) |
| Mermaid syntax errors | try/catch render, raw code fallback |
| 1-hour overrun | Hard cut at end of Phase 4; Phase 5 is "nice to have" |

---

**Approve to start Phase 0.**
