# Code Smells — Detection Reference

## Bloaters

### God Class / Large Class
**Detection:** Class with 10+ public methods or 300+ lines spanning unrelated domains.
**Resolves with:** SRP decomposition, Extract Class refactoring.

### Long Method
**Detection:** Method/function exceeding 30 lines or doing 3+ distinct operations.
**Resolves with:** Extract Method, decompose into focused functions.

### Long Parameter List
**Detection:** Function with 5+ parameters.
**Resolves with:** Builder pattern, Parameter Object, or configuration object.

### Primitive Obsession
**Detection:** Using strings/numbers for domain concepts (e.g., `status: string` instead of `Status` enum/type, `price: number` instead of `Money`).
**Resolves with:** Value Objects, domain types, enums.

---

## Object-Orientation Abusers

### Switch Statements / Type Checking
**Detection:** switch/if-else on type or status controlling behavior in 3+ places.
**Resolves with:** Strategy, State, or Polymorphism.

### Refused Bequest
**Detection:** Subclass ignores or overrides parent methods as no-ops.
**Resolves with:** Fix inheritance hierarchy (LSP), prefer composition.

### Parallel Inheritance Hierarchies
**Detection:** Adding a subclass in one hierarchy requires adding one in another.
**Resolves with:** Merge hierarchies, use composition or Bridge pattern.

---

## Change Preventers

### Divergent Change
**Detection:** A single class changes for many unrelated reasons.
**Resolves with:** SRP — extract classes per reason for change.

### Shotgun Surgery
**Detection:** A single change requires editing many classes/files.
**Resolves with:** Move related logic into one place, Facade, centralize responsibility.

---

## Dispensables

### Dead Code
**Detection:** Unreachable code, unused variables, unused imports, commented-out code.
**Resolves with:** Delete it.

### Speculative Generality
**Detection:** Abstract classes, interfaces, or parameters created "for future use" with only one implementation.
**Resolves with:** YAGNI — remove until actually needed.

### Duplicate Code
**Detection:** Identical or near-identical blocks in 2+ places.
**Resolves with:** DRY — Extract Method, Extract Class, or template.

---

## Couplers

### Feature Envy
**Detection:** A method accesses data from another class more than its own.
**Resolves with:** Move Method to the class it envies.

### Inappropriate Intimacy
**Detection:** Two classes accessing each other's private/internal fields.
**Resolves with:** Move methods, extract shared interface, enforce encapsulation.

### Message Chains
**Detection:** `a.getB().getC().getD().doSomething()` — long chains of method calls.
**Resolves with:** Law of Demeter — Facade, delegate method, or restructure.

### Middle Man
**Detection:** Class that delegates almost all its work to another class.
**Resolves with:** Remove the middleman, let clients talk to the real class.

---

## Scoring Rubric

- 90-100: No significant smells, clean codebase
- 70-89: Few minor smells, well-maintained
- 50-69: Several noticeable smells, refactoring advised
- 30-49: Pervasive smells, maintenance burden is high
- 0-29: Severe code rot, major refactoring needed
