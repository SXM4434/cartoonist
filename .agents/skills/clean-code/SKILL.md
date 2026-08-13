---
name: clean-code
description: Refactor any codebase using Fowler's catalog (refactoring.guru) — detect the smell, pick the technique, apply in safe behavior-preserving steps. Use when asked to refactor, clean up, simplify, improve readability/maintainability, or reduce code smells.
---

# Clean Code

Turn messy code into clean code **without changing its observable behavior**. Method and catalog are from Martin Fowler's *Refactoring*, organized the way refactoring.guru presents it.

The core idea: clean code is not a style preference, it is what makes a codebase cheap to change. Every technique below trades a small, mechanical edit for lower future cost.

## What "clean" means (the target you refactor toward)

Code is clean when it is:

1. **Obvious to another programmer** — intention-revealing names, no magic numbers, small methods and classes. If a reader needs you to explain it, it isn't clean.
2. **Free of duplication** — one change should require editing exactly one place. Duplication multiplies cognitive load and bugs.
3. **Minimal** — the fewest classes and moving parts that solve the problem. *Code is a liability, not an asset; keep it short and simple.*
4. **Tested and passing** — reliability is part of clean. "95% of tests pass" means the code is dirty.
5. **Cheap to maintain and extend** — the actual payoff of the four above.

The opposite of clean is **technical debt**: messy code charges interest (slower delivery) until you pay it down by refactoring.

## The refactoring loop

For every cleanup, run this loop. **Never skip step 4 or 5.**

1. **Detect** — name the specific smell, don't just say "this is ugly." See [references/code-smells.md](references/code-smells.md).
2. **Choose** — map the smell to a concrete technique. See [references/refactoring-techniques.md](references/refactoring-techniques.md).
3. **Step small** — make one tiny, behavior-preserving change.
4. **Re-run tests** — after every step. All must stay green. A long red period means your step was too big — shrink it.
5. **Verify it's actually cleaner** — read the result. If it isn't more readable than before, revert it. Mechanical rule-compliance that hurts readability is a net loss.

## Rules of engagement (non-negotiable)

- **Behavior-preserving only.** Refactoring never changes what the program does. The moment you change behavior, it's a feature or bugfix — separate commit, separate review.
- **Tests are the safety net.** No tests around the target? Write characterization tests that pin current behavior *first*, then refactor. If a test breaks during refactoring: either you introduced a bug (fix the code) or the test was too low-level / coupled to internals (fix the test, prefer behavioral/BDD-style tests).
- **Small steps, always green.** Commit-sized changes, each independently correct.
- **One concern per commit.** Don't bundle five refactorings into one diff — you and the reviewer will lose the thread. Keep refactoring commits separate from feature commits.
- **Match the surrounding code.** Adopt the codebase's existing naming, idioms, and structure. Do not reformat, rename, or "improve" unrelated code.
- **Stay surgical.** Touch only what the task requires.
- **Cohesion over line-count rules.** "Functions ≤ 50 lines" is a smell detector, not a law. Split by responsibility, not to hit a number. Don't create one-line pass-through wrappers unless they name a real concept.

## When to refactor (and when not to)

- **Rule of Three** — first time, just write it. Second time you duplicate, wince but proceed. Third time, refactor.
- **Before adding a feature** — clean the area you're about to extend; changes are far easier in clean code.
- **While fixing a bug** — bugs hide in the messiest code. Cleaning often makes the defect reveal itself.
- **During code review** — the last cheap chance to fix before it ships; do it together with the author.
- **Not under deadline pressure as a big-bang rewrite.** Prefer many small in-place improvements over one risky overhaul. Only rewrite a section when it's beyond repair — and only after you have tests and time.

## Workflow for a whole-codebase cleanup

When asked to "clean up the codebase" broadly:

1. **Establish a safety net first.** Confirm a working build and test suite. If absent, set one up before touching code — refactoring without tests is just editing and hoping.
2. **Triage by leverage.** Fix the highest-impact smells first: Long Method, Duplicate Code, Large Class, Long Parameter List, tangled conditionals. Ignore cosmetic nits until structure is sound.
3. **Work in cohesive units.** Module by module (or file by file). Commit each cohesive cleanup on its own.
4. **Gate every unit.** Run full tests + lint + type-check + build between modules. Report exactly what was verified.
5. **Explain the why.** The *what* lives in the diff; the *why* lives in the commit message. State what you changed and the reasoning.

## References (load on demand)

- [references/clean-code-principles.md](references/clean-code-principles.md) — naming, small functions, guard clauses, magic numbers, DRY, comments, consistent abstraction level — each with before → after.
- [references/code-smells.md](references/code-smells.md) — all 23 smells in 5 families; each maps to the techniques that fix it. Use this to *diagnose*.
- [references/refactoring-techniques.md](references/refactoring-techniques.md) — 60+ techniques in 6 families with clean, readable before → after patterns. Use this to *fix*.
