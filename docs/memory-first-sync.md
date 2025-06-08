# Memory-First Sync Engine Design

> **🎯 Approach**: All data in memory, sync engine watches changes and handles persistence

## The Core Insight

Instead of:

```typescript
// ❌ Complex: Async queries everywhere
const comments = await syncEngine.query({ entityType: "comment" });
const comment = await syncEngine.query({ entityId: "comment-123" });
await syncEngine.upsert(id, type, data);
```

Do this:

```typescript
// ✅ Simple: Direct memory access
const comments = store.comments;
const comment = store.comments.get("comment-123");
store.comments.set("comment-123", newComment); // Sync engine automatically detects change
```

## Layered Architecture Overview

### Local User Change Flow

```
1. User Interaction
   ↓
2. In-Memory Store (Hot Layer)
   ↓ Background flush
3. PGlite Frontend (Warm Layer)
   ↓ Sync engine push
4. RPC Endpoints
   ↓ Network
5. PGlite Backend (Cold Layer)
```

### Other User Change Flow

```
1. PGlite Backend (Other user's change)
   ↓ Change detection
2. RPC Poke (Replicache pattern)
   ↓ Notification
3. Sync Engine Pull
   ↓ Download changes
4. PGlite Frontend (Update local DB)
   ↓ Load into memory
5. In-Memory Store (Update hot layer)
   ↓ React subscriptions
6. UI Updates (Automatic re-render)
```

### Complete System Architecture

```
┌─────────────────────────────────────┐
│           React Components          │
│   • Direct memory read/write       │
│   • Synchronous, optimistic        │
│   • Zero loading states            │
└─────────────────┬───────────────────┘
                  │ Sync access
┌─────────────────▼───────────────────┐
│          In-Memory Store            │ ← Hot Layer
│   • Proxy-wrapped collections      │
│   • Change detection               │
│   • Event notifications            │
└─────────────────┬───────────────────┘
                  │ Auto-flush
┌─────────────────▼───────────────────┐
│      PGlite Frontend Database       │ ← Warm Layer
│   • Persistent entity storage      │
│   • Change log for sync            │
│   • Offline-first foundation       │
└─────────────────┬───────────────────┘
                  │ Push/Pull RPC
                  │ (TanStack Start)
┌─────────────────▼───────────────────┐
│       PGlite Backend Database       │ ← Cold Layer
│   • Authoritative server state     │
│   • Multi-client coordination      │
│   • Replication log + versioning   │
└─────────────────────────────────────┘
```

## Change Tracking Strategies

### Option 1: Proxy-Based Detection (Automatic)

```typescript
interface Comment {
  id: string;
  message: string;
  lineNumber: number;
  authorId: string;
}

class MemoryStore {
  private _comments = new Map<string, Comment>();
  private syncEngine: SyncEngine;

  constructor(syncEngine: SyncEngine) {
    this.syncEngine = syncEngine;
  }

  get comments() {
    return new Proxy(this._comments, {
      set: (target, prop, value) => {
        // Detect mutations
        const result = Reflect.set(target, prop, value);

        if (typeof prop === "string" && value) {
          // Track change for sync
          this.syncEngine.trackChange("comment", prop, value);
        }

        return result;
      },

      deleteProperty: (target, prop) => {
        const result = Reflect.deleteProperty(target, prop);

        if (typeof prop === "string") {
          this.syncEngine.trackChange("comment", prop, null); // Deletion
        }

        return result;
      },
    });
  }
}
```

**Usage**:

```typescript
// Automatic change tracking!
store.comments.set("comment-123", newComment); // ← Sync engine detects this
store.comments.delete("comment-456"); // ← Sync engine detects this too
```

### Option 2: Immutable Updates (Explicit)

```typescript
class MemoryStore {
  private state = {
    comments: new Map<string, Comment>(),
    reviews: new Map<string, Review>(),
  };

  // Immutable update methods that track changes
  setComment(id: string, comment: Comment): void {
    const newState = {
      ...this.state,
      comments: new Map(this.state.comments).set(id, comment),
    };

    this.state = newState;
    this.syncEngine.trackChange("comment", id, comment);
  }

  deleteComment(id: string): void {
    const newState = {
      ...this.state,
      comments: new Map(this.state.comments),
    };
    newState.comments.delete(id);

    this.state = newState;
    this.syncEngine.trackChange("comment", id, null);
  }

  // Direct read access (fast & synchronous)
  get comments() {
    return this.state.comments;
  }
}
```

