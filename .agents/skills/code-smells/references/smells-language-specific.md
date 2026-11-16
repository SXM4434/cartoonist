# Language-Specific Code Smells

---

## JavaScript & TypeScript

### Variable Declared with var
See smells-error-handling.md. Always use `const` or `let`.

### Anonymous Functions Abusers
See smells-functional.md. Name your lambdas.

### Callback Hell (Arrow Code variant)
```javascript
// Bad
getUser(id, function(err, user) {
    getOrders(user, function(err, orders) {
        getItems(orders[0], function(err, items) {
            processItems(items, function(err, result) {
                // ...
            });
        });
    });
});

// Good — async/await
async function processUserOrders(id) {
    const user = await getUser(id);
    const orders = await getOrders(user);
    const items = await getItems(orders[0]);
    return processItems(items);
}
```

### Implicit any in TypeScript
**Severity:** 🟠 Major

```typescript
// Bad — defeats the purpose of TypeScript
function process(data: any) {
    return data.value + data.other; // no type safety!
}

// Good
interface ProcessInput {
    value: number;
    other: number;
}
function process(data: ProcessInput): number {
    return data.value + data.other;
}
```

### Using == Instead of ===
**Severity:** 🟠 Major

```javascript
// Bad — type coercion surprises
0 == false   // true!
"" == false  // true!
null == undefined // true!

// Good
0 === false  // false
```

### Mutating Function Arguments
**Severity:** 🟠 Major

```javascript
// Bad
function addItem(cart, item) {
    cart.items.push(item); // mutates caller's object!
    return cart;
}

// Good
function addItem(cart, item) {
    return { ...cart, items: [...cart.items, item] };
}
```

### Promise Not Awaited
**Severity:** 🔴 Critical

```javascript
// Bad — promise result ignored, errors swallowed
async function deleteUser(id) {
    db.delete(id); // not awaited! failure is silent
    return { success: true };
}

// Good
async function deleteUser(id) {
    await db.delete(id);
    return { success: true };
}
```

### Floating Point Currency
**Severity:** 🔴 Critical

```javascript
// Bad
const total = 0.1 + 0.2; // 0.30000000000000004!

// Good — use integer cents or a decimal library
const total = (10 + 20) / 100; // work in cents
// or use: decimal.js, big.js
```

---

## Python

### Mutable Default Arguments
**Severity:** 🔴 Critical

```python
# Bad — the list is shared across all calls!
def add_item(item, items=[]):
    items.append(item)
    return items

add_item(1)  # [1]
add_item(2)  # [1, 2] — not [2]!

# Good
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

### Using except Without Specifying Exception
**Severity:** 🟠 Major

```python
# Bad — catches KeyboardInterrupt, SystemExit, everything!
try:
    do_something()
except:
    pass

# Good
try:
    do_something()
except (ValueError, TypeError) as e:
    logger.error("Processing failed: %s", e)
```

### Not Using Context Managers
**Severity:** 🟠 Major

```python
# Bad — file not closed on exception
f = open('data.txt')
data = f.read()
f.close()

# Good
with open('data.txt') as f:
    data = f.read()
```

### String Formatting — Old Style
**Severity:** 🔵 Style

```python
# Bad — %-formatting (ancient)
msg = "Hello, %s! You have %d messages." % (name, count)

# Better — str.format()
msg = "Hello, {}! You have {} messages.".format(name, count)

# Best — f-strings (Python 3.6+)
msg = f"Hello, {name}! You have {count} messages."
```

### Checking Type with ==
**Severity:** 🟡 Minor

```python
# Bad
if type(x) == int:
    pass

# Good
if isinstance(x, int):
    pass  # also works for subclasses
```

---

## Go

### Ignoring Errors
**Severity:** 🔴 Critical

```go
// Bad — error silently discarded
result, _ := json.Marshal(data)
file, _ := os.Open("config.json")

// Good
result, err := json.Marshal(data)
if err != nil {
    return fmt.Errorf("marshaling failed: %w", err)
}
```

### Naked Returns
**Severity:** 🟡 Minor

```go
// Bad — what are x, y, z?
func getCoords() (x, y, z float64) {
    x = 1.0
    y = 2.0
    z = 3.0
    return // naked return
}

// Good
func getCoords() (float64, float64, float64) {
    return 1.0, 2.0, 3.0
}
```

### init() Overuse
**Severity:** 🟡 Minor

```go
// Bad — init() with side effects makes code hard to test
func init() {
    db = connectToDatabase() // side effect in init!
    config = loadConfig()
}

// Good — explicit initialization
func NewApp() (*App, error) {
    db, err := connectToDatabase()
    if err != nil {
        return nil, err
    }
    return &App{db: db}, nil
}
```

### Using panic for Normal Errors
**Severity:** 🟠 Major

```go
// Bad
func parseConfig(path string) Config {
    data, err := os.ReadFile(path)
    if err != nil {
        panic(err) // crashes the whole program!
    }
    // ...
}

