# Testing Code Smells

## Tests Depending on Dates
**Severity:** 🟠 Major  
**Languages:** All

Tests that use `new Date()`, `datetime.now()`, or real timestamps — they fail randomly as time passes.

```javascript
// Bad
test('session should be expired', () => {
    const session = new Session(new Date('2020-01-01')); // hardcoded past date
    expect(session.isExpired()).toBe(true);
    // This always passes, but if logic changes, no test tells you
});

test('session created now is valid', () => {
    const session = new Session(new Date()); // depends on real time!
    expect(session.isExpired()).toBe(false);
});

// Good — inject or mock the clock
test('session expires after 24 hours', () => {
    const clock = new FakeClock('2024-01-01T12:00:00Z');
    const session = new Session(clock.now(), clock);
    clock.advance({ hours: 25 });
    expect(session.isExpired()).toBe(true);
});
```

```python
# Bad
from datetime import datetime

def test_is_recent():
    obj = MyObject(created_at=datetime.now())
    assert obj.is_recent()  # will fail after a few seconds!

# Good — use freezegun or inject time
from freezegun import freeze_time

@freeze_time("2024-01-01")
def test_is_recent():
    obj = MyObject(created_at=datetime(2024, 1, 1, 12, 0))
    assert obj.is_recent()
```

---

## Irrelevant Test Information
**Severity:** 🟡 Minor  
**Languages:** All

Test setup containing fields and data that are irrelevant to what's being tested, obscuring the signal.

```java
// Bad — what matters here? Too much noise
@Test
void shouldApplyDiscount() {
    User user = new User(
        "John", "Doe", "john@example.com",
        "123 Main St", "New York", "NY", "10001",
        "+1-555-555-5555", LocalDate.of(1990, 5, 15),
        "GOLD",  // <-- this is the only thing that matters
        true, false, 42
    );
    assertEquals(0.2, discountService.getRate(user));
}

// Good — only set what the test cares about
@Test
void goldMemberShouldGetTwentyPercentDiscount() {
    User user = UserBuilder.aUser().withMembership("GOLD").build();
    assertEquals(0.2, discountService.getRate(user));
}
```

---

## Float Assertions
**Severity:** 🟠 Major  
**Languages:** All

Asserting exact equality of floating point numbers — will fail due to floating point imprecision.

```python
# Bad
def test_tax():
    assert calculate_tax(10.0) == 0.8  # May fail: 0.7999999999999999

# Good
def test_tax():
    assert abs(calculate_tax(10.0) - 0.8) < 0.0001
    # or with pytest:
    assert calculate_tax(10.0) == pytest.approx(0.8)
```

```java
// Bad
@Test
void testTax() {
    assertEquals(0.8, calculateTax(10.0)); // floating point!
}

// Good
@Test
void testTax() {
    assertEquals(0.8, calculateTax(10.0), 0.0001); // delta
}
```

---

## Testing Private Methods
**Severity:** 🟡 Minor  
**Languages:** All

Testing private methods directly — they're an implementation detail. Test through the public interface.

```java
// Bad — using reflection to test private methods
@Test
void testPrivateValidation() throws Exception {
    Method method = UserService.class.getDeclaredMethod("validateEmail", String.class);
    method.setAccessible(true);
    boolean result = (boolean) method.invoke(userService, "bad-email");
    assertFalse(result);
}

// Good — test through the public interface
@Test
void createUserShouldFailWithInvalidEmail() {
    assertThrows(InvalidEmailException.class, 
        () -> userService.createUser("John", "bad-email"));
}
```

---

## Assert True
**Severity:** 🟡 Minor  
**Languages:** All

Using `assertTrue(a == b)` instead of `assertEquals(a, b)` — test failures give no useful information.

```java
// Bad — failure message: "expected true but was false"
assertTrue(user.getName().equals("Alice"));
assertTrue(list.size() == 3);

// Good — failure message: "expected 'Alice' but was 'Bob'"
assertEquals("Alice", user.getName());
assertEquals(3, list.size());
```

```python
# Bad
assert user.name == "Alice"  # bare assert in pytest (ok in production)
self.assertTrue(user.is_active)  # unittest with no message

# Good
self.assertEqual("Alice", user.name)
self.assertTrue(user.is_active, "Expected user to be active after activation")
```

