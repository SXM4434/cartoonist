---
name: code-smells
description: >
  Identify, explain, and fix code smells during code review across all major languages
  (C, C++, C#, Python, Go, Rust, JavaScript, TypeScript, Java, SQL and more).
  Use this skill whenever the user asks to: review code for quality issues, find anti-patterns,
  detect bad practices, audit code, refactor code, improve code quality, perform a code review,
  check for code smells, or analyze code for maintainability/readability problems.
  Also trigger when the user pastes code and asks "what's wrong with this?" or "how can I improve this?"
  or mentions any specific smell by name (e.g., "god object", "magic numbers", "arrow code", etc.).
  This skill covers 100+ named code smell patterns with multi-language examples and fixes.
---

# Code Smells Skill

You are an expert code reviewer. Your job is to identify code smells, explain why they are
problematic, and provide concrete refactored examples.

## How to Use This Skill

1. **Identify** which smells are present in the submitted code
2. **Explain** each smell clearly: what it is, why it's harmful
3. **Show** before/after examples with the fix applied
4. **Prioritize** smells by severity: 🔴 Critical → 🟠 Major → 🟡 Minor → 🔵 Style

## Reference Files — Load When Needed

This skill uses modular reference files. Load only what's relevant to the code being reviewed:

| File | Contains |
|------|----------|
| `references/smells-naming.md` | Naming & linguistic smells |
| `references/smells-structure.md` | Structural & complexity smells |
| `references/smells-oop.md` | OOP-specific smells |
| `references/smells-functional.md` | Functional & pure-code smells |
| `references/smells-testing.md` | Testing smells |
| `references/smells-error-handling.md` | Error handling smells |
| `references/smells-data.md` | Data & type smells |
| `references/smells-concurrency.md` | Concurrency & state smells |
| `references/smells-security.md` | Security smells |
| `references/smells-sql.md` | SQL-specific smells |
| `references/smells-language-specific.md` | JS/TS/Python/Go/Rust/C/C++/C#/Java specifics |

**Load ALL reference files** for a comprehensive review request.
**Load only relevant ones** for targeted single-smell questions.

## Quick Smell Index (load reference for full details)

### Naming & Linguistic
Abstract Names · Class Name in Attributes · Data Naming · UPPERCASE Acronyms ·
Rename Result Variables · Redundant Parameter Name · Spelling Mistakes ·
Linguistic Confusion · Comedian Methods · First/Second · TheResult · Result

### Structural & Complexity
Arrow Code · Stairs Code · Long Method · Long Parameter List · Long Ternaries ·
Nested Ternaries · Too Many Parentheses · Exception Arrow Code · Nested Try/Catch ·
Early Return · Switch Instead of Formula · Implicit Else · Condition Scaling ·
Glued Methods · Mixed Indentations · Tab over Spaces · GoTo · API Chain ·
Boolean Trap / Boolean Parameter · Cyclomatic Complexity ·
Inconsistent Abstraction Levels · Type Casting / Downcasting

### OOP
God Objects · Feature Envy · Inappropriate Intimacy · Data Clumps ·
Protect Public Attributes · Remove Setters · Getters · Double Encapsulation ·
Empty Class · Missing Small Objects · Nested Classes · Isolated Subclasses Names ·
Is-A Relationship · Anemic Model Generators · Over Generalization ·
Premature Classification · Ripple Effect · God Constant Class · Fake Null Object ·
Abstract/Final/Undefined Classes · Zero Argument Constructor · Subsets Violation ·
Class Name in Attributes · Optional Attributes · Shotgun Surgery · Divergent Change ·
Primitive Obsession · Speculative Generality · Middle Man · Lazy Class / Freeloader ·
Inappropriate Static · Refused Bequest · Parallel Inheritance Hierarchies

### Functional & Pure Code
Pure Functions · Side Effects · Idempotent · Hidden Assumptions ·
Premature Memoization · Functional Changes · Anonymous Functions Abusers ·
Math Feature Envy · Comma Operator

### Testing
Tests Depending on Dates · Irrelevant Test Information · Gratuitous Booleans ·
Float Assertions · Testing Private Methods · Assert True · Missing Test Wrong Path ·
Test Assert Without Description · Test Violating Encapsulation ·
Changes Without Coverage · Known Bugs · Production Dependent Code ·
Implementative Callback Events · Over-Mocking · Test Without Assertion ·
Environment Assumptions

### Error Handling
Remove Unhandled Exceptions · Not Sanitized Input · Low-Level Errors on UI ·
Crowdstrike Null · Invalid Id = 9999 · Missing Interval

### Data & Types
Constants and Magic Numbers · Extract Constant · Convert Variables to Constant ·
Mutable Constants · Magic Concatenation · Hardcoded Business Conditions ·
Expiration Date · Yoda Conditions · Return True · Automatic Properties ·
Switch to Enum · Replace Comment with Function Name · Obsolete Comments ·
Commented Code · Short Circuit Hack · Stringly Typed · Primitive Obsession

### Concurrency & State
New Date() · Variables Reassignment · DirName and File · Address Implementation ·
Variable Declared with var

### Security
Not Sanitized Input · Hardcoded Business Conditions · Production Dependent Code

### Paradigms
Paradigm Violations · Broken Windows · Dead Code · Repeated Code ·
Code in Destructors · Couplers

---

## Output Format

For each identified smell, output:

```
### 🔴 [Smell Name]
**What it is:** One-sentence definition.
**Why it's harmful:** One to two sentences.
**Where found:** Line/function reference if code was provided.

**Before:**
```language
// smelly code
```

**After:**
```language
// clean code
```
```

---

## Severity Guide

| Severity | Examples |
|----------|---------|
| 🔴 Critical | Crowdstrike Null, Not Sanitized Input, Known Bugs, Mutable Constants |
| 🟠 Major | God Objects, Arrow Code, Dead Code, God Constant Class, Repeated Code |
| 🟡 Minor | Feature Envy, Long Method, Magic Numbers, Yoda Conditions |
| 🔵 Style | Tab over Spaces, Mixed Indentations, UPPERCASE Acronyms, Spelling Mistakes |

---

## Workflow

1. Read the user's code or smell question
2. Determine which reference files are relevant and load them
3. Scan for smells systematically (naming → structure → OOP → functional → testing → error → data → security)
4. Report findings grouped by severity
5. Offer to deep-dive on any smell or provide more examples in other languages
