# Structural & Complexity Code Smells

## Arrow Code
**Severity:** 🟠 Major  
**Languages:** All

Deeply nested conditionals that form an arrow shape pointing right. Each nesting level adds cognitive load.

```javascript
// Bad — arrow pointing right
function processOrder(order) {
    if (order) {
        if (order.isValid()) {
            if (order.customer) {
                if (order.customer.isActive()) {
                    if (order.items.length > 0) {
                        return fulfill(order);
                    }
                }
            }
        }
    }
    return null;
}

// Good — early returns flatten the arrow
function processOrder(order) {
    if (!order) return null;
    if (!order.isValid()) return null;
    if (!order.customer) return null;
    if (!order.customer.isActive()) return null;
    if (order.items.length === 0) return null;
    return fulfill(order);
}
```

```python
# Bad
def get_discount(user, cart):
    if user:
        if user.is_premium:
            if cart:
                if cart.total > 100:
                    return 0.2
    return 0

# Good
def get_discount(user, cart):
    if not user or not user.is_premium:
        return 0
    if not cart or cart.total <= 100:
        return 0
    return 0.2
```

---

## Exception Arrow Code
**Severity:** 🟠 Major  
**Languages:** All

Nested try/catch blocks creating the same arrow-code problem.

```java
// Bad
try {
    try {
        try {
            result = parseJson(input);
            result = validate(result);
            result = save(result);
        } catch (ParseException e) {
            log.error("parse failed", e);
        }
    } catch (ValidationException e) {
        log.error("validation failed", e);
    }
} catch (IOException e) {
    log.error("save failed", e);
}

// Good — handle in one place or use specific catch types
try {
    result = parseJson(input);
    result = validate(result);
    result = save(result);
} catch (ParseException e) {
    log.error("parse failed", e);
} catch (ValidationException e) {
    log.error("validation failed", e);
} catch (IOException e) {
    log.error("save failed", e);
}
```

---

## Nested Try/Catch
**Severity:** 🟠 Major  
**Languages:** All

See Exception Arrow Code above. Nesting try/catch should be extracted to separate methods.

```csharp
// Bad
try {
    var data = FetchData();
    try {
        var parsed = Parse(data);
        ProcessResult(parsed);
    } catch (FormatException ex) {
        HandleFormatError(ex);
    }
} catch (NetworkException ex) {
    HandleNetworkError(ex);
}

// Good
FetchAndProcess();

void FetchAndProcess() {
    var data = FetchData();
    ProcessData(data);
}

void ProcessData(string data) {
    try {
        var parsed = Parse(data);
        ProcessResult(parsed);
    } catch (FormatException ex) {
        HandleFormatError(ex);
    }
}
```

---

## Stairs Code
**Severity:** 🟠 Major  
**Languages:** All

Related to arrow code — sequential operations that keep increasing indentation when they should be flat.

```java
// Bad
public Result process(Input input) {
    Result r1 = step1(input);
        Result r2 = step2(r1);
            Result r3 = step3(r2);
                return step4(r3);
}

// Good
public Result process(Input input) {
    Result afterStep1 = step1(input);
    Result afterStep2 = step2(afterStep1);
    Result afterStep3 = step3(afterStep2);
    return step4(afterStep3);
}
```

---

## Long Method
**Severity:** 🟠 Major  
**Languages:** All

Methods longer than ~20 lines are doing too much. Extract until each method has one job.

```python
# Bad — 50-line method doing everything
def handle_checkout(cart, user, payment_info):
    # validate cart
    if not cart.items:
        raise ValueError("Empty cart")
    for item in cart.items:
        if item.stock < item.quantity:
            raise ValueError(f"{item.name} out of stock")
    # apply discounts
    if user.is_premium:
        cart.total *= 0.9
    if cart.coupon:
        cart.total -= cart.coupon.value
    # process payment
    ... # 30 more lines

# Good — each step is its own method
def handle_checkout(cart, user, payment_info):
    validate_cart(cart)
    cart.total = apply_discounts(cart, user)
    charge = process_payment(payment_info, cart.total)
    send_confirmation(user, charge)
    return charge
```

