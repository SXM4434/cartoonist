# Runtime rules

- Drawing generations must not use timer-driven aborts in the browser or server; model-dependent latency can exceed fixed deadlines and discard paid work.
- Wireframe AI generates semantic screen plans, not coordinates; the shared layout builder owns geometry to prevent overlapping additive passes and unrelated demo screens.
- Recall stores supported answers and links citations only to matching transcript spans, so reloads retain provenance without inventing drawing associations.