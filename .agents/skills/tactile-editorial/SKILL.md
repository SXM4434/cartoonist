---
name: tactile-editorial
description: The house visual language — tactile, editorial, design-engineered. Warm paper and off-black ink, one warm orange, a locked type ladder, elevation by border and lightness never shadow, plus a physicality layer of grain, hand-drawn marks, dimensional type and material motion. Use for any visual or UI work in this project: new screens, restyling, choosing colors/type/spacing, or judging whether a surface is on-brand.
---

# Tactile Editorial

A quiet, rigorous system as the canvas; one or two expressive, physical elements
carry each composition. Crafted, not polished into sterility.

## The quiet system

**Color.** Warm paper background, off-black ink (never `#000`), one warm orange
accent. Everything supporting is desaturated. Only semantic tokens from
`src/styles.css` — never `text-white`, `bg-black`, or arbitrary hex in a component.

**Type.** Locked ladder, no off-ladder sizes: `11 / 13 / 15 / 22 / 32 / 52 / 84`.
Fraunces for display, Inter for body. Body leading 1.5, ragged right, measure
45–75ch. Tabular numerals for anything numeric. Eyebrows are uppercase with wide
tracking. Two typefaces, three at the absolute limit.

**Elevation.** Hairline borders and lightness steps. Never a drop shadow to fake
depth. Depth that exists comes from stacked paper edges and press states, not blur.

**Layout.** Asymmetric over centered. One primary focal point per surface. Precise
alignment, generous negative space, real interaction states on everything
interactive (hover, active, focus-visible, disabled).

## The physicality layer

Pick one or two per surface. More than two and the system stops reading as quiet.

- **Paper grain** — a subtle noise/fiber texture on large surfaces.
- **Thickness** — an element that stacks or has a visible edge, like an index card.
- **Press** — a control that depresses on `:active` (translate + edge collapse),
  not one that fades opacity.
- **Hand-drawn marks** — SVG underlines, circles, arrows, checks with real
  irregularity. Never a perfect vector arc pretending to be a pen stroke.
- **Dimensional type** — hollow faux-3D wordmarks, extruded via repeated offset
  strokes, not a bevel filter.
- **Isometric objects** — flat-shaded, ink-outlined, axonometric. No glossy 3D.
- **Morphing cursors and controls** — the pointer changes shape to express what
  the surface will do.

Motion expresses an object's material and state. Paper slides and lifts; it does
not fade in for decoration. Transform and opacity only, interruptible,
`prefers-reduced-motion` honoured.

## The anti-default check

Anthropic's `frontend-design` names warm-cream + serif + terracotta as a current
AI default look. This system sits dangerously close to it, so it must earn the
distance:

> Strip the texture, the marks and the press states from the screen. If what
> remains reads as a generic warm-cream AI landing page, the screen is wrong.
> The physicality is not garnish — it is the differentiator.

## Kill list

Rounded-2xl everything. Soft drop shadows. Pastel or purple-to-blue gradients.
Glassmorphism, neumorphism, glossy 3D. Centered hero with a centered subhead and
two centered buttons. Generic SaaS card grids. Decorative emoji. Off-ladder type
sizes. Tech-bro futurism. Sterile minimalism with nothing to touch.

## Before you call a surface done

1. Name the one or two expressive elements. If you can't, it's under-designed.
2. Count typefaces (≤3) and check every size against the ladder.
3. Confirm no shadow is doing elevation work.
4. Run the anti-default check above.
5. Verify hover / active / focus-visible / disabled on every control, hit areas
   ≥44px, and reduced-motion.
