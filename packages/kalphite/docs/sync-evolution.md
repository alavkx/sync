# Kalphite Sync Evolution Strategy

## 📋 **Overview**

Evolution from real-time WebSocket sync to a modern **operation-based sync pattern** with HTTP endpoints + WebSocket notifications. This approach maintains backward compatibility while adding proven sync capabilities.

## 🎯 **Target Architecture**

### Current State (Layer 4 - Real-time WebSocket)

```typescript
// Direct entity synchronization
interface SyncChange {
  type: "upsert" | "delete";
  entityType: string;
  entityId: string;
  entity?: any;
}

// Real-time operational transforms
ws.send(JSON.stringify({ type: "sync-change", data: change }));
```

### Evolution Target (Operation-Based Sync)

```typescript
// Named operations with arguments
interface Operation {
  name: string; // addTodo, completeTodo, updateTitle
  args: any[]; // Operation parameters
  id: number; // Sequential per client
  clientId: string; // Client identification
}

// HTTP-first with WebSocket hints
POST / sync / operations; // Push operations
POST / sync / state; // Pull state updates
WebSocket; // Real-time notifications
```

## 🔄 **Compatibility Strategy**

### Phase 1: Interface Extension (Non-Breaking)

**Current interfaces remain functional** while adding new operation-based methods:

```typescript
interface SyncEngine {
  // ✅ Existing methods (keep working)
  sendChange(change: SyncChange): Promise<void>;
  on(event: string, handler: Function): void;
  flush(): Promise<void>;

  // 🆕 New operation-based methods
  executeOperation(name: string, args: any[]): Promise<void>;
  onStatePatch(handler: (patch: StatePatch) => void): void;
  onOperationConfirmed(handler: (op: Operation) => void): void;
}
```

**Backward compatibility wrapper** converts entity changes to operations:

```typescript
async sendChange(change: SyncChange): Promise<void> {
  // Convert legacy change to operation
  const operation = this.convertChangeToOperation(change)
  return this.executeOperation(operation.name, operation.args)
}

private convertChangeToOperation(change: SyncChange): Operation {
  switch (change.type) {
    case "upsert":
      return {
        name: `upsert${change.entityType}`,
        args: [change.entityId, change.entity],
        id: this.generateOperationId(),
        clientId: this.config.userId
      }
    case "delete":
      return {
        name: `delete${change.entityType}`,
        args: [change.entityId],
        id: this.generateOperationId(),
        clientId: this.config.userId
      }
  }
}
```

### Phase 2: Server Contract Specification

**Generic server interface** (not framework-specific):

```typescript
interface ServerSyncContract<TSchema> {
  operations: {
    endpoint: string; // POST /sync/operations
    request: PendingOperation[];
    response: OperationConfirmation[];
  };

  state: {
    endpoint: string; // POST /sync/state
    request: StateSyncRequest;
    response: StateSyncResponse<TSchema>;
  };

  notifications: {
    transport: "websocket" | "sse"; // Real-time hints
    endpoint: string; // ws://host/sync/notify
  };
}
```

**Request/Response Types:**

```typescript
interface PendingOperation {
  name: string;
  args: any[];
  id: number;
  clientId: string;
  timestamp: number;
}

interface OperationConfirmation {
  operationId: number;
  clientId: string;
  success: boolean;
  error?: string;
  serverTimestamp: number;
}

interface StateSyncRequest {
  stateVersion?: string; // Client's current state version
  entityTypes?: string[]; // Optional: limit sync scope
}

interface StateSyncResponse<TSchema> {
  stateVersion: string; // New state version
  entities: ValidatedEntity<TSchema>[]; // Full or delta entities
  deletedEntityIds?: string[]; // Entities to remove
}
```

### Phase 3: Hybrid Transport Implementation

**HTTP-first approach** with WebSocket enhancement:

```typescript
class ModernSyncEngine extends NetworkSyncEngine {
  private httpClient: HttpClient;
  private wsNotifications: WebSocket | null = null;

  // New: HTTP-based operation pushing
  async executeOperation(name: string, args: any[]): Promise<void> {
    const operation: PendingOperation = {
      name,
      args,
      id: this.generateOperationId(),
      clientId: this.config.userId,
      timestamp: Date.now(),
    };

    if (this.isOnline()) {
      const response = await this.httpClient.post("/sync/operations", {
        operations: [operation],
      });
      this.handleOperationConfirmations(response.confirmations);
    } else {
      this.operationQueue.push(operation);
    }
  }

  // New: HTTP-based state synchronization
  async syncState(): Promise<void> {
    const request: StateSyncRequest = {
      stateVersion: this.currentStateVersion,
    };

    const response = await this.httpClient.post("/sync/state", request);
    this.applyStatePatch(response);
    this.currentStateVersion = response.stateVersion;
  }

  // Enhanced: WebSocket for notifications only
  private setupNotifications(): void {
    this.wsNotifications = new WebSocket(this.config.notificationUrl);

    this.wsNotifications.onmessage = (event) => {
      const notification = JSON.parse(event.data);

      switch (notification.type) {
        case "state_changed":
          this.syncState(); // Pull latest state via HTTP
          break;
        case "operation_confirmed":
          this.handleOperationConfirmation(notification.data);
          break;
      }
    };
  }
}
```

## 🔧 **Implementation Phases**

### Phase 1: Documentation & Interface Design

- [x] Document evolution strategy
- [ ] Update API specifications
- [ ] Define server contracts
- [ ] Create migration guide

### Phase 2: Test Evolution

- [ ] Extend existing tests to cover operation-based API
- [ ] Add server contract validation tests
- [ ] Create compatibility test suite
- [ ] HTTP client integration tests

### Phase 3: Implementation

- [ ] Extend NetworkSyncEngine with operation methods
- [ ] Implement HTTP client abstraction
- [ ] Add WebSocket notification handling
- [ ] Create backward compatibility layer

### Phase 4: Demo Evolution

- [ ] Update CLI todo demo to use operations
- [ ] Add server implementation example
- [ ] Create migration examples
- [ ] Performance benchmarking

## 📊 **Benefits of Evolution**

### Reliability Improvements

- **Server authority**: Eliminates complex conflict resolution
- **HTTP reliability**: Better error handling vs WebSocket
- **Speculative execution**: Immediate UI updates with rollback

### Scalability Improvements

- **Reduced WebSocket connections**: Only for notifications
- **HTTP caching**: Standard web caching strategies
- **Operation batching**: Efficient bulk operations

### Developer Experience

- **Familiar HTTP patterns**: Standard REST-like endpoints
- **Better debugging**: HTTP request/response visibility
- **Framework agnostic**: Works with any backend

### Backward Compatibility

- **Zero breaking changes**: Existing code continues working
- **Gradual migration**: Adopt new features incrementally
- **Feature parity**: All current capabilities preserved

## 🚀 **Next Steps**

1. **Update API specifications** with new operation contracts
2. **Evolve test suite** to cover both entity and operation patterns
3. **Implement hybrid transport** layer
4. **Update CLI demo** to showcase new capabilities

This evolution maintains Kalphite's core philosophy of **memory-first, synchronous-feeling** operations while adding proven sync patterns for production reliability.
