# OOP Code Smells

## God Objects
**Severity:** 🟠 Major  
**Languages:** All OOP

A class that knows too much or does too much. Usually has 1000+ lines and dozens of methods.

```java
// Bad — UserManager does everything
class UserManager {
    void createUser() {}
    void deleteUser() {}
    void sendEmail() {}
    void generateReport() {}
    void processPayment() {}
    void updateProfile() {}
    void resetPassword() {}
    void logActivity() {}
    // ... 40 more methods
}

// Good — Single Responsibility
class UserRepository { void create(); void delete(); }
class EmailService { void sendWelcome(); void sendReset(); }
class PaymentProcessor { void charge(); }
class UserReportService { void generate(); }
```

---

## Feature Envy
**Severity:** 🟡 Minor  
**Languages:** All OOP

A method that uses data from another class more than its own.

```python
# Bad — Order.total() is jealous of Customer's data
class Order:
    def calculate_discount(self):
        if self.customer.membership == "gold":
            if self.customer.years > 5:
                return self.total * 0.2
        return 0

# Good — put the method where the data lives
class Customer:
    def discount_rate(self):
        if self.membership == "gold" and self.years > 5:
            return 0.2
        return 0

class Order:
    def calculate_discount(self):
        return self.total * self.customer.discount_rate()
```

---

## Inappropriate Intimacy
**Severity:** 🟠 Major  
**Languages:** All OOP

Two classes that reach into each other's private parts too much — tight coupling.

```java
// Bad
class Printer {
    void print(Document doc) {
        // Reaching into Document internals
        String[] lines = doc.content.split("\n");
        int margin = doc.settings.leftMargin;
        boolean duplex = doc.printerSettings.duplex;
        // ...
    }
}

// Good
class Printer {
    void print(Document doc) {
        PrintJob job = doc.createPrintJob();
        submitJob(job);
    }
}
```

---

## Data Clumps
**Severity:** 🟡 Minor  
**Languages:** All OOP

Groups of data that always appear together should be their own class.

```csharp
// Bad — these three always travel together
void CreateOrder(string street, string city, string zipCode) {}
void ShipTo(string street, string city, string zipCode) {}
bool Validate(string street, string city, string zipCode) {}

// Good
class Address {
    string Street { get; }
    string City { get; }
    string ZipCode { get; }
}
void CreateOrder(Address shippingAddress) {}
void ShipTo(Address destination) {}
bool Validate(Address address) {}
```

---

## Protect Public Attributes
**Severity:** 🟠 Major  
**Languages:** All OOP

Public fields bypass encapsulation — anyone can modify internal state without validation.

```java
// Bad
class BankAccount {
    public double balance; // Anyone can set to -999999
    public String ownerId;
}

// Good
class BankAccount {
    private double balance;
    private String ownerId;

    public double getBalance() { return balance; }
    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Must be positive");
        this.balance += amount;
    }
}
```

---

## Remove Setters
**Severity:** 🟡 Minor  
**Languages:** All OOP

Setters for every field often just expose internals and invite inconsistent state. Prefer constructors, builders, or domain methods.

```java
// Bad — object can be left in invalid state
User user = new User();
user.setId(123);
user.setName("Alice");
user.setEmail("alice@example.com");
// What if someone forgets setEmail()?

// Good — all required fields via constructor
User user = new User(123, "Alice", "alice@example.com");

// Or builder pattern for complex objects
User user = User.builder()
    .id(123)
    .name("Alice")
    .email("alice@example.com")
    .build();
```

---

## Getters
**Severity:** 🟡 Minor  
**Languages:** All OOP

Exposing everything via getters is just public fields with extra steps. "Tell, don't ask."

```java
// Bad — asking for data then acting on it
if (user.getStatus().equals("ACTIVE") && user.getAge() >= 18) {
    user.getSubscription().activate();
}

// Good — tell the object to do work
if (user.canActivateSubscription()) {
    user.activateSubscription();
}
```

---

## Double Encapsulation
**Severity:** 🟡 Minor  
**Languages:** All OOP

