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

### Layer 4: Network Sync Interfaces (Legacy WebSocket)

```typescript
// src/types/sync.ts - EXISTING (WebSocket-based)
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

// src/sync/NetworkSyncEngine.ts - EXISTING IMPLEMENTATION
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

## 🆕 **Layer 4 Evolution: Operation-Based Sync**

### Modern Sync Interfaces (HTTP + WebSocket)

```typescript
// src/types/modern-sync.ts - NEW INTERFACES

export interface ModernSyncConfig {
  // HTTP endpoints
  baseUrl: string; // http://api.example.com
  operationsEndpoint?: string; // /sync/operations (default)
  stateEndpoint?: string; // /sync/state (default)

  // WebSocket notifications (optional)
  notificationUrl?: string; // ws://api.example.com/sync/notify

  // Client identification
  clientId: string; // Unique client identifier
  userId: string; // User identifier

  // Configuration
  authToken?: string;
  batchSize?: number; // Default: 10
  stateVersionKey?: string; // Default: "stateVersion"
  offlineQueueLimit?: number; // Default: 1000
}

export interface PendingOperation {
  name: string; // addTodo, completeTodo, updateTitle
  args: any[]; // Operation parameters
  id: number; // Sequential per client
  clientId: string; // Client identification
  timestamp: number; // When operation was created
}

export interface OperationConfirmation {
  operationId: number; // Matches PendingOperation.id
  clientId: string; // Client that sent operation
  success: boolean; // Operation succeeded
  error?: string; // Error message if failed
  serverTimestamp: number; // Server processing time
}

export interface StateSyncRequest {
  stateVersion?: string; // Client's current state version
  entityTypes?: string[]; // Optional: limit sync scope
  lastSyncTimestamp?: number; // For delta sync
}

export interface StateSyncResponse<TSchema> {
  stateVersion: string; // New state version
  entities: ValidatedEntity<TSchema>[]; // Full or delta entities
  deletedEntityIds?: string[]; // Entities to remove
  syncTimestamp: number; // Server sync time
}

export interface StatePatch {
  stateVersion: string; // New version after patch
  operations: ConfirmedOperation[]; // Operations that caused changes
  entities: Entity[]; // Entities modified/added
  deletedEntityIds: string[]; // Entities removed
  timestamp: number; // When patch was created
}

export interface ConfirmedOperation {
  name: string;
  args: any[];
  id: number;
  clientId: string;
  serverTimestamp: number;
  result?: any; // Operation result if any
}

// HTTP Client abstraction
export interface HttpClient {
  post<TRequest, TResponse>(
    endpoint: string,
    data: TRequest,
    options?: RequestOptions
  ): Promise<TResponse>;

  get<TResponse>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<TResponse>;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

// WebSocket notification types
export interface NotificationMessage {
  type:
    | "state_changed"
    | "operation_confirmed"
    | "client_connected"
    | "client_disconnected";
  payload: any;
  timestamp: number;
}

export interface StateChangedNotification extends NotificationMessage {
  type: "state_changed";
  payload: {
    stateVersion: string;
    affectedEntityTypes: string[];
    triggerClientId?: string;
  };
}

export interface OperationConfirmedNotification extends NotificationMessage {
  type: "operation_confirmed";
  payload: OperationConfirmation;
}
```

### Modern Sync Engine Interface

```typescript
// src/sync/ModernSyncEngine.ts - NEW HYBRID IMPLEMENTATION

export class ModernSyncEngine extends NetworkSyncEngine {
  private httpClient: HttpClient;
  private wsNotifications: WebSocket | null = null;
  private currentStateVersion: string = "";
  private pendingOperations: Map<number, PendingOperation> = new Map();
  private operationQueue: PendingOperation[] = [];

  constructor(config: ModernSyncConfig) {
    // Initialize with backward compatibility
    super({
      wsUrl: config.notificationUrl || "",
      roomId: "default",
      userId: config.userId,
    });

    this.httpClient = new HttpClientImpl(config);
    this.config = config;
  }

