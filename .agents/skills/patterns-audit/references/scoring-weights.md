# Scoring Weights & Criteria

## Weight Table

| Axis | Weight | Justification |
|------|--------|---------------|
| SRP | 8% | Foundation of maintainable code |
| OCP | 8% | Extensibility for future changes |
| LSP | 8% | Correct inheritance hierarchies |
| ISP | 8% | Clean, focused interfaces |
| DIP | 8% | Loose coupling, testability |
| **SOLID subtotal** | **40%** | |
| DRY | 8.3% | Avoid duplication |
| KISS | 8.3% | Avoid unnecessary complexity |
| YAGNI | 8.3% | Avoid over-engineering |
| **DRY/KISS/YAGNI subtotal** | **25%** | |
| Design Patterns | 20% | Architectural maturity |
| Code Smells | 15% | Cleanliness (often symptom of above) |
| **Total** | **100%** | |

## Global Score Calculation

```
global = (SRP * 0.08) + (OCP * 0.08) + (LSP * 0.08) + (ISP * 0.08) + (DIP * 0.08)
       + (DRY * 0.083) + (KISS * 0.083) + (YAGNI * 0.083)
       + (DesignPatterns * 0.20) + (CodeSmells * 0.15)
```

Round to nearest integer. Display as `XX/100`.

## Severity Mapping

| Severity | Score impact | Criteria |
|----------|-------------|----------|
| HIGH | -15 to -25 per finding | Direct principle violation, impacts maintainability/extensibility |
| MEDIUM | -5 to -14 per finding | Clear improvement opportunity, code functions correctly |
| LOW | -1 to -4 per finding | Refinement, polish, minor inconsistency |

## Score starts at 100 per axis

Each axis starts at 100. Findings subtract points based on severity. Minimum is 0.

Example: SRP axis with 1 HIGH (-20) and 2 LOW (-3 each) = 100 - 20 - 3 - 3 = 74.

## Finding Output Format

Each finding must include:
- **Severity:** HIGH / MEDIUM / LOW
- **Axis:** Which principle/pattern this relates to
- **File:** Exact path with line number(s)
- **Issue:** What the problem is (1-2 sentences)
- **Pattern:** Which principle is violated or which pattern resolves it
- **Refactor:** Concrete suggestion for how to fix it
