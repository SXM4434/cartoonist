# Feature — Human Layer

**Status:** spec. Owned by `cartoonist-roadmap-v2.md`. Built in v2.P1; deepened in v2.P2, P3, P5.
**One-liner:** Cartoonist understands the people in the room, not just the conversation.

---

## Problem

Cartoonist already attributes utterances and gives each person a color. That's identity, not understanding. The mediator has no idea that Sebastian prefers direct critique, that Yimeng thinks visually, that Amara is worried about scope today. So the AI facilitates everyone the same way, which is the same failure mode as a generic meeting tool.

## What it is

A lightweight per-session profile, gathered in a 30–60s check-in before the room opens, used by the mediator (and later the per-user agents) to facilitate more inclusively.

Not a personality test. Not an HR record. Every field must change AI behavior or a visible UI affordance — if it doesn't, cut it.

## Fields

| Field | Type | Why it earns its slot |
|---|---|---|
| `role_today` | short text | Mediator knows whether to ask you about scope, visuals, ops, or eng feasibility. |
| `strengths` | 1–3 chips | Drafter attributes decisions to the right voice; mediator routes the right question to you. |
| `contribution_modes[]` | multi-select: voice, chat, whiteboard, async notes | Room defaults your input UI; mediator doesn't push you to speak if you opted out of voice. |
| `feedback_style` | one of: direct, gentle, ask-first, written-only | TTS mediator and drafter calibrate tone when addressing you. |
| `blockers` | short text, private by default | Mediator can surface on your behalf, or hold it as context without exposing. |
| `needs_today` | short text | What you want out of the session. Drafter checks at end whether you got it. |
| `can_help_with` | short text | When someone else raises a question, mediator can route to you. |

Defaults: every field optional. Skipping the check-in is a one-click action and the room opens normally.

## Capture flow

1. Room invite link → name + role gate (already exists).
2. New screen: "60 seconds — say hi to the room." Voice button (Scribe) or 6 small text fields.
3. Voice path: one prompt, "tell us your role today, how you like to work, and what you need from this meeting." Parser fills the fields, user confirms.
4. "Join meeting" → room opens.

## Data model

Extend existing `participants` table:

```sql
ALTER TABLE participants
  ADD COLUMN strengths text[],
  ADD COLUMN contribution_modes text[],
  ADD COLUMN feedback_style text,
  ADD COLUMN blockers text,
  ADD COLUMN needs_today text,
  ADD COLUMN can_help_with text,
  ADD COLUMN human_layer_complete boolean DEFAULT false;
```

Privacy: `blockers` and `needs_today` are not exposed in the realtime payload to other clients unless `share_with_room = true` (per-field, default false). Mediator reads server-side regardless.

## AI integration

Mediator system prompt gains a compact block, regenerated per call:

```
PARTICIPANTS:
- Sebastian (design lead): direct critique ok. Strong: prototype direction. Worry: overbuilding.
- Yimeng (visual storyteller): chat-preferred. Strong: spatial thinking. Help with: diagrams.
- Amara (ops/PM): written feedback. Strong: scope. Need today: a decision on cutover.
```

Token budget: capped at ~40 tokens per participant. Truncate `strengths` to 1 chip and worries to 6 words if budget exceeded.

## Out of scope

- Personality typing (MBTI, DISC, etc.)
- Energy/mood sliders
- Long bios, photos, links
- Sharing the profile outside the workspace
- Manager-facing dashboards
- Automatic inference from past sessions (lives in v2.P5)

## Kill criteria

If, after two real test sessions, the mediator's output doesn't measurably change based on the participant block (judged by blind A/B against a no-Human-Layer run), kill the feature. Don't keep collecting data that doesn't earn its keep.

## Sequencing

- **v2.P1:** capture + storage + mediator prompt block + privacy toggles.
- **v2.P2:** live state inference layered on top.
- **v2.P3:** seeds per-user agents.
- **v2.P5:** becomes a workspace-level living profile.