A method that wraps its own field accessor instead of accessing the field directly — inside the class.

```java
// Bad — inside the class, calling its own getter
class Circle {
    private double radius;
    public double getRadius() { return radius; }

    public double area() {
        return Math.PI * getRadius() * getRadius(); // unnecessary
    }
}

// Good
public double area() {
    return Math.PI * radius * radius;
}
```

---

## Empty Class
**Severity:** 🟡 Minor  
**Languages:** All OOP

A class with no behaviour — just a name. Either it should have methods, or it's a sign of premature classification.

```python
# Bad
class PaymentError(Exception):
    pass  # no added behaviour, context, or attributes

class UserService:
    pass  # created but never implemented

# Good — add meaningful context
class PaymentError(Exception):
    def __init__(self, message, transaction_id=None):
        super().__init__(message)
        self.transaction_id = transaction_id
```

---

## Missing Small Objects
**Severity:** 🟡 Minor  
**Languages:** All OOP

Using primitives where a small value object would better capture the concept.

```typescript
// Bad — money is just a number?
function applyDiscount(price: number, discount: number): number {
    return price - discount; // what currency? can go negative?
}

// Good
class Money {
    constructor(private amount: number, private currency: string) {
        if (amount < 0) throw new Error("Money cannot be negative");
    }
    subtract(other: Money): Money {
        if (this.currency !== other.currency) throw new Error("Currency mismatch");
        return new Money(this.amount - other.amount, this.currency);
    }
}
```

---

## Nested Classes
**Severity:** 🟡 Minor  
**Languages:** Java, C#, Python

Inner classes that grow large enough to deserve their own file — but are buried inside another class.

```java
// Bad — Builder is 200 lines buried inside Order
class Order {
    // ... Order methods
    
    public static class Builder {
        // 200 lines of complex builder logic buried here
    }
}

// Good — separate file for complex inner types
// Order.java + OrderBuilder.java
```

---

## Shotgun Surgery
**Severity:** 🔴 Critical  
**Languages:** All OOP

One logical change forces small edits scattered across many unrelated classes. The inverse of Divergent Change. Sign of poor cohesion.

```java
// Bad — adding a new "currency" field requires changes in 12 classes:
// Order.java, OrderDTO.java, OrderSerializer.java, OrderRepository.java,
// InvoiceGenerator.java, EmailTemplate.java, ReportBuilder.java...

// Good — centralize the concept
class Money {
    BigDecimal amount;
    Currency currency;
    // All money behavior lives here — one change, one place
}
```

---

## Divergent Change
**Severity:** 🔴 Critical  
**Languages:** All OOP

A class that changes for many *different* reasons — each new feature or fix touches it. Violates the Single Responsibility Principle. (Different from Shotgun Surgery: here *one* class changes often; there *many* classes change for *one* reason.)

```java
// Bad — UserService changes when:
// - authentication logic changes
// - email format changes
// - user data validation changes
// - reporting requirements change
class UserService {
    void authenticate(User user) { ... }
    void sendWelcomeEmail(User user) { ... }
    void validateAge(User user) { ... }
    void generateUserReport(User user) { ... }
}

// Good — each class has one reason to change
class AuthenticationService { void authenticate(User user) {} }
class UserEmailService { void sendWelcome(User user) {} }
class UserValidator { void validateAge(User user) {} }
class UserReportService { void generate(User user) {} }
```

---

## Primitive Obsession
**Severity:** 🔴 Critical  
**Languages:** All

Using raw primitives (String, int, float) for domain concepts that deserve their own type. Leads to validation scattered everywhere, no encapsulation of rules, and easy mix-ups.

```java
// Bad — all strings, easy to mix up
void createUser(String name, String email, String phone, String userId) {}
// Can call as: createUser(email, name, phone, userId) — compiles fine!

// Good — each concept has its own type
void createUser(Name name, Email email, PhoneNumber phone, UserId id) {}

class Email {
    private final String value;
    Email(String value) {
        if (!value.contains("@")) throw new IllegalArgumentException("Invalid email");
        this.value = value.toLowerCase();
    }
}
```

