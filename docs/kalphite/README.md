# Kalphite Sync Engine

> **Memory-first, schema-agnostic sync engine with intuitive API**

## Core Features

- **🚀 Memory-First**: All data lives in memory for instant access
- **📋 Schema-Agnostic**: Use any Standard Schema library (Zod, Valibot, ArkType, etc.)
- **⚡ Synchronous Operations**: No async/await complexity in your UI code
- **🎨 Intuitive API**: `store.comment` instead of `store.getByType("comment")`
- **🔄 Optimistic Updates**: UI updates instantly, sync happens in background
- **🎯 Type-Safe**: Full TypeScript inference from your schema

## Quick Start

```typescript
import { z } from "zod";
import { KalphiteStore } from "@kalphite/sync-engine";

// Define your schema
const EntitySchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("comment"),
    data: z.object({
      message: z.string(),
      lineNumber: z.number(),
    }),
    updatedAt: z.number(),
  }),
]);

// Create store
const store = KalphiteStore(EntitySchema);

// Use the intuitive API
const comments = store.comment; // Array-like access
store.comment.upsert("id", entity); // Type-scoped mutations
store.comment.delete("id"); // Clean operations
```

## API Examples

### Reading Data

```typescript
// Access collections as properties
const comments = store.comment;
const reviews = store.review;

// All array methods work
const messages = store.comment.map((c) => c.data.message);
const urgent = store.comment.filter((c) => c.data.priority === "high");
```

### Writing Data

```typescript
// Type-scoped operations
store.comment.upsert("comment-1", commentEntity);
store.review.delete("review-1");

// Bulk operations
store.loadEntities([entity1, entity2, entity3]);
store.clear();
```

## React Integration

```typescript
import { useKalphiteStore } from "@kalphite/sync-engine";

function MyComponent() {
  const store = useKalphiteStore();

  const comments = store.comment;

  const addComment = () => {
    store.comment.upsert(crypto.randomUUID(), {
      id: crypto.randomUUID(),
      type: "comment",
      data: { message: "Hello!", lineNumber: 42 },
      updatedAt: Date.now(),
    });
  };

  return (
    <div>
      {comments.map((comment) => (
        <div key={comment.id}>{comment.data.message}</div>
      ))}
      <button onClick={addComment}>Add Comment</button>
    </div>
  );
}
```

## Documentation

- **[Architecture](./architecture.md)** - Technical design and implementation
- **[Testing](./testing.md)** - TDD approach and test strategy
- **[Development](./setup.md)** - Getting started with development
- **[Status](./status.md)** - Current implementation progress
- **[Decisions](./decisions.md)** - Key architectural decisions

## Schema Libraries

Works with any [Standard Schema](https://standardschema.dev/) library:

```typescript
// Zod
import { z } from "zod";

// Valibot
import * as v from "valibot";

// ArkType
import { type } from "arktype";
```
