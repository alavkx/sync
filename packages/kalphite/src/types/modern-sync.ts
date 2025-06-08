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
  retryAttempts?: number; // Default: 3
  retryDelay?: number; // Default: 1000ms
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

export interface StateSyncResponse<TSchema = any> {
  stateVersion: string; // New state version
  entities: Entity[]; // Full or delta entities
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

// Basic entity interface (should match existing)
export interface Entity {
  id: string;
  type: string;
  updatedAt: number;
  [key: string]: any;
}

// Server contract types for implementation guidance
export interface ServerSyncContract<TSchema = any> {
  operations: {
    endpoint: string; // POST /sync/operations
    request: { operations: PendingOperation[] };
    response: { confirmations: OperationConfirmation[] };
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

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ValidatedOperation<TSchema = any> {
  name: string;
  args: any[];
  schema: TSchema;
  isValid: boolean;
}

export interface ValidatedEntity<TSchema = any> {
  id: string;
  type: string;
  data: any;
  schema: TSchema;
  isValid: boolean;
}
