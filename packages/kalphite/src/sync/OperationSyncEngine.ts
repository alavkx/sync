import type {
  ConfirmedOperation,
  Entity,
  HttpClient,
  NotificationMessage,
  OperationConfirmation,
  OperationSyncConfig,
  PendingOperation,
  StatePatch,
  StateSyncRequest,
  StateSyncResponse,
} from "../types/operation-sync";
import { HttpClientImpl } from "./HttpClient";
import { WebSocketSyncEngine } from "./WebSocketSyncEngine";

export class OperationSyncEngine extends WebSocketSyncEngine {
  private httpClient: HttpClient;
  private config: OperationSyncConfig;
  private wsNotifications: WebSocket | null = null;
  private currentStateVersion: string = "";
  private lastSyncTimestamp: number = 0;
  private pendingOperations: Map<number, PendingOperation> = new Map();
  private operationQueue: PendingOperation[] = [];
  private operationIdCounter: number = 0;
  private batchSize: number;
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchedOperations: PendingOperation[] = [];
  private optimisticUpdates: Map<string, { entity: Entity; original: Entity }> =
    new Map();

  constructor(config: OperationSyncConfig) {
    super({
      wsUrl: config.notificationUrl || "",
      roomId: "default",
      userId: config.userId,
      authToken: config.authToken,
    });

    this.config = config;
    this.httpClient = new HttpClientImpl(config);
    this.batchSize = config.batchSize || 10;
  }

  async connect(): Promise<void> {
    if (this.config.notificationUrl) {
      try {
        await super.connect();
      } catch (error) {
        console.warn(
          "WebSocket connection failed, continuing with HTTP-only mode:",
          error
        );
      }
      this.setupNotifications();
    }

    await this.syncState();
    await this.flushOperationQueue();
  }

  async executeOperation(name: string, args: any[]): Promise<void> {
    const operation: PendingOperation = {
      name,
      args,
      id: this.generateOperationId(),
      clientId: this.config.clientId,
      timestamp: Date.now(),
    };

    this.pendingOperations.set(operation.id, operation);
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
    const queueLimit = this.config.offlineQueueLimit || 1000;
    if (this.operationQueue.length >= queueLimit) {
      this.operationQueue.shift();
    }
    this.operationQueue.push(operation);
  }

  private scheduleBatchSend(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    this.batchTimeout = setTimeout(() => {
      this.flushBatchedOperations();
    }, 50);
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
      >(this.config.stateEndpoint || "/sync/state", request);

      this.applyStatePatch({
        stateVersion: response.stateVersion,
        operations: [],
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
    const maxRetries = this.config.retryAttempts || 3;
    const baseDelay = this.config.retryDelay || 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.httpClient.post<
          { operations: PendingOperation[] },
          { confirmations: OperationConfirmation[] }
        >(this.config.operationsEndpoint || "/sync/operations", {
          operations,
        });

        await this.handleOperationConfirmations(response.confirmations);
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          operations.forEach((op) => this.addToQueue(op));
          throw error;
        }
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async handleOperationConfirmations(
    confirmations: OperationConfirmation[]
  ): Promise<void> {
    for (const confirmation of confirmations) {
      const operation = this.pendingOperations.get(confirmation.operationId);
      if (!operation) continue;

      if (confirmation.success) {
        this.pendingOperations.delete(confirmation.operationId);
        this.emit("operationConfirmed", {
          ...operation,
          serverTimestamp: confirmation.serverTimestamp,
        });
      } else {
        this.emit("operationFailed", {
          operation,
          error: confirmation.error || "Unknown error",
        });
        this.addToQueue(operation);
      }
    }
  }

  private applyOptimisticUpdate(operation: PendingOperation): Entity[] {
    const affectedEntities: Entity[] = [];
    // Implementation of optimistic updates
    return affectedEntities;
  }

  private applyStatePatch(patch: StatePatch): void {
    // Apply state changes
    this.emit("statePatch", patch);
  }

  private setupNotifications(): void {
    if (!this.config.notificationUrl) return;

    this.wsNotifications = new WebSocket(this.config.notificationUrl);
    this.wsNotifications.onmessage = (event) => {
      const message: NotificationMessage = JSON.parse(event.data);
      if (message.type === "operationConfirmed") {
        this.handleOperationConfirmations([message.confirmation]);
      }
    };
  }

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

  getPendingOperations(): PendingOperation[] {
    return Array.from(this.pendingOperations.values());
  }

  getQueuedOperations(): PendingOperation[] {
    return [...this.operationQueue];
  }

  getCurrentStateVersion(): string {
    return this.currentStateVersion;
  }

  async flush(): Promise<void> {
    await this.flushBatchedOperations();
    await super.flush();
    await this.flushOperationQueue();
  }

  async disconnect(): Promise<void> {
    if (this.wsNotifications) {
      this.wsNotifications.close();
      this.wsNotifications = null;
    }
    await super.disconnect();
  }

  private generateOperationId(): number {
    return ++this.operationIdCounter;
  }

  private isOnline(): boolean {
    return navigator.onLine !== false;
  }

  get connected(): boolean {
    return this.isOnline();
  }

  getOptimisticState(entityId: string): Entity | undefined {
    const update = this.optimisticUpdates.get(entityId);
    return update?.entity;
  }
}
