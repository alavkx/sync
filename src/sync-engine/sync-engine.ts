export type ClientID = string;
export type Version = number;

export interface Change {
  id: string;
  clientId: ClientID;
  timestamp: number;
  data: any;
}

export interface SyncState {
  version: Version;
  lastSyncedVersion: Version;
  pendingChanges: Change[];
}

export interface SyncEngine {
  // Core operations
  applyChange(change: Omit<Change, "id" | "timestamp">): Promise<void>;
  getState(): Promise<SyncState>;

  // Sync operations
  push(): Promise<void>;
  pull(): Promise<void>;

  // Event handlers
  onStateChange(callback: (state: SyncState) => void): void;
  onSyncError(callback: (error: Error) => void): void;
}

export class SimpleSyncEngine implements SyncEngine {
  private state: SyncState;
  private stateChangeCallbacks: ((state: SyncState) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  constructor(private clientId: ClientID) {
    this.state = {
      version: 0,
      lastSyncedVersion: 0,
      pendingChanges: [],
    };
  }

  // Core operations
  async applyChange(change: Omit<Change, "id" | "timestamp">): Promise<void> {
    const newChange: Change = {
      ...change,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.state = {
      ...this.state,
      version: this.state.version + 1,
      pendingChanges: [...this.state.pendingChanges, newChange],
    };

    this.notifyStateChange();
  }

  async getState(): Promise<SyncState> {
    return this.state;
  }

  // Sync operations
  async push(): Promise<void> {
    if (this.state.pendingChanges.length === 0) return;

    try {
      // TODO: Implement actual server communication
      // For now, we'll just simulate a successful push
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.state = {
        ...this.state,
        lastSyncedVersion: this.state.version,
        pendingChanges: [],
      };

      this.notifyStateChange();
    } catch (error) {
      this.notifyError(error as Error);
    }
  }

  async pull(): Promise<void> {
    try {
      // TODO: Implement actual server communication
      // For now, we'll just simulate a successful pull
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate receiving changes from server
      const serverChanges: Change[] = [];

      this.state = {
        ...this.state,
        version: this.state.version + serverChanges.length,
        lastSyncedVersion: this.state.version + serverChanges.length,
      };

      this.notifyStateChange();
    } catch (error) {
      this.notifyError(error as Error);
    }
  }

  // Event handlers
  onStateChange(callback: (state: SyncState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  onSyncError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach((callback) => callback(this.state));
  }

  private notifyError(error: Error): void {
    this.errorCallbacks.forEach((callback) => callback(error));
  }
}
