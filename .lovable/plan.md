## Problem

All the planning/spec docs were written to `/mnt/documents/`, which is a sandbox artifacts location — files there are downloadable but live **outside** the project repo, so git never sees them. That's why none of them appear in your GitHub sync.

Files currently stranded in `/mnt/documents/`:
- `cartoonist-prd.md`
- `cartoonist-roadmap-v1.md`
- `cartoonist-roadmap-v2.md`
- `feature-human-layer.md`
- `feature-team-desk.md`
- `feature-contextual-drawing.md`
- `feature-canvas-memory.md`
- `cartoonist-rebuild-plan.md` (older, superseded by v1)
- `Cartoonist_PRD.md` (older duplicate of `cartoonist-prd.md`)

## Fix

1. Create a `docs/` folder in the repo.
2. Copy the 7 canonical docs into `docs/`:
   - `docs/cartoonist-prd.md`
   - `docs/cartoonist-roadmap-v1.md`
   - `docs/cartoonist-roadmap-v2.md`
   - `docs/feature-human-layer.md`
   - `docs/feature-team-desk.md`
   - `docs/feature-contextual-drawing.md`
   - `docs/feature-canvas-memory.md`
3. Skip the two stale ones (`cartoonist-rebuild-plan.md`, `Cartoonist_PRD.md`) — `cartoonist-roadmap-v1.md` and `cartoonist-prd.md` already replace them. (Say the word if you want them copied anyway as historical artifacts.)
4. Add a short `docs/README.md` index explaining what each doc is and how v1/v2 relate, so the folder is self-navigable on GitHub.
5. Leave the originals in `/mnt/documents/` alone (no harm, still downloadable).

After this, the docs will sync to GitHub on the next commit and stay in version control alongside the code they describe.

## Note for future doc work

From now on, project docs go in `docs/` in the repo, not `/mnt/documents/`. `/mnt/documents/` is only for one-off downloadable artifacts (reports, exports). I'll follow that rule going forward.