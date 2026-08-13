# Real design-engineering skills — research results + install plan

You asked whether these people have actual skills. Here's what's verifiably published, fetched and read (not guessed):

## What exists

**Emil Kowalski — real.** `github.com/emilkowalski/skills` (~28k stars). Three skills, all fetched:
- `emil-design-eng` (27KB) — his full design-engineering doctrine: animation decision framework, spring physics, transform mastery, clip-path animation, gesture/drag, performance rules, "the Sonner principles", stagger, a review checklist.
- `animate` (11KB) — a build-order procedure: should this animate at all → purpose → cheapest tool → which properties → easing/duration or spring → interruption and exit.
- `improve-animations` (8KB) — read-only audit that surveys existing motion code and returns a prioritized fix list.

**Jakub Krehel — real.** `github.com/jakubkrehel/skills` (~3.4k stars). An orchestrator (`better-interface`) plus domain skills, each multi-file: `better-ui` (surfaces, enter/exit, icon transitions, performance), `better-typography` (7 files incl. wrapping/punctuation, variable fonts), `better-colors`, `better-layout`, `better-accessibility`, `better-writing`, and `interface-review`.

**Anthropic — real.** `anthropics/skills → frontend-design`. "The hero is a thesis", anti-default calibration (it explicitly names warm-cream + serif + terracotta as an AI default to avoid — worth noting given our palette), copy-as-design-material.

**Also real and popular (not by these people):** `Nutlope/hallmark` (anti-AI-slop, pre-emit self-critique scoring), `Leonxlnx/taste-skill`, `nextlevelbuilder/ui-ux-pro-max-skill`, `199-biotechnologies/motion-dev-animations-skill`.

**Does not exist:** no published skill by Josh Puckett, Rauno Freiberg, Paco Coursey, Jhey Tompkins, Amelia Wattenberger, Nate Baldwin, or Tobias Ahlin. Only blogs, talks and courses. Third-party repos that name-drop "interaction design" are unrelated authors.

## What I'll install

Rather than write my own paraphrase of people who already published the real thing, I'll vendor the genuine skill files into this project and add one original skill for the part nobody covers (your tactile/editorial visual language).

1. **`emil-design-eng`** — vendored from Emil's repo, with attribution header. Governs motion and component craft.
2. **`animate`** — vendored. The build-order procedure for any new animation.
3. **`improve-animations`** — vendored. Audit pass to run over the existing canvas/room UI.
4. **`better-interface`** + its domain files (`better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`) — vendored from Jakub's repo.
5. **`tactile-editorial`** — written by me, the only genuinely new one. Encodes your locked system: warm paper + off-black ink + one warm orange, the 11/13/15/22/32/52/84 ladder, Fraunces/Inter, borders-and-lightness elevation, hand-drawn marks, hollow dimensional type, isometric objects, paper grain and thickness. Includes the kill list and, importantly, a note reconciling with Anthropic's warning that cream+serif+terracotta is an AI default — ours earns it through physicality and hand-drawn marks, not by defaulting to it.

Each vendored skill keeps its upstream source URL and license note in the frontmatter so it can be refreshed later.

## Then

Once the skills are active, the redesign runs through them rather than through my ad-hoc taste: `animate` for every new motion, `better-typography`/`better-colors` for the type and palette pass, `tactile-editorial` for the expressive layer, `improve-animations` as the final audit over the canvas room.

I'll hold the redesign implementation until you've seen the skills land — say the word and I'll go straight into the screen-by-screen rollout after.

## Technical notes

- Skills are written to `.agents/skills/<name>/` with `SKILL.md` plus `references/` for multi-file ones, then activated.
- Vendored content is fetched from `raw.githubusercontent.com` at install time, not retyped, so it matches upstream exactly.
- Skills are retrieval-triggered — the description line on each one is tuned so motion work pulls Emil's, interface polish pulls Jakub's, and visual-language work pulls the tactile one.
