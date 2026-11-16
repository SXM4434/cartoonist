---
name: optical-alignment
description: Optical (perceptual) correction — overshoot, optical centering, icon and glyph balance, side bearings, punctuation hanging, and when measured-correct looks wrong. Use for final polish on buttons, icons, avatars, badges, and headline edges.
---

# Optical alignment

The eye does not measure; it weighs. Mathematically centered often looks off, and correcting it is what separates polished from merely correct.

## Where math lies

**Optical center.** In a tall container, geometric center looks low. Place isolated content 3–5% above center (modals, empty states, hero blocks in a full-height viewport).

**Play/triangle icons.** A triangle centered by bounding box looks right-heavy. Shift it left by roughly 8% of its width — hence every play button ever.

**Round vs. square.** A circle must overshoot a square of the "same" size by 2–3% to look equal. Same for `o` vs `x` in type — the typeface already does this; your CSS shapes do not.

**Icon in a circular button.** Center by visual mass, not bounding box. Icons with a heavy side (magnifier, send arrow, external-link) need 1–2px counter-shift.

**Text in a pill/button.** Cap-height sits below the line box top, so equal padding looks bottom-heavy. Reduce bottom padding by 1–2px, or set `line-height: 1` and pad explicitly.

**Uppercase and mono labels.** No descenders, so vertical centering must ignore the descender space — otherwise the label rides high.

**Nested radii.** Inner radius = outer radius − padding. Equal radii on nested boxes look wrong at the corners.

**Punctuation and quotes.** Hang opening quotes, bullets, and em-dashes outside the text spine so the letterforms, not the marks, define the edge. Same for large display type: apply a small negative left offset to cancel side bearings so the headline aligns with body text below it.

**Avatar stacks / logos.** Wordmarks with different visual densities need per-item scaling to read as equal weight; never trust a single fixed height.

## Method

Adjustments live in the 1–3px / 1–3% range. Larger than that and the underlying layout is wrong — fix that instead.

Verify by screenshot, blurred and at 100%. If you cannot see the difference at 100%, keep the change only if it removes a visible defect elsewhere; otherwise drop it.