---

## Long Ternaries
**Severity:** 🟡 Minor  
**Languages:** All

Ternaries that are so long they need to be wrapped are just `if/else` statements in disguise.

```javascript
// Bad
const message = user.isAuthenticated && user.role === 'admin' && !user.isBanned ? `Welcome back, ${user.name}! You have ${notifications.length} notifications.` : 'Please log in to continue.';

// Good
let message;
if (user.isAuthenticated && user.role === 'admin' && !user.isBanned) {
    message = `Welcome back, ${user.name}! You have ${notifications.length} notifications.`;
} else {
    message = 'Please log in to continue.';
}
```

---

## Nested Ternaries
**Severity:** 🟠 Major  
**Languages:** All

Ternaries inside ternaries — unreadable and error-prone.

```javascript
// Bad
const label = isAdmin ? 'Admin' : isModerator ? 'Mod' : isPremium ? 'Premium' : 'User';

// Good
function getUserLabel(user) {
    if (user.isAdmin) return 'Admin';
    if (user.isModerator) return 'Mod';
    if (user.isPremium) return 'Premium';
    return 'User';
}
```

---

## Implicit Else
**Severity:** 🟡 Minor  
**Languages:** All

When the true-branch always returns/throws, the else is redundant noise and increases indentation.

```java
// Bad
public String classify(int score) {
    if (score >= 90) {
        return "A";
    } else {
        if (score >= 80) {
            return "B";
        } else {
            return "C";
        }
    }
}

// Good
public String classify(int score) {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    return "C";
}
```

---

## Switch Instead of Formula
**Severity:** 🟡 Minor  
**Languages:** All

Using a long switch/if-else when a simple formula or data structure would work.

```python
# Bad
def day_number(day_name):
    if day_name == "Monday": return 1
    if day_name == "Tuesday": return 2
    if day_name == "Wednesday": return 3
    if day_name == "Thursday": return 4
    if day_name == "Friday": return 5
    if day_name == "Saturday": return 6
    if day_name == "Sunday": return 7

# Good
DAY_NUMBERS = {
    "Monday": 1, "Tuesday": 2, "Wednesday": 3,
    "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7
}
def day_number(day_name):
    return DAY_NUMBERS[day_name]
```

```java
// Bad
double getTaxRate(String country) {
    switch (country) {
        case "US": return 0.07;
        case "UK": return 0.20;
        case "DE": return 0.19;
        default: return 0.0;
    }
}

// Good
private static final Map<String, Double> TAX_RATES = Map.of(
    "US", 0.07, "UK", 0.20, "DE", 0.19
);
double getTaxRate(String country) {
    return TAX_RATES.getOrDefault(country, 0.0);
}
```

---

## Too Many Parentheses
**Severity:** 🔵 Style  
**Languages:** All

Redundant parentheses that don't clarify precedence — they just add noise.

```java
// Bad
if ((x > 0) && (y > 0)) { }
return (result);
boolean flag = (a == b);

// Good
if (x > 0 && y > 0) { }
return result;
boolean flag = a == b;
```

---

## Glued Methods
**Severity:** 🟠 Major  
**Languages:** All

A method that does two distinct things that should be separate (often signalled by "and" in the name).

```python
# Bad
def validate_and_save(user):
    if not user.email:
        raise ValueError("Email required")
    db.save(user)

# Good
def validate(user):
    if not user.email:
        raise ValueError("Email required")

def save(user):
    db.save(user)

# Caller decides when/how to compose them
```

---

## Mixed Indentations
**Severity:** 🔵 Style  
**Languages:** All

Mixing tabs and spaces makes code render differently in different editors.

---

## Tab over Spaces
**Severity:** 🔵 Style  
**Languages:** Python (critical in Python!), All

In Python, inconsistent use of tabs vs. spaces causes `TabError`. In all languages, inconsistency breeds confusion.

```python
# Bad (mixed)
def calculate():
	x = 1      # tab
    y = 2      # spaces
	return x+y # tab

# Good (spaces throughout, per PEP 8)
def calculate():
    x = 1
    y = 2
    return x + y
```