---

## Missing Test Wrong Path
**Severity:** 🟠 Major  
**Languages:** All

Only testing the happy path — no tests for invalid inputs, edge cases, or error conditions.

```python
# Bad — only tests success
def test_divide():
    assert divide(10, 2) == 5

# Good — tests all paths
def test_divide_normal():
    assert divide(10, 2) == 5

def test_divide_by_zero():
    with pytest.raises(ZeroDivisionError):
        divide(10, 0)

def test_divide_negative():
    assert divide(-10, 2) == -5

def test_divide_with_floats():
    assert divide(10, 3) == pytest.approx(3.333, rel=1e-3)
```

---

## Test Assert Without Description
**Severity:** 🔵 Style  
**Languages:** All

Assertions with no message — when they fail, you don't know why.

```java
// Bad
assertTrue(result.isValid());
assertEquals(3, items.size());

// Good
assertTrue("Order should be valid after applying discount", result.isValid());
assertEquals("Cart should have 3 items after adding to empty cart", 3, items.size());
```

```python
# Bad
assert user.is_active

# Good
assert user.is_active, f"Expected user {user.id} to be active after creation"
```

---

## Test Violating Encapsulation
**Severity:** 🟡 Minor  
**Languages:** All

Tests that reach into private state to verify results instead of going through the public interface.

```java
// Bad — accessing private field via reflection or package-private access
@Test
void testUserActivation() {
    user.activate();
    assertEquals("ACTIVE", user.status); // accessing private field!
}

// Good — test behaviour, not internals
@Test
void testUserActivation() {
    user.activate();
    assertTrue(user.isActive()); // use the public method
    assertTrue(user.canLogin());
}
```

---

## Changes Without Coverage
**Severity:** 🟠 Major  
**Languages:** All

Modifying or adding code without adding or updating tests. The riskiest kind of change.

*Detection:* Check git diff against coverage reports. Any new function with 0% coverage is a smell.

```python
# Bad — new business rule, no test
def apply_coupon(order, coupon):
    if coupon.is_stackable:
        order.total -= coupon.value  # new logic, no test!
    elif not order.has_discount:
        order.total -= coupon.value

# Good — new logic comes with tests
def test_stackable_coupon_always_applies():
    order = Order(total=100, has_discount=True)
    coupon = Coupon(value=10, is_stackable=True)
    apply_coupon(order, coupon)
    assert order.total == 90

def test_non_stackable_coupon_ignored_if_already_discounted():
    order = Order(total=100, has_discount=True)
    coupon = Coupon(value=10, is_stackable=False)
    apply_coupon(order, coupon)
    assert order.total == 100
```

---

## Known Bugs
**Severity:** 🔴 Critical  
**Languages:** All

`// TODO: fix this` or `// HACK:` comments that have been there for months. Tracked bugs that nobody owns.

```java
// Bad — it's been "temporary" for 3 years
// TODO: this crashes when order is null, fix later
if (order != null) {
    processOrder(order);
}
// HACK: workaround for issue #1234 — never fixed

// Good — fix it or create a tracked ticket with an owner
processOrder(Objects.requireNonNull(order, "Order must not be null"));
```

---

## Production Dependent Code
**Severity:** 🔴 Critical  
**Languages:** All

Tests or code paths that only work (or behave differently) in production environments.

```python
# Bad
import os

def send_notification(user, message):
    if os.getenv("ENV") == "production":
        real_email_service.send(user.email, message)
    else:
        print(f"Would send: {message}")  # silently skips in dev/test!

# Good — inject the dependency
def send_notification(user, message, email_service):
    email_service.send(user.email, message)

# Tests use a mock, production passes the real service
```

---

## Implementative Callback Events
**Severity:** 🟡 Minor  
**Languages:** JS/TS, Java, C#

Tests that rely on specific callback execution order or implementation details of async behavior, making tests brittle.

