# 🛠️ Kalphite Setup

## Install

```bash
npm install kalphite
```

## Hello World

```typescript
import { createKalphiteStore } from "kalphite";

const store = createKalphiteStore();

// Add data
store.comment.upsert("c1", {
  data: { message: "Hello!", author: "dev" },
});

// Query like arrays
const comments = store.comment.filter((c) => c.data.author === "dev");
```

## Key Patterns

### Reactive UI

```typescript
function useComments() {
  const [comments, setComments] = useState(store.comment);

  useEffect(() => {
    return store.subscribe((changes) => {
      if (changes.some((c) => c.entityType === "comment")) {
        setComments([...store.comment]); // New array reference
      }
    });
  }, []);

  return comments;
}
```

### Bulk Operations

```typescript
// Fast: Use bulk operations
store.bulkUpsert("comment", newComments);

// Slow: Individual operations
newComments.forEach((c) => store.comment.upsert(c.id, c));
```

### Smart Queries

```typescript
// Complex filtering
const urgent = store.comment
  .filter((c) => c.data.priority === "high")
  .filter((c) => !c.data.resolved)
  .sort((a, b) => b.data.timestamp - a.data.timestamp);

// Dynamic access
function getByType(entityType: string) {
  return store[entityType] || [];
}
```

## Common Issues

**Subscriptions not firing**: Use `upsert()`, not direct mutation

```typescript
// ❌ Won't trigger subscriptions
store.comment[0].data.message = "changed";

// ✅ Triggers subscriptions
const comment = store.comment[0];
store.comment.upsert(comment.id, {
  ...comment,
  data: { ...comment.data, message: "changed" },
});
```

**Performance**: Use bulk operations for multiple entities

**React updates**: Create new array references in subscriptions

## Testing

```typescript
test("store behavior", () => {
  const store = createKalphiteStore();

  store.comment.upsert("c1", { data: { message: "test" } });

  expect(store.comment).toHaveLength(1);
  expect(store.comment[0].data.message).toBe("test");
});
```

## Performance

- **10k entities**: <1ms reads, <10ms bulk writes
- **Memory**: Linear growth only
- **Subscriptions**: <5ms notifications

Ready for local development, prototypes, and UI state management.
