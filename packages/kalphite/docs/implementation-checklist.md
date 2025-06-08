# Kalphite Implementation Checklist

## 🎯 Priority 1: Fix Layer 1 (TypedCollection API)

### File: `src/store/TypedCollection.ts`

**Current Status**: Basic class exists, missing core methods

**Required Implementations**:

- [ ] **`upsert(id: EntityId, entity: T): T`**

  ```typescript
  upsert(id: EntityId, entity: T): T {
    // 1. Validate entity.type matches this.entityType
    // 2. this.store._entities.set(id, entity)
    // 3. Update this array contents via Array methods
    // 4. this.store.notifySubscribers()
    // 5. this.store.scheduleFlush(id, entity)
    // 6. return entity
  }
  ```

- [ ] **`delete(id: EntityId): boolean`**

  ```typescript
  delete(id: EntityId): boolean {
    // 1. const entity = this.store._entities.get(id)
    // 2. if (!entity || entity.type !== this.entityType) return false
    // 3. this.store._entities.delete(id)
    // 4. Remove from this array
    // 5. this.store.notifySubscribers()
    // 6. this.store.scheduleFlush(id) for deletion
    // 7. return true
  }
  ```

- [ ] **`findById(id: EntityId): T | undefined`**
- [ ] **Array synchronization** - Keep TypedCollection array in sync with store
- [ ] **Performance optimization** - Entity reference sharing

### File: `src/store/KalphiteStore.ts`

**Current Status**: Proxy works but TypedCollection integration broken

**Required Fixes**:

- [ ] **Fix `getTypeCollection()` method** - Ensure array stays synchronized
- [ ] **Add `scheduleDelete()` method** - For deletion tracking
- [ ] **Improve proxy handler** - Better TypedCollection caching
- [ ] **Add flush control methods**:
  - `flushNow(): Promise<void>`
  - `pauseFlush(): void`
  - `resumeFlush(): void`

### Tests to Pass:

- [ ] `src/__tests__/Layer1-TypedCollection.test.ts` - All tests should pass
- [ ] `src/__tests__/Layer1-InMemoryStore.test.ts` - Convert todos to real tests
- [ ] Performance benchmarks from `Acceptance-BasicUsage.test.ts`

---

## 🎯 Priority 2: Implement Layer 2 (Memory Flush Engine)

### File: `src/types/flush.ts`

**Current Status**: Does not exist

**Required Interfaces**:

- [ ] `FlushConfig` interface
- [ ] `FlushChange` interface
- [ ] `FlushState` interface
- [ ] `FlushTarget` type
- [ ] Export all interfaces

### File: `src/engines/MemoryFlushEngine.ts`

**Current Status**: Does not exist

**Required Implementation**:

- [ ] **Constructor** - Accept FlushConfig, set defaults
- [ ] **`scheduleFlush(entityId, entity)`** - Debounced upsert scheduling
- [ ] **`scheduleDelete(entityId, entityType)`** - Debounced delete scheduling
- [ ] **`flush()`** - Batch changes and call flushTarget
- [ ] **Debouncing logic** - Configurable timing (default 100ms)
- [ ] **Error handling** - Exponential backoff retry
- [ ] **Change deduplication** - Latest version wins
- [ ] **Control methods** - pause/resume/destroy

### File: `src/store/KalphiteStore.ts`

**Integration Required**:

- [ ] **Add `flushEngine` to KalphiteConfig**
- [ ] **Call `scheduleFlush()` on mutations**
- [ ] **Call `scheduleDelete()` on deletions**
- [ ] **Expose flush control methods**

### Tests to Pass:

- [ ] `src/__tests__/Layer2-MemoryFlushEngine.test.ts` - All tests should pass
- [ ] Integration tests with KalphiteStore

---

## 🎯 Priority 3: Implement Layer 3 (Frontend Database)

### Dependencies:

- [ ] **Install PGlite**: `pnpm add @electric-sql/pglite`

### File: `src/types/database.ts`

**Current Status**: Does not exist

**Required Interfaces**:

- [ ] `DatabaseConfig` interface
- [ ] `Migration` interface
- [ ] `QueryFilter<T>` and `QueryOrderBy<T>` types