```javascript
// Bad — relies on implementation detail of callback order
test('should process in order', (done) => {
    let results = [];
    processItems([1, 2, 3], (item) => {
        results.push(item);
        if (results.length === 3) {
            expect(results).toEqual([1, 2, 3]); // assumes execution order!
            done();
        }
    });
});

// Good — test the outcome, not execution order
test('should process all items', async () => {
    const results = await processItems([1, 2, 3]);
    expect(results).toHaveLength(3);
    expect(new Set(results)).toEqual(new Set([1, 2, 3]));
});
```

---

## Over-Mocking
**Severity:** 🟡 Minor  
**Languages:** All

Tests that mock so much they don't actually test anything real. The mock *becomes* the test — you're just verifying that your mock returns what you told it to return.

```java
// Bad — what are we even testing?
@Test
void testGetUserName() {
    UserRepository mockRepo = mock(UserRepository.class);
    UserService mockService = mock(UserService.class);
    when(mockService.getUser(1)).thenReturn(new User("Alice"));
    when(mockRepo.find(1)).thenReturn(new User("Alice"));

    String name = mockService.getUser(1).getName(); // just calling the mock!
    assertEquals("Alice", name); // this tests nothing real
}

// Good — mock only external boundaries (DB, HTTP), test real logic
@Test
void testGetUserName() {
    UserRepository repo = new InMemoryUserRepository();
    repo.save(new User(1, "Alice"));
    UserService service = new UserService(repo);

    assertEquals("Alice", service.getUser(1).getName());
}
```

```python
# Bad — mocking everything including the thing being tested
def test_calculate_discount():
    mock_order = Mock()
    mock_order.total = 100
    mock_discount_service = Mock()
    mock_discount_service.calculate.return_value = 10
    # We mocked the calculation — we're testing Mock, not our code!
    assert mock_discount_service.calculate(mock_order) == 10

# Good — use real objects, mock only I/O
def test_calculate_discount():
    order = Order(total=100, customer=Customer(tier="GOLD"))
    discount = calculate_discount(order)
    assert discount == 20.0
```

---

## Test Without Assertion
**Severity:** 🟠 Major  
**Languages:** All

A test that runs code but never asserts anything — it passes vacuously regardless of what the code does.

```python
# Bad — passes even if process() raises no exception but returns wrong result
def test_process_order():
    order = Order(items=[item1, item2])
    result = process_order(order)
    # no assertion! always passes

# Good
def test_process_order():
    order = Order(items=[item1, item2])
    result = process_order(order)
    assert result.status == "completed"
    assert result.total == 29.99
    assert len(result.items) == 2
```

```java
// Bad — test passes even if method throws or returns wrong value
@Test
void testCreateUser() {
    userService.createUser("Alice", "alice@example.com");
    // no assertion!
}

// Good
@Test
void testCreateUser() {
    User created = userService.createUser("Alice", "alice@example.com");
    assertNotNull(created.getId());
    assertEquals("Alice", created.getName());
    assertTrue(created.isActive());
}
```

---

## Environment Assumptions
**Severity:** 🟠 Major  
**Languages:** All

Code that silently assumes a specific OS, filesystem, timezone, locale, or file encoding — works on one machine, fails on another.

```java
// Bad — assumes Unix path separator
String path = "data" + "/" + "config.json"; // breaks on Windows

// Bad — assumes system timezone
LocalDateTime.now() // timezone varies by server!

// Bad — assumes default charset
new FileReader("data.csv") // assumes platform default encoding

// Good
Path path = Paths.get("data", "config.json"); // OS-independent
LocalDateTime.now(ZoneId.of("UTC")); // explicit timezone
new FileReader("data.csv", StandardCharsets.UTF_8); // explicit encoding
```

```python
# Bad — assumes Unix paths
config_path = "config/settings.json"
with open(config_path) as f:  # breaks on Windows with backslash paths
    pass

# Bad — assumes UTC or local timezone
from datetime import datetime
now = datetime.now()  # no timezone info!

# Good
from pathlib import Path
from datetime import datetime, timezone

config_path = Path("config") / "settings.json"  # OS-independent
now = datetime.now(timezone.utc)  # explicit UTC
```

```javascript
// Bad — assumes en-US locale for date formatting
const formatted = new Date().toLocaleDateString(); // differs by system locale!

// Good — always specify locale and timezone
const formatted = new Date().toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit'
});
```