```python
# Bad
def transfer(amount: float, from_account: str, to_account: str):
    pass
# amount in dollars? cents? which currency?

# Good
@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("Amount cannot be negative")

def transfer(amount: Money, from_account: AccountId, to_account: AccountId):
    pass
```

---

## Speculative Generality
**Severity:** 🟠 Major  
**Languages:** All OOP

Code written for hypothetical future flexibility that nobody currently needs. Abstract base classes with one implementor, parameters that are always the same value, hooks that are never called.

```java
// Bad — generalizing for a future that never comes
interface PaymentProcessor {
    void process(Payment payment, ProcessingContext ctx, ProcessingOptions opts);
}
// Only ever one implementation, ctx is always null, opts always default

// Good — YAGNI: build what you need
class StripePaymentProcessor {
    void process(Payment payment) { ... }
}
```

```python
# Bad — plugin system for an app with one plugin
class BaseExporter(ABC):
    @abstractmethod
    def export(self, data, format, options, callback): pass

class CsvExporter(BaseExporter):  # only ever one exporter
    def export(self, data, format, options, callback):
        return csv.writer(data)  # ignores format, options, callback

# Good — just write the CSV exporter directly
class CsvExporter:
    def export(self, data) -> str:
        return csv.writer(data)
```

---

## Middle Man
**Severity:** 🟠 Major  
**Languages:** All OOP

A class whose only job is to delegate every method call to another object. A hollow layer that adds no value.

```java
// Bad — Department just passes through to Manager
class Department {
    private Manager manager;
    String getName() { return manager.getName(); }
    void addEmployee(Employee e) { manager.addEmployee(e); }
    List<Employee> getEmployees() { return manager.getEmployees(); }
    // Every method is just manager.xxx()
}

// Good — remove the middle man, talk directly
// Or: keep Department but give it actual behaviour
class Department {
    private Manager manager;
    List<Employee> getActiveEmployees() {
        return manager.getEmployees().stream()
            .filter(Employee::isActive).toList();
    }
}
```

---

## Lazy Class / Freeloader
**Severity:** 🟠 Major  
**Languages:** All OOP

A class so small and simple it doesn't justify existing as a separate abstraction. The cost of understanding it outweighs its benefit.

```java
// Bad — why is this a class?
class EmailValidator {
    boolean isValid(String email) {
        return email.contains("@");
    }
}

// Good — inline into the domain object that uses it
class User {
    User(String name, String email) {
        if (!email.contains("@")) throw new IllegalArgumentException("Invalid email");
        ...
    }
}
```

```python
# Bad — one-liner class
class Multiplier:
    def multiply(self, a, b):
        return a * b

# Good — just use a function, or inline it
```

---

## Inappropriate Static
**Severity:** 🟠 Major  
**Languages:** All OOP

Making methods or fields static when they should be instance-level — destroys testability, prevents injection, and introduces hidden global state.

```java
// Bad — static service with global state, impossible to mock
class DatabaseService {
    private static Connection connection; // global!
    public static User findUser(int id) {
        return connection.query("SELECT...", id);
    }
}

// Usage: DatabaseService.findUser(1); // can't inject a test DB!

// Good — instance method, injectable
class DatabaseService {
    private final Connection connection;
    DatabaseService(Connection connection) { this.connection = connection; }
    public User findUser(int id) { return connection.query("SELECT...", id); }
}
```

```python
# Bad
class Config:
    @staticmethod
    def get_db_url():
        return os.environ["DATABASE_URL"]  # hidden dependency, can't mock

# Good
class Config:
    def __init__(self, env=os.environ):
        self.env = env
    def get_db_url(self):
        return self.env["DATABASE_URL"]
```

---

## Refused Bequest
**Severity:** 🟡 Minor  
**Languages:** All OOP

A subclass inherits methods from its parent but doesn't use them — or worse, overrides them to throw exceptions. The subclass doesn't truly honor the parent's contract.

