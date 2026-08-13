# Functional & Pure Code Smells

## Pure Functions
**Severity:** 🟠 Major (when violated)  
**Languages:** All

A function that produces side effects or depends on external state when it shouldn't. Pure functions are testable, predictable, and composable.

```javascript
// Bad — impure: same inputs can produce different outputs
let taxRate = 0.07;
function calculateTotal(price) {
    return price * (1 + taxRate); // depends on external state
}

// Good — pure: output depends only on inputs
function calculateTotal(price, taxRate) {
    return price * (1 + taxRate);
}
```

```python
# Bad
def add_item(cart, item):
    cart.items.append(item)  # mutates argument!
    cart.total += item.price

# Good
def add_item(cart, item):
    return Cart(
        items=[*cart.items, item],
        total=cart.total + item.price
    )
```

---

## Side Effects
**Severity:** 🟠 Major  
**Languages:** All

Hidden side effects in functions that appear to be queries — mutations, I/O, or state changes that callers don't expect.

```java
// Bad — looks like a simple getter but modifies state
public int getPrice() {
    accessCount++;           // hidden mutation
    lastAccessed = now();    // hidden mutation
    return this.price;
}

// Good — separate query from command
public int getPrice() { return this.price; }
public void recordAccess() { accessCount++; lastAccessed = now(); }
```

```python
# Bad — findUser sounds like a query but logs and modifies db
def find_user(user_id):
    user = db.query(user_id)
    db.execute("UPDATE users SET last_seen = NOW()")  # side effect!
    logger.info(f"User {user_id} fetched")             # side effect!
    return user

# Good — separate concerns
def find_user(user_id):
    return db.query(user_id)

def find_user_and_track(user_id):
    user = find_user(user_id)
    update_last_seen(user_id)
    logger.info(f"User {user_id} fetched")
    return user
```

---

## Idempotent
**Severity:** 🟠 Major (when violated)  
**Languages:** All

Operations that should be idempotent (safe to call multiple times) but aren't.

```python
# Bad — calling twice adds the fee twice
def apply_processing_fee(order):
    order.total += 2.99

# Good — idempotent check
def apply_processing_fee(order):
    if not order.has_processing_fee:
        order.total += 2.99
        order.has_processing_fee = True
```

```http
# Bad REST design — POST /api/charge is not idempotent
# Calling it twice charges twice

# Good — use idempotency keys
POST /api/charge
Idempotency-Key: <unique-key>
# Server deduplicates based on key
```

---

## Hidden Assumptions
**Severity:** 🟠 Major  
**Languages:** All

Functions that work only under undocumented preconditions that callers can't know about.

```python
# Bad — assumes items is sorted, but doesn't say so
def find_first_over_budget(items, budget):
    for item in items:
        if item.price > budget:
            return item  # only works because we assume sorted!
    return None

# Good — make the assumption explicit
def find_first_over_budget(items, budget):
    """Finds first item over budget.
    Args:
        items: Must be sorted by price ascending.
    """
    for item in items:
        if item.price > budget:
            return item
    return None

# Or better — don't require sorted input
def find_cheapest_over_budget(items, budget):
    over = [i for i in items if i.price > budget]
    return min(over, key=lambda i: i.price, default=None)
```

---

## Premature Memoization
**Severity:** 🟡 Minor  
**Languages:** All

Caching results of a function before measuring that it's actually slow.

```python
# Bad — memoizing a trivial function
from functools import lru_cache

@lru_cache(maxsize=128)
def add(a, b):
    return a + b  # this doesn't need caching!

# Good — memoize actual expensive computations
@lru_cache(maxsize=128)
def fibonacci(n):
    if n < 2: return n
    return fibonacci(n-1) + fibonacci(n-2)
```

---

## Functional Changes
**Severity:** 🟡 Minor  
**Languages:** All

Using functional operations (map, filter, reduce) for their side effects rather than their return values.

```javascript
// Bad — using map() for side effects (forEach is correct)
users.map(user => {
    sendWelcomeEmail(user); // side effect! ignoring return value
});

// Good
users.forEach(user => sendWelcomeEmail(user));

// Bad — using filter() and throwing away the result
orders.filter(order => {
    if (!order.isPaid) {
        cancelOrder(order); // side effect!
    }
    return order.isPaid;
});

// Good — separate concerns
const unpaidOrders = orders.filter(order => !order.isPaid);
unpaidOrders.forEach(order => cancelOrder(order));
```

---

## Anonymous Functions Abusers
**Severity:** 🟡 Minor  
**Languages:** JS/TS, Python, Java, Go

Using anonymous/lambda functions so heavily that logic becomes unreadable, or when a named function would communicate intent better.

```javascript
// Bad — multi-line lambda that should be named
const result = orders
    .filter(o => {
        const daysSinceOrder = (Date.now() - o.createdAt) / 86400000;
        return daysSinceOrder > 30 && o.status === 'pending' && !o.flagged;
    })
    .map(o => {
        return { id: o.id, customer: o.customer.name, total: o.total };
    });

// Good
const isStuckPendingOrder = (o) => {
    const daysSinceOrder = (Date.now() - o.createdAt) / 86400000;
    return daysSinceOrder > 30 && o.status === 'pending' && !o.flagged;
};
const toOrderSummary = (o) => ({
    id: o.id, customer: o.customer.name, total: o.total
});
const result = orders.filter(isStuckPendingOrder).map(toOrderSummary);
```

---

## Math Feature Envy
**Severity:** 🟡 Minor  
**Languages:** All

Complex math operations scattered across business logic instead of being in a dedicated class or module.

```java
// Bad — business class doing complex math inline
class Mortgage {
    double calculateMonthlyPayment() {
        double r = this.annualRate / 12 / 100;
        return this.principal * r * Math.pow(1 + r, this.months) 
               / (Math.pow(1 + r, this.months) - 1);
    }
    double calculateTotalInterest() {
        double monthly = calculateMonthlyPayment();
        return (monthly * this.months) - this.principal;
    }
}

// Good — math belongs in a calculator class
class MortgageCalculator {
    static double monthlyPayment(double principal, double annualRate, int months) {
        double r = annualRate / 12 / 100;
        return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    }
}

class Mortgage {
    double calculateMonthlyPayment() {
        return MortgageCalculator.monthlyPayment(principal, annualRate, months);
    }
}
```

---

## Return True
**Severity:** 🟡 Minor  
**Languages:** All

Returning a boolean from a comparison that is already a boolean.

```javascript
// Bad
function isAdult(age) {
    if (age >= 18) {
        return true;
    } else {
        return false;
    }
}

// Good
function isAdult(age) {
    return age >= 18;
}
```

```java
// Bad
public boolean isPremium(User user) {
    if (user.subscription != null && user.subscription.isActive()) {
        return true;
    }
    return false;
}

// Good
public boolean isPremium(User user) {
    return user.subscription != null && user.subscription.isActive();
}
```

---

## Gratuitous Booleans
**Severity:** 🟡 Minor  
**Languages:** All

Using boolean literals in expressions or conditions where they aren't needed.

```python
# Bad
if is_valid == True:
    pass

while running == True:
    pass

return is_done == True

# Good
if is_valid:
    pass

while running:
    pass

return is_done
```

```typescript
// Bad
const canProceed = isLoggedIn === true && hasPermission === true;

// Good
const canProceed = isLoggedIn && hasPermission;
```
