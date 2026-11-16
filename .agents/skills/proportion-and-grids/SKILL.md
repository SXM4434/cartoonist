---
name: proportion-and-grids
description: Grid systems, columns and gutters, rule of thirds, golden ratio, Fibonacci and modular scales, aspect ratios, and applying proportional systems to UI layout. Use when structuring a page grid, sizing panels, or choosing ratios.
---

# Proportion and grids

Proportional systems are a way to make many small decisions consistently. They are scaffolding, not a religion.

## Grids

- Pick a column count for the content, not from habit. 12 divides by 2/3/4/6 and suits marketing pages; 4–6 suits app shells; a single 65ch column suits reading.
- Gutter ≈ half the outer margin at desktop; equal at mobile. Content max-width 1120–1280 for marketing, wider only for dashboards.
- Baseline grid (8px) governs vertical placement; the column grid governs horizontal. Both, or the page drifts.
- Nested grids inherit the parent's gutter. A card grid inside a 12-col grid uses the same gutter, not a new one.

## Rule of thirds

Divide the frame into 3×3. Place the focal element on an intersection or along a third-line rather than dead center. Practical UI uses: hero text ending at the 2/3 line with media occupying the right third-and-a-bit; a horizon or image crop set on the lower third; a sidebar at 1/3 with content at 2/3.

## Golden ratio (1.618)

Useful for two-panel splits (62/38), for deriving a type scale, and for sizing a card's image against its body. Do not chase it to decimal places — 62/38 and 60/40 are indistinguishable on screen; use the one that lands on the grid.

## Fibonacci (1 2 3 5 8 13 21 34 55 89)

The natural source of a spacing scale: 8 / 13 / 21 / 34 / 55 read as more organic than 8 / 16 / 32 / 64, which reads as more mechanical. Pick one character and stay with it. Fibonacci also gives good aspect-ratio jumps for card imagery (3:2, 5:3, 8:5).

## Aspect ratios

Fix ratios per media role: 16:9 video, 4:3 or 3:2 photography, 1:1 avatars, 5:4 or 21:9 for hero artifacts. Never let images size themselves from intrinsic dimensions inside a grid — enforce `aspect-ratio` and `object-fit: cover`.

## Practical order

1. Content max-width and outer margins.
2. Column count and gutter.
3. Vertical unit (8) and section rhythm.
4. Proportional split(s) for the big compositions.
5. Only then, component-level sizes.
