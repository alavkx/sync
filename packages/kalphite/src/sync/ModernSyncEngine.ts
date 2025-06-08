import type {
  ConfirmedOperation,
  Entity,
  HttpClient,
  ModernSyncConfig,
  NotificationMessage,
  OperationConfirmation,
  OperationConfirmedNotification,
  PendingOperation,
  StatePatch,
  StateSyncRequest,
  StateSyncResponse,
} from "../types/modern-sync";
import { HttpClientImpl } from "./HttpClient";
import type { SyncChange } from "./NetworkSyncEngine";
import { NetworkSyncEngine } from "./NetworkSyncEngine";

export class ModernSyncEngine extends NetworkSyncEngine {
  private httpClient: HttpClient;
  private modernConfig: ModernSyncConfig;
  private wsNotifications: WebSocket | null = null;
  private currentStateVersion: string = "";
  private lastSyncTimestamp: number = 0;
  private pendingOperations: Map<number, PendingOperation> = new Map();
  private modernOperationQueue: PendingOperation[] = [];
  private operationIdCounter: number = 0;
  private batchSize: number;
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchedOperations: PendingOperation[] = [];
  private optimisticUpdates: Map<string, { entity: Entity; original: Entity }> =
    new Map();

  constructor(config: ModernSyncConfig) {
    // Initialize parent with backward compatibility
    super({
      wsUrl: config.notificationUrl || "",
      roomId: "default",
      userId: config.userId,
      authToken: config.authToken,
    });

    this.modernConfig = config;
    this.httpClient = new HttpClientImpl(config);
    this.batchSize = config.batchSize || 10;
  }

  async connect(): Promise<void> {
    // Connect parent (WebSocket) if notification URL provided
    if (this.modernConfig.notificationUrl) {
      try {
        await super.connect();
      } catch (error) {
        // WebSocket connection is optional, continue without it
        console.warn(
          "WebSocket connection failed, continuing with HTTP-only mode:",
          error
        );
      }
      this.setupNotifications();
    }

    // Perform initial state sync
    await this.syncState();

    // Process any queued operations
    await this.flushOperationQueue();
  }

  // 🆕 NEW: Operation-based sync methods
  async executeOperation(name: string, args: any[]): Promise<void> {
    const operation: PendingOperation = {
      name,
      args,
      id: this.generateModernOperationId(),
      clientId: this.modernConfig.clientId,
      timestamp: Date.now(),
    };

    this.pendingOperations.set(operation.id, operation);

    // Apply optimistic update
    const affectedEntities = this.applyOptimisticUpdate(operation);

    if (this.isOnline()) {
      this.batchedOperations.push(operation);

      if (this.batchedOperations.length >= this.batchSize) {
        await this.flushBatchedOperations();
      } else {
        this.scheduleBatchSend();
      }
    } else {
      this.addToQueue(operation);
    }
  }

  private addToQueue(operation: PendingOperation): void {
    const queueLimit = this.modernConfig.offlineQueueLimit || 1000;
    if (this.modernOperationQueue.length >= queueLimit) {
      // Remove oldest operation when queue is full
      this.modernOperationQueue.shift();
    }
    this.modernOperationQueue.push(operation);
  }

