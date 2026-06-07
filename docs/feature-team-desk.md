# Feature — Team Desk

**Status:** spec. Owned by `cartoonist-roadmap-v2.md`. Built in v2.P1; deepened in v2.P2.
**One-liner:** A right-rail surface that keeps the humans visible while the work happens.

---

## Problem

Once the canvas fills with shapes, the humans in the room disappear. You forget who hasn't spoken, who's stuck, who raised a point that got dropped. The chat rail shows messages, not people. There is no surface for "who's in this room and what state are they in right now."

## Why a right rail (not a canvas frame, not a modal)

- **Canvas frame:** pollutes the artifact, competes with the work, AI can draw over it.
- **Modal:** hides the humans the moment the meeting starts — opposite of the goal.
- **Separate page:** kills the live "humans visible while the work happens" point.
- **Right rail (chosen):** always visible, doesn't fight the canvas, collapses for focus mode, mirrors the existing chat rail pattern.

## Layout

```
┌─────────────────────────────────────┬──────────────┐
│                                     │ TEAM DESK    │
│                                     │ ──────────── │
│                                     │ [card]       │
│         tldraw canvas               │ [card]       │
│                                     │ [card]       │
│                                     │ [card]       │
│                                     │              │
│                                     │ ──────────── │
│                                     │ chat rail    │
└─────────────────────────────────────┴──────────────┘
```

- Rail width: 280px. Collapses to 44px (avatars only) with a single hotkey.
- Stacks above the existing chat rail in the same column. Chat rail unchanged.

## ParticipantCard — collapsed state

| Element | Source |
|---|---|
| Avatar (color disc + initials) | `participants.color`, `display_name` |
| Name + role one-liner | `display_name`, `role_today` |
| Mode dot: `speaking` `typing` `sketching` `quiet` `unresolved` | derived from transcript_chunks, chat events, canvas_events, v2.P2 detector |
| One-line context | rotates: open ask → can-help → last contribution snippet |

Visual rules (per design memory):
- Off-black surface, 1px border, square corners (no rounded-2xl).
- Mode dot is a 6px solid disc in the participant's color; saturation drops when `quiet`.
- Eyebrow label uppercase tracking-wide for role.
- No drop shadows. Border + bg lightness step for elevation when expanded.
- Type ladder: name 15, role 11, context 13. Tabular numerals for any counts.

## ParticipantCard — expanded state (click to open)

- Full profile from Human Layer (respecting per-field privacy).
- Last 3 contributions, each linkable to the moment in replay.
- AI-inferred current focus (v2.P2+): "talking about cutover decision."
- "Address this person" button → mediator opens a chat thread to them.

## Live state derivation

- `speaking`: active audio level above threshold for >1s in last 3s.
- `typing`: chat composer focus + keystroke in last 5s.
- `sketching`: canvas_events with `source = user` and this participant_id in last 5s.
- `quiet`: none of the above for >60s.
- `unresolved` (v2.P2): facilitator agent flagged dropped thread.

All state is ephemeral — never persisted, never replayable as state. Replay rebuilds from underlying events.

## Privacy

- Mode dot is visible to everyone. It's behavioral, not personal.
- Profile fields obey per-field `share_with_room` from Human Layer.
- Blockers/needs hidden by default. Card shows "private to mediator" placeholder so the *existence* of context is visible without leaking content.

## What it is not

- Not a leaderboard. No contribution counts ranked.
- Not a mood tracker. No emoji weather, no energy bars.
- Not an HR surface. No manager view, no export.
- Not a scoreboard for the mediator. Cards don't show AI ratings of participants.
- Not a settings panel. Editing profile happens in the check-in screen or a dedicated page, not in the rail.

## Components

```
src/components/team-desk/
  TeamDesk.tsx               // right-rail container, collapse state
  ParticipantCard.tsx        // collapsed + expanded states
  ModeDot.tsx                // derives + animates the live mode
  use-participant-state.ts   // subscribes to transcript + canvas events
```

No new tables — reads from existing `participants` + `transcript_chunks` + `canvas_events` + Human Layer columns.

## Verification gate

- One card per `participants` row.
- Mode dot transitions within 2s of the triggering event in manual test.
- Expanding a card never shifts canvas layout (rail is absolute-positioned overlay above 1200px viewport, push-layout below).
- Privacy: a participant with `share_with_room=false` on `blockers` — no one else sees the content; "private" placeholder visible.

## Sequencing

- **v2.P1:** rail, cards, mode dot (speaking/typing/sketching/quiet), expanded view.
- **v2.P2:** unresolved marker + AI-inferred focus line.
- **v2.P5:** card surfaces workspace-memory hints ("Sebastian usually wants to ship a prototype by end of session").
