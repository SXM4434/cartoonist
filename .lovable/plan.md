## Goal

One unified "speak to join" step replaces the separate enrollment + form, and the same captured audio later powers live speaker attribution during the session.

## Part 1 — Unified voice onboarding (enrollment + autofill in one take)

Single screen for both host and people being added:

1. Press-and-hold (or tap to start/stop) **one** recording, ~15–30s.
   Prompt shown on screen: *"Say your name, your role, and what you want out of this meeting."*
2. On stop we do, in parallel:
   - Upload the raw audio to the `voice-samples` storage bucket → save `voice_sample_path` on `participants`.
   - Transcribe it via ElevenLabs Scribe (batch, `scribe_v2`, no diarize) in a server function → save the full transcript to `voice_sample_transcript`.
   - Run the transcript through Lovable AI (`google/gemini-3-flash-preview`, structured output) to extract `{ display_name, role, personality, goal_hint }`.
3. Show the extracted fields pre-filled in the existing form so the user can confirm/edit, then save.

That same audio + transcript is the speaker's enrollment reference — no second recording step.

## Part 2 — Live speaker attribution during the session

While the room is active:

1. Capture mic audio in rolling ~8s chunks on the client.
2. Send each chunk to a server function that calls Scribe batch with `diarize: true` → returns words tagged `speaker_0/1/2…`.
3. Map cluster IDs → real participants:
   - **First-utterance confirm flow** (simple, reliable): when a new `speaker_N` first appears, surface a small "Who's speaking?" chip in the UI with the top guess based on whose enrolled sample is most textually similar to recent context; host or that person taps to confirm. Mapping persists for the rest of the session in a new `speaker_map` table (`room_id`, `cluster_label`, `participant_id`).
   - Once mapped, every transcript chunk inserts into `transcript_chunks` with the correct `participant_id`.
4. Existing transcript UI shows "Name: text" live.

(Acoustic similarity matching against enrollment samples is possible later but isn't reliable from Scribe alone — the confirm flow is the pragmatic v1.)

## Schema changes

- New table `public.speaker_map` (`id`, `room_id`, `cluster_label text`, `participant_id`, `created_at`) with RLS + GRANTs, unique on `(room_id, cluster_label)`.
- No changes needed to `participants` (already has `voice_sample_path`, `voice_sample_transcript`).

## Server functions / routes

- `transcribeVoiceSample` (serverFn, POST) — accepts audio, returns `{ transcript }`.
- `extractParticipantFromTranscript` (serverFn, POST) — Lovable AI structured output → `{ display_name, role, personality, goal_hint }`.
- `transcribeRoomChunk` (serverFn, POST) — accepts chunk + `room_id`, returns diarized words with cluster labels; inserts mapped chunks into `transcript_chunks` for already-known clusters; returns unmapped clusters for the UI to confirm.
- `assignSpeaker` (serverFn, POST) — `{ room_id, cluster_label, participant_id }` → upsert into `speaker_map`.

## Client changes

- Rework `intro-modal.tsx` (and the "add person" modal) into a single **VoiceOnboarding** component: record → transcribe+extract → confirm form → save.
- New `useLiveDiarization` hook in the room: MediaRecorder rolling chunks → `transcribeRoomChunk` → renders unmapped-speaker confirm chips.
- Live transcript panel updates from `transcript_chunks` realtime subscription (already wired).

## Secrets

`ELEVENLABS_API_KEY` and `LOVABLE_API_KEY` already present — no new secrets.

## Order of work

1. Migration: `speaker_map` table.
2. Server functions for transcribe + extract.
3. Replace intro/add-person modals with unified VoiceOnboarding.
4. Live diarization hook + confirm-chip UI + `assignSpeaker`.
5. Wire transcript chunks insert path.

Tldraw canvas work stays untouched — separate track.