---

## Early Return
**Severity:** 🟡 Minor (it's actually a fix for arrow code)  
**Languages:** All

Early returns reduce nesting and make the happy path clear. Prefer them over deep if-else chains.

```go
// Bad
func processUser(u *User) error {
    if u != nil {
        if u.IsActive {
            if u.HasPermission("write") {
                return doWork(u)
            } else {
                return ErrNoPermission
            }
        } else {
            return ErrInactiveUser
        }
    } else {
        return ErrNilUser
    }
}

// Good
func processUser(u *User) error {
    if u == nil { return ErrNilUser }
    if !u.IsActive { return ErrInactiveUser }
    if !u.HasPermission("write") { return ErrNoPermission }
    return doWork(u)
}
```

---

## API Chain
**Severity:** 🟡 Minor  
**Languages:** All

Excessive method chaining that violates the Law of Demeter — you're reaching deep into object internals.

```java
// Bad
String city = order.getCustomer().getAddress().getCity().toUpperCase();

// Good
String city = order.getCustomerCity().toUpperCase();
// Or at minimum, assign intermediate steps
Customer customer = order.getCustomer();
Address address = customer.getAddress();
String city = address.getCity().toUpperCase();
```

---

## Condition Scaling
**Severity:** 🟡 Minor  
**Languages:** All

A condition with so many clauses it's impossible to understand what scenario it represents.

```python
# Bad
if user.age > 18 and user.country == "US" and not user.is_banned and user.email_verified and user.subscription_active and user.payment_method is not None:
    grant_access()

# Good
def is_eligible_for_access(user):
    return (
        user.is_adult()
        and user.is_us_resident()
        and user.is_in_good_standing()
    )

if is_eligible_for_access(user):
    grant_access()
```

---

## GoTo
**Severity:** 🔴 Critical  
**Languages:** C, C++, Go (has goto), PHP

`goto` makes control flow impossible to follow and is almost never the right solution.

```c
// Bad
int find_item(int *arr, int n, int target) {
    int i = 0;
    loop:
        if (arr[i] == target) goto found;
        i++;
        if (i < n) goto loop;
        return -1;
    found:
        return i;
}

// Good
int find_item(int *arr, int n, int target) {
    for (int i = 0; i < n; i++) {
        if (arr[i] == target) return i;
    }
    return -1;
}
```

---

## Comma Operator
**Severity:** 🟡 Minor  
**Languages:** C, C++, JavaScript

Using the comma operator to pack multiple expressions into one. Cryptic and surprising.

```javascript
// Bad
for (let i = 0, j = 10; i < j; i++, j--) {
    console.log(i, j); // this is ok
}

// Really bad — comma operator outside for loop
let x = (doSomething(), getValue()); // doSomething() result is discarded!

// Good — be explicit
doSomething();
let x = getValue();
```

---

## Long Parameter List
**Severity:** 🔴 Critical  
**Languages:** All

Functions with 4+ parameters are hard to call correctly, hard to test, and signal the function is doing too much. One of Fowler's original 22 smells.

```python
# Bad
def create_user(name, email, age, street, city, zip_code, country, role, is_active):
    pass

# Good — group related parameters into objects
@dataclass
class Address:
    street: str
    city: str
    zip_code: str
    country: str

def create_user(name: str, email: str, age: int, address: Address, role: str):
    pass
```

```java
// Bad
void sendEmail(String to, String from, String subject, String body,
               boolean isHtml, boolean attachLogs, int priority) {}

// Good — builder pattern
EmailMessage msg = EmailMessage.builder()
    .to("user@example.com")
    .subject("Hello")
    .body("<p>Hi</p>")
    .html(true)
    .build();
emailService.send(msg);
```

---

## Boolean Trap / Boolean Parameter
**Severity:** 🔴 Critical  
**Languages:** All

Passing `true`/`false` to control function behavior — the caller has no idea what the boolean means without reading the implementation.

```java
// Bad — what does true mean here?
render(true);
loadUser(userId, false, true);

// Good — self-documenting
render(RenderMode.FULL);
loadUser(userId, LoadOptions.WITHOUT_CACHE.WITH_PERMISSIONS);
```

```python
# Bad
def export(data, True, False)  # compress? include_headers? nobody knows at call site

# Good
def export(data, compress=False, include_headers=True):
    pass
# Or better — named enum
class ExportOptions(Enum):
    COMPRESSED = auto()
    WITH_HEADERS = auto()
```

```typescript
// Bad
button.render(true, false, true);

// Good
button.render({
    fullWidth: true,
    disabled: false,
    visible: true,
});
```

---

## Cyclomatic Complexity
**Severity:** 🟠 Major  
**Languages:** All

A single function with too many independent paths (branches) through it. CC > 10 is a warning sign; CC > 15 is a smell; CC > 20 is a crisis. High CC directly correlates with defect density.

```python
# Bad — CC of ~12 (each if/elif/for/while/except adds 1)
def process_order(order, user, payment):
    if order:
        if order.items:
            for item in order.items:
                if item.in_stock:
                    if user.is_active:
                        if user.has_payment_method:
                            if payment.is_valid:
                                try:
                                    charge(payment)
                                except PaymentError:
                                    if payment.can_retry:
                                        retry(payment)
                                    else:
                                        cancel(order)

# Good — extract until each function has CC ≤ 5
def process_order(order, user, payment):
    validate_order(order)
    validate_user(user)
    execute_payment(payment, order)
```

*Measure with:* `radon` (Python), `eslint complexity` rule (JS), SonarQube, `gocognit` (Go), `clippy` (Rust).

---

## Inconsistent Abstraction Levels
**Severity:** 🟡 Minor  
**Languages:** All

A function that mixes high-level business logic with low-level implementation details in the same body. Readers have to context-switch between "what" and "how".

```python
# Bad — high-level and low-level mixed
def checkout(cart, user):
    apply_loyalty_discount(cart)          # high level
    cart.total = round(cart.total, 2)     # low level
    sql = "INSERT INTO orders VALUES ..."  # very low level!
    db.execute(sql, (cart.total, user.id))
    send_confirmation_email(user)          # high level again

# Good — consistent abstraction level
def checkout(cart, user):
    apply_loyalty_discount(cart)
    cart.total = round_currency(cart.total)
    order = save_order(cart, user)
    send_confirmation_email(user, order)
```

---

## Type Casting / Downcasting
**Severity:** 🟡 Minor  
**Languages:** All OOP

Using `instanceof`/`is`/`as` checks and casts in business logic — usually signals the type hierarchy is wrong and polymorphism should be used instead.

```java
// Bad — type checking in logic
void process(Animal animal) {
    if (animal instanceof Dog) {
        ((Dog) animal).bark();
    } else if (animal instanceof Cat) {
        ((Cat) animal).meow();
    }
}

// Good — polymorphism
abstract class Animal {
    abstract void makeSound();
}
void process(Animal animal) {
    animal.makeSound(); // each subclass handles its own behavior
}
```

```python
# Bad
def describe(shape):
    if isinstance(shape, Circle):
        return f"Circle with radius {shape.radius}"
    elif isinstance(shape, Rectangle):
        return f"Rectangle {shape.width}x{shape.height}"

# Good
class Circle:
    def describe(self): return f"Circle with radius {self.radius}"

class Rectangle:
    def describe(self): return f"Rectangle {self.width}x{self.height}"

def describe(shape):
    return shape.describe()
```

---

## Short Circuit Hack
**Severity:** 🟡 Minor  
**Languages:** JS, TS, Python

Using `&&` or `||` as a control flow mechanism instead of an explicit if statement, when the intent is side effects.

```javascript
// Bad — using && for control flow
user.isAdmin && deleteAllRecords();
isLoggedIn && renderDashboard();

// Good — intent is explicit
if (user.isAdmin) deleteAllRecords();
if (isLoggedIn) renderDashboard();

// Fine — using || for defaults is idiomatic
const name = user.name || "Anonymous";
```
