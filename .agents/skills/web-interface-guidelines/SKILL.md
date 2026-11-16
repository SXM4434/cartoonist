---
name: web-interface-guidelines
description: Audit UI code against Vercel's Web Interface Guidelines — accessibility, keyboard support, hit targets, focus states, forms, animation performance, layout, content and typography. Use when reviewing or polishing any interface, before shipping a UI change, or when asked whether a screen meets a craft bar. Reports concrete file:line findings.
---

# Web Interface Guidelines

Source: `vercel-labs/web-interface-guidelines` (MIT). The full rule set is in
`references/guidelines.md` — read it before auditing.

## How to run an audit

1. Read `references/guidelines.md` in full.
2. Read the UI files under review (components, route files, stylesheets).
3. For each violation, report:
   - `path/to/file.tsx:42`
   - the rule level: MUST / SHOULD / NEVER
   - the rule, quoted
   - the concrete fix
4. Sort findings: MUST violations first, then SHOULD, then NEVER-class smells.
5. Do not report speculative issues. If a rule cannot be checked from source
   (contrast of a runtime-computed color, real focus order), say so and check it
   in the browser instead.

## Fix mode

When asked to fix rather than report, apply MUST-level fixes directly, list
SHOULD-level fixes as recommendations, and never restructure product behaviour
to satisfy a presentation rule.
