# Kalphite Sync Engine

> **Memory-first, schema-agnostic sync engine with intuitive API**

Memory-first sync engine that makes async operations feel synchronous. No loading states, no async/await complexity - just synchronous simplicity.

Part of a monorepo with a demo code review application. See [Development](./docs/setup.md) for workspace commands.

## Installation

```bash
npm install @kalphite/sync
```

## Core Features

- **🚀 Memory-First**: All data lives in memory for instant access
- **📋 Schema-Agnostic**: Works with any Standard Schema compliant library (Zod, Valibot, ArkType, etc.)
- **⚡ Synchronous Operations**: No async/await complexity in your UI code
- **🎨 Intuitive API**: `store.comment` instead of `store.getByType("comment")`
- **🔄 Optimistic Updates**: UI updates instantly, sync happens in background
- **🎯 Type-Safe**: Full TypeScript inference from your schema

## Quick Start

```typescript
import { z } from "zod";
import { createKalphiteStore } from "@kalphite/sync";

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
const store = createKalphiteStore(EntitySchema);

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

// Natural queries
const line42Comments = store.comment.filter((c) => c.data.lineNumber === 42);
const pendingReviews = store.review.filter((r) => r.data.status === "pending");
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
import { useKalphiteStore } from "@kalphite/sync";

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
      <h2>Comments ({comments.length})</h2>
      {comments.map((comment) => (
        <div key={comment.id}>
          <p>{comment.data.message}</p>
          <button onClick={() => store.comment.delete(comment.id)}>
            Delete
          </button>
        </div>
      ))}
      <button onClick={addComment}>Add Comment</button>
    </div>
  );
}
```

## Schema Libraries

Works with any [Standard Schema](https://standardschema.dev/) compliant library:

```typescript
// Zod (v3.24.0+)
import { z } from "zod";
const schema = z.discriminatedUnion("type", [...]);

// Valibot (v1.0+)
import * as v from "valibot";
const schema = v.discriminatedUnion("type", [...]);

// ArkType (v2.0+)
import { type } from "arktype";
const schema = type({ type: "comment" | "review", ... });

// Effect Schema (v3.13.0+)
import * as S from "@effect/schema";
const schema = S.Union(S.Struct({ type: S.Literal("comment") }), ...);

// All of these implement Standard Schema natively - no adapters needed!
```

## Current Status

**Ready**: Local development ✅  
**Coming**: Persistence (Layer 2) 🚧  
**Future**: Real-time sync 📋

### Layer 1: In-Memory Store ✅

- Complete and production-ready
- 20 tests passing
- Handles 10k+ entities smoothly
- React integration working

### Layer 2: Memory Flush Engine ⏳

- Planned: Automatic background persistence
- Debounced writes to reduce I/O
- Error recovery for failed operations

### Layer 3: Frontend Database ⏳

- Planned: PGlite integration
- In-browser SQL database
- Automatic schema migration

### Layer 4: Network Sync ⏳

- Planned: Real-time collaboration
- WebSocket-based updates
- Conflict resolution

## Documentation

- **[Architecture](./docs/architecture.md)** - Technical design and implementation
- **[Testing](./docs/testing.md)** - TDD approach and test strategy
- **[Development](./docs/setup.md)** - Getting started with development
- **[Status](./docs/status.md)** - Current implementation progress
- **[Decisions](./docs/decisions.md)** - Key architectural decisions
- **[Glossary](./docs/glossary.md)** - Key terms and concepts

## Philosophy

Kalphite eliminates the complexity of async state management by keeping everything in memory. Your UI code becomes simple and synchronous while sync happens transparently in the background.

No more loading states. No more async/await. Just clean, predictable code.