### File: `src/database/FrontendDatabase.ts`

**Current Status**: Does not exist

**Required Implementation**:

- [ ] **Constructor** - Accept DatabaseConfig
- [ ] **`init()`** - Initialize PGlite, run migrations
- [ ] **`upsert()`** - INSERT ON CONFLICT UPDATE
- [ ] **`delete()`** - DELETE by type and id
- [ ] **`getById()`** - SELECT by type and id
- [ ] **`getByType()`** - SELECT all of type
- [ ] **`query()`** - Advanced filtering
- [ ] **`backup()`** and `restore()`\*\* - Data export/import
- [ ] **Schema migration system**

### Tests to Pass:

- [ ] `src/__tests__/Layer3-FrontendDatabase.test.ts` - All tests should pass

---

## 🎯 Priority 4: Implement Layer 4 (Network Sync)

### Dependencies:

- [ ] **WebSocket client** - Built-in or `ws` library
- [ ] **Vector clock library** or custom implementation

### File: `src/types/sync.ts`

**Current Status**: Does not exist

**Required Interfaces**:

- [ ] `SyncConfig` interface
- [ ] `SyncMessage` and `ChangeMessage` interfaces
- [ ] `VectorClock` type
- [ ] `ConflictResolution` interface

### File: `src/sync/NetworkSyncEngine.ts`

**Current Status**: Does not exist

**Required Implementation**:

- [ ] **WebSocket connection management**
- [ ] **Message handling** - Send/receive changes
- [ ] **Vector clock** - Causal ordering
- [ ] **Conflict resolution** - Operational transforms
- [ ] **Offline queue** - Store changes when disconnected
- [ ] **Heartbeat system** - Connection health
- [ ] **Reconnection logic** - Handle connection drops

### Tests to Pass:

- [ ] `src/__tests__/Layer4-NetworkSync.test.ts` - All tests should pass

---

## 📋 Testing Implementation Status

### Current Test Status:

- ✅ **Acceptance tests** - Basic scenarios work
- ⏳ **Layer 1 tests** - Need TypedCollection implementation
- ⏳ **Layer 2 tests** - All `.todo()`, need MemoryFlushEngine
- ⏳ **Layer 3 tests** - All `.todo()`, need FrontendDatabase
- ⏳ **Layer 4 tests** - All `.todo()`, need NetworkSyncEngine

### Test Completion Checklist:

- [ ] Convert all `.todo()` tests to real implementations
- [ ] Add performance benchmarks for each layer
- [ ] Add error handling tests
- [ ] Add integration tests between layers
- [ ] Verify all documented APIs work exactly as shown

---

## 🔧 Development Environment Setup

### Required Dependencies:

```bash
# Layer 3 dependencies
pnpm add @electric-sql/pglite

# Development dependencies (if missing)
pnpm add -D vitest typescript @types/node

# Optional: Type checking
pnpm add -D @types/ws
```

### Folder Structure to Create:

```
packages/kalphite/src/
├── engines/           # Layer 2 - MemoryFlushEngine
├── database/          # Layer 3 - FrontendDatabase
├── sync/              # Layer 4 - NetworkSyncEngine
└── types/
    ├── flush.ts       # Layer 2 types
    ├── database.ts    # Layer 3 types
    └── sync.ts        # Layer 4 types
```

### Commands to Run Tests:

```bash
# Run specific layer tests
pnpm test Layer1-TypedCollection
pnpm test Layer2-MemoryFlushEngine
pnpm test Layer3-FrontendDatabase
pnpm test Layer4-NetworkSync

# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage
```

---

## 🎯 **Immediate Next Action**

**Start with TypedCollection implementation** - this is blocking basic functionality:

1. Open `packages/kalphite/src/store/TypedCollection.ts`
2. Implement `upsert()` and `delete()` methods
3. Run `pnpm test Layer1-TypedCollection` to validate
4. Fix any integration issues with KalphiteStore
5. Move to Layer 2 once Layer 1 tests pass

The functional programming approach you prefer fits well with the memory-first design - focus on pure functions for transformations while keeping side effects (persistence, network) isolated in their respective layers.
