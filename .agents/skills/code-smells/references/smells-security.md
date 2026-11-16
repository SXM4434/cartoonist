# Security Code Smells

## Hardcoded Credentials
**Severity:** 🔴 Critical  
**Languages:** All

API keys, passwords, tokens baked into source code — committed to git forever.

```python
# Bad
DB_PASSWORD = "supersecret123"
API_KEY = "sk-1234567890abcdef"

# Good
import os
DB_PASSWORD = os.environ.get("DB_PASSWORD")
API_KEY = os.environ.get("API_KEY")
```

```java
// Bad
private static final String API_KEY = "Bearer eyJhbG...";

// Good
private static final String API_KEY = System.getenv("API_KEY");
```

---

## Sensitive Data in Logs
**Severity:** 🔴 Critical  
**Languages:** All

Logging passwords, tokens, PII, or financial data.

```java
// Bad
log.info("Login attempt: user={}, password={}", username, password);
log.debug("Payment: card={}, cvv={}", cardNumber, cvv);

// Good
log.info("Login attempt: user={}", username);
log.debug("Payment initiated for user {}", userId);
```

---

## Insecure Random
**Severity:** 🟠 Major  
**Languages:** All

Using non-cryptographic random number generators for security-sensitive values.

```python
# Bad — predictable!
import random
token = str(random.randint(100000, 999999))
session_id = random.random()

# Good
import secrets
token = secrets.token_urlsafe(32)
otp = secrets.randbelow(1000000)
```

```java
// Bad
Random rand = new Random();
String token = String.valueOf(rand.nextLong());

// Good
SecureRandom rand = new SecureRandom();
byte[] token = new byte[32];
rand.nextBytes(token);
```

---

## Open Redirect
**Severity:** 🟠 Major  
**Languages:** Web (JS, Python, Java, etc.)

Redirecting to user-supplied URLs without validation.

```python
# Bad
@app.route('/login')
def login():
    next_url = request.args.get('next', '/')
    return redirect(next_url) # attacker passes https://evil.com!

# Good
from urllib.parse import urlparse, urljoin

def is_safe_url(url):
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, url))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc

@app.route('/login')
def login():
    next_url = request.args.get('next', '/')
    if not is_safe_url(next_url):
        next_url = '/'
    return redirect(next_url)
```

---

## Disabled Security Headers
**Severity:** 🟠 Major  
**Languages:** Web

Missing or disabled Content-Security-Policy, CORS, HSTS headers.

```javascript
// Bad — CORS wide open
app.use(cors()); // allows all origins!

// Good
app.use(cors({
    origin: ['https://app.example.com', 'https://admin.example.com'],
    methods: ['GET', 'POST'],
    credentials: true
}));
```

---

# Concurrency & State Code Smells

## Race Condition
**Severity:** 🔴 Critical  
**Languages:** C, C++, Java, Go, Rust (prevented by compiler), Python

Shared mutable state accessed from multiple threads without synchronization.

```java
// Bad — not thread-safe
class Counter {
    private int count = 0;
    public void increment() { count++; } // read-modify-write: not atomic!
    public int get() { return count; }
}

// Good
class Counter {
    private final AtomicInteger count = new AtomicInteger(0);
    public void increment() { count.incrementAndGet(); }
    public int get() { return count.get(); }
}
```

```go
// Bad
var counter int
func increment() {
    counter++ // race condition with multiple goroutines!
}

// Good
var mu sync.Mutex
var counter int
func increment() {
    mu.Lock()
    defer mu.Unlock()
    counter++
}
```

---

## New Date() in Business Logic
**Severity:** 🟠 Major  

See smells-error-handling.md — inject time rather than calling `new Date()` / `datetime.now()` directly.

---

## Global State
**Severity:** 🟠 Major  
**Languages:** All

Mutable global variables that are shared implicitly across the codebase.

```python
# Bad
_current_user = None  # global mutable state
_request_context = {}

def get_user():
    return _current_user

def set_user(user):
    global _current_user
    _current_user = user  # mutates global state!

# Good — use dependency injection or request-scoped context
class RequestContext:
    def __init__(self, user):
        self.user = user

def process_request(context: RequestContext):
    user = context.user
```

---

## Premature Memoization of Stateful Functions
**Severity:** 🟠 Major  
**Languages:** All

Caching the results of a function that has side effects or depends on changing state.

```python
# Bad — caches stale DB results
from functools import lru_cache

@lru_cache(maxsize=None)
def get_user(user_id):
    return db.query(user_id) # caches first result forever!

# Good — cache only pure, stable computations
@lru_cache(maxsize=128)
def compute_fibonacci(n):
    if n < 2: return n
    return compute_fibonacci(n-1) + compute_fibonacci(n-2)
```

---

## Shared Mutable State Between Tests
**Severity:** 🟠 Major  
**Languages:** All

Test state that leaks between test cases.

```python
# Bad — class variable mutated by tests
class TestCart:
    cart = Cart()  # shared between ALL tests!

    def test_add_item(self):
        self.cart.add(item1)
        assert len(self.cart.items) == 1

    def test_add_two_items(self):
        self.cart.add(item2)
        assert len(self.cart.items) == 1  # FAILS: cart has item from previous test!

# Good — fresh state per test
class TestCart:
    def setup_method(self):
        self.cart = Cart()  # fresh for each test

    def test_add_item(self):
        self.cart.add(item1)
        assert len(self.cart.items) == 1
```