// Good
func parseConfig(path string) (Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return Config{}, fmt.Errorf("reading config: %w", err)
    }
    // ...
}
```

---

## Rust

### .unwrap() in Production Code
**Severity:** 🔴 Critical

```rust
// Bad — panics if None or Err
let user = find_user(id).unwrap();
let config = load_config().unwrap();

// Good
let user = find_user(id).ok_or(AppError::UserNotFound)?;
let config = load_config().map_err(AppError::ConfigError)?;
```

### Cloning When Borrowing Suffices
**Severity:** 🟡 Minor

```rust
// Bad — unnecessary clone
fn print_name(user: User) {
    println!("{}", user.name.clone()); // .clone() unnecessary
}

// Good
fn print_name(user: &User) {
    println!("{}", user.name); // borrow it
}
```

### Using String When &str Suffices
**Severity:** 🟡 Minor

```rust
// Bad — takes ownership unnecessarily
fn greet(name: String) {
    println!("Hello, {}!", name);
}

// Good
fn greet(name: &str) {
    println!("Hello, {}!", name);
}
```

---

## C / C++

### Buffer Without Bounds Check
**Severity:** 🔴 Critical

```c
// Bad — classic buffer overflow
char buf[10];
gets(buf); // no bounds check — security vulnerability

// Good
char buf[10];
fgets(buf, sizeof(buf), stdin);
```

### strcpy / sprintf / gets
**Severity:** 🔴 Critical

```c
// Bad — unsafe string functions
strcpy(dest, src);   // no length check
sprintf(buf, fmt, ...); // potential overflow

// Good
strncpy(dest, src, sizeof(dest) - 1);
snprintf(buf, sizeof(buf), fmt, ...);
```

### Raw Pointer Owning Memory (C++)
**Severity:** 🟠 Major

```cpp
// Bad — manual memory management
void process() {
    MyClass* obj = new MyClass();
    obj->doWork(); // if this throws, memory leaks!
    delete obj;
}

// Good — RAII with smart pointers
void process() {
    auto obj = std::make_unique<MyClass>();
    obj->doWork(); // exception-safe
} // automatically deleted
```

---

## C#

### Not Disposing IDisposable
**Severity:** 🔴 Critical

```csharp
// Bad — connection never closed
SqlConnection conn = new SqlConnection(connStr);
conn.Open();
// ... if exception thrown here, conn leaks!

// Good
using (var conn = new SqlConnection(connStr))
{
    conn.Open();
    // automatically disposed
}

// Or C# 8+:
using var conn = new SqlConnection(connStr);
```

### Async Void
**Severity:** 🔴 Critical

```csharp
// Bad — exceptions are unobservable, can't be awaited
async void LoadData() {
    var data = await FetchAsync();
    // if this throws, the exception is lost!
}

// Good
async Task LoadData() {
    var data = await FetchAsync();
}
```

### String Concatenation in Loops
**Severity:** 🟠 Major

```csharp
// Bad — creates N intermediate string objects
string result = "";
foreach (var item in items) {
    result += item.Name + ", "; // O(n²) allocations
}

// Good
var sb = new StringBuilder();
foreach (var item in items) {
    sb.Append(item.Name).Append(", ");
}
string result = sb.ToString();
```

---

## Java

### Catching Exception or Throwable
**Severity:** 🟠 Major

```java
// Bad — catches OutOfMemoryError, ThreadDeath...
try {
    process();
} catch (Throwable t) {
    log.error("Error", t);
}

// Good
try {
    process();
} catch (IOException | SQLException e) {
    log.error("Processing failed", e);
    throw new ProcessingException(e);
}
```

### Returning Null from Collection Methods
**Severity:** 🟠 Major

```java
// Bad — callers must null-check
public List<Order> getOrders(long userId) {
    if (!hasOrders(userId)) return null;
    return fetchOrders(userId);
}

// Good
public List<Order> getOrders(long userId) {
    if (!hasOrders(userId)) return Collections.emptyList();
    return fetchOrders(userId);
}
```

### String Comparison with ==
**Severity:** 🔴 Critical

```java
// Bad — compares references, not values
String status = getStatus();
if (status == "ACTIVE") { // almost always false!
    ...
}

// Good
if ("ACTIVE".equals(status)) { // null-safe
    ...
}
```

### Non-Final Static Fields
**Severity:** 🟠 Major

```java
// Bad — global mutable state
public static int requestCount = 0;

// Good — at minimum, make it final; better: encapsulate it
private static final AtomicInteger requestCount = new AtomicInteger(0);
```
