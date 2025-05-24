// Types for our sync engine

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
