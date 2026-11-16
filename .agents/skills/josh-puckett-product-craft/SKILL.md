---
name: josh-puckett-product-craft
description: Product craft heuristics distilled from Josh Puckett's writing and talks — taste, detail budgets, prototyping in code, and shipping decisions. Use when judging whether a screen or flow is "done", prioritising polish, or deciding what to cut.
---

# Product craft (Puckett-derived)

Josh Puckett publishes essays and talks, not a packaged skill. This encodes the
recurring principles so they are usable at build time.

## Core stance

- **Craft is a system, not a coat of paint.** Polish applied at the end reads as
  decoration. Decide the material properties (type ladder, spacing scale, motion
  curves, elevation model) first, then every screen inherits craft for free.
- **Taste = a large reference library plus the discipline to subtract.** When a
  screen feels off, first remove something. Only add after two removals fail.
- **Prototype in the real medium.** Judge interaction in the running app, at real
  data volumes, on a real device — never in a static mock. A flow that "reads"
  well in a frame often feels wrong at 200ms.
- **Details compound, but they are not equal.** Spend the detail budget on the
  moments users hit most: first load, the primary action, empty states, and the
  transition between the two most-visited screens. Ignore the long tail.

## Detail budget (apply in this order)

1. First meaningful paint: does the page communicate its purpose before any data?
2. Primary action: is there exactly one, and is it unmistakable?
3. States: loading, empty, error, and success each designed, not defaulted.
4. Transitions between the two highest-traffic screens.
5. Everything else — deliberately plain.

## Decision rules

- If two designs are close, ship the one with fewer moving parts.
- If a feature needs an explanation label to be usable, the design failed; fix
  the affordance, don't add the label.
- Anything that only the designer would notice is not craft, it is self-indulgence.
- Speed is a design feature. A 100ms interaction with plain styling beats a 600ms
  one with a beautiful animation.

## Review questions

- What is this screen's single job? Point at the pixel that does it.
- What did I remove to get here?
- Does it hold up with 0 items, 1 item, and 500 items?
- Does it feel fast when the network is slow?
