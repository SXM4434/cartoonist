# SOLID Principles — Detection Reference

## SRP — Single Responsibility Principle

**Definition:** A class/module should have one, and only one, reason to change.

**Detection heuristics:**
- Class/module has more than 3 public methods doing unrelated things
- File name doesn't clearly describe a single responsibility
- Class has methods that could logically belong to different domains (e.g., `validate()` + `sendEmail()` + `saveToDb()`)
- Constructor receives dependencies for unrelated concerns
- Changing one behavior requires touching methods for another behavior

**Scoring rubric:**
- 90-100: Every class/module has a clear single purpose
- 70-89: Most classes focused, 1-2 minor violations
- 50-69: Several classes mix concerns
- 30-49: Many god classes or mixed-responsibility modules
- 0-29: No separation of concerns

---

## OCP — Open/Closed Principle

**Definition:** Software entities should be open for extension, closed for modification.

**Detection heuristics:**
- Adding new behavior requires modifying existing switch/if-else chains
- No use of interfaces, abstract classes, or strategy patterns where variation exists
- New feature types require editing core logic instead of adding new implementations
- Enum-driven dispatching without extension points

**Scoring rubric:**
- 90-100: Extension points exist where variation occurs, new behavior = new class
- 70-89: Most variation handled via extension, few hardcoded branches
- 50-69: Mix of extensible and hardcoded patterns
- 30-49: Most new features require modifying existing code
- 0-29: Entirely hardcoded, no extension points

---

## LSP — Liskov Substitution Principle

**Definition:** Derived classes must be substitutable for their base classes without breaking functionality.

**Detection heuristics:**
- Subclass overrides method and throws "not implemented" or "not supported"
- Subclass narrows preconditions or weakens postconditions
- Type checks (instanceof/typeof) used to branch on subclass type
- Base class has methods that don't make sense for all subclasses (e.g., `fly()` on a `Penguin`)

**Scoring rubric:**
- 90-100: All inheritance hierarchies are substitutable
- 70-89: Minor violations, mostly correct hierarchies
- 50-69: Some classes break substitutability
- 30-49: Frequent instanceof checks, broken hierarchies
- 0-29: Inheritance used incorrectly throughout

---

## ISP — Interface Segregation Principle

**Definition:** Clients should not be forced to depend on interfaces they don't use.

**Detection heuristics:**
- Interface/type with 5+ methods where implementors only use a subset
- Classes that implement interface methods as no-ops or throw "not needed"
- Fat interfaces that combine read + write + admin operations
- Importing a module to use only 1 of its 10 exports

**Scoring rubric:**
- 90-100: Interfaces are small and focused, clients use what they depend on
- 70-89: Most interfaces well-scoped, 1-2 fat interfaces
- 50-69: Several bloated interfaces
- 30-49: Fat interfaces are the norm
- 0-29: No interface segregation, monolithic contracts

---

## DIP — Dependency Inversion Principle

**Definition:** High-level modules should not depend on low-level modules. Both should depend on abstractions.

**Detection heuristics:**
- Direct instantiation of dependencies inside constructors (`new StripeClient()`)
- Importing concrete implementations instead of interfaces/abstractions
- No dependency injection pattern (constructor injection, factory, container)
- Changing a low-level detail (database, API client) requires changing high-level logic
- Test files show difficulty mocking because of concrete coupling

**Scoring rubric:**
- 90-100: Dependencies injected via abstractions, easy to swap implementations
- 70-89: Most dependencies inverted, few concrete couplings
- 50-69: Mixed — some DI, some hardcoded dependencies
- 30-49: Most modules directly depend on concrete implementations
- 0-29: No abstraction layer, everything tightly coupled
