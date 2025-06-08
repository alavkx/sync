export interface FlushConfig<T = any> {
  flushTarget: FlushTarget<T>;
  debounceMs?: number;
  maxRetries?: number;
  baseRetryDelay?: number;
  maxBatchSize?: number;
}

export interface FlushChange<T = any> {
  operation: "push" | "upsert" | "delete";
  entityId: string;
  entity?: T;
  timestamp: number;
}

export type FlushTarget<T = any> = (changes: FlushChange<T>[]) => Promise<void>;

export interface FlushEngine<T = any> {
  scheduleFlush(
    entityId: string,
    entity: T,
    operation?: "push" | "upsert"
  ): void;
  scheduleDelete(entityId: string): void;
  getQueuedChanges(): FlushChange<T>[];
  flushNow(): Promise<void>;
  pause(): void;
  resume(): void;
}
