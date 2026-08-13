# Error Handling Code Smells

## Remove Unhandled Exceptions
**Severity:** 🟠 Major  
**Languages:** All

Catching exceptions and doing nothing, or letting exceptions bubble up without context.

```java
// Bad — swallowed exception
try {
    processPayment(order);
} catch (Exception e) {
    // silently ignore
}

// Bad — too broad catch
try {
    connect();
    authenticate();
    fetchData();
} catch (Exception e) {
    System.out.println("Error");
}

// Good — handle specifically, add context
try {
    processPayment(order);
} catch (PaymentGatewayException e) {
    log.error("Payment failed for order {}: {}", order.getId(), e.getMessage());
    throw new OrderProcessingException("Payment failed", e);
}
```

---

## Not Sanitized Input
**Severity:** 🔴 Critical  
**Languages:** All

Using user input directly without validation or sanitization — opens injection vulnerabilities.

```python
# Bad — SQL injection
def get_user(username):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return db.execute(query)

# Good — parameterized query
def get_user(username):
    return db.execute("SELECT * FROM users WHERE username = ?", (username,))
```

```javascript
// Bad — XSS
function renderGreeting(name) {
    document.getElementById('greeting').innerHTML = `Hello, ${name}!`;
    // If name = '<script>steal(document.cookie)</script>'...
}

// Good
function renderGreeting(name) {
    document.getElementById('greeting').textContent = `Hello, ${name}!`;
}
```

```java
// Bad — command injection
public void runScript(String filename) throws IOException {
    Runtime.getRuntime().exec("sh script.sh " + filename);
}

// Good
public void runScript(String filename) throws IOException {
    String sanitized = filename.replaceAll("[^a-zA-Z0-9._-]", "");
    ProcessBuilder pb = new ProcessBuilder("sh", "script.sh", sanitized);
    pb.start();
}
```

---

## Low-Level Errors on User Interface
**Severity:** 🟠 Major  
**Languages:** All

Showing stack traces, SQL errors, or internal exception messages to end users.

```python
# Bad — exposing internals
@app.errorhandler(Exception)
def handle_error(e):
    return str(e), 500  # "SQLSTATE[23000]: Integrity constraint violation..."

# Good — user-friendly message, log internally
@app.errorhandler(Exception)
def handle_error(e):
    app.logger.exception("Unhandled error")
    return {"error": "Something went wrong. Please try again."}, 500
```

---

## Crowdstrike Null
**Severity:** 🔴 Critical  
**Languages:** C, C++, C#, Java, others with null references

Dereferencing a pointer/reference without checking for null first. Named after the 2024 CrowdStrike outage caused by a null pointer dereference.

```c
// Bad — crash if ptr is NULL
void process(Data* data) {
    int value = data->value; // CRASH if data is NULL
}

// Good
void process(Data* data) {
    if (data == NULL) {
        log_error("Received null data pointer");
        return;
    }
    int value = data->value;
}
```

```java
// Bad
public String getUpperName(User user) {
    return user.getName().toUpperCase(); // NullPointerException if getName() returns null
}

// Good
public String getUpperName(User user) {
    if (user == null || user.getName() == null) return "";
    return user.getName().toUpperCase();
}
// Or with Optional:
public String getUpperName(User user) {
    return Optional.ofNullable(user)
        .map(User::getName)
        .map(String::toUpperCase)
        .orElse("");
}
```

---

## Invalid Id = 9999
**Severity:** 🟠 Major  
**Languages:** All

Using a magic number (0, -1, 9999, 99999) as a sentinel for "no ID" or "invalid". Use null/None/Optional instead.

```java
// Bad
int userId = getUserId(); // returns -1 if not found
if (userId != -1) {
    fetchUser(userId);
}

// Bad — what does 9999 mean?
public static final int NO_USER_ID = 9999;

// Good
Optional<Integer> userId = getUserId();
userId.ifPresent(id -> fetchUser(id));
```

```python
# Bad
def get_product_id(name):
    product = db.find(name)
    if product is None:
        return -1  # magic sentinel
    return product.id

# Good
def get_product_id(name):
    product = db.find(name)
    return product.id if product else None
```

---

## Missing Interval
**Severity:** 🟡 Minor  
**Languages:** All

Off-by-one errors in range boundaries — not checking inclusive vs exclusive bounds correctly.

```python
# Bad — excludes the last day
def get_week_orders(start_date):
    end_date = start_date + timedelta(days=7)
    return Order.where(created_at__gte=start_date, created_at__lt=end_date)
    # Missing orders created at exactly end_date midnight

# Good — be explicit about inclusive/exclusive
def get_week_orders(start_date):
    end_date = start_date + timedelta(days=7)
    return Order.where(
        created_at__gte=start_date,
        created_at__lt=end_date  # exclusive end — document this!
    )
```

