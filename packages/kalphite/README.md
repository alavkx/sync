# @kalphite/sync-engine

Memory-first, schema-agnostic sync engine with intuitive API.

## Installation

```bash
npm install @kalphite/sync-engine
```

## Quick Start

```typescript
import { z } from "zod";
import { KalphiteStore } from "@kalphite/sync-engine";

const EntitySchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("comment"),
    data: z.object({ message: z.string() }),
    updatedAt: z.number(),
  }),
]);

const store = KalphiteStore(EntitySchema);

// Intuitive database-like API
const comments = store.comment;
store.comment.upsert("id", entity);
store.comment.delete("id");
```

## Documentation

**📖 [Full Documentation](../../docs/kalphite/README.md)**

- [Architecture](../../docs/kalphite/architecture.md)
- [Testing](../../docs/kalphite/testing.md)
- [Development](../../docs/kalphite/setup.md)
- [Status](../../docs/kalphite/status.md)
- [Decisions](../../docs/kalphite/decisions.md)
