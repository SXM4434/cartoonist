# Design-engineering skills → full app redesign

I looked these people up properly and fetched the actual files. Here's what's real.

## What actually exists

**Emil Kowalski — real.** `github.com/emilkowalski/skills` (~28k stars), by him, from his Vercel/Linear years. Three skills, all downloaded and read:
- `emil-design-eng` (27KB) — animation decision framework, spring physics, transform mastery, clip-path animation, gesture/drag, performance rules, "the Sonner principles", stagger, review checklist.
- `animate` (11KB) — a build-order procedure: should this animate at all → what's the purpose → cheapest tool that works → which properties → easing/duration or spring → interruption and exit.
- `improve-animations` (8KB) — read-only audit that surveys existing motion code and returns a prioritized fix list.

**Jakub Krehel — real.** `github.com/jakubkrehel/skills` (~3.4k stars). An orchestrator (`better-interface`) plus multi-file domain skills: `better-ui` (surfaces, enter/exit, icon transitions, performance), `better-typography` (7 files incl. wrapping/punctuation, variable fonts), `better-colors`, `better-layout`, `better-accessibility`, `better-writing`, `interface-review`.

**Josh Puckett — does not exist.** He has design tools and components on GitHub, no agent skill. Same for Rauno Freiberg, Paco Coursey, Jhey Tompkins, Amelia Wattenberger, Nate Baldwin, Tobias Ahlin — blogs, talks and courses only. Anything claiming to be "their" skill is an unrelated author name-dropping them.

## The popular ones not by these guys (the gap you asked about)

- **`anthropics/frontend-design`** — Anthropic's own. "The hero is a thesis", structure-as-information, spend your boldness in one place. Notably it names warm-cream + serif + terracotta as a current AI default to avoid — directly relevant to our palette, see below.
- **`Nutlope/hallmark`** — the anti-AI-slop skill. Its best mechanic is a pre-emit self-critique: score the output 1–5 on Philosophy / Hierarchy / Execution / Specificity / Restraint / Variety and revise anything under 3 before shipping.
- **`motion-dev-animations`** — spring physics reference, 120fps, scroll-linked motion.
- Also surveyed and skipped as lower value for us: `taste-skill`, `ui-ux-pro-max-skill`, `superdesign-skill`, various awesome-lists.

## Phase 1 — install the skill layer

1. `emil-design-eng` — vendored verbatim, attributed.
2. `animate` — vendored. Runs on every new animation.
3. `improve-animations` — vendored. Audit pass over the canvas room.
4. `better-interface` + `better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility` — vendored from Jakub's repo with their reference files.
5. `frontend-design` — vendored from Anthropic.
6. `slop-gate` — small original skill lifting hallmark's pre-emit critique scoring, so every screen gets scored before I call it done.
7. **`tactile-editorial`** — the only fully original one, your design language: warm paper + off-black ink + one warm orange, the 11/13/15/22/32/52/84 ladder, Fraunces/Inter, borders-and-lightness elevation never shadows, hand-drawn marks, hollow faux-3D type, isometric objects, paper grain and thickness, morphing cursors, motion that expresses material rather than decorates. Carries your kill list. It also explicitly answers Anthropic's cream-serif-terracotta warning: ours earns it through physicality, imperfection and hand-drawn marks — if a screen would read as the default without those, it's wrong.

Vendored files keep their upstream URL and license in frontmatter so they can be refreshed.

## Phase 2 — redesign the app through them

Order, one screen per pass, each ending in a Playwright screenshot and a slop-gate score:

1. **Foundations** — `src/styles.css`: paper grain, press depth, ink tokens, the locked ladder, motion duration/spring tokens from `animate`. Plus three primitives: `PaperSurface`, `DimensionalHeading`, `Marks` (hand-drawn SVG library).
2. **Landing `/`** — asymmetric editorial hero, hollow 3D wordmark as the single expressive element, everything else quiet.
3. **Session create + join** — card-stack physicality, paper that lifts and presses rather than fading.
4. **Sessions list** — index cards with thickness and slight rotation, not a SaaS grid.
5. **Canvas room chrome** — the biggest job. Header, TeamDesk, ThreadRail, CheckIn, cost meter, style switch: hairline paper UI, morphing cursor, breathing mic indicator as the room's one expressive element.
6. **Motion audit** — run `improve-animations` over the whole app, fix everything it flags, verify no non-transform animations and that every transition is interruptible.

Interaction floor across all of it, from Jakub's skills: real hover/active/focus/disabled states, visible keyboard focus, hit areas ≥44px, `prefers-reduced-motion` respected, no layout-shifting animation.

## Technical notes

- Skills go to `.agents/skills/<name>/` with `SKILL.md` plus `references/`, then get activated.
- Vendored content is fetched from raw.githubusercontent.com at install time, not retyped, so it matches upstream exactly.
- Descriptions are tuned for retrieval: motion work pulls Emil's, interface polish pulls Jakub's, visual language pulls `tactile-editorial`.
- No behavioural/business-logic changes in Phase 2 — presentation layer only.
