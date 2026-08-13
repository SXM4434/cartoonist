# Dead Code, Duplication & Paradigm Smells

## Dead Code
**Severity:** 🟠 Major  
**Languages:** All

Code that is never executed — unreachable branches, unused functions, variables that are set but never read.

```python
# Bad — unreachable code
def get_grade(score):
    if score >= 90:
        return "A"
    return "B"
    return "C"  # unreachable!

# Bad — unused function
def calculate_legacy_rate():
    pass  # never called anywhere

# Good — delete dead code. Git history preserves it.
def get_grade(score):
    if score >= 90:
        return "A"
    return "B"
```

```javascript
// Bad — condition can never be false
const MAX = 100;
if (MAX > 200) { // always false!
    doSomething();
}

// Bad — variable set but never read
function process(items) {
    let count = 0;  // set
    for (const item of items) {
        count++;    // set
        handleItem(item);
    }
    // count never used!
}
```

---

## Repeated Code
**Severity:** 🟠 Major  
**Languages:** All

Duplicate code that should be extracted into a shared function or class (DRY principle).

```java
// Bad — validation logic duplicated in 5 places
class OrderController {
    void createOrder(String email, int quantity) {
        if (email == null || !email.contains("@")) throw new ValidationException("Invalid email");
        if (quantity <= 0) throw new ValidationException("Invalid quantity");
        // ...
    }
    void updateOrder(String email, int quantity) {
        if (email == null || !email.contains("@")) throw new ValidationException("Invalid email");
        if (quantity <= 0) throw new ValidationException("Invalid quantity");
        // ...
    }
}

// Good
class OrderValidator {
    void validate(String email, int quantity) {
        validateEmail(email);
        validateQuantity(quantity);
    }
    private void validateEmail(String email) {
        if (email == null || !email.contains("@"))
            throw new ValidationException("Invalid email");
    }
    private void validateQuantity(int quantity) {
        if (quantity <= 0)
            throw new ValidationException("Quantity must be positive");
    }
}
```

---

## Broken Windows
**Severity:** 🟠 Major  
**Languages:** All

The theory: one broken window (bad code) signals that nobody cares, inviting more deterioration. TODOs, commented-out code, unused variables, failing tests — if left unfixed, they compound.

*Detection:* Count `TODO`, `FIXME`, `HACK`, `XXX` comments in the codebase. More than 10 per 1000 lines is a warning sign.

```python
# Broken windows look like:
x = compute_value()  # TODO: fix this
# result = old_computation()  # commented-out for ages
def unused_helper():  # never called
    pass

# HACK: don't touch this, it somehow works
data = process(data, True, False, True, 42)
```

---

## Couplers
**Severity:** 🟠 Major  
**Languages:** All OOP

Classes that are so tightly coupled that changes in one always require changes in the other. Often seen through message chains, data clumps, or shared mutable state.

```java
// Bad — OrderProcessor knows too much about Customer internals
class OrderProcessor {
    void process(Order order) {
        String tier = order.customer.account.tier.name; // deep chain
        if (tier.equals("GOLD")) applyGoldDiscount(order);
    }
}

// Good — Customer exposes behaviour, not data
class Customer {
    boolean isGoldTier() {
        return account.tier == Tier.GOLD;
    }
}
class OrderProcessor {
    void process(Order order) {
        if (order.customer.isGoldTier()) applyGoldDiscount(order);
    }
}
```

---

## Code in Destructors
**Severity:** 🟠 Major  
**Languages:** C++, Python, C#

Complex or fallible logic in destructors/finalizers — exceptions thrown from destructors cause crashes, and finalizer execution timing is unreliable.

```cpp
// Bad — exception in destructor terminates the program
class DatabaseConnection {
    ~DatabaseConnection() {
        commit(); // throws if network is down — terminates!
        close();
    }
};

// Good — explicit cleanup with RAII
class DatabaseConnection {
    ~DatabaseConnection() noexcept {
        try { close(); } catch (...) { /* log but don't throw */ }
    }
    void commit() { /* explicit, can throw */ }
};
```

```python
# Bad — I/O in __del__ (not guaranteed to run or run at right time)
class FileWriter:
    def __del__(self):
        self.file.close()  # may not run, may run at wrong time

# Good — context manager
class FileWriter:
    def __enter__(self): return self
    def __exit__(self, *args): self.file.close()

with FileWriter('out.txt') as f:
    f.write(data)
```

---

## Paradigm Violations
**Severity:** 🟠 Major  
**Languages:** All

Using language features against their designed paradigm — procedural code in OOP systems, OOP patterns in functional code, etc.

```python
# Bad — procedural style in Python (missing OOP/functional opportunities)
user_name = ""
user_email = ""
user_active = False

def set_user(name, email):
    global user_name, user_email
    user_name = name
    user_email = email

# Good — use the language's idioms
@dataclass
class User:
    name: str
    email: str
    active: bool = False
```

---

## Abstract / Final / Undefined Classes
**Severity:** 🟡 Minor  
**Languages:** Java, C#, C++

Abstract classes with no abstract methods (should be concrete), final classes designed to be extended, or abstract classes with all methods implemented (should be interface).

```java
// Bad — abstract class with no abstract methods
abstract class Logger {
    public void log(String message) { // concrete
        System.out.println(message);
    }
    // nothing abstract!
}

// Bad — final class that should be extensible
public final class HttpClient { // can't be mocked or extended!
    public Response send(Request req) { ... }
}

// Good
interface Logger { void log(String message); }
class ConsoleLogger implements Logger { ... }

// Or use interface for HttpClient if extension/testing needed
```

---

## Nested Classes (Over-nesting)
**Severity:** 🟡 Minor  
**Languages:** Java, C#, Python

Inner classes that are so large they obscure the outer class and should be in their own files.

---

## Subsets Violation (LSP)
**Severity:** 🟠 Major

See OOP smells file — Liskov Substitution violations where a subtype can't replace the parent.

---

## Mixed Indentations
**Severity:** 🔵 Style  

See structure smells. Auto-fix with a linter (prettier, black, gofmt, etc.).

---

## Paradigm — Over Generalization
**Severity:** 🟡 Minor  

See OOP smells — building abstract frameworks for single-use cases.
