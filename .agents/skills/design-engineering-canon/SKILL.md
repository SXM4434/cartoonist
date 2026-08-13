---
name: design-engineering-canon
description: Cross-cutting design-engineering canon gathered from Rauno Freiberg, Paco Coursey, Linear, Vercel and Amie — micro-interaction details, focus/keyboard behaviour, perceived performance, and the small implementation facts that make interfaces feel built rather than assembled. Use when polishing interactions or auditing feel.
---

# Design engineering canon

Research-derived rules from practitioners who publish implementation-level
interface craft (Rauno Freiberg's Interface Guidelines, Paco Coursey's component
work, Linear/Vercel/Amie interaction patterns).

## Perceived performance

- Optimistic UI for anything the user initiated; roll back visibly on failure.
- Skeletons only when load exceeds ~300ms; below that, show nothing rather than a flash.
- Preload on `pointerdown`/hover intent, not on click.
- Never block first paint on data that is not above the fold.
- A spinner under 400ms is worse than no spinner.

## Interaction detail

- Hit targets minimum 44px on touch; expand with padding or a pseudo-element, not
  by growing the visual box.
- Disabled buttons should still be focusable and explain why, or be replaced with
  an enabled button that surfaces the error on click.
- Inputs: select-all on focus for single-value fields; never trap the caret.
- Hover states must not be the only signal — keyboard focus needs a visible ring.
- Delay tooltip open ~500ms, but skip the delay while a tooltip group is already active.
- Popovers close on Escape, outside click, and scroll of the underlying container.

## Keyboard and focus

- Every dialog traps focus, restores it to the trigger on close, and closes on Escape.
- Provide `⌘K` only if it does something the UI cannot; do not fake a command menu.
- Arrow-key navigation inside any list-like widget (menus, comboboxes, tabs).
- Focus ring: `:focus-visible` only, offset from the element, respects the accent token.

## Text and numbers

- Tabular numerals for anything that updates in place (timers, counters, prices).
- Never let text reflow because of a live value — reserve the width.
- Truncate with a tooltip or title, never mid-word without ellipsis.
- Prevent selection on decorative/UI chrome; always allow it on content.

## Scroll and overflow

- `overscroll-behavior: contain` on every scrollable panel.
- Lock the body when a modal opens, and compensate for the scrollbar width to
  avoid layout shift.
- Sticky headers need a shadow or border that only appears once scrolled.

## Colour and depth

- Elevation via border + background lightness step before shadow.
- Never pure black or pure white for large surfaces.
- One accent; everything else desaturated.
- Semantic tokens only — no raw hex or `text-white` in components.

## Motion

- Motion explains a spatial relationship or state change; otherwise cut it.
- Curve: `cubic-bezier(0.32, 0.72, 0, 1)` for spatial moves, `ease-out` for fades.
- Interruptible: a second interaction must retarget, not queue.

## Audit prompt

Run through: first paint, primary action, keyboard-only pass, reduced-motion pass,
slow-network pass, empty/error state, and 500-row state. Anything that breaks in
one of those is not shipped.
