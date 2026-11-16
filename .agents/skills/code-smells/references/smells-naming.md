# Naming & Linguistic Code Smells

## Abstract Names
**Severity:** 🟡 Minor  
**Languages:** All

Using vague, meaningless names that describe nothing about the variable's purpose.

```python
# Bad
def process(d):
    for i in d:
        x = i * 2
        lst.append(x)

# Good
def double_prices(products):
    for product in products:
        doubled_price = product.price * 2
        doubled_prices.append(doubled_price)
```

```java
// Bad
Object obj = getObj();
String s = obj.getData();

// Good
Invoice invoice = fetchLatestInvoice();
String customerName = invoice.getCustomerName();
```

---

## Class Name in Attributes
**Severity:** 🔵 Style  
**Languages:** All OOP languages

Repeating the class name inside an attribute name — it's already implied by the class context.

```java
// Bad
class Customer {
    String customerName;
    int customerId;
    String customerEmail;
}

// Good
class Customer {
    String name;
    int id;
    String email;
}
```

```python
# Bad
class Order:
    def __init__(self):
        self.order_status = "pending"
        self.order_total = 0.0

# Good
class Order:
    def __init__(self):
        self.status = "pending"
        self.total = 0.0
```

---

## Data Naming
**Severity:** 🟡 Minor  
**Languages:** All

Using generic collection suffixes (data, info, manager, handler) that add no meaning.

```typescript
// Bad
const userData = fetchUserData();
const infoObject = processInfo(userData);

// Good
const user = fetchUser();
const subscription = processSubscription(user);
```

---

## UPPERCASE Acronyms
**Severity:** 🔵 Style  
**Languages:** All

Shouting acronyms in the middle of camelCase names makes them hard to read.

```java
// Bad
String getHTTPSURL();
void parseXMLResponse();
int getUserID();

// Good
String getHttpsUrl();
void parseXmlResponse();
int getUserId();
```

```csharp
// Bad
public string GetAPIKey() { }
public int ParseHTMLContent() { }

// Good
public string GetApiKey() { }
public int ParseHtmlContent() { }
```

---

## Rename Result Variables
**Severity:** 🔵 Style  
**Languages:** All

Variables named `result`, `res`, `ret`, `retval` tell you nothing about what they hold.

```go
// Bad
func calculateDiscount(price float64) float64 {
    result := price * 0.1
    return result
}

// Good
func calculateDiscount(price float64) float64 {
    discount := price * 0.1
    return discount
}
```

```rust
// Bad
fn find_user(id: u32) -> Option<User> {
    let result = db.query(id);
    result
}

// Good
fn find_user(id: u32) -> Option<User> {
    let found_user = db.query(id);
    found_user
}
```

---

## TheResult / Result
**Severity:** 🔵 Style  
**Languages:** All

`theResult` is even worse than `result` — the article adds nothing and is a classic smell.

```javascript
// Bad
function computeTotal(items) {
    let theResult = 0;
    for (const item of items) theResult += item.price;
    return theResult;
}

// Good
function computeTotal(items) {
    let total = 0;
    for (const item of items) total += item.price;
    return total;
}
```

---

## Redundant Parameter Name
**Severity:** 🔵 Style  
**Languages:** All

Repeating the parameter type or enclosing function name in the parameter name.

```csharp
// Bad
void SaveUser(User userToSave, string userNameString) { }

// Good
void SaveUser(User user, string name) { }
```

```python
# Bad
def send_email(email_address_string, email_subject_string, email_body_text):
    pass

# Good
def send_email(address, subject, body):
    pass
```

---

## Spelling Mistakes
**Severity:** 🔵 Style  
**Languages:** All

Typos in identifiers spread through codebases and are embarrassing in APIs.

```java
// Bad
public int caluclateTotla(List<Itme> itmes) { }
boolean isConnceted = false;

// Good
public int calculateTotal(List<Item> items) { }
boolean isConnected = false;
```

