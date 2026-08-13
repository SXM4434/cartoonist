---
name: patterns-audit
description: >
  Multi-agent architectural audit that analyzes codebases for SOLID principles,
  DRY/KISS/YAGNI, GoF design patterns, and code smells. Produces a weighted 0-100
  score report with actionable refactoring suggestions. Use this skill when the user
  asks to audit code quality, review architecture, check for design pattern violations,
  analyze SOLID compliance, find code smells, assess tech debt, check code health,
  evaluate code hygiene, find refactoring opportunities, or says "patterns-audit",
  "design audit", "architecture review", "SOLID check", "code quality audit",
  "review my code architecture", "check design patterns", "how clean is my code",
  "audit this code", "tech debt check", "code health", or "clean code review".
license: MIT
model: claude-opus-4-6
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Agent
  - TodoWrite
  - AskUserQuestion
metadata:
  version: 1.0.0
  author: eduardodotai
  domains: [code-quality, architecture, solid, design-patterns, refactoring, code-review]
  type: workflow-orchestrator
---

# patterns-audit — Multi-Agent Architectural Audit

A language-agnostic skill that audits codebases for architectural quality using SOLID principles, DRY/KISS/YAGNI, GoF design patterns, and code smell detection. Uses 4 parallel sub-agents for deep, specialized analysis.

## Usage

```
/patterns-audit [path] [--auto]
/patterns-audit --help
```

- **No path:** Audit entire project from current working directory
- **File path:** Audit a single file
- **Directory path:** Audit all code files in directory
- **--auto:** Output report only, no interactive refactoring
- **Default (no --auto):** Interactive mode — shows report, then offers guided refactoring

## Execution Flow

### Phase 1: Parse Arguments

Parse the user's input to extract:
- `scope_path`: file, directory, or project root (default: cwd)
- `mode`: "interactive" (default) or "auto" (if --auto flag present)

If `--help` is passed, display usage information and stop.

### Phase 2: Scope Resolution

Resolve which files to analyze:

1. **If scope is a file:** Read that file directly.
2. **If scope is a directory or project:**
   - Use Glob to find all code files: `**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,cs,cpp,c,h,swift,kt}`
   - Exclude: `node_modules/`, `.next/`, `dist/`, `build/`, `__pycache__/`, `.git/`, `vendor/`, `target/`, `*.test.*`, `*.spec.*`, `*.min.*`
   - Report: "Found X files across Y languages"
3. **Auto-detect languages** from file extensions.

### Error Handling

Handle these scenarios at any phase:

- **No code files found:** Report "No code files found in [scope]. Check the path or try a different directory." and stop.
- **Scope too large (50+ files):** Warn the user: "Found X files. For best results, consider narrowing scope to a specific directory (e.g., `/patterns-audit src/services/`). Continue with full scan? (y/n)"
- **Agent failure/timeout:** If a sub-agent fails to return results, report which agent failed, skip its scores (mark as "N/A"), calculate the global score from remaining agents with adjusted weights, and note the gap in the report.
- **Unreadable files:** Skip files that cannot be read (binary, permissions), log them as skipped in the report header.

### Phase 3: Context Preparation

For each file in scope, build a structural map:
- Read the file
- Extract: classes/modules, functions/methods, imports/exports, dependencies
- Format as a concise summary (file path, list of entities, key dependencies)

This structural map is shared context for all sub-agents.

### Phase 4: Parallel Agent Dispatch

Dispatch all 4 sub-agents in a **single message** using the Agent tool (4 parallel calls):

**Agent 1 — SOLID Agent:**
- Read `skills/solid-agent.md` for the full agent instructions
- Read `references/solid-principles.md` for detection heuristics
- Prompt the agent with: the full solid-agent.md instructions + the solid-principles.md reference + the structural map + source code
- Agent returns: SCORES (5 per-principle) and FINDINGS

**Agent 2 — DRY/KISS/YAGNI Agent:**
- Read `skills/dry-kiss-yagni-agent.md` for the full agent instructions
- Prompt the agent with: the full dry-kiss-yagni-agent.md instructions + the structural map + source code
- Agent returns: SCORES (3 per-principle) and FINDINGS

**Agent 3 — Design Patterns Agent:**
- Read `skills/design-patterns-agent.md` for the full agent instructions
- Read `references/design-patterns.md` for the pattern catalog
- Prompt the agent with: the full design-patterns-agent.md instructions + the design-patterns.md reference + the structural map + source code
- Agent returns: SCORE (1 pattern maturity) and FINDINGS

**Agent 4 — Code Smells Agent:**
- Read `skills/code-smells-agent.md` for the full agent instructions
- Read `references/code-smells.md` for the smell catalog
- Prompt the agent with: the full code-smells-agent.md instructions + the code-smells.md reference + the structural map + source code
- Agent returns: SCORE (1 cleanliness) and FINDINGS

### Phase 5: Consolidation

After all 4 agents return:

1. **Parse scores** from each agent's output.
2. **Collect all findings** into a single list.
3. **Deduplicate:** If two agents flagged the same file:line range, keep the finding with higher severity and merge the descriptions.
4. **Calculate global score** using the formula from `references/scoring-weights.md`:
   ```
   global = (SRP * 0.08) + (OCP * 0.08) + (LSP * 0.08) + (ISP * 0.08) + (DIP * 0.08)
          + (DRY * 0.083) + (KISS * 0.083) + (YAGNI * 0.083)
          + (DesignPatterns * 0.20) + (CodeSmells * 0.15)
   ```
5. **Sort findings** by severity: HIGH first, then MEDIUM, then LOW.

### Phase 6: Output Report

Read `templates/report.md` for the output format. Replace all placeholders with actual values and print the complete report.

### Phase 7: Interactive Refactoring (skip if --auto)

If mode is interactive:

1. For each finding (sorted by severity), present:
   ```
   [N/total] SEVERITY — Title
     Issue description
     Suggested: refactoring suggestion
     Apply? (y/n/all/skip):
   ```
2. Wait for user response:
   - **y**: Apply the refactoring using Edit tool, then continue to next finding
   - **n**: Skip this finding, continue to next
   - **all**: Apply all remaining refactorings without asking
   - **skip**: Stop refactoring, jump to Phase 8

### Phase 8: Re-scan (only if refactorings were applied)

If any refactorings were applied in Phase 7:

1. Identify which agents' findings were refactored.
2. Re-dispatch **only those agents** with the updated code.
3. Recalculate affected scores and global score.
4. Display the delta:
   ```
   Score Delta:
   - SRP: 74 → 89 (+15)
   - Global: 72 → 81 (+9)
   ```