**Usage**:

```typescript
// Explicit but simple
store.setComment("comment-123", newComment); // Tracked
const comments = store.comments; // Fast read
```

### Option 3: Signal/Observable Based (Reactive)

```typescript
import { signal, effect } from "@preact/signals-core";

class ReactiveMemoryStore {
  comments = signal(new Map<string, Comment>());
  reviews = signal(new Map<string, Review>());

  constructor(private syncEngine: SyncEngine) {
    // Watch all changes automatically
    effect(() => {
      const commentsValue = this.comments.value;
      // Sync engine reacts to any change
      this.syncEngine.syncComments(commentsValue);
    });
  }

  // Helper methods for mutations
  setComment(id: string, comment: Comment): void {
    const current = new Map(this.comments.value);
    current.set(id, comment);
    this.comments.value = current;
  }
}
```

## Benefits of Memory-First Approach

### ✅ **Dramatically Simpler API**

**Before (Query-based)**:

```typescript
// React component with async queries everywhere
const CodeReviewDemo = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      const result = await syncEngine.query({ entityType: "comment" });
      setComments(result);
      setLoading(false);
    };
    loadComments();
  }, []);

  const handleAddComment = async (message: string) => {
    setLoading(true);
    await syncEngine.upsert(crypto.randomUUID(), "comment", { message });
    const updated = await syncEngine.query({ entityType: "comment" });
    setComments(updated);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  // ...
};
```

**After (Memory-first)**:

```typescript
// React component with direct memory access
const CodeReviewDemo = () => {
  const comments = Array.from(store.comments.values()); // Always fast & sync

  const handleAddComment = (message: string) => {
    const id = crypto.randomUUID();
    store.comments.set(id, { id, message, lineNumber: 42, authorId: "user-1" });
    // That's it! Change is automatically tracked and synced
  };

  // No loading states, no async complexity
  return (
    <div>
      {comments.map((comment) => (
        <CommentDisplay key={comment.id} comment={comment} />
      ))}
    </div>
  );
};
```

### ✅ **Everything is Optimistic by Default**

Users see changes **immediately** because they're working directly with memory. The sync engine handles persistence in the background without blocking the UI.

### ✅ **Perfect for React**

```typescript
// Natural React patterns
const useComments = () => {
  const [comments, setComments] = useState(() =>
    Array.from(store.comments.values())
  );

  useEffect(() => {
    const unsubscribe = store.onCommentsChange(() => {
      setComments(Array.from(store.comments.values()));
    });
    return unsubscribe;
  }, []);

  return comments;
};
```

### ✅ **Clear Separation of Concerns**

- **Memory Store**: Fast synchronous access, change detection
- **Sync Engine**: Background persistence, conflict resolution, network sync
- **UI Components**: Simple read/write to memory, no async complexity

## Layered Implementation

### Layer 1: In-Memory Store (Hot Layer)

```typescript
import { PGlite } from "@electric-sql/pglite";

interface Entity {
  id: string;
  type: string;
  data: any;
  updatedAt: number;
}

class MemoryStore {
  private _entities = new Map<string, Entity>();
  private changeListeners: ((
    entityId: string,
    entity: Entity | null
  ) => void)[] = [];
  private flushEngine: MemoryFlushEngine;

  constructor(flushEngine: MemoryFlushEngine) {
    this.flushEngine = flushEngine;
  }

  // Proxy-wrapped entities for automatic change detection
  get entities() {
    return new Proxy(this._entities, {
      set: (target, prop, value) => {
        const result = Reflect.set(target, prop, value);

        if (typeof prop === "string" && value) {
          // Auto-flush to PGlite layer
          this.flushEngine.scheduleFlush(prop, value);

          // Notify React components
          this.changeListeners.forEach((listener) => listener(prop, value));
        }

        return result;
      },

      deleteProperty: (target, prop) => {
        const existing = target.get(prop as string);
        const result = Reflect.deleteProperty(target, prop);

        if (typeof prop === "string" && existing) {
          // Auto-flush deletion
          this.flushEngine.scheduleFlush(prop, { ...existing, deleted: true });

          // Notify React components
          this.changeListeners.forEach((listener) => listener(prop, null));
        }

        return result;
      },
    });
  }

  // Synchronous read operations (fast!)
  getById(id: string): Entity | null {
    return this._entities.get(id) || null;
  }

  getByType(type: string): Entity[] {
    return Array.from(this._entities.values()).filter((e) => e.type === type);
  }

  // Event system for React components
  onChange(
    listener: (entityId: string, entity: Entity | null) => void
  ): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) this.changeListeners.splice(index, 1);
    };
  }

  // Load entities from PGlite into memory (called during initialization)
  loadFromPGlite(entities: Entity[]): void {
    entities.forEach((entity) => {
      this._entities.set(entity.id, entity);
    });
  }
}
```