---

---

# Data & Type Code Smells

## Constants and Magic Numbers
**Severity:** 🟠 Major  
**Languages:** All

Raw numbers in code with no explanation of what they mean.

```python
# Bad
def calculate_overtime(hours):
    if hours > 40:
        return (hours - 40) * 1.5
    return hours

# Good
STANDARD_WORK_WEEK_HOURS = 40
OVERTIME_MULTIPLIER = 1.5

def calculate_overtime(hours):
    if hours > STANDARD_WORK_WEEK_HOURS:
        return (hours - STANDARD_WORK_WEEK_HOURS) * OVERTIME_MULTIPLIER
    return hours
```

---

## Extract Constant
**Severity:** 🟡 Minor  
**Languages:** All

Repeated literal values that should be named constants.

```javascript
// Bad
if (retries > 3) throw new Error("Too many retries");
await delay(3000);
const API_URL = 'https://api.example.com/v2'; // inline in 12 places

// Good
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const API_BASE_URL = 'https://api.example.com/v2';
```

---

## Convert Variables to Constant
**Severity:** 🟡 Minor  
**Languages:** All

Variables that are assigned once and never changed should be constants.

```javascript
// Bad
let maxFileSize = 10 * 1024 * 1024; // never reassigned
let apiVersion = 'v2';              // never reassigned

// Good
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const API_VERSION = 'v2';
```

---

## Mutable Constants
**Severity:** 🔴 Critical  
**Languages:** All

Things declared as constants but their contents can be mutated.

```javascript
// Bad — the array reference is const but the array is mutable
const ALLOWED_ROLES = ['admin', 'user', 'moderator'];
ALLOWED_ROLES.push('hacker'); // silently succeeds!

// Good
const ALLOWED_ROLES = Object.freeze(['admin', 'user', 'moderator']);
```

```java
// Bad
public static final List<String> ALLOWED = new ArrayList<>(Arrays.asList("admin", "user"));
ALLOWED.add("hacker"); // compiles and runs!

// Good
public static final List<String> ALLOWED = Collections.unmodifiableList(Arrays.asList("admin", "user"));
```

---

## Magic Concatenation
**Severity:** 🟡 Minor  
**Languages:** All

Building strings by concatenation when a template or format string is clearer.

```java
// Bad
String message = "Hello, " + firstName + " " + lastName + "! Your order #" + orderId + " is ready.";

// Good
String message = String.format("Hello, %s %s! Your order #%d is ready.", firstName, lastName, orderId);
// Or in Java 15+:
String message = "Hello, %s %s! Your order #%d is ready.".formatted(firstName, lastName, orderId);
```

---

## Hardcoded Business Conditions
**Severity:** 🟠 Major  
**Languages:** All

Business rules baked into code that will inevitably change — they should be in config or database.

```python
# Bad
def apply_discount(order):
    if order.total > 100:  # what if threshold changes?
        order.total *= 0.9
    if order.customer.country == "US":  # what about Canada?
        apply_sales_tax(order)

# Good — externalize business rules
def apply_discount(order, config):
    if order.total > config.discount_threshold:
        order.total *= (1 - config.discount_rate)

def apply_regional_tax(order, tax_config):
    rate = tax_config.get_rate(order.customer.country)
    if rate:
        order.total *= (1 + rate)
```

---

## Yoda Conditions
**Severity:** 🔵 Style  
**Languages:** All (except C/C++ where they prevent = vs == bugs)

Putting the constant on the left side of comparisons. Unnatural to read.

```java
// Bad — "if 5 equals x" — Yoda speaks
if (5 == x) { }
if (null == user) { }
if ("active".equals(status)) { } // this one is actually OK in Java — null safety

// Good
if (x == 5) { }
if (user == null) { }
```

---

## Automatic Properties
**Severity:** 🟡 Minor  
**Languages:** C#, Python (properties)

Auto-properties that do nothing but expose a field — only useful if you'll add logic later.

```csharp
// Bad — pointless auto-property for internal use
class Order {
    private string _id { get; set; } // why a property? just use a field
}

// Good
class Order {
    private string _id; // simple field
    public string Id => _id; // public read-only property makes sense
}
```

---

## Switch to Enum
**Severity:** 🟡 Minor  
**Languages:** All

String or int constants used where an enum would provide type safety and exhaustiveness checking.

```java
// Bad
String status = "PENDING";
if (status.equals("PENDING")) { }
if (status.equals("ACTIVE")) { }
// Typo "PNDING" compiles fine!

// Good
enum OrderStatus { PENDING, ACTIVE, COMPLETED, CANCELLED }
OrderStatus status = OrderStatus.PENDING;
switch (status) {
    case PENDING: break;
    case ACTIVE: break;
    // Compiler warns if you miss a case!
}
```

---

## Comparison Against
**Severity:** 🟡 Minor  
**Languages:** All