```java
// Bad — Stack "is-a" Vector but refuses most Vector methods
class Stack extends Vector {
    @Override
    public void add(int index, Object element) {
        throw new UnsupportedOperationException(); // refusing the bequest!
    }
    @Override
    public Object remove(int index) {
        throw new UnsupportedOperationException();
    }
}

// Good — use composition, not inheritance
class Stack {
    private final Deque<Object> elements = new ArrayDeque<>();
    public void push(Object item) { elements.push(item); }
    public Object pop() { return elements.pop(); }
}
```

---

## Parallel Inheritance Hierarchies
**Severity:** 🟠 Major  
**Languages:** All OOP

Every time you add a subclass in one hierarchy, you must add a corresponding one in another. A special case of Shotgun Surgery at the class hierarchy level.

```java
// Bad — two hierarchies that must always grow together
class Animal {}
class Dog extends Animal {}
class Cat extends Animal {}

class AnimalTrainer {}
class DogTrainer extends AnimalTrainer {}  // must add whenever Dog is added
class CatTrainer extends AnimalTrainer {}  // must add whenever Cat is added

// Good — merge or use strategy pattern
class Animal {
    private final TrainingStrategy trainer;
    Animal(TrainingStrategy trainer) { this.trainer = trainer; }
    void train() { trainer.train(this); }
}
```

---

## Anemic Model Generators
**Severity:** 🟠 Major  
**Languages:** All OOP

Domain objects (models) that have data but no behaviour — all logic is in external "service" or "manager" classes. The model becomes a struct.

```java
// Bad — User is just a data bag
class User {
    String name;
    String email;
    String status;
    // no methods!
}

class UserService {
    void activate(User user) { user.status = "ACTIVE"; }
    boolean canLogin(User user) { return user.status.equals("ACTIVE"); }
    void sendWelcome(User user) { emailer.send(user.email, "Welcome " + user.name); }
}

// Good — User knows about itself
class User {
    private String name;
    private UserStatus status;

    void activate() { this.status = UserStatus.ACTIVE; }
    boolean canLogin() { return status == UserStatus.ACTIVE; }
    String welcomeMessage() { return "Welcome " + name; }
}
```

---

## God Constant Class
**Severity:** 🟠 Major  
**Languages:** All

A class that's just a bag of unrelated constants. Constants should live close to where they're used.

```java
// Bad
class Constants {
    public static final int MAX_RETRIES = 3;
    public static final String DEFAULT_CURRENCY = "USD";
    public static final double TAX_RATE = 0.07;
    public static final int SESSION_TIMEOUT = 3600;
    public static final String ERROR_MSG = "Something went wrong";
    // 200 more unrelated constants...
}

// Good — constants live near their domain
class PaymentConfig {
    public static final String DEFAULT_CURRENCY = "USD";
    public static final double TAX_RATE = 0.07;
}

class NetworkConfig {
    public static final int MAX_RETRIES = 3;
    public static final int TIMEOUT_SECONDS = 30;
}
```

---

## Over Generalization
**Severity:** 🟡 Minor  
**Languages:** All OOP

Building a framework when you need a feature. Abstractions for hypothetical future use.

```java
// Bad — generic handler for a single use case
interface DataProcessor<T, R, C extends ProcessingContext> {
    R process(T input, C context, ProcessingOptions options);
}

// Only ever used like this:
class OrderProcessor implements DataProcessor<Order, Receipt, OrderContext> {
    public Receipt process(Order order, OrderContext ctx, ProcessingOptions opts) {
        return createReceipt(order);
    }
}

// Good — simple, direct
class OrderProcessor {
    public Receipt process(Order order) {
        return createReceipt(order);
    }
}
```

---

## Premature Classification
**Severity:** 🟡 Minor  
**Languages:** All OOP

Creating class hierarchies before you understand the domain — often leads to wrong abstractions.

