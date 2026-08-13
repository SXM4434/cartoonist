---
name: shadcn-ui-animations
description: Animating shadcn/ui + Radix primitives correctly — data-state driven transitions, dialogs, popovers, dropdowns, sheets, accordions, toasts, and list reordering. Use when adding or fixing motion on shadcn components.
---

# shadcn/ui animations

Radix primitives expose state as data attributes. Animate those, not React state.

## The primitive contract

Every Radix overlay renders `data-state="open" | "closed"` and, when relevant,
`data-side`, `data-align`, and `data-motion`. Tailwind animates them via the
`data-[state=...]` variant.

```tsx
className="
  data-[state=open]:animate-in data-[state=closed]:animate-out
  data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
  data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
  data-[side=bottom]:slide-in-from-top-2
"
```

Rules:
- Exit animations only run if the primitive keeps the node mounted. Never wrap a
  Radix `Content` in your own conditional render — you delete the exit.
- Use `forceMount` + presence only when you need a custom animation library.

## Durations and easing

| Element | Duration | Easing |
| --- | --- | --- |
| Dropdown / popover / tooltip | 120–150ms | `ease-out` in, `ease-in` out |
| Dialog / alert | 180–220ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Sheet / drawer | 250–300ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Accordion / collapsible | 200ms | `ease-out` |
| Toast | 200ms in, 150ms out | spring-ish ease-out |

Exit is always faster than enter (~70%). Overlays scale from 95–98%, never below.

## Accordion / collapsible

Radix sets `--radix-accordion-content-height`; animate to that variable, never to
`height: auto`.

```css
@keyframes accordion-down { from { height: 0 } to { height: var(--radix-accordion-content-height) } }
@keyframes accordion-up   { from { height: var(--radix-accordion-content-height) } to { height: 0 } }
```

## Origin matters

Popovers and dropdowns must scale from the trigger:
`origin-[--radix-popover-content-transform-origin]`. Without it the panel grows
from its own centre and feels detached.

## Buttons and interactive surfaces

- Hover: 100–150ms colour/border transition only.
- Active: `active:translate-y-px` or `active:scale-[0.98]`, transition 60ms.
- Never transition `all`; name the properties.
- Only animate `transform`, `opacity`, `filter`, and colour.

## Lists and layout

- Reordering: use a layout-animation library (Motion `layout`) or nothing. Manual
  top/left transitions jitter.
- Stagger max 3–5 items at 20–30ms; beyond that it reads as slow.
- Never animate items entering on first paint of a page — it delays comprehension.

## Accessibility

Always honour reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

Keep opacity fades (they are safe); drop translation, scale, and parallax.

## Review checklist

- Does the exit animation actually play, or does the node unmount instantly?
- Does the panel grow from its trigger?
- Is exit faster than enter?
- Is anything animating layout-triggering properties (width/height/top/left) that could use transform?
- Reduced motion respected?
