# SQL Code Smells

## SELECT *
**Severity:** 🟠 Major  
**Databases:** All

Selecting all columns when only a few are needed wastes bandwidth and breaks when schema changes.

```sql
-- Bad
SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id;

-- Good
SELECT 
    orders.id,
    orders.total,
    customers.name,
    customers.email
FROM orders
JOIN customers ON orders.customer_id = customers.id;
```

---

## N+1 Query Problem
**Severity:** 🔴 Critical  
**Languages:** ORM-heavy languages (Java/Hibernate, Python/SQLAlchemy, Ruby/Rails)

Fetching a list then querying each item individually — 1 query + N more queries.

```python
# Bad — 1 query to get orders, then 1 per order to get customer
orders = Order.objects.all()
for order in orders:
    print(order.customer.name)  # separate query each time!

# Good — eager load
orders = Order.objects.select_related('customer').all()
for order in orders:
    print(order.customer.name)  # no extra queries
```

```java
// Bad — Hibernate lazy loading triggers N+1
List<Order> orders = orderRepo.findAll();
for (Order o : orders) {
    System.out.println(o.getCustomer().getName()); // N queries
}

// Good
@Query("SELECT o FROM Order o JOIN FETCH o.customer")
List<Order> findAllWithCustomers();
```

---

## Not Sanitized Input in SQL
**Severity:** 🔴 Critical  
**Languages:** All

String interpolation in SQL queries = SQL injection. Always use parameterized queries.

```python
# Bad — injectable!
def get_user(username):
    cursor.execute(f"SELECT * FROM users WHERE name = '{username}'")

# Good
def get_user(username):
    cursor.execute("SELECT * FROM users WHERE name = %s", (username,))
```

---

## Missing Index
**Severity:** 🟠 Major  
**Databases:** All

Querying on columns that aren't indexed causes full table scans.

```sql
-- Bad — no index on email, full scan on large users table
SELECT * FROM users WHERE email = 'user@example.com';

-- Good
CREATE INDEX idx_users_email ON users(email);
SELECT id, name FROM users WHERE email = 'user@example.com';
```

---

## Implicit Conversion in WHERE
**Severity:** 🟠 Major  
**Databases:** All

Comparing columns of different types forces implicit conversion, often defeating indexes.

```sql
-- Bad — varchar column compared to integer, index not used
SELECT * FROM orders WHERE id = '12345'; -- id is INT

-- Good
SELECT * FROM orders WHERE id = 12345;
```

---

## Logic in Views Instead of Application
**Severity:** 🟡 Minor  
**Databases:** All

Embedding business logic in database views makes it harder to test and maintain.

```sql
-- Bad — tax calculation buried in a view
CREATE VIEW order_totals AS
SELECT id, subtotal * 1.07 AS total -- tax rate hardcoded!
FROM orders;

-- Better — handle tax in application code where it can be tested and configured
```

---

## God Query
**Severity:** 🟠 Major  
**Databases:** All

A single query with 15+ JOINs doing what should be several queries or a stored procedure.

```sql
-- Bad — unmaintainable single query
SELECT u.name, o.id, oi.product_id, p.name, p.category_id, c.name,
       s.warehouse_id, w.location, d.carrier, d.tracking_number, ...
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
JOIN categories c ON p.category_id = c.id
JOIN shipments s ON o.id = s.order_id
JOIN warehouses w ON s.warehouse_id = w.id
JOIN deliveries d ON s.id = d.shipment_id
-- ... 8 more JOINs

-- Better — split into focused queries or use application-side joining
```

---

## Hardcoded Values in SQL
**Severity:** 🟠 Major  
**Databases:** All

Magic numbers or strings embedded in SQL queries.

```sql
-- Bad
SELECT * FROM users WHERE role_id = 3;  -- what is 3?
UPDATE orders SET status = 'P' WHERE created_at < '2024-01-01'; -- what is 'P'?

-- Good
-- Use named parameters, enums, or lookups
SELECT * FROM users 
JOIN roles ON users.role_id = roles.id 
WHERE roles.name = 'admin';
```

---

## Missing Foreign Key Constraints
**Severity:** 🟠 Major  
**Databases:** All relational

Relying on application code to maintain referential integrity instead of database constraints.

```sql
-- Bad — no FK constraint, orphaned records possible
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT  -- no constraint!
);

-- Good
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);
```

---

## Null in Unexpected Places
**Severity:** 🟡 Minor  
**Databases:** All

NOT NULL not enforced at the DB level for columns that should always have values.

```sql
-- Bad
CREATE TABLE users (
    id INT PRIMARY KEY,
    email VARCHAR(255),  -- should always have email!
    created_at TIMESTAMP  -- should always have timestamp!
);

-- Good
CREATE TABLE users (
    id INT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## Overuse of Stored Procedures
**Severity:** 🟡 Minor  
**Databases:** All

Putting business logic in stored procedures: hard to test, version control, and debug.

```sql
-- Bad — complex business logic in a stored procedure
CREATE PROCEDURE apply_loyalty_discount(IN order_id INT)
BEGIN
    DECLARE points INT;
    SELECT loyalty_points INTO points FROM customers WHERE id = ...;
    IF points > 1000 THEN
        UPDATE orders SET total = total * 0.9 WHERE id = order_id;
    END IF;
END;

-- Better — keep business logic in application code, use DB for data
```

---

## Boolean Columns as Status
**Severity:** 🟡 Minor  
**Databases:** All

Using boolean columns for what is really a multi-state status.

```sql
-- Bad — can't add states without schema change
CREATE TABLE orders (
    id INT PRIMARY KEY,
    is_pending BOOLEAN,
    is_approved BOOLEAN,
    is_shipped BOOLEAN,
    is_cancelled BOOLEAN
    -- What happens when we add "is_held"?
);

-- Good
CREATE TABLE orders (
    id INT PRIMARY KEY,
    status ENUM('pending', 'approved', 'shipped', 'cancelled') NOT NULL
);
```
