# Tactile editorial redesign + design-engineering skills

Two things: install a small set of reusable design skills so every future change follows the same craft rules, then redesign the whole app against them.

## Part 1 — Three skills

Distilled from the published bodies of work of the design engineers you named (Emil Kowalski's animation teaching, Josh Puckett's product-craft writing, Jakub Krehel's tactile/experimental interface work) plus the wider design-engineering canon (Rauno Freiberg's UI interaction laws, Linear/Vercel-style motion systems).

**1. `motion-craft`** — how anything is allowed to move.
- Animate `transform` and `opacity` only; never `width`, `height`, `top`, `left`.
- Duration ladder: 120ms micro (hover, press), 200ms enter, 160ms exit, 300ms+ only for large surfaces.
- Ease-out for things entering, ease-in for exiting, spring only for gesture-driven or interruptible motion.
- Every animation is interruptible; nothing blocks input.
- Origin matters: menus scale from their trigger, sheets slide from their edge.
- Stagger ≤ 40ms, max ~5 items, then fade the rest.
- `prefers-reduced-motion` collapses motion to opacity.
- Motion explains state change, never decorates.

**2. `interface-craft`** — the non-negotiable quality bar per component.
- Every control ships default / hover / active / focus-visible / disabled / loading states.
- Every list ships empty, loading (skeleton not spinner), error, and one-item states.
- No spinner for work under 300ms; optimistic updates with rollback.
- Optical alignment over mathematical; consistent hit targets ≥ 36px.
- Full keyboard path, visible focus, Escape closes, Enter submits.
- Copy is UI: verbs on buttons, plain-language empty states, no "Oops".
- Never rebuild what the design system already has.

**3. `tactile-editorial`** — this app's visual language.
- Quiet structured canvas: paper background, hairline rules, real grid, generous negative space, locked type ladder, tabular numerals.
- One expressive element per composition — hollow faux-3D display type, an isometric object, a hand-drawn mark, a scanned-paper texture, a morphing cursor. One, not four.
- Materials behave physically: paper has grain and thickness, cards press instead of glow, toggles have travel.
- Kill list: SaaS card grids, gradients as decoration, glassmorphism, glossy 3D, drop shadows for hierarchy, centered-everything heroes, sterile minimalism.

All three get saved as active skills so later work picks them up automatically.

## Part 2 — Redesign

Keeps the existing palette (warm paper, off-black ink, one warm orange) and type ladder — the plan spends its budget on structure, materiality and motion, not on new colors.

**Foundation**
- Add the `motion` library (React) for interruptible spring/tween primitives.
- New CSS layer: paper grain overlay, tactile press/lift utilities, hollow dimensional type utility, hand-drawn rule/underline marks, texture edges.
- Shared primitives: `<PaperSurface>`, `<PressButton>`, `<DimensionalHeading>`, `<Reveal>` (in-view fade+rise), `<MorphCursor>` (context-aware cursor on canvas/interactive zones), `<Marks>` (SVG hand-drawn circles, arrows, underlines).

**Screens, in order**
1. **Landing (`/`)** — asymmetric editorial hero, hollow faux-3D wordmark, one isometric "drawing table" object, hand-drawn arrow to the join field. Join code input becomes a tactile stamped field.
2. **Onboarding + New session** — one question per view, large type, paper-card stack with real thickness, mic capture as a physical object with breathing waveform, progress as a drawn stroke.
3. **Dashboard** — session list as stacked index cards / paper slips with pressed hover, not a SaaS card grid. Empty state gets a drawn illustration and a single verb.
4. **Session lobby** — participant chips as pinned paper tags, join code as a rubber-stamp block, "Start with voice" as a weighted primary object.
5. **Canvas room chrome** — header, Team Desk, Threads rail, cost meter, style switch all retuned to hairline/paper; panels slide from their own edge; the mic/listening indicator becomes the room's one expressive live element.
6. **Examples gallery** — blueprint tabs as tactile paper tabs with real selected depth.

**Interaction pass across all screens**
- Press physics on every button, focus-visible rings in ink not blue, skeletons instead of spinners, keyboard paths, optimistic states, reduced-motion fallback.

## Technical notes

- Add dependency: `motion`. No other new runtime deps; marks and textures are inline SVG/CSS, no image assets beyond one or two generated paper-grain and isometric-object files.
- All tokens stay in `src/styles.css` — new tokens for grain, press depth, and dimensional type shadow offsets; no hardcoded colors in components.
- Canvas rendering (tldraw layer, blueprints, fidelity/ink system) is untouched; this is chrome and page-level work only.
- Each screen is verified with Playwright screenshots before moving to the next, per the standing rule.
