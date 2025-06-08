import type {
  ConfirmedOperation,
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

    if (this.isOnline()) {
      try {
        await this.pushOperations([operation]);
      } catch (error) {
        // Add back to queue for retry
        this.modernOperationQueue.push(operation);
        throw error;
      }
    } else {
      this.modernOperationQueue.push(operation);
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
      this.emitEvent("error", error);
      throw error;
    }
  }

  private async pushOperations(operations: PendingOperation[]): Promise<void> {
    const response = await this.httpClient.post<
      { operations: PendingOperation[] },
      { confirmations: OperationConfirmation[] }
    >(this.modernConfig.operationsEndpoint || "/sync/operations", {
      operations,
    });

    this.handleOperationConfirmations(response.confirmations);
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

  private handleOperationConfirmations(
    confirmations: OperationConfirmation[]
  ): void {
    for (const confirmation of confirmations) {
      const pendingOp = this.pendingOperations.get(confirmation.operationId);

      if (pendingOp) {
        this.pendingOperations.delete(confirmation.operationId);

        if (confirmation.success) {
          const confirmedOp: ConfirmedOperation = {
            ...pendingOp,
            serverTimestamp: confirmation.serverTimestamp,
          };
          this.emit("operationConfirmed", confirmedOp);
        } else {
          this.emit("operationFailed", {
            operation: pendingOp,
            error: confirmation.error || "Unknown error",
          });
        }
      }
    }
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
    return [...this.modernOperationQueue];
  }

  getCurrentStateVersion(): string {
    return this.currentStateVersion;
  }

  // Override/enhance parent methods
  async flush(): Promise<void> {
    // Flush legacy queue first
    await super.flush();

    // Then flush modern operation queue
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
}