Comparing a boolean to `true` or `false` explicitly.

```java
// Bad
if (user.isActive() == true) { }
if (list.isEmpty() == false) { }

// Good
if (user.isActive()) { }
if (!list.isEmpty()) { }
```

---

## Variable Declared with var
**Severity:** 🟡 Minor  
**Languages:** JavaScript

Using `var` in modern JavaScript — function-scoped, hoisted, and a source of bugs. Use `let`/`const`.

```javascript
// Bad
var count = 0;
for (var i = 0; i < 10; i++) {
    var doubled = i * 2; // hoisted to function scope!
}
console.log(i); // 10 — leaked!
console.log(doubled); // 18 — leaked!

// Good
let count = 0;
for (let i = 0; i < 10; i++) {
    const doubled = i * 2;
}
// console.log(i) — ReferenceError, as expected
```

---

## Variables Reassignment
**Severity:** 🟡 Minor  
**Languages:** All

Variables that are reassigned frequently when intermediate values should be named instead.

```python
# Bad — "result" changes meaning 4 times
result = fetch_data()
result = parse(result)
result = validate(result)
result = transform(result)
return result

# Good — each step is named
raw_data = fetch_data()
parsed = parse(raw_data)
validated = validate(parsed)
transformed = transform(validated)
return transformed
```

---

## Expiration Date
**Severity:** 🟠 Major  
**Languages:** All

Hardcoded dates or time-based conditions baked into the code.

```java
// Bad — code that silently stops working
public boolean isFeatureEnabled() {
    return LocalDate.now().isBefore(LocalDate.of(2024, 12, 31)); // already expired!
}

// Good — externalize to config
public boolean isFeatureEnabled() {
    return featureToggleService.isEnabled("new-checkout");
}
```

---

## New Date()
**Severity:** 🟠 Major  
**Languages:** JS/TS, Java, C#

Calling `new Date()` / `DateTime.Now` / `LocalDate.now()` directly in business logic makes it untestable.

```javascript
// Bad — untestable
class Session {
    isExpired() {
        return (new Date() - this.createdAt) > SESSION_TIMEOUT;
    }
}

// Good — inject clock
class Session {
    constructor(createdAt, clock = Date) {
        this.createdAt = createdAt;
        this.clock = clock;
    }
    isExpired() {
        return (this.clock.now() - this.createdAt) > SESSION_TIMEOUT;
    }
}
```

---

## DirName and File
**Severity:** 🟡 Minor  
**Languages:** Node.js, Python

Using `__dirname`, `__file__` for path construction in ways that break when files move.

```javascript
// Bad — fragile path construction
const template = fs.readFileSync(__dirname + '/../templates/email.html');

// Good — use path.join
const path = require('path');
const template = fs.readFileSync(path.join(__dirname, '..', 'templates', 'email.html'));
```

---

## Address Implementation
**Severity:** 🟡 Minor  
**Languages:** C/C++

Relying on specific memory addresses or pointer arithmetic that is platform-dependent.

```c
// Bad — platform-specific, undefined behavior
int arr[5] = {1, 2, 3, 4, 5};
int *p = arr + 6; // out of bounds — undefined behavior
int val = *(arr - 1); // before array — undefined behavior

// Good — use indices and bounds checks
int arr[5] = {1, 2, 3, 4, 5};
for (int i = 0; i < 5; i++) {
    process(arr[i]);
}
```

---

## Stringly Typed
**Severity:** 🟠 Major  
**Languages:** All

Using strings to represent values that should be enums, types, or structured objects. A variant of Primitive Obsession — strings have no type safety, no validation, and swallow typos silently.

```java
// Bad — strings for everything, typos compile fine
void setUserRole(String role) { ... }      // "admin"? "ADMIN"? "Admin"?
void setOrderStatus(String status) { ... } // "pending"? "PENDING"? "Pending"?

// Bad call site — which string goes where?
createUser("alice@example.com", "Alice", "admin");

// Good — enums provide safety and discoverability
enum Role { ADMIN, USER, MODERATOR }
enum OrderStatus { PENDING, ACTIVE, COMPLETED }

void setUserRole(Role role) { ... }
void setOrderStatus(OrderStatus status) { ... }
```

```python
# Bad
def move(direction: str):  # "up"? "UP"? "u"? easy to typo silently
    if direction == "up": ...

# Good
from enum import Enum

class Direction(Enum):
    UP = "up"
    DOWN = "down"
    LEFT = "left"
    RIGHT = "right"

def move(direction: Direction):
    match direction:
        case Direction.UP: ...
```

```typescript
// Bad
function setTheme(theme: string) { } // "dark"? "Dark"? "DARK"?

// Good
type Theme = 'light' | 'dark' | 'system'; // union type
function setTheme(theme: Theme) { }
```
