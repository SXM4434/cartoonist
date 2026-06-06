
# Cartoonist v2 — Live AI Storyboard Canvas

A Figjam-style room where 2+ people join, introduce themselves, talk, and watch an AI mediator draw the meeting as it happens — sticky notes, user flows, journey maps, decisions — onto a shared, scrubbable canvas.

## What the demo shows (must-have slice)

1. **Create / join a room** via shareable link (e.g. `/r/abc123`)
2. **Intro round** — each person records a 10-sec self-intro; AI extracts name + role + (optional) personality tag and pins a "participant card" on the canvas
3. **Live mic transcription** (ElevenLabs Scribe v2 realtime) with speaker labels per participant
4. **AI mediator draws live** — every ~8 sec the AI reads the rolling transcript and emits *canvas commands*:
   - `addStickyNote`, `addParticipant`, `addUserFlow`, `addJourneyMap`, `addDecision`, `addActionItem`, `connect(a, b, label)`
   - The visual *type* is chosen by the AI from context (flow vs map vs sticky cluster)
5. **Live collab** — cursors, shared state, anyone can drag/edit nodes (Liveblocks)
6. **Anonymous note** button — drops a sticky tagged "anonymous"
7. **"Someone has an idea" nudge** — AI detects an underheard speaker / quiet participant and posts a prompt
8. **End meeting → scrubbable timeline** — audio + transcript timeline at the bottom; clicking a moment highlights the canvas elements that were created at that moment
9. **Export panel** — Summary, Decisions, Action Items, PRD (reuses existing artifact generator)

## Stretch (only if time)
- Voting on stickies (👍 reactions)
- Upload past notes → AI ingests as context
- Agreement / disagreement heatmap overlay

## Tech stack

| Concern | Choice |
|---|---|
| Canvas | **tldraw** (`@tldraw/tldraw`) — gives infinite canvas, shapes, selection, multiplayer hooks out of the box |
| Realtime collab | **Liveblocks** (`@liveblocks/client`, `@liveblocks/react`, `@liveblocks/yjs`) — presence, cursors, Y.js doc for shapes |
| Voice → text | ElevenLabs Scribe v2 realtime (already wired) |
| AI mediator | Lovable AI Gateway → `google/gemini-3-flash-preview`, JSON tool-call returning canvas commands |
| Rooms / auth / persistence | Lovable Cloud (Supabase) — `rooms`, `participants`, `transcript_chunks`, `canvas_snapshots`, `audio_clips` (storage bucket) |
| Audio capture for scrub | MediaRecorder → upload to Cloud storage on meeting end |

## Build phases (~3-4 h realistic; we'll cut features to hit 1 h)

### Phase A — Foundations (20 min)
- Enable Lovable Cloud
- Add secrets: `LIVEBLOCKS_SECRET_KEY` (user provides), reuse `ELEVENLABS_API_KEY`
- Install `tldraw`, `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/yjs`, `yjs`
- DB: `rooms`, `participants`, `transcript_chunks`, `canvas_events`, `audio_clips` (+ RLS, grants)
- Storage bucket: `meeting-audio` (private)
- Server fn: `/api/liveblocks-auth` (mint Liveblocks token w/ room access)

### Phase B — Room + Canvas (25 min)
- Routes: `/` (create room), `/r/$roomId` (the meeting)
- Drop tldraw on `/r/$roomId` with `useYjsStore` bound to Liveblocks Y.js provider → cursors + shapes sync for free
- Header: room URL copy button, participant avatars

### Phase C — Intro round (15 min)
- Modal on join: "Record a 10-sec intro" → Scribe realtime → text → server fn extracts `{name, role, personality?}` → inserts a custom tldraw "ParticipantCard" shape

### Phase D — Live AI mediator (30 min)
- Per-participant Scribe session writes committed transcripts to `transcript_chunks` (with speaker_id + timestamp)
- Worker loop in the room (debounced 8 s): server fn `generateCanvasOps({ transcript, currentCanvasSummary })` → returns JSON array of ops
- Apply ops to tldraw store (which syncs via Liveblocks)
- Custom shapes: StickyNote, FlowNode, JourneyStep, DecisionDiamond, ActionItem; `connect` creates tldraw arrows

### Phase E — Anonymous notes + nudges (10 min)
- "Anon note" button → modal → adds sticky with author = "anonymous"
- Quiet-speaker detector: count utterances per speaker in last 2 min; if someone < threshold, AI posts a "💭 [Name] — anything to add?" sticky

### Phase F — Scrub timeline + export (20 min)
- "End meeting" → stop recorders, upload concatenated audio blob to storage
- Timeline bar: audio `<audio>` + scrubber; canvas events have timestamps → on scrub, highlight (glow) shapes created within ±2 s
- "Export" drawer reuses existing `/api/generate-artifacts` over the full transcript

### Phase G — Polish (15 min)
- Keep cream/orange/grey theme on tldraw via theme tokens
- Empty states, room-not-found, mic-permission error
- Quick README

## Data model (technical)

```sql
rooms(id uuid pk, name text, created_by uuid, created_at, ended_at)
participants(id uuid pk, room_id fk, user_id uuid?, display_name text, role text, personality text, joined_at)
transcript_chunks(id, room_id, participant_id, text, t_start_ms, t_end_ms, created_at)
canvas_events(id, room_id, op jsonb, created_at_ms)  -- for scrub replay
audio_clips(id, room_id, storage_path, duration_ms)
```

RLS: room members (by `participants.user_id = auth.uid()`) can read/write their room's rows. Anonymous join allowed via guest user.

## Liveblocks vs Y.js choice

tldraw's `useSync` + Liveblocks Y.js provider is ~30 lines of code and gives presence + cursors + shape sync. Raw Y.js + custom WebSocket would eat the hour. Liveblocks free tier covers demo.

## Risks
- **Liveblocks key**: user must provide one (free signup). If blocked, fallback: single-room mode using Supabase Realtime broadcast (no cursors, last-write-wins).
- **AI op quality**: model may emit invalid shape refs. Validate ops + ignore bad ones, never crash the canvas.
- **Scrubbing**: requires single recorded audio file. If multi-mic, just record host's tab audio for v1.
- **1-hour reality**: this is a 3-4 h build honest. For the hackathon hour, ship Phases A+B+D (room, canvas, AI draws live) and fake intros/scrub with screenshots in the pitch.

## What carries over from current code
- ElevenLabs Scribe token route ✅
- `generate-artifacts` route (reused for export) ✅
- Cream/orange/grey theme ✅
- Sample transcripts (for offline demo) ✅

What gets deleted: solo recording UI on `/`, single-page artifact tabs (moved into export drawer), Mermaid flow component (replaced by tldraw shapes).

---

**Confirm and I'll switch to build mode and start Phase A.** Also: do you already have a Liveblocks account / secret key, or should I scaffold the Supabase-Realtime fallback instead?
