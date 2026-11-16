---
name: typographic-systems
description: Type scales, pairing, measure, leading, tracking, weight/width contrast, numerals, and typographic hierarchy in UI and editorial layouts. Use when choosing fonts, setting a type ladder, or fixing text that looks off.
---

# Typographic systems

Type carries the personality of a page. Most "AI-looking" design is a default font at default sizes with default leading.

## Scale

- Fix a ladder before writing components. 6–8 steps, no off-ladder sizes. Derive it from a ratio (1.2 minor third for dense UI, 1.25–1.333 for editorial, 1.5+ only when there are few steps) and then round to whole pixels.
- Big jumps at the top, small jumps at the bottom. 11/13/15 can sit close; 32→52→84 should feel like separate registers.
- Hierarchy comes from contrast in *scale, weight, width, case, and color* — use two of those per level, not all five.

## Pairing

- Display face: characterful, used sparingly, large sizes only. Body face: quiet, high x-height, tested at 15px.
- A narrow/condensed display against a normal-width body creates contrast without a second personality. Same-superfamily pairings (Archivo / Archivo Narrow / Archivo Black) read as intentional systems.
- Mono is for utility: labels, data, timestamps, codes. Uppercase mono at 11px with tracking is a label, not a headline.
- Never Inter + Poppins default pairing unless asked.

## Setting text

- Measure: 45–75 characters. Enforce with `max-width: 65ch`, not a pixel guess.
- Leading: inverse to size. Body 1.5–1.6; 22–32px headings 1.2–1.3; display 52px+ 0.95–1.05 — but check descenders. A `g` colliding with the next line's ascender means the leading is too tight regardless of what looks good in a mockup.
- Tracking: negative on large display (−0.01 to −0.03em), 0 on body, positive (0.06–0.12em) on small uppercase.
- Ragged right for editorial, never justified on the web.
- Tabular numerals (`font-variant-numeric: tabular-nums`) for any column, timer, price, or metric.

## Common defects

- Headline and subhead the same weight → no hierarchy.
- All-caps body text.
- Line-height set globally at 1.5 including display.
- Widows on a two-line headline — rebalance with a `<br>` or `text-wrap: balance`.
- Placeholder Lorem shipped as final copy.
- Font loaded but not applied due to a missing weight; check computed styles, not the CSS.
