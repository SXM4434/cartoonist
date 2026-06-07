# Cartoonist Docs

Canonical specs and roadmaps for Cartoonist. Everything here is version-controlled — edit in place, don't fork copies into `/mnt/documents/`.

## Product

- [cartoonist-prd.md](./cartoonist-prd.md) — Product requirements. Principles, scope, phasing.

## Roadmaps

- [cartoonist-roadmap-v1.md](./cartoonist-roadmap-v1.md) — **Frozen.** The original build plan (Phase 1–5). Ship this first. Do not reorder.
- [cartoonist-roadmap-v2.md](./cartoonist-roadmap-v2.md) — **Additive.** Slots in after v1. Adds Human Layer, Team Desk, contextual drawing, canvas memory. Phases numbered `v2.P1, v2.P1.5, v2.P2 …` with explicit dependencies on v1 phases.

## Feature specs (referenced by v2 roadmap)

- [feature-human-layer.md](./feature-human-layer.md) — Pre-session check-in. Feeds mediator context. (v2.P1)
- [feature-team-desk.md](./feature-team-desk.md) — Right-rail participant cards + live state. (v2.P1, v2.P2)
- [feature-contextual-drawing.md](./feature-contextual-drawing.md) — Active contextualization loop: fetch vs sketch vs note. (v2.P1.5)
- [feature-canvas-memory.md](./feature-canvas-memory.md) — Provenance, threads, cross-time relations, post-session additions. (v2.P6)

## Rules

1. v1 stays frozen until shipped. v2 never reorders v1.
2. Every shape on the canvas carries provenance (`source`, `transcript_span`, `confidence`). See `feature-canvas-memory.md`.
3. No fabricated citations. If a reference can't be resolved, render as a typed note, not a fake card.
