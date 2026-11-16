---
name: alignment-discipline
description: Structural alignment — edge alignment, alignment axes, text alignment choices, baseline alignment across columns, and detecting stray elements. Use when a layout feels messy, unresolved, or subtly wrong.
---

# Alignment discipline

Most "unpolished" UI is an alignment problem, not a taste problem.

## Rules

- Every element aligns to something. If you cannot name the edge it aligns to, it is floating.
- Minimize alignment axes. A section with left-aligned heading, centered body, and right-aligned CTA has three axes and no spine. Two axes is usually the ceiling.
- Left-align by default. Center only short, isolated, symmetric content (empty states, single-line CTAs, modals). Never center a paragraph over three lines. Right-align only numbers and trailing actions.
- Text aligns to text, not to boxes. A card's heading and body should share one left edge even if the icon sits outside it.
- Baseline, not box: label and value in a row align on their baselines, not their container centers, when their sizes differ.
- Icons align to the cap-height or x-height of adjacent text, not to its line box.
- Nested content inherits the parent's spine — a list inside a section starts at the section's text edge, not indented arbitrarily.

## Grid alignment

- Content columns snap to a shared grid; decorative elements may leave it, deliberately and visibly (fully off, not off by 4px). Near-misses read as bugs; large offsets read as intent.
- Full-bleed media still aligns its internal content to the text grid.

## Detection

- Draw a vertical line down the screenshot at each intended spine — every element within a group should touch it.
- In the browser, add `* { outline: 1px solid red }` temporarily and screenshot; stray edges become obvious.
- Check the three most common offenders: section heading vs. section body, card padding vs. card image edge, button label vs. adjacent link.
