# Feature — Contextual Drawing

**Status:** spec, owned by v2.
**Slots into:** `cartoonist-roadmap-v2.md` → v2.P1.5.
**Related:** `cartoonist-prd.md` (Principle 9, §5), `feature-canvas-memory.md` (where fetched references get stored), `cartoonist-roadmap-v1.md` (v1 Phase 2 renderer this sits in front of).

---

## 1. Why

Today the AI renderer (`src/routes/api/cartoonist-draw.ts`) treats every utterance as "draw something." That misses three things:

1. **References.** When someone says "like the auth flow in the doc Sarah sent" or "the Stripe checkout pattern," the AI should *fetch* and embed, not invent.
2. **Free expression.** Not every idea fits a template (wireframe / journey / flow). Sometimes the right move is a doodle, a quoted callout, a typed note, an arrow scribbled between two existing shapes.
3. **Choice.** Right now the AI defaults to drawing. It should choose: fetch, sketch, type, annotate, or stay silent.

This feature adds a **planner stage** in front of the renderer that makes that choice explicit.

---

## 2. The contextual loop

Per AI turn (still gated by the existing pause/utterance detector):

```
utterance + recent transcript + canvas state + workspace memory
        │
        ▼
┌──────────────────────────┐
│  1. Classify intent      │  → {reference | concept | decision | quote |
│     (cheap model)        │     annotation | nothing}
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  2. Resolve references   │  → workspace memory hit? prior session hit?
│     (only if needed)     │     external web lookup? null?
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  3. Pick modality        │  → fetch_card | template_shape | free_sketch |
│                          │     typed_note | annotation | skip
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  4. Render               │  → existing cartoonist-draw shapes pipeline
└──────────────────────────┘
```

Steps 1–3 are one cheap model call returning JSON. Step 4 is the existing renderer.

---

## 3. Drawing modalities (the AI's licensed toolkit)

| Modality | When to use | Primitive | Provenance |
|---|---|---|---|
| **fetch_card** | Named external thing (product, doc, link, prior artifact) | Image + 1-line caption + source URL | `transcript_span` + `source_url` |
| **template_shape** | Process / journey / decision / system map | Existing wireframe, flowStep, journeyStep, diamond | `transcript_span` |
| **free_sketch** | Explained concept that doesn't fit a template | `path` primitive (already exists in `cartoonist-draw.ts`) + caption text | `transcript_span` |
| **typed_note** | Speaker stated a fact / number / quote worth pinning | `note` or `text` primitive | `transcript_span` |
| **annotation** | Speaker is reacting to an existing shape ("that login step should be biometric") | `text` + `arrow` + optional `path` underline, attached to existing shape id | `transcript_span` + `attaches_to: shape_id` |
| **skip** | Filler, small talk, repetition of something already drawn | — | — |

`skip` is a first-class output. Silence is correct most of the time.

---

## 4. Reference resolution order

When step 1 classifies as `reference`, step 2 searches in this order and stops at the first hit:

1. **Current canvas** — already drawn? then it's an `annotation` modality, not a fetch.
2. **Workspace memory** (see `feature-canvas-memory.md` §6) — prior session artifact embedding match.
3. **Connected docs / drives** — if a Google Docs / Figma / Notion connector is linked.
4. **Web search** — only for clearly external named things (products, frameworks, public docs).
5. **Null** — no hit; fall through to `free_sketch` + caption that says what the speaker referenced. **Never fabricate a citation.**

---

## 5. Failure modes & guardrails

- **Fabrication.** If web search returns nothing credible, the AI must NOT invent a URL or screenshot. Render the speaker's words as a quoted `typed_note` with no source.
- **Lookup latency budget.** Step 2 caps at 1.5s wall-clock. Timeout → fall through to sketch.
- **Cost.** Step 1 runs on every utterance (cheap classifier). Steps 2–3 run only when step 1 is non-`nothing`. Cost meter (PRD §5) attributes both stages.
- **Duplicate fetch.** Workspace memory dedupes — if the same external doc was fetched last session, reuse the cached card; don't refetch.

---

## 6. Data shape

New fields on a rendered shape:

```ts
{
  // existing fields...
  modality: 'fetch_card' | 'template_shape' | 'free_sketch' | 'typed_note' | 'annotation',
  source_url?: string,           // fetch_card only
  attaches_to?: string,          // annotation only — id of shape it annotates
  transcript_span: {             // required for every AI-made shape
    start_ms: number,
    end_ms: number,
    speaker_participant_id: string | null,
  },
}
```

Provenance is mandatory. Enforced at the renderer boundary, not optional. See `feature-canvas-memory.md` §2.

---

## 7. Out of scope (for v2.P1.5)

- Autonomous web research that runs without an utterance trigger.
- Fetching from private workspaces the participant hasn't joined.
- Pre-generating cards for likely references before the speaker finishes.
- Citation styling beyond a single source URL chip.

---

## 8. Verification gate

Scripted 10-minute session that includes:

1. A named external product → AI emits `fetch_card` with real URL.
2. An explained novel concept → AI emits `free_sketch` + caption.
3. A direct callback to a shape already on canvas → AI emits `annotation` attached to that shape, not a duplicate.
4. 30s of filler → 0 shapes emitted (`skip` working).
5. A reference to a doc that doesn't exist → AI emits quoted `typed_note`, no fabricated URL.

All five must pass for v2.P1.5 to ship.
