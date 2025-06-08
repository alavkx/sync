import { EventEmitter } from "events";
import type { Entity } from "../types/operation-sync";

export interface SyncChange {
  type: "upsert" | "delete";
  entityType: string;
  entityId: string;
  entity?: Entity;
  operationId?: number;
  timestamp?: number;
  userId?: string;
}

export interface WebSocketSyncConfig {
  wsUrl: string;
  roomId: string;
  userId: string;
  authToken?: string;
}

export class WebSocketSyncEngine extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketSyncConfig;
  private changeQueue: SyncChange[] = [];
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(config: WebSocketSyncConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.config.wsUrl);
      this.setupWebSocket();
      await this.waitForConnection();
      this.reconnectAttempts = 0;
      this.emit("connected");
    } catch (error) {
      this.handleConnectionError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  private setupWebSocket(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.sendAuth();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {
      this.emit("error", error);
    };
  }

  private sendAuth(): void {
    if (!this.ws) return;

    this.ws.send(
      JSON.stringify({
        type: "auth",
        roomId: this.config.roomId,
        userId: this.config.userId,
        authToken: this.config.authToken,
      })
    );
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket not initialized"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 5000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  private handleConnectionError(error: any): void {
    this.emit("error", error);
    this.attemptReconnect();
  }

  private handleDisconnect(): void {
    this.emit("disconnected");
    this.attemptReconnect();
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("error", new Error("Max reconnection attempts reached"));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    await new Promise((resolve) => setTimeout(resolve, delay));
    this.connect();
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case "change":
        this.emit("remoteChange", message.change);
        break;
      case "error":
        this.emit("error", message.error);
        break;
      default:
        console.warn("Unknown message type:", message.type);
    }
  }

  async sendChange(
    change: Omit<SyncChange, "operationId" | "timestamp" | "userId">
  ): Promise<void> {
    const fullChange: SyncChange = {
      ...change,
      operationId: Date.now(),
      timestamp: Date.now(),
      userId: this.config.userId,
    };

    if (this.isConnected()) {
      this.ws?.send(JSON.stringify({ type: "change", change: fullChange }));
    } else {
      this.changeQueue.push(fullChange);
    }
  }

  async flush(): Promise<void> {
    if (!this.isConnected() || this.changeQueue.length === 0) return;

    const changes = [...this.changeQueue];
    this.changeQueue = [];

    for (const change of changes) {
      await this.sendChange(change);
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get queueLength(): number {
    return this.changeQueue.length;
  }
}