  private scheduleBatchSend(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flushBatchedOperations();
    }, 50); // Small delay to allow batching
  }

  private async flushBatchedOperations(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchedOperations.length === 0) return;

    const operations = [...this.batchedOperations];
    this.batchedOperations = [];

    try {
      await this.pushOperations(operations);
    } catch (error) {
      // If push fails, add all operations back to queue
      operations.forEach((op) => this.addToQueue(op));
      throw error;
    }
  }

  async syncState(): Promise<void> {
    const request: StateSyncRequest = {
      stateVersion: this.currentStateVersion || undefined,
      lastSyncTimestamp: this.lastSyncTimestamp || undefined,
    };

    try {
      const response = await this.httpClient.post<
        StateSyncRequest,
        StateSyncResponse
      >(this.modernConfig.stateEndpoint || "/sync/state", request);

      this.applyStatePatch({
        stateVersion: response.stateVersion,
        operations: [], // State sync doesn't include operations
        entities: response.entities,
        deletedEntityIds: response.deletedEntityIds || [],
        timestamp: response.syncTimestamp,
      });

      this.currentStateVersion = response.stateVersion;
      this.lastSyncTimestamp = response.syncTimestamp;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  private async pushOperations(operations: PendingOperation[]): Promise<void> {
    const maxRetries = this.modernConfig.retryAttempts || 3;
    const baseDelay = this.modernConfig.retryDelay || 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.httpClient.post<
          { operations: PendingOperation[] },
          { confirmations: OperationConfirmation[] }
        >(this.modernConfig.operationsEndpoint || "/sync/operations", {
          operations,
        });

        await this.handleOperationConfirmations(response.confirmations);
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          // Last attempt failed, add to queue for later retry
          operations.forEach((op) => this.addToQueue(op));
          throw error;
        }

        // Wait with exponential backoff before retrying
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async flushOperationQueue(): Promise<void> {
    if (this.modernOperationQueue.length === 0) return;

    const batchSize = this.modernConfig.batchSize || 10;
    const toFlush = this.modernOperationQueue.splice(0, batchSize);

    try {
      await this.pushOperations(toFlush);

      // If successful and there are more, continue flushing
      if (this.modernOperationQueue.length > 0) {
        await this.flushOperationQueue();
      }
    } catch (error) {
      // Put failed operations back at the front of the queue
      this.modernOperationQueue.unshift(...toFlush);
      throw error;
    }
  }

  private async handleOperationConfirmations(
    confirmations: OperationConfirmation[]
  ): Promise<void> {
    for (const confirmation of confirmations) {
      const operation = this.pendingOperations.get(confirmation.operationId);
      if (!operation) continue;

      if (confirmation.success) {
        // Operation succeeded, clear optimistic update
        const [entityId] = operation.args;
        this.optimisticUpdates.delete(entityId);

        const confirmedOp: ConfirmedOperation = {
          ...operation,
          serverTimestamp: confirmation.serverTimestamp,
        };
        this.emit("operationConfirmed", confirmedOp);
      } else {
        // Operation failed, rollback optimistic update
        const [entityId] = operation.args;
        const update = this.optimisticUpdates.get(entityId);
        if (update) {
          // Rollback to original state
          this.rollbackOptimisticUpdate(entityId, update.original);
          this.optimisticUpdates.delete(entityId);
        }

        this.emit("operationFailed", {
          operation,
          error: confirmation.error || "Unknown error",
        });
      }

      this.pendingOperations.delete(confirmation.operationId);
    }
  }

  private applyOptimisticUpdate(operation: PendingOperation): Entity[] {
    const affectedEntities: Entity[] = [];

    // Simple optimistic update logic - can be extended based on operation type
    switch (operation.name) {
      case "upsert":
        const [entityId, entity] = operation.args;
        const original = this.getEntity(entityId);
        if (original) {
          this.optimisticUpdates.set(entityId, { entity, original });
          affectedEntities.push(entity);
        }
        break;
      case "delete":
        const [id] = operation.args;
        const existing = this.getEntity(id);
        if (existing) {
          this.optimisticUpdates.set(id, {
            entity: { ...existing, deleted: true },
            original: existing,
          });
          affectedEntities.push(existing);
        }
        break;
    }

    return affectedEntities;
  }

  private applyStatePatch(patch: StatePatch): void {
    // Apply entities as remote changes
    for (const entity of patch.entities) {
      this.emit("remoteChange", {
        type: "upsert",
        entityType: entity.type,
        entityId: entity.id,
        entity,
        timestamp: patch.timestamp,
        userId: "server",
        operationId: `state-${patch.timestamp}-${entity.id}`,
      });
    }

    // Apply deletions as remote changes
    for (const deletedId of patch.deletedEntityIds) {
      // Try to determine entity type from ID (this could be improved)
      const entityType = this.inferEntityTypeFromId(deletedId);
      this.emit("remoteChange", {
        type: "delete",
        entityType,
        entityId: deletedId,
        timestamp: patch.timestamp,
        userId: "server",
        operationId: `state-delete-${patch.timestamp}-${deletedId}`,
      });
    }

    this.emit("statePatch", patch);
  }

  private inferEntityTypeFromId(id: string): string {
    // Simple heuristic - look for type prefix in ID
    // e.g., "todo-123" -> "todo"
    const parts = id.split("-");
    return parts.length > 1 ? parts[0] : "unknown";
  }

  // Enhanced WebSocket notifications
  private setupNotifications(): void {
    if (!this.modernConfig.notificationUrl) return;

    try {
      this.wsNotifications = new WebSocket(this.modernConfig.notificationUrl);

      this.wsNotifications.onmessage = (event) => {
        try {
          const notification: NotificationMessage = JSON.parse(event.data);

          switch (notification.type) {
            case "state_changed":
              // Pull latest state via HTTP
              this.syncState().catch((error) => this.emit("error", error));
              break;

            case "operation_confirmed":
              const opNotification =
                notification as OperationConfirmedNotification;
              this.handleOperationConfirmations([opNotification.payload]);
              break;
          }
        } catch (error) {
          this.emit("error", error);
        }
      };

      this.wsNotifications.onerror = (error) => {
        this.emit("error", error);
      };

      this.wsNotifications.onclose = () => {
        // Attempt to reconnect after delay
        setTimeout(() => {
          if (this.wsNotifications?.readyState === WebSocket.CLOSED) {
            this.setupNotifications();
          }
        }, 5000);
      };
    } catch (error) {
      this.emit("error", error);
    }
  }

  // 🔄 COMPATIBILITY: Legacy methods still work
  async sendChange(
    change: Omit<SyncChange, "operationId" | "timestamp" | "userId">
  ): Promise<void> {
    // Convert to operation
    const operation = this.convertChangeToOperation(change);
    return this.executeOperation(operation.name, operation.args);
  }

  private convertChangeToOperation(
    change: Omit<SyncChange, "operationId" | "timestamp" | "userId">
  ): {
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
    return [...this.modernOperationQueue];
  }

  getCurrentStateVersion(): string {
    return this.currentStateVersion;
  }

  // Override/enhance parent methods
  async flush(): Promise<void> {
    await this.flushBatchedOperations();
    await super.flush();
    await this.flushOperationQueue();
  }

  async disconnect(): Promise<void> {
    // Close WebSocket notifications
    if (this.wsNotifications) {
      this.wsNotifications.close();
      this.wsNotifications = null;
    }

    // Call parent disconnect
    await super.disconnect();
  }

  private generateModernOperationId(): number {
    return ++this.operationIdCounter;
  }

  private isOnline(): boolean {
    // For HTTP-based sync, we consider ourselves online if we can make requests
    // This could be enhanced with actual connectivity checking
    return navigator.onLine !== false;
  }

  // Override parent's connected getter to reflect HTTP availability
  get connected(): boolean {
    return this.isOnline();
  }

  private getEntity(id: string): Entity | undefined {
    // This would need to be implemented based on your store structure
    return undefined; // Placeholder
  }

  private rollbackOptimisticUpdate(entityId: string, original: Entity): void {
    // This would need to be implemented based on your store structure
    // It should restore the entity to its original state
  }

  // Add method to get current optimistic state
  getOptimisticState(entityId: string): Entity | undefined {
    const update = this.optimisticUpdates.get(entityId);
    return update?.entity;
  }
}