```python
# Bad — built a whole hierarchy for two cases
class Vehicle: pass
class MotorizedVehicle(Vehicle): pass
class NonMotorizedVehicle(Vehicle): pass
class FourWheelMotorizedVehicle(MotorizedVehicle): pass
class Car(FourWheelMotorizedVehicle): pass

# Good — start flat, extract hierarchy only when needed
class Car:
    def __init__(self, make, model, engine):
        self.make = make
        self.model = model
        self.engine = engine
```

---

## Fake Null Object
**Severity:** 🟠 Major  
**Languages:** All

Returning a special "empty" object from methods instead of null/None, but the caller still has to check if it's empty.

```java
// Bad — what's the point of the pattern if we check anyway?
User user = userRepo.find(id);
if (user.isEmpty()) { // EmptyUser sentinel
    throw new NotFoundException();
}

// Good — just use Optional explicitly
Optional<User> user = userRepo.find(id);
user.orElseThrow(() -> new NotFoundException());
```

---

## Is-A Relationship
**Severity:** 🟡 Minor  
**Languages:** All OOP

Misusing inheritance when composition is more appropriate. A class that "is-a" thing just to inherit behavior.

```java
// Bad — Stack is not a Vector
class Stack extends Vector {
    void push(Object item) { addElement(item); }
    Object pop() { /* ... */ }
}
// Problem: exposes all Vector methods like add(index, item) which break stack semantics

// Good — compose instead
class Stack {
    private final List<Object> elements = new ArrayList<>();
    void push(Object item) { elements.add(item); }
    Object pop() { return elements.remove(elements.size() - 1); }
}
```

---

## Ripple Effect
**Severity:** 🟠 Major  
**Languages:** All

Changing one class requires changing many others — a sign of high coupling.

```java
// Bad — changing User requires changes in 15 other places
class User {
    public String firstName;
    public String lastName;
    // Changing to fullName breaks UserController, UserView, 
    // UserSerializer, UserReport, UserEmail, ...
}

// Good — stable interface, flexible implementation
class User {
    public String getDisplayName() {
        return firstName + " " + lastName;
    }
}
```

---

## Isolated Subclasses Names
**Severity:** 🔵 Style  
**Languages:** All OOP

Subclass names that don't reflect their parent class — confusing hierarchy.

```java
// Bad — what is "Premium"? No relation visible
class User { }
class Premium extends User { } // Premium what?
class Trial extends User { }   // Trial what?

// Good
class User { }
class PremiumUser extends User { }
class TrialUser extends User { }
```

---

## Zero Argument Constructor
**Severity:** 🟡 Minor  
**Languages:** Java, C#, C++

Objects that can exist in a half-initialized state because of a public no-arg constructor required by frameworks but leaving the object incomplete.

```java
// Bad — incomplete state possible
class Connection {
    public Connection() {} // required by some frameworks
    private String host;
    private int port;
    // Can be used without setting host/port!
}

// Better — use factory methods + private constructor
class Connection {
    private Connection() {}
    public static Connection to(String host, int port) {
        Connection c = new Connection();
        c.host = requireNonNull(host);
        c.port = port;
        return c;
    }
}
```

---

## Subsets Violation
**Severity:** 🟡 Minor  
**Languages:** All OOP

Inheritance where the subclass only uses part of the parent's interface — violates Liskov Substitution.

```java
// Bad — ReadOnlyList extends List but throws on mutating methods
class ReadOnlyList extends ArrayList {
    @Override
    public void add(Object item) {
        throw new UnsupportedOperationException(); // LSP violation!
    }
}

// Good — implement the read-only interface only
class ReadOnlyList implements Iterable, Collection {
    // only implement reading methods
}
```

---

## Optional Attributes
**Severity:** 🟡 Minor  
**Languages:** All OOP

Nullable fields on a class that are only set in some subtype scenarios — a sign the class should be split.

```python
# Bad — premium_until is null for non-premium users
class User:
    def __init__(self):
        self.name = ""
        self.email = ""
        self.premium_until = None  # only set for premium users
        self.store_credit = None   # only set for store accounts

# Good — subtype captures optional state
class User:
    name: str
    email: str

class PremiumUser(User):
    premium_until: datetime

class StoreUser(User):
    store_credit: Decimal
```
