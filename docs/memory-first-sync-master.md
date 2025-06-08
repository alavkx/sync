# Memory-First Sync Engine: Complete Architecture Guide

> **🎯 Ultimate Goal**: Radically simple sync engine where all data lives in memory, operations are synchronous, and persistence happens automatically in the background.

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Architecture Overview](#architecture-overview)
3. [Layer 1: In-Memory Store](#layer-1-in-memory-store)
4. [Layer 2: Memory Flush Engine](#layer-2-memory-flush-engine)
5. [Layer 3: Frontend Database](#layer-3-frontend-database)
6. [Layer 4: Network Sync Engine](#layer-4-network-sync-engine)
7. [React Integration](#react-integration)
8. [Implementation Guide](#implementation-guide)
9. [Usage Examples](#usage-examples)
10. [Trade-offs & Benefits](#trade-offs--benefits)

---

## Core Philosophy

### The Revolutionary Insight

Traditional sync engines force async operations everywhere:

```typescript
// ❌ Traditional: Everything is async and complex
const comments = await syncEngine.query({ entityType: "comment" });
const comment = await syncEngine.query({ entityId: "comment-123" });
await syncEngine.upsert(id, type, data);

// Loading states everywhere
const [comments, setComments] = useState([]);
const [loading, setLoading] = useState(true);
```

Our memory-first approach makes everything synchronous:

```typescript
// ✅ Memory-First: Direct access, zero async
const store = useKalphiteStore();
const comments = store.getByType("comment"); // Sync!
const comment = store.getById("comment-123"); // Sync!
store.entities.set("comment-123", newComment); // Sync! (persistence automatic)

// No loading states needed - data is always available
```

### Key Benefits

- **🚀 Immediate UI updates** - All operations are synchronous
- **🧠 Zero cognitive load** - No async/loading complexity
- **🐛 Impossible stale data** - Memory is always the source of truth
- **⚡ Optimistic by default** - UI updates instantly, sync happens background
- **🔄 Simple conflict resolution** - Last-write-wins with server authority

---

## Architecture Overview

### 4-Layer Design

```
┌─────────────────────────────────────┐
│           React Components          │ ← User Interaction
│   • Direct memory read/write       │
│   • Synchronous, optimistic        │
│   • Zero loading states            │
└─────────────────┬───────────────────┘
                  │ useSyncExternalStore
┌─────────────────▼───────────────────┐
│    Layer 1: In-Memory Store         │ ← Hot Data (RAM)
│   • Proxy-wrapped entities         │
│   • Automatic change detection     │
│   • React subscription handling    │
└─────────────────┬───────────────────┘
                  │ 100ms debounced flush
┌─────────────────▼───────────────────┐
│  Layer 2: Memory Flush Engine       │ ← Memory → Disk
│   • Debounced persistence          │
│   • Change batching                │
│   • Error handling & retry        │
└─────────────────┬───────────────────┘
                  │ PGlite transactions
┌─────────────────▼───────────────────┐
│  Layer 3: Frontend Database         │ ← Warm Data (IndexedDB)
│   • PGlite + IndexedDB             │
│   • Local persistence              │
│   • Change log for sync            │
└─────────────────┬───────────────────┘
                  │ TanStack Start RPC
┌─────────────────▼───────────────────┐
│  Layer 4: Network Sync Engine       │ ← Cold Data (Server)
│   • 1s debounced push operations   │
│   • 5s background pull polling     │
│   • Replicache push/pull pattern   │
└─────────────────┬───────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────┐
│       Backend Database              │ ← Authoritative State
│   • PGlite server instance         │
│   • Multi-client coordination      │
│   • Global version tracking        │
└─────────────────────────────────────┘
```

### Change Flow Examples

**Local User Action:**

```
User clicks → Memory updated (instant UI) → 100ms later → PGlite write → 1s later → Network push
```

**Remote User Action:**

```
Other user changes → Server detects → Push notification → Pull triggered → PGlite updated → Memory reloaded → UI re-renders
```

---

## Layer 1: In-Memory Store

### Core Entity Structure

```typescript
interface Entity {
  id: string;
  type: string;
  data: any;
  updatedAt: number;
}

class KalphiteStore {
  private _entities = new Map<string, Entity>();
  private subscribers = new Set<() => void>();
  private flushEngine: MemoryFlushEngine;

  constructor(flushEngine: MemoryFlushEngine) {
    this.flushEngine = flushEngine;
  }

  // Proxy-wrapped for automatic change detection
  get entities() {
    return new Proxy(this._entities, {
      set: (target, prop, value) => {
        const result = Reflect.set(target, prop, value);

        if (typeof prop === "string" && value) {
          // Trigger background flush
          this.flushEngine.scheduleFlush(prop, value);
          // Notify React components
          this.notifySubscribers();
        }

        return result;
      },

      deleteProperty: (target, prop) => {
        const existing = target.get(prop as string);
        const result = Reflect.deleteProperty(target, prop);

        if (typeof prop === "string" && existing) {
          this.flushEngine.scheduleFlush(prop, { ...existing, deleted: true });
          this.notifySubscribers();
        }

        return result;
      },
    });
  }

  // Fast synchronous read operations
  getById(id: string): Entity | null {
    return this._entities.get(id) || null;
  }

  getByType(type: string): Entity[] {
    return Array.from(this._entities.values()).filter((e) => e.type === type);
  }

  getAll(): Entity[] {
    return Array.from(this._entities.values());
  }

  // React integration
  subscribe = (callback: () => void): (() => void) => {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  };

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback());
  }

  // Bulk loading from persistence layer
  loadFromPGlite(entities: Entity[]): void {
    entities.forEach((entity) => {
      this._entities.set(entity.id, entity);
    });
    this.notifySubscribers();
  }
}
```

---

## Layer 2: Memory Flush Engine

### Debounced Persistence Manager

```typescript
interface FlushOperation {
  entityId: string;
  entity: Entity | { deleted: true };
  timestamp: number;
}

class MemoryFlushEngine {
  private pendingFlushes = new Map<string, FlushOperation>();
  private flushTimer: NodeJS.Timeout | null = null;
  private frontendDb: FrontendDatabase;

  constructor(frontendDb: FrontendDatabase) {
    this.frontendDb = frontendDb;
  }

  scheduleFlush(entityId: string, entity: Entity | { deleted: true }): void {
    // Add to pending operations
    this.pendingFlushes.set(entityId, {
      entityId,
      entity,
      timestamp: Date.now(),
    });

    // Debounce: Reset timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    // Execute flush after 100ms of inactivity
    this.flushTimer = setTimeout(() => {
      this.executeBatchFlush();
    }, 100);
  }

  private async executeBatchFlush(): Promise<void> {
    const operations = Array.from(this.pendingFlushes.values());
    this.pendingFlushes.clear();
    this.flushTimer = null;

    if (operations.length === 0) return;

    try {
      // Batch write to PGlite
      await this.frontendDb.transaction(async (tx) => {
        for (const op of operations) {
          if ("deleted" in op.entity) {
            await tx.deleteEntity(op.entityId);
          } else {
            await tx.upsertEntity(op.entity);
          }
        }
      });

      // Success: Trigger network sync
      this.scheduleNetworkSync();
    } catch (error) {
      console.error("Flush failed, will retry:", error);
      // Re-queue failed operations with exponential backoff
      setTimeout(() => {
        operations.forEach((op) => {
          this.pendingFlushes.set(op.entityId, op);
        });
        this.executeBatchFlush();
      }, 1000);
    }
  }

  private scheduleNetworkSync(): void {
    // Notify Layer 4 that new changes are available
    window.dispatchEvent(new CustomEvent("localChangesReady"));
  }
}
```

---

## Layer 3: Frontend Database

### PGlite + IndexedDB Storage

```typescript
import { PGlite } from '@electric-sql/pglite';

class FrontendDatabase {
  private db: PGlite;

  constructor() {
    // PGlite with IndexedDB persistence
    this.db = new PGlite({
      dataDir: 'idb://sync-engine-db',
    });
  }

  async initialize(): Promise<void> {
    // Create tables
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_at BIGINT NOT NULL,
        version INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS client_changes (
        id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL, -- 'upsert' or 'delete'
        data JSONB,
        timestamp BIGINT NOT NULL,
        synced BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS client_state (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at);
      CREATE INDEX IF NOT EXISTS idx_changes_synced ON client_changes(synced);
    `);
  }

  async transaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T> {
    // PGlite transaction wrapper
    return this.db.transaction(async () => {
      const tx = new DatabaseTransaction(this.db);
      return await fn(tx);
    });
  }

  async loadAllEntities(): Promise<Entity[]> {
    const result = await this.db.query(`
      SELECT id, type, data, updated_at
      FROM entities
      ORDER BY updated_at DESC
    `);

    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      data: row.data,
      updatedAt: row.updated_at
    }));
  }

  async getUnsynced Changes(): Promise<ChangeOperation[]> {
    const result = await this.db.query(`
      SELECT entity_id, entity_type, operation, data, timestamp
      FROM client_changes
      WHERE synced = FALSE
      ORDER BY timestamp ASC
    `);

    return result.rows.map(row => ({
      entityId: row.entity_id,
      entityType: row.entity_type,
      operation: row.operation,
      data: row.data,
      timestamp: row.timestamp
    }));
  }

  async markChangesSynced(changeIds: number[]): Promise<void> {
    if (changeIds.length === 0) return;

    await this.db.query(`
      UPDATE client_changes
      SET synced = TRUE
      WHERE id = ANY($1)
    `, [changeIds]);
  }
}

class DatabaseTransaction {
  constructor(private db: PGlite) {}

  async upsertEntity(entity: Entity): Promise<void> {
    await this.db.query(`
      INSERT INTO entities (id, type, data, updated_at, version)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (id) DO UPDATE SET
        type = $2,
        data = $3,
        updated_at = $4,
        version = version + 1
    `, [entity.id, entity.type, entity.data, entity.updatedAt]);

    // Track change for sync
    await this.db.query(`
      INSERT INTO client_changes (entity_id, entity_type, operation, data, timestamp)
      VALUES ($1, $2, 'upsert', $3, $4)
    `, [entity.id, entity.type, entity.data, entity.updatedAt]);
  }

  async deleteEntity(entityId: string): Promise<void> {
    const result = await this.db.query(`
      DELETE FROM entities WHERE id = $1 RETURNING type
    `, [entityId]);

    if (result.rows.length > 0) {
      await this.db.query(`
        INSERT INTO client_changes (entity_id, entity_type, operation, timestamp)
        VALUES ($1, $2, 'delete', $3)
      `, [entityId, result.rows[0].type, Date.now()]);
    }
  }
}
```

---

## Layer 4: Network Sync Engine

### TanStack Start RPC Integration

```typescript
interface PushRequest {
  changes: ChangeOperation[];
  clientId: string;
}

interface PullRequest {
  lastVersion?: number;
  clientId: string;
}

interface PullResponse {
  entities: Entity[];
  version: number;
  hasMore: boolean;
}

class NetworkSyncEngine {
  private pushTimer: NodeJS.Timeout | null = null;
  private pullTimer: NodeJS.Timeout | null = null;
  private frontendDb: FrontendDatabase;
  private memoryStore: MemoryStore;

  constructor(frontendDb: FrontendDatabase, memoryStore: MemoryStore) {
    this.frontendDb = frontendDb;
    this.memoryStore = memoryStore;

    // Listen for local changes
    window.addEventListener("localChangesReady", () => {
      this.schedulePush();
    });

    // Start background polling
    this.startBackgroundPull();
  }

  private schedulePush(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }

    // Debounce push operations (1 second)
    this.pushTimer = setTimeout(() => {
      this.executePush();
    }, 1000);
  }

  private async executePush(): Promise<void> {
    try {
      const changes = await this.frontendDb.getUnsyncedChanges();

      if (changes.length === 0) return;

      // TanStack Start RPC call
      const response = await $fetch("/api/sync/push", {
        method: "POST",
        body: {
          changes,
          clientId: this.getClientId(),
        },
      });

      if (response.success) {
        // Mark changes as synced
        const changeIds = changes.map((c) => c.id);
        await this.frontendDb.markChangesSynced(changeIds);
      }
    } catch (error) {
      console.error("Push failed:", error);
      // Retry with exponential backoff
      setTimeout(() => this.executePush(), 2000);
    }
  }

  private startBackgroundPull(): void {
    // Pull every 5 seconds
    this.pullTimer = setInterval(() => {
      this.executePull();
    }, 5000);
  }

  private async executePull(): Promise<void> {
    try {
      const lastVersion = await this.getLastKnownVersion();

      const response = await $fetch("/api/sync/pull", {
        method: "POST",
        body: {
          lastVersion,
          clientId: this.getClientId(),
        },
      });

      if (response.entities.length > 0) {
        // Apply changes to frontend database
        await this.frontendDb.applyRemoteChanges(response.entities);

        // Reload memory store
        const allEntities = await this.frontendDb.loadAllEntities();
        this.memoryStore.loadFromPGlite(allEntities);

        // Save new version
        await this.saveLastKnownVersion(response.version);
      }
    } catch (error) {
      console.error("Pull failed:", error);
    }
  }

  private getClientId(): string {
    let clientId = localStorage.getItem("sync-client-id");
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem("sync-client-id", clientId);
    }
    return clientId;
  }
}
```

---

## React Integration

### Single Hook Pattern (Radically Simple)

```typescript
import { useSyncExternalStore } from "react";

// Global store instance
let store: KalphiteStore;

// One hook to rule them all
export function useKalphiteStore(): KalphiteStore {
  return useSyncExternalStore(
    store.subscribe,
    () => store, // Return entire store
    () => store // SSR fallback
  );
}

// Initialize the store
export async function initializeStore(): Promise<void> {
  const frontendDb = new FrontendDatabase();
  await frontendDb.initialize();

  const flushEngine = new MemoryFlushEngine(frontendDb);
  store = new MemoryStore(flushEngine);

  // Load existing data
  const entities = await frontendDb.loadAllEntities();
  store.loadFromPGlite(entities);

  // Start network sync
  new NetworkSyncEngine(frontendDb, store);
}
```

### Component Usage Patterns

```typescript
// Every component follows this pattern:
const MyComponent = () => {
  const store = useKalphiteStore(); // Re-renders on ANY change

  // Extract what you need (computed every render - simple!)
  const comments = store.getByType("comment");
  const pendingReviews = store
    .getByType("review")
    .filter((r) => r.data.status === "pending");

  // Direct mutations trigger full sync flow
  const handleAddComment = () => {
    store.entities.set(crypto.randomUUID(), {
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
        <CommentItem key={comment.id} comment={comment} />
      ))}
      <button onClick={handleAddComment}>Add Comment</button>
    </div>
  );
};
```

---

## Implementation Guide

### 1. Project Setup

```bash
npm install @electric-sql/pglite
npm install @tanstack/start
```

### 2. Initialize Store

```typescript
// app/lib/store.ts
import { initializeStore } from "./kalphite-store";

