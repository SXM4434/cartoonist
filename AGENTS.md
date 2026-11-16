# Runtime rules

- Drawing generations must not use timer-driven aborts in the browser or server; model-dependent latency can exceed fixed deadlines and discard paid work.
- Wireframe AI generates semantic screen plans, not coordinates; the shared layout builder owns geometry to prevent overlapping additive passes and unrelated demo screens.
- Recall stores supported answers and links citations only to matching transcript spans, so reloads retain provenance without inventing drawing associations.
- Voice commands share the existing draw, document, and Recall actions; pause nudges require explicit consent and participant speech interrupts playback.
- Voice storage uses validated server uploads; authenticated recordings use the caller's storage client for ownership, while guests require an exact live-room capability and cannot read storage directly.
- Team ownership and membership live in protected membership rows; team actions use authenticated server functions and database membership checks, never local profile data.