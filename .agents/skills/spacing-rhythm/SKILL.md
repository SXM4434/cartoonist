---
name: spacing-rhythm
description: Spacing scales, vertical rhythm, proximity grouping, padding vs margin discipline, section breathing room, and density tuning. Use when a layout feels cramped, floaty, or inconsistent.
---

# Spacing and rhythm

Spacing is the cheapest way to look expensive and the most common thing done arbitrarily.

## Scale

- One spacing scale, geometric-ish: 2 4 8 12 16 24 32 48 64 96 128. No 15, no 37, no `mt-[19px]`.
- Density tiers: component internals use 4–16; between components 16–32; between sections 64–128. If a section gap and a component gap are the same number, the page loses structure.

## Proximity is meaning

- Related things sit closer than unrelated things. A label 16px from its input and 16px from the next field is ambiguous — halve the outer or double the inner.
- Space *above* a heading should exceed the space below it, roughly 2:1. This is the single most common fix for "everything floats".

## Discipline

- Owners space their children. Prefer parent `gap` over per-child margins; a child should not know what sits next to it.
- Never both `margin-bottom` on children and `gap` on the parent — pick one.
- Optical padding: a button with an all-caps label needs less top padding than bottom to look centered; icon-plus-text needs asymmetric horizontal padding (less on the icon side).
- Nested containers must not stack padding into an accidental 80px inset. Check the sum.

## Rhythm

- Pick a base unit (usually 8) and keep vertical gaps as multiples. Deviations should be deliberate and rare.
- Repeating section padding creates a metronome; changing it deliberately creates emphasis. A tighter section reads as urgent, a taller one reads as important.
- Responsive: scale section padding, not component padding. 128 → 64 at mobile; 16 stays 16.

## Review pass

Squint at the screenshot. You should see grouped blocks with clear channels between them. If it reads as one grey mass, proximity is failing; if it reads as scattered islands, the outer gaps are too large relative to content.
