# Kalphite Sync Engine

> Schema-agnostic, memory-first sync engine for real-time applications

## Features

- **🚀 Memory-First**: All data lives in memory for synchronous access
- **📋 Schema-Agnostic**: Use any Standard Schema compliant library (Zod, Valibot, ArkType, etc.)
- **⚡ Optimistic Updates**: UI updates instantly, sync happens in background
- **🔄 Simple API**: Single hook, direct data access
- **🎯 Type-Safe**: Full TypeScript inference from your schema

## Quick Start

```bash
npm install @kalphite/sync-engine
```

```typescript
import { z } from "zod";
import { initializeStore, useKalphiteStore } from "@kalphite/sync-engine";

// Define your schema with any Standard Schema library
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

// Initialize the store
await initializeStore(EntitySchema);

// Use in React components
function MyComponent() {
  const store = useKalphiteStore();

  const comments = store?.getByType("comment") || [];

  const addComment = () => {
    store?.upsert(crypto.randomUUID(), {
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

## Philosophy

Kalphite represents a radical simplification of traditional sync engines by embracing trade-offs (performance for simplicity) to create dramatically better developer experience. Perfect for learning, prototyping, and building real applications where "fast enough" is good enough.

## Documentation

See the [complete documentation](../../docs/memory-first-sync-master.md) for detailed architecture and implementation guide.

## License

MIT
