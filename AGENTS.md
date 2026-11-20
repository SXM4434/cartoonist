# Runtime rules

- Drawing generations must not use timer-driven aborts in the browser or server; model-dependent latency can exceed fixed deadlines and discard paid work.
- Wireframe and diagram AI return semantic plans (screens / nodes+edges), never coordinates; `wireframe-layout` and `diagram-layout` own all geometry and text fitting, and hand-placed model boxes are salvaged into a plan, so drawings never overlap or spill.
- Recall stores supported answers and links citations only to matching transcript spans, so reloads retain provenance without inventing drawing associations.
- Voice commands share the existing draw, document, and Recall actions; pause nudges require explicit consent and participant speech interrupts playback.
- Voice storage uses validated server uploads; authenticated recordings use the caller's storage client for ownership, while guests require an exact live-room capability and cannot read storage directly.
- Team ownership and membership live in protected membership rows; team actions use authenticated server functions and database membership checks, never local profile data.
- Wireframe screens stack vertically within a topic column, with calendar cards confined to date rows, so multi-screen requests do not spill into neighboring topics.
- Transcription excludes provider audio-event captions before speaker attribution and storage, so background sounds cannot become meeting participants or dialogue.
- Canvas labels resolve pale surface/outline colors to dark ink through a shared helper, so text remains readable without changing shape fills.- Screen-mockup intent is decided from the latest request only (`draw-intent`), never the whole transcript, so one earlier "wireframe" cannot turn later flows, timelines or comparisons into screens.
- Typed drawing requests made while a drawing is in progress are queued and run in order (enrichment passes yield to them), so no request is silently dropped.
- Small marks join the frame's last row when it has room; larger drawings start a new row, so notes group side by side instead of laddering down the board.
