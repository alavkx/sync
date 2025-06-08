# Development Setup

## Quick Start

```typescript
import { z } from "zod";
import { createKalphiteStore } from "@kalphite/sync-engine";

const EntitySchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("comment"),
    data: z.object({ message: z.string() }),
    updatedAt: z.number(),
  }),
]);

const store = createKalphiteStore(EntitySchema);

// Add data
store.comment.upsert("c1", {
  id: "c1",
  type: "comment",
  data: { message: "Hello!" },
  updatedAt: Date.now(),
});

// Query like arrays
const comments = store.comment.filter((c) => c.data.message.includes("Hello"));
```

## Monorepo Development

```bash
# From workspace root
pnpm install    # Install all dependencies
pnpm dev        # Start code review demo app
pnpm test       # Run all tests

# Package development
cd packages/kalphite
npm test        # Run sync engine tests
npm run build   # Build library
```

## React Integration

```typescript
import { useKalphiteStore } from "@kalphite/sync-engine";

function useComments() {
  const store = useKalphiteStore();
  return store.comment;
}

function MyComponent() {
  const comments = useComments();

  return (
    <div>
      {comments.map((comment) => (
        <div key={comment.id}>{comment.data.message}</div>
      ))}
    </div>
  );
}
```

## Common Patterns

### Bulk Operations

```typescript
// Efficient: Use bulk loading
store.loadEntities([entity1, entity2, entity3]);

// Inefficient: Individual operations
entities.forEach((e) => store[e.type].upsert(e.id, e));
```

### Dynamic Access

```typescript
// Access by type variable
const entityType = "comment";
const entities = store[entityType];

// Type-safe access
const comments = store.comment;
const reviews = store.review;
```

## Common Issues

**Subscriptions not firing**: Use store methods, not direct mutation

```typescript
// ❌ Won't trigger React updates
store.comment[0].data.message = "changed";

// ✅ Triggers React updates
const comment = store.comment[0];
store.comment.upsert(comment.id, {
  ...comment,
  data: { ...comment.data, message: "changed" },
});
```

**Performance**: Use bulk operations for multiple entities

## Testing Your Code

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { createKalphiteStore } from "@kalphite/sync-engine";

describe("My Feature", () => {
  let store: ReturnType<typeof createKalphiteStore>;

  beforeEach(() => {
    store = createKalphiteStore(schema);
  });

  test("adds comments", () => {
    store.comment.upsert("c1", commentEntity);
    expect(store.comment).toHaveLength(1);
  });
});
```

## Performance

Current benchmarks:

- **10k entities**: <50ms load time
- **1k updates/sec**: <1ms per operation
- **Memory**: ~100KB per 1k entities
- **Subscriptions**: <5ms notifications

Ready for local development, prototypes, and production UI state management.
