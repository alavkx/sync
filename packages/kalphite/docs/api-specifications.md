# Kalphite API Specifications

## Missing TypeScript Interfaces & Implementation Requirements

### Layer 1: TypedCollection Interface

```typescript
// src/store/TypedCollection.ts - NEEDS IMPLEMENTATION
class TypedCollection<T extends Entity = Entity> extends Array<T> {
  constructor(
    private entityType: string,
    private store: KalphiteStoreImpl,
    entities: T[]
  ) {
    super(...entities);
  }

  // MISSING: Core mutation methods
  upsert(id: EntityId, entity: T): T {
    // 1. Validate entity matches collection type
    // 2. Update store._entities map
    // 3. Update this array (maintain reference integrity)
    // 4. Notify subscribers
    // 5. Schedule flush
    // 6. Return entity
  }

  delete(id: EntityId): boolean {
    // 1. Find entity in store and array
    // 2. Remove from store._entities map
    // 3. Remove from this array
    // 4. Notify subscribers
    // 5. Schedule flush
    // 6. Return success boolean
  }

  // MISSING: Query methods
  findById(id: EntityId): T | undefined;
  where(predicate: (entity: T) => boolean): T[];
  orderBy(keySelector: (entity: T) => any): T[];
}
```

### Layer 2: Memory Flush Engine Interfaces

```typescript
// src/types/flush.ts - NEEDS CREATION
export interface FlushConfig {
  flushTarget: FlushTarget;
  debounceMs?: number; // Default: 100
  maxRetries?: number; // Default: 3
  baseRetryDelay?: number; // Default: 100
  maxBatchSize?: number; // Default: 100
  enablePersistence?: boolean; // Default: true
}

export type FlushTarget = (changes: FlushChange[]) => Promise<void>;

export interface FlushChange {
  operation: "upsert" | "delete";
  entityId: EntityId;
  entityType: string;
  entity?: Entity;
  timestamp: number;
}

export interface FlushState {
  pending: Map<EntityId, FlushChange>;
  retryQueue: FlushChange[];
  isFlushInProgress: boolean;
  lastFlushTime: number;
}

// src/engines/MemoryFlushEngine.ts - NEEDS CREATION
export class MemoryFlushEngine {
  private config: Required<FlushConfig>;
  private state: FlushState;
  private debounceTimer?: NodeJS.Timeout;

  constructor(config: FlushConfig) {
    // Initialize with defaults
  }

  scheduleFlush(entityId: EntityId, entity: Entity): void {
    // 1. Add/update in pending changes
    // 2. Cancel existing debounce timer
    // 3. Start new debounce timer
  }

  scheduleDelete(entityId: EntityId, entityType: string): void {
    // 1. Add deletion to pending changes
    // 2. Cancel existing debounce timer
    // 3. Start new debounce timer
  }

  async flush(): Promise<void> {
    // 1. Collect pending changes
    // 2. Clear pending state
    // 3. Call flushTarget with batched changes
    // 4. Handle retries on failure
  }

  private async retryWithBackoff(
    changes: FlushChange[],
    attempt: number
  ): Promise<void> {
    // Exponential backoff retry logic
  }

  getQueuedChanges(): FlushChange[] {
    // Return pending + retry queue for debugging
  }

  pauseFlush(): void;
  resumeFlush(): void;
  destroy(): void;
}
```

### Layer 3: Frontend Database Interfaces

