
# Chat-join + dual-mode participants

Add a chat-based way to join a session alongside the existing voice/audio join, and let the canvas treat typed messages as first-class input equal to speech. Same person in both modes = one identity (chosen at join, with a manual "this is also me" fallback).

---

## Scope

### 1. Join screen — two paths
On the existing join/onboarding screen (`src/routes/onboarding.tsx` and `src/routes/r.$roomId.tsx` entry), add a clear choice:

- **Join with voice** (existing flow — mic permission, audio intro, autofills profile from speech).
- **Join with chat** (new — no mic permission, opens straight into the room with a chat composer focused).

Both paths require the participant to pick/confirm their **display name** first. That name is the join-time identity used to merge streams later (option **a**).

Room-code path keeps working for both modes.

### 2. Participant model
Extend `participants` row with:
- `input_mode: 'voice' | 'chat' | 'both'` — what they're currently using.
- `linked_participant_id: uuid | null` — for the "this is also me" manual link (option **c**).

When someone joins, we look for an existing participant in the same room with the same normalized display name; if found, we pre-fill a "Are you also @Maya (voice)?" prompt → one click links them. They can also link/unlink later from the participant list.

### 3. Chat panel in the room
New right-rail (or bottom drawer on narrow viewport) `ChatPanel`:
- Live message list, newest at bottom, grouped by participant with their color dot.
- Voice utterances and chat messages render in the **same** stream, distinguished only by a small `🎙` or `⌨` glyph next to the author name. Linked identities collapse into one author with both glyphs shown on their messages.
- Composer: textarea, Enter to send, Shift+Enter newline. Typing indicator broadcast via Supabase Realtime presence.

### 4. Transcript merging
`transcript_chunks` already has `participant_id`. Add `source: 'voice' | 'chat'` (default `voice`). Chat messages insert into the same table — the Cartoonist sees one unified timeline.

When two participants are linked, the AI prompt and the participant rail render them as one person; the canvas attribution (when AI quotes someone) uses the canonical display name.

### 5. AI awareness
The cartoonist-draw and any future agent prompts get a small participant header:
```
Maya (voice + chat)
Jordan (chat only)
Sam (voice only)
```
So when the AI puts a quote on canvas it attributes correctly regardless of input mode.

### 6. Audio-intro autofill stays
Voice-join still runs the audio intro and parses goal/outputs/role into the room + profile (`parse-intro` route). Chat-join shows a 30-second typed intro form with the same fields, optional.

---

## Technical details

### Migration
- `ALTER TABLE participants ADD COLUMN input_mode text NOT NULL DEFAULT 'voice' CHECK (input_mode IN ('voice','chat','both'))`
- `ALTER TABLE participants ADD COLUMN linked_participant_id uuid REFERENCES participants(id) ON DELETE SET NULL`
- `ALTER TABLE transcript_chunks ADD COLUMN source text NOT NULL DEFAULT 'voice' CHECK (source IN ('voice','chat'))`
- Add `transcript_chunks` and `participants` to `supabase_realtime` publication (if not already) so chat + linking updates broadcast live.

No new tables — reusing `transcript_chunks` as the unified stream is what makes voice/chat parity actually work end-to-end.

### Files
- `src/routes/onboarding.tsx` — add mode picker step (Voice / Chat) after name.
- `src/routes/r.$roomId.tsx` / `src/components/canvas-room.tsx` — wire mode into participant insert; conditionally start `useSpeech` only for voice.
- `src/components/chat-panel.tsx` (new) — message list + composer + presence.
- `src/components/participant-rail.tsx` (touch) — show mode glyphs, "link as me" action.
- `src/lib/profile.ts` — helper to find-or-link by normalized display name.
- `src/routes/api/cartoonist-draw.ts` — include participant roster + source tags in the prompt context.

### Identity-link logic (option a + c)
On join:
1. User types/confirms display name.
2. Query existing participants in this room with `lower(trim(display_name)) = lower(trim(input))`.
3. If a match exists with a *different* `input_mode`, show inline: "Looks like @Maya is already here on voice — is that you?" → Yes sets `linked_participant_id` both ways and bumps the canonical row's `input_mode` to `both`.
4. If no match or user says No, create a fresh participant.
5. Manual link/unlink button in the participant rail handles the case where someone joins under a slightly different name.

### Out of scope (deliberate)
- Voice diarization auto-matching (option b).
- Cross-room identity.
- Auth-bound identities — display name is the identity for this session.

---

## Verify
- Open the room in two tabs as "Maya" — first picks Voice, second picks Chat, gets the "is that you?" prompt, accepts → one participant shows in the rail with both glyphs. Talk in tab 1, type in tab 2, canvas reacts to both, transcript shows both with `🎙` / `⌨` tags under one name.
- Third tab as "Jordan" Chat-only: types a message, canvas reacts, rail shows chat-only glyph.

Approve and I'll build it.
