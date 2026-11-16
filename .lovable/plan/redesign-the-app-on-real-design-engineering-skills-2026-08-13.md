# Redesign the app on real design-engineering skills

I went and found the actual published skills. Here's what's real, ranked by adoption, all files verified fetchable.

## The skills

| Skill | Author | Adoption | What it gives us |
|---|---|---|---|
| `frontend-design` | Anthropic | 768k installs, #1 design skill | Commit to a visual direction before writing UI. Names the three looks AI defaults to, so we don't land there. |
| `web-design-guidelines` | Vercel Labs | 476k installs | Audits UI code against Vercel's Web Interface Guidelines and reports `file:line` findings. Fetches fresh rules each run. |
| `impeccable` | Paul Bakaus (ex-Google/Amazon DX) | Top design pack on skills.sh | The big one. A verb system: `critique`, `audit`, `polish`, `bolder`, `quieter`, `distill`, `animate`, `typeset`, `layout`, `delight`, `clarify`, `harden`. Plus surface "modes" — Persuade / Operate / Read / Experience — which map perfectly onto our landing vs canvas room. |
| `emil-design-eng` | Emil Kowalski | 183k installs, 28k stars | His Vercel/Linear motion doctrine: easing decisions, spring physics, transform mastery, clip-path, gesture/drag, the Sonner principles, perf rules. |
| `animate` | Emil Kowalski | same repo | Build-order procedure for any new animation: should it animate → purpose → cheapest tool → which properties → easing or spring → interruption and exit. |
| `improve-animations` | Emil Kowalski | same repo | Read-only audit of existing motion code, returns a prioritized fix list. |
| `better-interface` + `better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility` | Jakub Krehel | 3.4k stars | Domain-by-domain interface review. Typography alone is 7 files (wrapping, punctuation, variable fonts, optical sizing). |
| `high-end-visual-design` | leonxlnx | 209k installs | Editorial/luxury aesthetic vocabulary. Optional — mostly brand-kit generation, we'd take the editorial mode only. |

**Josh Puckett has no published skill.** Neither do Rauno Freiberg, Paco Coursey, Jhey Tompkins, Amelia Wattenberger, Nate Baldwin or Tobias Ahlin — blogs, talks and courses only. Repos claiming to be theirs are unrelated authors name-dropping.

## Plus one of ours

**`tactile-editorial`** — the only skill I write from scratch, because it's your design language and nobody else has published it:

Warm paper, off-black ink, one warm orange. The locked ladder 11/13/15/22/32/52/84. Fraunces display, Inter body. Elevation via borders and lightness steps, never shadows. Then the physicality layer: paper grain and thickness, hand-drawn marks, hollow faux-3D type, isometric objects, morphing cursors, motion that expresses an object's material rather than decorating it. One or two expressive elements per surface, everything else quiet. Carries the kill list: no SaaS cards, no gradients, no glossy 3D, no glassmorphism, no sterile minimalism.

It also has to answer Anthropic's warning head-on: `frontend-design` names warm-cream + serif + terracotta as a current AI default. Ours earns it through imperfection, grain and hand-drawn marks — if a screen would read as that default with the texture stripped out, it's wrong and gets rebuilt.

## Redesign rollout

Each pass ends with a Playwright screenshot, an `impeccable critique`, and a `web-design-guidelines` audit.

1. **Foundations** — `src/styles.css`: paper grain, press depth, ink tokens, locked ladder, motion duration/spring tokens taken from `animate`. Three new primitives: `PaperSurface`, `DimensionalHeading`, `Marks` (hand-drawn SVG set).
2. **Landing `/`** — Persuade mode. Asymmetric editorial hero, hollow 3D wordmark as the single expressive element.
3. **Create + join session** — card-stack physicality; paper lifts and presses instead of fading.
4. **Sessions list** — index cards with thickness and a degree of rotation, not a grid of SaaS cards.
5. **Canvas room chrome** — Operate mode, the biggest job. Header, TeamDesk, ThreadRail, CheckIn, cost meter, style switch: hairline paper UI, morphing cursor, breathing mic indicator as the room's one expressive element.
6. **Motion audit** — `improve-animations` across the whole app. Every transition transform/opacity only, interruptible, reduced-motion respected.

Interaction floor throughout, from Jakub's pack: real hover/active/focus/disabled states, visible keyboard focus, hit areas ≥44px, no layout-shifting animation.

## Technical notes

- Skills land in `.agents/skills/<name>/` with `SKILL.md` and `references/`, then get activated. Vendored ones are fetched from raw.githubusercontent.com so they match upstream byte-for-byte, with source URL and license kept in frontmatter.
- Descriptions tuned for retrieval: motion pulls Emil's, interface polish pulls Jakub's and `impeccable`, visual language pulls `tactile-editorial`.
- Phase 2 is presentation layer only — no changes to session logic, AI routes, or the database.
