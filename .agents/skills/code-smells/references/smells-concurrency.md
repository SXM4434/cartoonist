# Concurrency & State Smells

## Overview

Concurrency and state management smells occur when code improperly handles mutable state, timing, thread safety, or asynchronous operations. These are particularly critical in multi-threaded, async, or real-time systems.

---

## 1. New Date() in Loop

**What it is:** Creating a new `Date()` or timestamp object repeatedly in a loop instead of reusing a single instance.

**Why it's harmful:**
- Unnecessary object allocation and GC pressure
- Each iteration gets a slightly different timestamp, which may not be intended
- Performance impact in tight loops with many iterations

**Before:**
```javascript
for (let i = 0; i < 1000; i++) {
  const timestamp = new Date();
  log(timestamp, data[i]);
}
```

**After:**
```javascript
const timestamp = new Date();
for (let i = 0; i < 1000; i++) {
  log(timestamp, data[i]);
}
```

---

## 2. Variables Reassignment (Mutable State)

**What it is:** Repeatedly reassigning variables within a function, especially in concurrent contexts, making state tracking difficult.

**Why it's harmful:**
- Makes it hard to reason about current state
- Increases bug surface area in concurrent code
- Difficult to debug variable value at any given point
- Race conditions become more likely

**Before:**
```javascript
async function processData(input) {
  let data = input;
  data = await fetchDetails(data);
  data = transform(data);
  data = await save(data);
  return data;
}
```

**After:**
```javascript
async function processData(input) {
  const details = await fetchDetails(input);
  const transformed = transform(details);
  const saved = await save(transformed);
  return saved;
}
```

---

## 3. DirName and File (Path Mutation)

**What it is:** Using mutable path objects or reassigning path variables in a way that makes it unclear which directory/file is actually being used.

**Why it's harmful:**
- Confusing in concurrent/parallel processing
- Easy to accidentally use wrong path
- Hard to track what file operation is happening

**Before:**
```javascript
let path = '/data';
processDir(path);
path = '/logs';
processDir(path);
```

**After:**
```javascript
const dataPath = '/data';
const logsPath = '/logs';

processDir(dataPath);
processDir(logsPath);
```

---

## 4. Variable Declared with `var`

**What it is:** Using `var` instead of `const` or `let` in JavaScript/TypeScript, especially in concurrent code.

**Why it's harmful:**
- `var` has function scope, not block scope, leading to unexpected variable sharing
- Can cause timing bugs in async code
- Makes refactoring dangerous

**Before:**
```javascript
for (var i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100); // Logs 5, 5, 5, 5, 5
}
```

**After:**
```javascript
for (let i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100); // Logs 0, 1, 2, 3, 4
}
```

---

## 5. Address Implementation (Pointer/Reference Leakage)

**What it is:** Exposing or relying on memory addresses, pointers, or object references in ways that break encapsulation or cause race conditions.

**Why it's harmful:**
- Breaks immutability assumptions
- Makes concurrent modification detectable and exploitable
- Complicates garbage collection
- Creates security vulnerabilities

**Before (C):**
```c
struct Data {
    int value;
    int *buffer;
};

Data* global_data = &some_stack_data;  // Dangling pointer!
```

**After:**
```c
struct Data {
    int value;
    int *buffer;
};

Data* global_data = malloc(sizeof(Data));
```

---

## 6. Shared Mutable State Without Synchronization

**What it is:** Multiple threads/tasks accessing and modifying the same variable without locks, atomic operations, or proper synchronization.

**Why it's harmful:**
- Data races and corrupted state
- Non-deterministic behavior
- Difficult to test and reproduce issues
- Security vulnerabilities

**Before (Go):**
```go
var counter int

func increment() {
    counter++  // Race condition!
}
```

**After (Go with Mutex):**
```go
var (
    mu      sync.Mutex
    counter int
)

func increment() {
    mu.Lock()
    counter++
    mu.Unlock()
}
```

---

## 7. Callback Hell in Async Code

**What it is:** Deeply nested callbacks in asynchronous code, making control flow hard to follow.

**Why it's harmful:**
- Error handling becomes scattered and incomplete
- Difficult to read and maintain
- Easy to miss error paths
- Variables from outer scopes become hard to track

**Before:**
```javascript
getData(function(a) {
  getMoreData(a, function(b) {
    getMoreData(b, function(c) {
      console.log(c);
    });
  });
});
```

**After (Async/Await):**
```javascript
async function process() {
  try {
    const a = await getData();
    const b = await getMoreData(a);
    const c = await getMoreData(b);
    console.log(c);
  } catch (err) {
    console.error(err);
  }
}
```

---

## 8. Fire-and-Forget Promises

**What it is:** Creating promises/async operations without awaiting or catching their results.

**Why it's harmful:**
- Errors silently fail
- Resource leaks (unfinished operations)
- Race conditions
- Difficult to debug

**Before:**
```javascript
async function handler() {
  await processMain();
  cleanup();  // May not finish!
}
```

**After:**
```javascript
async function handler() {
  await processMain();
  await cleanup();
}
```

---

## Severity Classification

| Smell | Severity | Why |
|-------|----------|-----|
| Shared Mutable State Without Sync | 🔴 Critical | Causes data corruption |
| Fire-and-Forget Promises | 🔴 Critical | Unhandled errors, resource leaks |
| Variables Reassignment | 🟠 Major | Hard to track in concurrent code |
| var Declaration | 🟠 Major | Scoping bugs in async code |
| Callback Hell | 🟠 Major | Error handling issues |
| New Date() in Loop | 🟡 Minor | Performance issue |
