export interface Entity {
  id: string;
  type: string;
  data: Record<string, any>;
  updatedAt: number;
}

export interface OperationSyncConfig {
  baseUrl: string;
  operationsEndpoint: string;
  stateEndpoint: string;
  notificationUrl?: string;
  clientId: string;
  userId: string;
  authToken?: string;
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  offlineQueueLimit?: number;
}

export interface PendingOperation {
  id: number;
  name: string;
  args: any[];
  clientId: string;
  timestamp: number;
}

export interface ConfirmedOperation extends PendingOperation {
  serverTimestamp: number;
}

export interface OperationConfirmation {
  operationId: number;
  clientId: string;
  success: boolean;
  serverTimestamp: number;
  error?: string;
}

export interface StateSyncRequest {
  stateVersion?: string;
  lastSyncTimestamp?: number;
}

export interface StateSyncResponse {
  stateVersion: string;
  entities: Entity[];
  deletedEntityIds: string[];
  syncTimestamp: number;
}

export interface StatePatch {
  stateVersion: string;
  operations: PendingOperation[];
  entities: Entity[];
  deletedEntityIds: string[];
  timestamp: number;
}

export interface NotificationMessage {
  type: "operationConfirmed";
  confirmation: OperationConfirmation;
}

export interface HttpClient {
  post<TRequest, TResponse>(url: string, data: TRequest): Promise<TResponse>;
}