### Layer 2: Memory Flush Engine (Hot → Warm)

```typescript
class MemoryFlushEngine {
  private pendingFlushes = new Map<string, Entity>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private frontendDB: FrontendPGliteDB) {}

  // Schedule entity to be flushed to PGlite (debounced)
  scheduleFlush(entityId: string, entity: Entity): void {
    this.pendingFlushes.set(entityId, entity);

    // Debounce flushes - batch multiple changes together
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushToPGlite();
    }, 100); // 100ms debounce
  }

  private async flushToPGlite(): Promise<void> {
    if (this.pendingFlushes.size === 0) return;

    const entitiesToFlush = Array.from(this.pendingFlushes.values());
    this.pendingFlushes.clear();

    try {
      // Batch write to PGlite
      await this.frontendDB.saveEntities(entitiesToFlush);

      console.log(`Flushed ${entitiesToFlush.length} entities to PGlite`);
    } catch (error) {
      console.error("Failed to flush to PGlite:", error);

      // Re-queue failed flushes
      entitiesToFlush.forEach((entity) => {
        this.pendingFlushes.set(entity.id, entity);
      });
    }
  }
}
```

### Layer 3: Frontend PGlite Database (Warm Layer)

```typescript
class FrontendPGliteDB {
  private db: PGlite;
  private syncEngine: NetworkSyncEngine;

  constructor(syncEngine: NetworkSyncEngine) {
    this.db = new PGlite("idb://sync-engine-frontend");
    this.syncEngine = syncEngine;
  }

  async initialize(): Promise<void> {
    await this.db.exec(`
      -- Entity storage table
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_at BIGINT NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE
      );

      -- Change log for sync
      CREATE TABLE IF NOT EXISTS changes (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        data JSONB NOT NULL,
        timestamp BIGINT NOT NULL,
        is_synced BOOLEAN DEFAULT FALSE
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_changes_synced ON changes(is_synced);
    `);
  }

  // Called by MemoryFlushEngine
  async saveEntities(entities: Entity[]): Promise<void> {
    await this.db.query("BEGIN");

    try {
      for (const entity of entities) {
        // Save/update entity
        await this.db.query(
          `
          INSERT INTO entities (id, type, data, updated_at, is_deleted)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted
        `,
          [
            entity.id,
            entity.type,
            JSON.stringify(entity.data),
            entity.updatedAt,
            entity.deleted || false,
          ]
        );

        // Record change for sync
        await this.db.query(
          `
          INSERT INTO changes (id, entity_id, entity_type, operation, data, timestamp, is_synced)
          VALUES ($1, $2, $3, $4, $5, $6, FALSE)
        `,
          [
            crypto.randomUUID(),
            entity.id,
            entity.type,
            entity.deleted ? "delete" : "upsert",
            JSON.stringify(entity.data),
            entity.updatedAt,
          ]
        );
      }

      await this.db.query("COMMIT");

      // Trigger sync engine push
      this.syncEngine.schedulePush();
    } catch (error) {
      await this.db.query("ROLLBACK");
      throw error;
    }
  }

  // Load all entities into memory (called during initialization)
  async loadAllEntities(): Promise<Entity[]> {
    const result = await this.db.query(`
      SELECT id, type, data, updated_at 
      FROM entities 
      WHERE is_deleted = FALSE
    `);

    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      data: JSON.parse(row.data),
      updatedAt: row.updated_at,
    }));
  }

  // Get pending changes for sync
  async getPendingChanges(): Promise<Change[]> {
    const result = await this.db.query(`
      SELECT * FROM changes WHERE is_synced = FALSE ORDER BY timestamp ASC
    `);

    return result.rows.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      operation: row.operation,
      data: JSON.parse(row.data),
      timestamp: row.timestamp,
    }));
  }

  // Mark changes as synced
  async markChangesSynced(changeIds: string[]): Promise<void> {
    if (changeIds.length === 0) return;

    const placeholders = changeIds.map((_, i) => `$${i + 1}`).join(",");
    await this.db.query(
      `
      UPDATE changes SET is_synced = TRUE WHERE id IN (${placeholders})
    `,
      changeIds
    );
  }
}
```

## Potential Issues & Solutions

### 🤔 **Memory Usage**

**Problem**: All data loaded in memory could be large.

**Solutions**:

- Start simple: Most apps have < 10MB of data
- Add pagination later if needed: `store.loadCommentsPage(2)`
- Implement data pruning: Remove old entities from memory
- Use efficient data structures: Maps instead of arrays for lookups

### 🤔 **Initial Load Time**

**Problem**: Must load all data before app becomes interactive.

**Solutions**:

- Progressive loading: Load critical data first
- Show loading indicator during initial sync
- Cache in localStorage for instant subsequent loads
- Implement background preloading

### 🤔 **Change Detection Complexity**

**Problem**: Tracking nested object mutations can be tricky.

**Solutions**:

- Use immutable updates (simplest)
- Proxy wrappers for automatic detection
- Reactive signals/observables
- Manual tracking with helper methods

## Comparison with Current Approach

| Aspect              | Current (Query-based)            | Memory-first                     |
| ------------------- | -------------------------------- | -------------------------------- |
| **Read Access**     | `await syncEngine.query(...)`    | `store.comments.get(id)`         |
| **Write Access**    | `await syncEngine.upsert(...)`   | `store.comments.set(id, data)`   |
| **UI Complexity**   | Async everywhere, loading states | Synchronous, always optimistic   |
| **Change Tracking** | Manual in sync engine            | Automatic via proxies/signals    |
| **Performance**     | Database query per read          | Memory access (instant)          |
| **Offline Support** | Complex caching needed           | Built-in (memory is the cache)   |
| **Learning Curve**  | High (async patterns)            | Low (direct object manipulation) |

## Recommendation

**This memory-first approach is perfect for learning sync engines** because:

1. **Core sync concepts remain**: Optimistic updates, conflict resolution, offline support
2. **Complexity is hidden**: Sync happens in background, UI is simple
3. **Natural for React**: Direct state manipulation, easy to observe changes
4. **Progressive enhancement**: Can add query optimizations later

### Layer 4: Network Sync Engine (Warm ↔ Cold)

```typescript
import { pushChanges, pullChanges } from "../api/sync"; // TanStack Start RPC

class NetworkSyncEngine {
  private pushTimer: NodeJS.Timeout | null = null;
  private isPushing = false;

  constructor(
    private frontendDB: FrontendPGliteDB,
    private memoryStore: MemoryStore
  ) {
    // Start background pull polling
    this.startBackgroundPull();
  }

  // Called by FrontendPGliteDB when changes are ready
  schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);

    this.pushTimer = setTimeout(() => {
      this.performPush();
    }, 1000); // 1 second debounce
  }

  private async performPush(): Promise<void> {
    if (this.isPushing) return;
    this.isPushing = true;

    try {
      const pendingChanges = await this.frontendDB.getPendingChanges();

      if (pendingChanges.length === 0) return;

      // Push to server via TanStack Start RPC
      await pushChanges({
        clientId: "user-123", // TODO: Get real client ID
        changes: pendingChanges,
      });

      // Mark as synced
      const changeIds = pendingChanges.map((c) => c.id);
      await this.frontendDB.markChangesSynced(changeIds);

      console.log(`Pushed ${pendingChanges.length} changes to server`);
    } catch (error) {
      console.error("Push failed:", error);
    } finally {
      this.isPushing = false;
    }
  }

  // Background pull from server (Replicache pattern)
  private startBackgroundPull(): void {
    setInterval(async () => {
      await this.performPull();
    }, 5000); // Poll every 5 seconds
  }

  private async performPull(): Promise<void> {
    try {
      // Get latest version from local DB
      const lastVersion = await this.getLastSyncedVersion();

      // Pull from server via TanStack Start RPC
      const result = await pullChanges({
        clientId: "user-123",
        lastSeenVersion: lastVersion,
      });

      if (result.changes.length === 0) return;

      // Apply changes to frontend PGlite
      await this.applyRemoteChanges(result.changes);

      // Reload affected entities into memory
      await this.reloadMemoryFromPGlite();

      console.log(`Pulled ${result.changes.length} changes from server`);
    } catch (error) {
      console.error("Pull failed:", error);
    }
  }

  private async applyRemoteChanges(changes: Change[]): Promise<void> {
    // Apply remote changes to local PGlite without triggering sync
    for (const change of changes) {
      const entity: Entity = {
        id: change.entityId,
        type: change.entityType,
        data: change.data,
        updatedAt: change.timestamp,
      };

      // Direct write to PGlite (bypass change tracking)
      await this.frontendDB.saveEntities([entity]);
    }
  }

  private async reloadMemoryFromPGlite(): Promise<void> {
    // Reload all entities from PGlite into memory
    const entities = await this.frontendDB.loadAllEntities();
    this.memoryStore.loadFromPGlite(entities);
  }

  private async getLastSyncedVersion(): Promise<number> {
    // TODO: Implement version tracking
    return 0;
  }
}
```

## Complete Usage Example

### System Initialization

```typescript
// Initialize the layered sync system
async function createSyncSystem(): Promise<MemoryStore> {
  // Create layers from bottom up
  const networkSyncEngine = new NetworkSyncEngine();
  const frontendDB = new FrontendPGliteDB(networkSyncEngine);
  const flushEngine = new MemoryFlushEngine(frontendDB);
  const memoryStore = new MemoryStore(flushEngine);

  // Initialize databases
  await frontendDB.initialize();

  // Load initial data from PGlite into memory
  const entities = await frontendDB.loadAllEntities();
  memoryStore.loadFromPGlite(entities);

  return memoryStore;
}
```

### React Integration (Ultra Simple!)

```typescript
// React component using the memory store
const CodeReviewDemo = () => {
  // Direct memory access - always synchronous!
  const comments = store.getByType("comment");
  const reviews = store.getByType("review");

  // Add comment - immediate UI update
  const handleAddComment = (message: string, lineNumber: number) => {
    const id = crypto.randomUUID();

    // This triggers the entire sync flow automatically!
    store.entities.set(id, {
      id,
      type: "comment",
      data: { message, lineNumber, authorId: "user-1" },
      updatedAt: Date.now(),
    });
  };

  // Edit comment - immediate UI update
  const handleEditComment = (commentId: string, newMessage: string) => {
    const existing = store.getById(commentId);
    if (existing) {
      // This also triggers sync automatically!
      store.entities.set(commentId, {
        ...existing,
        data: { ...existing.data, message: newMessage },
        updatedAt: Date.now(),
      });
    }
  };

  // Delete comment - immediate UI update
  const handleDeleteComment = (commentId: string) => {
    // This triggers deletion sync!
    store.entities.delete(commentId);
  };

  return (
    <div>
      <h2>Comments ({comments.length})</h2>
      {comments.map((comment) => (
        <div key={comment.id}>
          <p>{comment.data.message}</p>
          <button onClick={() => handleEditComment(comment.id, "Updated!")}>
            Edit
          </button>
          <button onClick={() => handleDeleteComment(comment.id)}>
            Delete
          </button>
        </div>
      ))}
      <button onClick={() => handleAddComment("New comment!", 42)}>
        Add Comment
      </button>
    </div>
  );
};
```

## Benefits of This Layered Approach

✅ **Best of Both Worlds**: Memory simplicity + PGlite robustness  
✅ **Automatic Sync**: Changes flow through layers automatically  
✅ **Replicache Patterns**: Proper push/pull with conflict resolution  
✅ **Offline-First**: PGlite provides persistence, memory provides speed  
✅ **Zero Async UI**: Components work with synchronous memory access  
✅ **Scalable**: Can optimize each layer independently

**Ready to implement this layered memory-first sync engine?** 🚀