  // 🆕 NEW: Operation-based sync methods
  async executeOperation(name: string, args: any[]): Promise<void> {
    const operation: PendingOperation = {
      name,
      args,
      id: this.generateOperationId(),
      clientId: this.config.clientId,
      timestamp: Date.now(),
    };

    this.pendingOperations.set(operation.id, operation);

    if (this.isOnline()) {
      await this.pushOperations([operation]);
    } else {
      this.operationQueue.push(operation);
    }
  }

  async syncState(): Promise<void> {
    const request: StateSyncRequest = {
      stateVersion: this.currentStateVersion,
      lastSyncTimestamp: this.lastSyncTimestamp,
    };

    const response = await this.httpClient.post<
      StateSyncRequest,
      StateSyncResponse<any>
    >(this.config.stateEndpoint || "/sync/state", request);

    this.applyStatePatch({
      stateVersion: response.stateVersion,
      operations: [], // State sync doesn't include operations
      entities: response.entities,
      deletedEntityIds: response.deletedEntityIds || [],
      timestamp: response.syncTimestamp,
    });

    this.currentStateVersion = response.stateVersion;
    this.lastSyncTimestamp = response.syncTimestamp;
  }

  private async pushOperations(operations: PendingOperation[]): Promise<void> {
    try {
      const response = await this.httpClient.post<
        { operations: PendingOperation[] },
        { confirmations: OperationConfirmation[] }
      >(this.config.operationsEndpoint || "/sync/operations", { operations });

      this.handleOperationConfirmations(response.confirmations);
    } catch (error) {
      // Add back to queue for retry
      this.operationQueue.push(...operations);
      throw error;
    }
  }

  private handleOperationConfirmations(
    confirmations: OperationConfirmation[]
  ): void {
    for (const confirmation of confirmations) {
      const pendingOp = this.pendingOperations.get(confirmation.operationId);

      if (pendingOp) {
        this.pendingOperations.delete(confirmation.operationId);

        if (confirmation.success) {
          this.emit("operationConfirmed", {
            ...pendingOp,
            serverTimestamp: confirmation.serverTimestamp,
          });
        } else {
          this.emit("operationFailed", {
            operation: pendingOp,
            error: confirmation.error,
          });
        }
      }
    }
  }

  private applyStatePatch(patch: StatePatch): void {
    // Apply entities and deletions to store
    for (const entity of patch.entities) {
      this.emit("remoteChange", {
        type: "upsert",
        entityType: entity.type,
        entityId: entity.id,
        entity,
        timestamp: patch.timestamp,
        userId: "server",
        operationId: `state-${patch.timestamp}`,
      });
    }

    for (const deletedId of patch.deletedEntityIds) {
      // Need to determine entity type from deleted ID
      // This might require server to provide type info
      this.emit("remoteChange", {
        type: "delete",
        entityType: "unknown", // TODO: Server should provide type
        entityId: deletedId,
        timestamp: patch.timestamp,
        userId: "server",
        operationId: `state-delete-${patch.timestamp}`,
      });
    }

    this.emit("statePatch", patch);
  }

  // Enhanced WebSocket notifications
  private setupNotifications(): void {
    if (!this.config.notificationUrl) return;

    this.wsNotifications = new WebSocket(this.config.notificationUrl);

    this.wsNotifications.onmessage = (event) => {
      const notification: NotificationMessage = JSON.parse(event.data);

      switch (notification.type) {
        case "state_changed":
          // Pull latest state via HTTP
          this.syncState().catch((error) => this.emit("error", error));
          break;

        case "operation_confirmed":
          const opNotification = notification as OperationConfirmedNotification;
          this.handleOperationConfirmations([opNotification.payload]);
          break;
      }
    };
  }

  // 🔄 COMPATIBILITY: Legacy methods still work
  async sendChange(
    change: Omit<SyncChange, "operationId" | "timestamp" | "userId">
  ): Promise<void> {
    // Convert to operation
    const operation = this.convertChangeToOperation(change);
    return this.executeOperation(operation.name, operation.args);
  }

  private convertChangeToOperation(change: SyncChange): {
    name: string;
    args: any[];
  } {
    switch (change.type) {
      case "upsert":
        return {
          name: `upsert${change.entityType}`,
          args: [change.entityId, change.entity],
        };
      case "delete":
        return {
          name: `delete${change.entityType}`,
          args: [change.entityId],
        };
    }
  }

