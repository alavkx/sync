export interface NetworkSyncConfig {
  wsUrl: string;
  roomId: string;
  userId: string;
  authToken?: string;
}

export interface SyncChange {
  type: "upsert" | "delete";
  entityType: string;
  entityId: string;
  entity?: any;
  timestamp: number;
  userId: string;
  operationId: string;
}

export interface PresenceInfo {
  userId: string;
  cursor?: { entityType: string; entityId: string; position?: number };
  isOnline: boolean;
  lastSeen: number;
}

export class NetworkSyncEngine {
  private ws: WebSocket | null = null;
  private config: NetworkSyncConfig;
  private isConnected = false;
  private operationQueue: SyncChange[] = [];
  private eventHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(config: NetworkSyncConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.config.wsUrl}?roomId=${this.config.roomId}&userId=${this.config.userId}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit("connected");
          this.flushQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.emit("disconnected");
          this.handleReconnection();
        };

        this.ws.onerror = (error) => {
          this.emit("error", error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  async sendChange(
    change: Omit<SyncChange, "operationId" | "timestamp" | "userId">
  ): Promise<void> {
    const fullChange: SyncChange = {
      ...change,
      operationId: this.generateOperationId(),
      timestamp: Date.now(),
      userId: this.config.userId,
    };

    if (this.isConnected && this.ws) {
      this.ws.send(
        JSON.stringify({
          type: "sync-change",
          data: fullChange,
        })
      );
    } else {
      this.operationQueue.push(fullChange);
    }
  }

  async flush(): Promise<void> {
    await this.flushQueue();
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Presence tracking
  async updatePresence(presence: Partial<PresenceInfo>): Promise<void> {
    if (this.isConnected && this.ws) {
      this.ws.send(
        JSON.stringify({
          type: "presence-update",
          data: {
            ...presence,
            userId: this.config.userId,
            timestamp: Date.now(),
          },
        })
      );
    }
  }

  // Simulation methods for testing
  async simulateRemoteChange(change: SyncChange): Promise<void> {
    this.emit("remoteChange", change);
  }

  // Private methods
  private handleMessage(message: any): void {
    switch (message.type) {
      case "sync-change":
        this.emit("remoteChange", message.data);
        break;
      case "presence-update":
        this.emit("presenceUpdate", message.data);
        break;
      case "conflict-resolution":
        this.emit("conflictResolution", message.data);
        break;
      case "sync-ack":
        this.emit("syncAck", message.data);
        break;
      default:
        console.warn("Unknown message type:", message.type);
    }
  }

  private async flushQueue(): Promise<void> {
    if (!this.isConnected || !this.ws) return;

    while (this.operationQueue.length > 0) {
      const change = this.operationQueue.shift()!;
      this.ws.send(
        JSON.stringify({
          type: "sync-change",
          data: change,
        })
      );
    }
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("reconnectionFailed");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    // Emit immediately to signal reconnection attempt
    this.emit("reconnecting", this.reconnectAttempts);

    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection failed, will try again
        this.handleReconnection();
      });
    }, delay);
  }

  private generateOperationId(): string {
    return `${this.config.userId}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  // Getters for testing
  get connected(): boolean {
    return this.isConnected;
  }

  get queueLength(): number {
    return this.operationQueue.length;
  }
}