```typescript
// src/types/database.ts - NEEDS CREATION
export interface DatabaseConfig {
  dbName: string;
  schema: StandardSchemaV1;
  enableMigrations?: boolean;
  enableBackup?: boolean;
  maxStorageMB?: number;
}

export interface Migration {
  version: number;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

export type QueryFilter<T> = (entity: T) => boolean;
export type QueryOrderBy<T> = (entity: T) => any;

// src/database/FrontendDatabase.ts - NEEDS CREATION
export class FrontendDatabase {
  private db: PGlite;
  private config: Required<DatabaseConfig>;

  constructor(config: DatabaseConfig) {}

  async init(): Promise<void> {
    // 1. Initialize PGlite
    // 2. Run migrations
    // 3. Create entity tables
  }

  async upsert(
    entityType: string,
    entityId: EntityId,
    entity: Entity
  ): Promise<void> {
    // 1. Serialize entity to JSON
    // 2. INSERT ON CONFLICT UPDATE
    // 3. Handle schema validation
  }

  async delete(entityType: string, entityId: EntityId): Promise<boolean> {
    // DELETE and return success
  }

  async getById(
    entityType: string,
    entityId: EntityId
  ): Promise<Entity | undefined> {
    // SELECT by type and id
  }

  async getByType(entityType: string): Promise<Entity[]> {
    // SELECT all entities of type
  }

  async query<T extends Entity>(
    entityType: string,
    filter?: QueryFilter<T>,
    orderBy?: QueryOrderBy<T>
  ): Promise<T[]> {
    // Advanced querying with filters
  }

  async backup(): Promise<Blob> {
    // Export all data
  }

  async restore(backup: Blob): Promise<void> {
    // Import data from backup
  }

  async close(): Promise<void> {
    // Clean shutdown
  }
}
```

### Layer 4: Network Sync Interfaces

```typescript
// src/types/sync.ts - NEEDS CREATION
export interface SyncConfig {
  wsUrl: string;
  roomId: string;
  userId: string;
  authToken?: string;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface SyncMessage {
  type: "change" | "ack" | "conflict" | "heartbeat";
  payload: any;
  timestamp: number;
  userId: string;
  messageId: string;
}

export interface ChangeMessage extends SyncMessage {
  type: "change";
  payload: {
    operation: "upsert" | "delete";
    entityType: string;
    entityId: EntityId;
    entity?: Entity;
    vector: VectorClock;
  };
}

export type VectorClock = Record<string, number>;

export interface ConflictResolution {
  strategy: "last-write-wins" | "operational-transform" | "manual";
  resolver?: (local: Entity, remote: Entity) => Entity;
}

// src/sync/NetworkSyncEngine.ts - NEEDS CREATION
export class NetworkSyncEngine extends EventEmitter {
  private ws?: WebSocket;
  private config: Required<SyncConfig>;
  private vectorClock: VectorClock;
  private offlineQueue: ChangeMessage[];

  constructor(config: SyncConfig) {}

  async connect(): Promise<void> {
    // 1. Establish WebSocket connection
    // 2. Handle authentication
    // 3. Start heartbeat
    // 4. Process offline queue
  }

  async disconnect(): Promise<void> {
    // Clean disconnect with proper cleanup
  }

  sendChange(change: ChangeMessage): void {
    // 1. Add to offline queue if disconnected
    // 2. Send via WebSocket if connected
    // 3. Wait for acknowledgment
  }

  private handleRemoteChange(message: ChangeMessage): void {
    // 1. Check vector clock for ordering
    // 2. Detect conflicts
    // 3. Apply operational transforms
    // 4. Emit change event
  }

  private resolveConflict(local: Entity, remote: Entity): Entity {
    // Conflict resolution logic
  }

  getConnectionStatus(): "connected" | "connecting" | "disconnected";
  getOfflineQueueSize(): number;
}
```

## Implementation Priority & Dependencies

### Phase 1: Complete Layer 1 (Essential)

1. **Fix TypedCollection** - Core API not working
2. **Add performance optimizations** - Entity deduplication
3. **Comprehensive testing** - Validate all documented behavior

### Phase 2: Implement Layer 2 (High Priority)

1. **MemoryFlushEngine** - Persistence foundation
2. **FlushTarget integration** - Connect to Layer 3/4
3. **Error handling** - Production-ready reliability

### Phase 3: Add Layer 3 (Medium Priority)

1. **PGlite integration** - Local persistence
2. **Schema migration** - Handle schema evolution
3. **Query optimization** - Performance at scale

### Phase 4: Build Layer 4 (Future)

1. **WebSocket sync** - Real-time collaboration
2. **Conflict resolution** - Multi-user editing
3. **Offline support** - Robust connectivity handling

## Testing Strategy

Each interface should have:

- **Unit tests** - Individual method behavior
- **Integration tests** - Layer interaction
- **Performance tests** - Benchmark requirements
- **Error handling tests** - Edge cases and failures
- **Type tests** - TypeScript compliance

The existing test files provide specifications - they need actual implementations to make them pass.