  // New event handlers
  onStatePatch(handler: (patch: StatePatch) => void): void {
    this.on("statePatch", handler);
  }

  onOperationConfirmed(handler: (op: ConfirmedOperation) => void): void {
    this.on("operationConfirmed", handler);
  }

  onOperationFailed(
    handler: (data: { operation: PendingOperation; error: string }) => void
  ): void {
    this.on("operationFailed", handler);
  }

  // Status methods
  getPendingOperations(): PendingOperation[] {
    return Array.from(this.pendingOperations.values());
  }

  getQueuedOperations(): PendingOperation[] {
    return [...this.operationQueue];
  }

  getCurrentStateVersion(): string {
    return this.currentStateVersion;
  }
}
```

### Server Contract Specification

```typescript
// src/types/server-contract.ts - SERVER IMPLEMENTATION GUIDE

export interface ServerSyncContract<TSchema> {
  operations: {
    endpoint: string; // POST /sync/operations
    request: { operations: PendingOperation[] };
    response: { confirmations: OperationConfirmation[] };

    // Server should:
    // 1. Validate each operation against schema
    // 2. Execute operations in order
    // 3. Update server state
    // 4. Return confirmations
    // 5. Notify other clients via WebSocket
  };

  state: {
    endpoint: string; // POST /sync/state
    request: StateSyncRequest;
    response: StateSyncResponse<TSchema>;

    // Server should:
    // 1. Compare client stateVersion with current
    // 2. Return delta or full state as needed
    // 3. Include new stateVersion
    // 4. Optionally support entity type filtering
  };

  notifications: {
    transport: "websocket" | "sse"; // Real-time hints
    endpoint: string; // ws://host/sync/notify

    // Server should send:
    // - state_changed when any client modifies state
    // - operation_confirmed for async operation results
    // - client_connected/disconnected for presence
  };
}

// Validation utilities (framework agnostic)
export interface SyncValidator<TSchema> {
  validateOperation(raw: unknown): Result<ValidatedOperation<TSchema>>;
  validateStateData(raw: unknown): Result<ValidatedEntity<TSchema>>;

  // Generic middleware pattern (not framework-specific)
  createMiddleware(): (req: any, res: any, next: any) => void;
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ValidatedOperation<TSchema> {
  name: string;
  args: any[];
  schema: TSchema;
  isValid: boolean;
}

export interface ValidatedEntity<TSchema> {
  id: string;
  type: string;
  data: any;
  schema: TSchema;
  isValid: boolean;
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

### Phase 4A: Maintain Layer 4 Legacy (Existing)

1. **WebSocket sync** - Keep existing real-time collaboration
2. **Conflict resolution** - Maintain multi-user editing
3. **Offline support** - Preserve robust connectivity handling

### Phase 4B: Evolve Layer 4 Modern (New)

1. **HTTP client implementation** - HTTP-first sync pattern
2. **Operation-based sync** - Named operations with args
3. **Hybrid notifications** - WebSocket hints + HTTP reliability
4. **Backward compatibility** - Legacy methods still work

## Testing Strategy

Each interface should have:

- **Unit tests** - Individual method behavior
- **Integration tests** - Layer interaction
- **Performance tests** - Benchmark requirements
- **Error handling tests** - Edge cases and failures
- **Type tests** - TypeScript compliance
- **Migration tests** - Legacy to modern compatibility

The existing test files provide specifications - they need actual implementations to make them pass.

## Migration Guide

### From Legacy NetworkSyncEngine to ModernSyncEngine

```typescript
// Before (still works)
syncEngine.sendChange({
  type: "upsert",
  entityType: "todo",
  entityId: "todo-1",
  entity: { id: "todo-1", title: "Buy groceries", completed: false },
});

// After (new capabilities)
await syncEngine.executeOperation("addTodo", ["Buy groceries"]);
await syncEngine.executeOperation("completeTodo", ["todo-1"]);

// Enhanced event handling
syncEngine.onStatePatch((patch) => {
  console.log(`State updated to version ${patch.stateVersion}`);
});

syncEngine.onOperationConfirmed((operation) => {
  console.log(`Operation ${operation.name} confirmed by server`);
});
```
