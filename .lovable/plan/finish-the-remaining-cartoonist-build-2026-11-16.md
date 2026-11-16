# Finish the remaining Cartoonist build

Keep the current visual system and the corrected semantic wireframe layouts. Complete the remaining meeting features rather than redesigning the room.

## 1. Recall and original drawings
- Save questions, supported answers, and transcript citations so Recall survives reloads.
- Link citations to the relevant drawing or thread; selecting a link focuses it on the canvas.
- Preserve the unsupported-answer fallback rather than inventing past decisions.

## 2. Team workspaces and memory
- Add team creation, invitations, membership management, and workspace-owned meetings.
- Preserve guest participation in invited rooms; require an account for team administration.
- Replace device-only session discovery with authorized workspace sessions.
- Make cross-session references and linked artifacts available only to authorized members.

## 3. References and agent coordination
- Add explicit web-reference lookup with source URLs, citations, saved references, and canvas pinning in the right panel.
- Coordinate Scribe, Historian, Drafter, Facilitator, Advocate, and Librarian through durable meeting events.
- Deduplicate agent work and show failures without creating autonomous retry storms.

## 4. Voice interaction
- Recognize “hey Cartoonist” from the existing speech stream and route the following request to the mediator.
- Allow spoken answers and requested document updates using the existing audio pipeline.
- Add opt-in pause nudges after questions; stop or duck playback when a participant speaks.
- Respect existing voice and participant-name preferences.

## 5. Learning from drawings
- Record whether generated drawings are kept, edited, or deleted, with their original context.
- Use authorized workspace examples to improve future drawing prompts, without model training.
- Keep feedback attributable to actual interactions, not fabricated ratings.

## 6. Recording security
- Keep guest voice onboarding through protected uploads tied to verified room access.
- Bind signed-in recordings to the authenticated owner and prevent arbitrary ownership changes.
- Recheck and resolve only the two previously selected voice-recording storage findings; leave other findings untouched.

## Technical approach
- Reuse existing room capability checks, transcript provenance, typed canvas relations, and audio controls.
- Use Lovable Cloud migrations with explicit grants and member-scoped access policies.
- Use authenticated server functions for team actions and verified room access for guest actions.
- Persist agent coordination and deduplication in the database; do not depend on worker memory.
- Keep drawing generation free of fixed abort deadlines and let the shared wireframe builder own geometry.
- Record structural decisions in the project's architecture rules and track completion in the roadmap.

## Verification
- Add focused tests for access boundaries, invitation permissions, citation matching, wake detection, nudges, and feedback deduplication.
- Run real meeting flows: join, record an introduction, speak, draw, ask Recall, pin a reference, create documents, reload, and revisit from a second workspace meeting.
- Test signed-in and guest recording access separately, including attempted unauthorized access.
- Check desktop and mobile screenshots with Playwright; report external-service blockers explicitly rather than marking untested work complete.

## Scope boundary
No broad aesthetic pass, unrelated security cleanup, model fine-tuning, or cross-workspace sharing.