---

## Linguistic Confusion
**Severity:** 🟡 Minor  
**Languages:** All

Name implies one thing, code does another. Classic examples: `is*` functions that return non-booleans, `get*` functions with side effects, `set*` functions that return values.

```java
// Bad — getName() sends an HTTP request?!
public String getName() {
    return httpClient.fetch("/user/name"); // side effect!
}

// Bad — isValid() mutates state?!
public boolean isValid() {
    this.errors.clear(); // side effect!
    return validate();
}

// Good
public String fetchName() {
    return httpClient.fetch("/user/name");
}

public boolean isValid() {
    return validate();
}
```

```typescript
// Bad — "get" implies no side effects
function getUser(id: number): User {
    logAccess(id); // hidden side effect
    return db.find(id);
}

// Good
function findUser(id: number): User {
    logAccess(id);
    return db.find(id);
}
```

---

## Comedian Methods
**Severity:** 🟡 Minor  
**Languages:** All

Methods with jokey, sarcastic, or unprofessional names. These are great for a laugh once and an irritant forever.

```python
# Bad
def fix_the_stupid_bug():
    pass

def this_should_never_happen():
    pass

def i_have_no_idea_what_this_does():
    pass

# Good
def recalculate_tax_rounding():
    pass

def handle_unexpected_state():
    pass

def normalize_legacy_payload():
    pass
```

---

## First / Second
**Severity:** 🟡 Minor  
**Languages:** All

Using ordinals (first, second, third) instead of meaningful names for parameters or variables.

```java
// Bad
void merge(String first, String second) {
    return first + second;
}

// Good
void merge(String prefix, String suffix) {
    return prefix + suffix;
}
```

```javascript
// Bad
function compare(first, second) {
    return first > second;
}

// Good
function compare(candidate, benchmark) {
    return candidate > benchmark;
}
```

---

## Replace Comment with Function Name
**Severity:** 🟡 Minor  
**Languages:** All

If you need a comment to explain what a block does, that block should be a named function.

```python
# Bad
def process_order(order):
    # Check if the customer has enough balance
    if order.customer.balance >= order.total:
        order.customer.balance -= order.total
        order.status = "paid"

# Good
def process_order(order):
    if customer_can_afford(order):
        charge_customer(order)

def customer_can_afford(order):
    return order.customer.balance >= order.total

def charge_customer(order):
    order.customer.balance -= order.total
    order.status = "paid"
```

---

## Obsolete Comments
**Severity:** 🟡 Minor  
**Languages:** All

Comments that no longer match the code they describe — they actively mislead.

```java
// Bad
// Returns the user's age
public String getUserName() {
    return this.name;
}

// Multiply by tax rate 0.2
total = total * TAX_RATE; // TAX_RATE is now 0.15

// Good — keep comments accurate or delete them
public String getUserName() {
    return this.name;
}
total = total * TAX_RATE;
```

---

## Commented Code
**Severity:** 🟡 Minor  
**Languages:** All

Dead code left in comments. Use version control instead — that's what it's for.

```javascript
// Bad
function calculatePrice(item) {
    // Old algorithm — kept in case we need to revert
    // let price = item.basePrice * 1.2;
    // if (item.premium) price *= 1.1;
    // return price;

    return item.basePrice * item.multiplier;
}

// Good
function calculatePrice(item) {
    return item.basePrice * item.multiplier;
}
// (old algorithm lives in git history)
```

---

## Inconsistent Parameters Sorting
**Severity:** 🔵 Style  
**Languages:** All

Related functions with parameters in different orders creates cognitive friction.

```python
# Bad
def create_user(name, email, role):
    pass

def update_user(role, name, user_id, email):
    pass

def delete_user(user_id):
    pass

# Good — consistent: id first, then name/email/role
def create_user(name, email, role):
    pass

def update_user(user_id, name, email, role):
    pass

def delete_user(user_id):
    pass
```
