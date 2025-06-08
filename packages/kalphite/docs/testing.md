# Kalphite Testing Strategy

## Philosophy: Tests as Specification

Tests are the primary specification for Kalphite's memory-first sync engine. They define behavior before implementation and serve as both planning documents and success criteria.

**Core Principles:**

- Tests drive implementation (not the reverse)
- Failing tests are specifications, not errors
- Work in clear stages: plan → scaffold → prepare → implement
- Architecture expressed through test organization
- Tests provide real-time progress visibility

## Test-Driven Workflow

**Important**: Tests should fail initially—this is expected and correct. Failing tests represent specifications that will eventually pass when implementation is complete.

### 1. Planning → `test.todo()`

```typescript
test.todo("should handle network reconnection with exponential backoff");
```

Capture requirements and user stories before detailed design.

### 2. Scaffolding → `test.skip()`

```typescript
test.skip("should handle network reconnection with exponential backoff", () => {
  const networkSync = createNetworkSync();
  expect(networkSync.reconnect()).resolves.toBeTruthy();
});
```

Define exact API surface, behavior, performance requirements, and edge cases. Tests remain skipped while scaffolding.

### 3. Preparing to Implement → Unskip & Refactor Tests

Remove `skip()` to activate all tests for a feature area. Refactor test code as needed to ensure specifications are complete and accurate. **Tests will fail at this stage—this is correct.**

### 4. Implementation → Fix Failing Tests

Implement production code to make tests pass. Ideally, no test code changes are needed during this phase—only implementation code changes.

**Critical**: A failing test is not incorrect. Our goal is to create failing tests that will eventually pass when we complete the implementation. Work in stages, not all at once.

## Organization Standards

### File Naming

```
Layer[N]-[Component].test.ts      # Architecture layers
Integration-[Aspect].test.ts      # Cross-layer functionality
Acceptance-[Workflow].test.ts     # User scenarios
[AppName]-[Context].test.ts       # Application-specific
```

### Test Structure

```typescript
describe("[Layer/Component]: [Functional Area]", () => {
  beforeEach(() => {
    /* Setup */
  });

  describe("[Capability Group]", () => {
    test("should [behavior] when [condition]", () => {
      // Arrange → Act → Assert
    });

    test.skip("should [planned behavior]", () => {
      // Future specification
    });

    test.todo("should [requirement]");
  });
});
```

## Quality Patterns

### Performance Requirements

```typescript
test("should load 50k entities under 500ms with <100MB memory", () => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  store.loadEntities(generateEntities(50000));

  expect(performance.now() - startTime).toBeLessThan(500);
  expect(process.memoryUsage().heapUsed - startMemory).toBeLessThan(
    100 * 1024 * 1024
  );
});
```

### API Design Through Tests

```typescript
test("should provide fluent query interface", () => {
  const results = store.comment
    .where((c) => c.data.priority === "high")
    .orderBy((c) => c.data.createdAt)
    .limit(10)
    .toArray();

  expect(results).toHaveLength(10);
  expect(results[0].data.priority).toBe("high");
});
```

### Behavior-Driven Workflows

```typescript
test("should support complete workflow: create → edit → complete → archive", () => {
  expect(store.todo).toHaveLength(0);

  store.todo.push({ text: "Buy groceries", done: false });
  expect(store.todo).toHaveLength(1);

  store.todo[0].text = "Buy organic groceries";
  store.todo[0].done = true;
  expect(store.todo[0].done).toBe(true);

  store.archiveCompleted();
  expect(store.todo).toHaveLength(0);
  expect(store.archivedTodo).toHaveLength(1);
});
```

## Quality Gates

**Before Implementation:**

- All planned tests written and skipped
- Performance thresholds defined
- Error scenarios covered
- Integration points specified

**During Implementation:**

- Tests activated in logical groups, not individually
- Failing tests guide implementation priorities
- Test code changes minimal during implementation phase
- Implementation code changes to satisfy failing specifications

**Before Release:**

- All tests passing (no skipped tests)
- Performance requirements met
- Integration tests validate cross-layer functionality
- Acceptance tests confirm user value

---

_Tests as specification ensures implementation is guided by clear requirements, maintains quality standards, and provides continuous progress feedback toward architectural goals._
