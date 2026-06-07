# Feature — Canvas Memory (threads, provenance, cross-time relations)

**Status:** spec, owned by v2.
**Slots into:** `cartoonist-roadmap-v2.md` → v2.P6.
**Related:** `cartoonist-prd.md` (Principle 8, §5, §8), `feature-contextual-drawing.md` (writes into reference memory), `cartoonist-roadmap-v1.md` (v1 Phase 3 replay + v1 Phase 5 workspace memory this builds on).

---

## 1. Why

Four real gaps in the current model:

1. The canvas is **linear**. The renderer lays shapes left-to-right by time. Real conversations loop, extend, contradict, re-open. A shape from minute 2 may get modified at minute 18.
2. There's **no doctrine on provenance**. `canvas_events.t_offset_ms` exists but nothing enforces that every shape — AI or human — carries a pointer to the transcript moment it belongs to. Replay needs this; so does workspace memory.
3. **Post-session additions** have no home. If someone drops a note in async after the meeting, it sits floating with no tie to the conversation.
4. **Cross-time relations** (this shape *extends* that one from last week) aren't modeled. v1 Phase 5 stores workspace memory but there's no edge type between artifacts.

This feature ships the data model for all four, plus a deliberately minimal UI surface so we don't over-build before we know how people want to traverse.

---

## 2. Provenance doctrine (Principle 8)

Every shape on every canvas carries:

```ts
{
  source: 'ai' | 'human' | 'post_hoc',
  transcript_span: { start_ms, end_ms, speaker_participant_id } | null,
  confidence: number,    // 0–1; 1.0 for AI live, 1.0 for human live, inferred for post_hoc
  thread_id: string,     // see §3
}
```

Rules:
- **AI live shapes**: `source: 'ai'`, `confidence: 1.0`, span from the utterance that triggered them.
- **Human live shapes**: `source: 'human'`, `confidence: 1.0`, span derived from "what was being said when they started drawing." If the canvas is silent at the time, span = null.
- **Post-hoc shapes** (added after `rooms.ended_at`): `source: 'post_hoc'`, span inferred (see §5), confidence ranges 0–1.

Provenance is enforced at insert time by the server function that writes `canvas_events`. Shapes without provenance are rejected.

---

## 3. Threads, not frames

A **thread** is the unit of memory: "all shapes tied to this topic / question / decision." Threads replace the linear storyboard frame as the organizing concept.

```ts
type Thread = {
  id: string,
  room_id: string,
  label: string,            // AI-named, human-editable
  first_span: { start_ms, end_ms },
  last_touched_ms: number,
  status: 'open' | 'resolved' | 'parked',
  shape_ids: string[],
};
```

How threads form:
- AI classifier (already in `cartoonist-draw.ts`) tags each utterance with a topic vector. A new utterance either joins the nearest open thread (cosine similarity > 0.78) or opens a new one.
- A shape inherits its thread from the utterance that birthed it.
- Human-drawn shapes inherit the active thread at their timestamp; user can re-thread via right-click.

**Linear is still the default render.** Threads are sorted by `first_span.start_ms` and laid out left-to-right. The non-linear behavior kicks in when an utterance re-opens an older thread — new shapes attach back to that thread's region of the canvas instead of marching forward.

---

## 4. Cross-time relations (within and across sessions)

Typed edges between shapes:

```ts
type Relation = {
  from_shape_id: string,
  to_shape_id: string,
  kind: 'extends' | 'contradicts' | 'references' | 'resolves',
  confidence: number,
  created_by: 'ai' | 'human',
  rationale: string,        // one-line explanation, shown on the chip
};
```

Stored in a new `canvas_relations` table from day one, even if the UI only surfaces a fraction of them in v2.P6.

### UI surface (minimal first cut)

Per pushback in plan review:
- Each shape with ≥1 relation gets a small **↗ chip** in its corner.
- Click the chip → peek panel: thumbnail of the related shape, kind, one-line rationale, "jump to" button.
- Hovering a shape with relations gives it a soft **glow** in the accent color, and the related shape(s) glow in sync (same room or, if cross-session, a ghost glow in the workspace sidebar).
- A subtle **audio cue** (one-shot, short, low volume) plays when the AI surfaces a cross-time relation during live conversation, so participants notice without having to watch the rail.

Explicitly **not** in v2.P6: animated connector lines, persistent insight cards, graph view, hover-revealed annotation overlays. Park until we see traversal patterns.

---

## 5. Post-session additions

When a human adds a shape after `rooms.ended_at`:

1. Server runs the contextual loop (see `feature-contextual-drawing.md` §2) in reverse: shape's text + nearest visual neighbors → search the transcript for best-fit span.
2. Confidence scoring:
   - `>= 0.7` → auto-link, render normally with a small "added later" badge.
   - `0.4–0.7` → render with badge + prompt the human: "I think this ties to <quote at MM:SS>. Confirm?"
   - `< 0.4` → render as floating shape with `manual` tag and null `transcript_span`. No fabricated provenance.
3. Same flow applies to post-session relations: AI can propose `extends`/`references` edges to past shapes; human confirms or dismisses.

---

## 6. Artifact memory + reference memory (workspace-scoped)

Two new tables, both keyed by workspace:

### `workspace_artifacts`
Every shape that was accepted (not deleted within 60s) gets indexed:
```
{ workspace_id, room_id, shape_id, text_content, embedding,
  modality, thread_label, created_at, accepted: bool }
```
Used by: the renderer's few-shot pack (v1 P5), the contextual loop's "have we drawn this before" check (`feature-contextual-drawing.md` §4).

### `workspace_references`
Every external thing the AI ever fetched:
```
{ workspace_id, source_url, title, snippet, embedding,
  first_seen_room_id, fetch_count, last_seen_at }
```
Used by: the contextual loop's reference resolution order, step 2.

### Eviction & hygiene
- Soft cap: 50k rows per workspace per table; LRU eviction by `last_seen_at`.
- Per-shape "forget this" action in the UI cascades to both tables.
- Workspace owner can wipe both tables from settings. Provenance link to source room is preserved until wipe.

### Out of scope
- No cross-workspace memory sharing.
- No autonomous background jobs scanning memory; reads are on-demand from the in-session AI.
- No model fine-tuning. Few-shot is the only learning surface (PRD non-goal #6).

---

## 7. Migration & compatibility

- New tables: `threads`, `canvas_relations`, `workspace_artifacts`, `workspace_references`. All with RLS scoped to workspace membership.
- `canvas_events.op` gets a non-breaking `provenance` field. Old events without it stay readable; new writes must include it.
- Replay (v1 P3) becomes the first consumer of provenance. If v1 P3 ships before v2.P6, it reads `t_offset_ms` and tolerates missing structured spans.

---

## 8. Verification gate

Scripted 25-minute session across two rooms in the same workspace:

1. Room A: discuss an auth flow, AI draws it.
2. Room B (one week later in test time): utterance "remember the auth flow from last week?" → AI surfaces the prior shape as a `↗ related` chip on a new shape **within 3s**, with audible cue, with both shapes glowing.
3. Re-open an old thread mid-room: a minute-20 utterance about a minute-2 topic causes new shapes to attach back to the original thread region, not the right edge.
4. Add a post-session note with clear context → auto-linked with "added later" badge. Add one with ambiguous context → prompt fires. Add one with no context → floats with `manual` tag.
5. Replay scrubber re-forms the canvas using provenance spans; speech bubbles attach to the right shapes.

All five must pass for v2.P6 to ship.