export async function setupStore() {
  await initializeStore();
}
```

### 3. App Root Integration

```typescript
// app/root.tsx
import { setupStore } from "./lib/store";

export default function App() {
  useEffect(() => {
    setupStore();
  }, []);

  return <RouterProvider router={router} />;
}
```

### 4. Server Functions (TanStack Start)

```typescript
// app/api/sync.ts
import { createServerFn } from "@tanstack/start";

export const pushChanges = createServerFn(
  "POST",
  async (request: PushRequest) => {
    // Apply changes to backend database
    // Return success/failure
  }
);

export const pullChanges = createServerFn(
  "POST",
  async (request: PullRequest) => {
    // Fetch changes since lastVersion
    // Return entities and new version
  }
);
```

---

## Usage Examples

### Code Review App

```typescript
const CodeReviewApp = () => {
  const store = useKalphiteStore();

  const comments = store.getByType("comment");
  const reviews = store.getByType("review");

  return (
    <div className="code-review">
      <ReviewList reviews={reviews} />
      <CommentThread comments={comments} />
    </div>
  );
};

const CommentThread = ({ comments }) => {
  const store = useKalphiteStore();

  const addComment = (message: string, lineNumber: number) => {
    store.entities.set(crypto.randomUUID(), {
      id: crypto.randomUUID(),
      type: "comment",
      data: {
        message,
        lineNumber,
        filePath: "/src/App.tsx",
        authorId: "current-user",
      },
      updatedAt: Date.now(),
    });
  };

  return (
    <div>
      {comments.map((comment) => (
        <div key={comment.id}>
          <strong>Line {comment.data.lineNumber}:</strong>
          <p>{comment.data.message}</p>
        </div>
      ))}
      <button onClick={() => addComment("Looks good!", 42)}>Add Comment</button>
    </div>
  );
};
```

### Real-time Dashboard

```typescript
const Dashboard = () => {
  const store = useKalphiteStore();

  // All computed every render - embracing simplicity!
  const totalComments = store.getByType("comment").length;
  const totalReviews = store.getByType("review").length;
  const pendingReviews = store
    .getByType("review")
    .filter((r) => r.data.status === "pending").length;

  const recentActivity = store
    .getAll()
    .filter((e) => Date.now() - e.updatedAt < 300000).length; // Last 5 minutes

  return (
    <div className="dashboard">
      <StatCard title="Comments" value={totalComments} />
      <StatCard title="Reviews" value={totalReviews} />
      <StatCard title="Pending" value={pendingReviews} />
      <StatCard title="Recent Activity" value={recentActivity} />
    </div>
  );
};
```

---

## Trade-offs & Benefits

### ✅ Massive Benefits

**🚀 Developer Experience**

- No async complexity anywhere
- No loading states to manage
- Immediate UI feedback
- Impossible to have stale data

**⚡ Performance Characteristics**

- Sub-millisecond read operations
- Optimistic updates by default
- Automatic batching prevents thrashing
- React 18 concurrent features help

**🧠 Cognitive Load**

- Single pattern: `const store = useKalphiteStore()`
- No selectors, no memoization, no optimization
- Direct data access like a local object
- Predictable: all changes trigger all re-renders

### ❌ Intentional Trade-offs

**🔄 Every Component Re-renders**
All components using `useMemoryStore()` re-render on every change. This is intentional - simplicity over performance.

**💾 Memory Usage**
All data lives in memory. For large datasets, this could be limiting.

**📶 Network Efficiency**
Pull polling instead of real-time WebSockets. Simple but not optimal.

### 🎯 Perfect For

- **Learning sync engines** (our primary goal)
- **Prototyping and MVPs**
- **Small to medium applications**
- **Teams prioritizing development speed**
- **Applications where "fast enough" is good enough**

### 🚫 Not Ideal For

- **Large datasets** (>10MB in memory)
- **High-frequency updates** (>100 changes/second)
- **Battery-constrained devices**
- **Ultra-performance-critical applications**

---

## Summary

This memory-first sync engine represents a radical simplification of traditional approaches:

- **All data in memory** for synchronous access
- **Automatic persistence** with background flushing
- **Single React hook** with global re-renders
- **Zero async complexity** in application code
- **Optimistic updates** as the default behavior

The result is a sync engine that's **fun to use**, **impossible to get wrong**, and **perfectly suited for learning** the core concepts without getting lost in optimization complexity.

When you need more performance later, you can always add surgical subscriptions, but you'll be surprised how far this simple approach can take you! 🚀
