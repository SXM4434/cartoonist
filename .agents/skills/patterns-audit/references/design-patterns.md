# GoF Design Patterns — Detection Reference

## Creational Patterns

### Factory Method
**Problem it solves:** Code that needs to create objects but shouldn't know the exact class to instantiate.
**Detection signals (opportunity):** `new ConcreteClass()` scattered across the codebase; constructor logic duplicated; adding a new type requires editing creation code in multiple places.
**Detection signals (misapplied):** Factory for a single type that will never vary; over-abstraction for simple object creation.

### Abstract Factory
**Problem it solves:** Creating families of related objects without coupling to concrete implementations.
**Detection signals (opportunity):** Multiple related objects created together with repeated conditional logic (e.g., themed UI components, platform-specific services).
**Detection signals (misapplied):** Used when only one family exists; unnecessary indirection for simple cases.

### Builder
**Problem it solves:** Constructing complex objects step by step, avoiding telescoping constructors.
**Detection signals (opportunity):** Constructor with 5+ parameters; optional parameters handled via overloads; object construction requires specific ordering.
**Detection signals (misapplied):** Builder for simple objects with 2-3 fields; builder that always sets the same values.

### Prototype
**Problem it solves:** Creating new objects by cloning existing instances when construction is expensive.
**Detection signals (opportunity):** Deep copy logic repeated; objects initialized identically then tweaked; expensive setup that could be cloned.
**Detection signals (misapplied):** Used where a simple constructor would suffice; shallow copy bugs.

### Singleton
**Problem it solves:** Ensuring a class has exactly one instance with global access.
**Detection signals (opportunity):** Global state managed via module-level variables without access control; multiple instances causing conflicts.
**Detection signals (misapplied):** Overused for convenience instead of dependency injection; hidden global state making testing hard; used where scoped instances would work.

---

## Structural Patterns

### Adapter
**Problem it solves:** Making incompatible interfaces work together.
**Detection signals (opportunity):** Wrapper functions that translate between two APIs; manual data transformation between systems; integration code repeated in multiple places.
**Detection signals (misapplied):** Adapter that just passes through without translation; used to mask poor API design instead of fixing it.

### Bridge
**Problem it solves:** Separating abstraction from implementation so both can vary independently.
**Detection signals (opportunity):** Class explosion from combining two dimensions (e.g., Shape x Color, Platform x Feature); deep inheritance hierarchies.
**Detection signals (misapplied):** Over-engineering when only one dimension varies.

### Composite
**Problem it solves:** Treating individual objects and compositions uniformly (tree structures).
**Detection signals (opportunity):** Recursive data structures (menus, file systems, org charts) with duplicated handling logic for leaf vs. branch.
**Detection signals (misapplied):** Used for flat lists; unnecessary complexity for non-recursive structures.

### Decorator
**Problem it solves:** Adding responsibilities to objects dynamically without subclassing.
**Detection signals (opportunity):** Subclass explosion for feature combinations; feature flags controlling behavior via if/else chains; wrapping logic repeated across classes.
**Detection signals (misapplied):** Deep decorator stacks making debugging impossible; used where simple composition would work.

### Facade
**Problem it solves:** Providing a simple interface to a complex subsystem.
**Detection signals (opportunity):** Client code interacting with 5+ classes to accomplish one task; initialization sequences repeated; complex library usage pattern duplicated.
**Detection signals (misapplied):** Facade that exposes everything (defeats purpose); hiding necessary complexity that callers need to understand.

### Flyweight
**Problem it solves:** Sharing common state to reduce memory usage with many similar objects.
**Detection signals (opportunity):** Thousands of objects with identical shared properties; memory profiling shows duplication; large arrays of similar objects.
**Detection signals (misapplied):** Premature optimization; shared state causing mutation bugs.

### Proxy
**Problem it solves:** Controlling access to an object (lazy loading, access control, caching, logging).
**Detection signals (opportunity):** Access control/caching/logging logic mixed into business classes; lazy initialization duplicated; cross-cutting concerns repeated.
**Detection signals (misapplied):** Proxy that just delegates without adding behavior; unnecessary indirection.

---

## Behavioral Patterns

### Chain of Responsibility
**Problem it solves:** Passing requests along a chain of handlers until one handles it.
**Detection signals (opportunity):** Long if/else-if chains processing different request types; middleware-like processing where handlers could be composed.
**Detection signals (misapplied):** Chain where only one handler ever matches (just use a direct call); chains that are hard to debug.

### Command
**Problem it solves:** Encapsulating requests as objects for parameterization, queuing, undo.
**Detection signals (opportunity):** Undo/redo functionality needed; operations queued for batch execution; callback hell with complex operation context.
**Detection signals (misapplied):** Command for simple direct operations; over-engineering CRUD.

### Iterator
**Problem it solves:** Sequential access to elements without exposing the underlying structure.
**Detection signals (opportunity):** Custom traversal logic for data structures; exposing internal arrays/maps to consumers; traversal code duplicated.
**Detection signals (misapplied):** Most languages have built-in iterators — custom ones rarely needed. Flag only if missing for custom data structures.

### Mediator
**Problem it solves:** Reducing coupling by centralizing complex communication between objects.
**Detection signals (opportunity):** Many objects referencing each other directly; changing one class requires changing many others; spaghetti event wiring.
**Detection signals (misapplied):** Mediator becoming a god object; centralizing logic that belongs in individual components.

### Memento
**Problem it solves:** Capturing and restoring object state without violating encapsulation.
**Detection signals (opportunity):** Undo/redo, state snapshots, or rollback needed; state serialization logic mixed into business classes.
**Detection signals (misapplied):** Storing excessive state; used where event sourcing would be more appropriate.

### Observer
**Problem it solves:** Notifying multiple objects about state changes without coupling.
**Detection signals (opportunity):** Manual notification calls scattered across code; polling for changes; tight coupling between state owner and consumers.
**Detection signals (misapplied):** Observer for single subscriber (just use a callback); event storms from cascading notifications.

### State
**Problem it solves:** Changing object behavior when internal state changes (state machine).
**Detection signals (opportunity):** Large switch/if-else on state variable controlling behavior; state transitions duplicated; adding a new state requires editing multiple methods.
**Detection signals (misapplied):** State pattern for 2-state boolean logic; over-engineering simple flags.

### Strategy
**Problem it solves:** Encapsulating interchangeable algorithms/behaviors.
**Detection signals (opportunity):** Switch/if-else selecting between algorithms; duplicated code with minor variations; behavior varies by type/config but implementation is hardcoded.
**Detection signals (misapplied):** Strategy for a single algorithm that won't vary; unnecessary indirection for simple logic.

### Template Method
**Problem it solves:** Defining algorithm skeleton with customizable steps.
**Detection signals (opportunity):** Subclasses overriding entire methods when only part varies; copy-pasted methods with minor differences; algorithm structure repeated across classes.
**Detection signals (misapplied):** Forcing inheritance when composition (Strategy) would be simpler.

### Visitor
**Problem it solves:** Adding operations to object structures without modifying them.
**Detection signals (opportunity):** Switch on type to perform different operations; adding new operations requires editing every class in a hierarchy; serialization/export logic scattered.
**Detection signals (misapplied):** Visitor when the class hierarchy changes frequently (visitor breaks on new types).
