# Report Template

The orchestrator MUST output the report in this exact format. Replace {{placeholders}} with actual values.

```
══════════════════════════════════════
  PATTERNS AUDIT — Report
  Scope: {{scope_path}}
  Mode: {{mode}}
  Language(s): {{detected_languages}}
  Files analyzed: {{file_count}}
══════════════════════════════════════

  GLOBAL SCORE: {{global_score}}/100

  ┌─────────────────────┬───────┐
  │ Principle           │ Score │
  ├─────────────────────┼───────┤
  │ SRP                 │ {{SRP}}  │
  │ OCP                 │ {{OCP}}  │
  │ LSP                 │ {{LSP}}  │
  │ ISP                 │ {{ISP}}  │
  │ DIP                 │ {{DIP}}  │
  │ DRY                 │ {{DRY}}  │
  │ KISS                │ {{KISS}} │
  │ YAGNI               │ {{YAGNI}}│
  │ Design Patterns     │ {{DP}}   │
  │ Code Smells         │ {{CS}}   │
  └─────────────────────┴───────┘

  FINDINGS ({{finding_count}} total, sorted by impact):

  {{#each findings}}
  {{severity}} — {{title}}
  File: {{file_path}}:{{line_numbers}}
  Issue: {{issue_description}}
  Pattern: {{principle_or_pattern}}
  Refactor: {{refactoring_suggestion}}

  {{/each}}
══════════════════════════════════════
```

For interactive mode, after the report, print:

```
Starting guided refactoring...

[1/{{finding_count}}] {{severity}} — {{title}}
  {{issue_description}}
  Suggested: {{refactoring_suggestion}}
  Apply? (y/n/all/skip): _
```
