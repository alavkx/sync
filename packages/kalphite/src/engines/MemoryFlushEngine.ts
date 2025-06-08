import type { FlushChange, FlushConfig, FlushEngine } from "../types/flush";

export class MemoryFlushEngine<T = any> implements FlushEngine<T> {
  private flushTarget: FlushConfig<T>["flushTarget"];
  private debounceMs: number;
  private maxRetries: number;
  private baseRetryDelay: number;
  private maxBatchSize: number;

  private pendingChanges = new Map<string, FlushChange<T>>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  private isPaused = false;

  constructor(config: FlushConfig<T>) {
    this.flushTarget = config.flushTarget;
    this.debounceMs = config.debounceMs ?? 100;
    this.maxRetries = config.maxRetries ?? 3;
    this.baseRetryDelay = config.baseRetryDelay ?? 100;
    this.maxBatchSize = config.maxBatchSize ?? 1000;
  }

  scheduleFlush(
    entityId: string,
    entity: T,
    operation: "push" | "upsert" = "upsert"
  ): void {
    if (this.isPaused) return;

    this.pendingChanges.set(entityId, {
      operation,
      entityId,
      entity,
      timestamp: Date.now(),
    });

    this.scheduleDebouncedFlush();
  }

  scheduleDelete(entityId: string): void {
    if (this.isPaused) return;

    this.pendingChanges.set(entityId, {
      operation: "delete",
      entityId,
      timestamp: Date.now(),
    });

    this.scheduleDebouncedFlush();
  }

  getQueuedChanges(): FlushChange<T>[] {
    return Array.from(this.pendingChanges.values());
  }

  async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    await this.executeFlush();
  }

  pause(): void {
    this.isPaused = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  resume(): void {
    this.isPaused = false;
    if (this.pendingChanges.size > 0) {
      this.scheduleDebouncedFlush();
    }
  }

  private scheduleDebouncedFlush(): void {
    if (this.flushTimer || this.isPaused) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.executeFlush().catch(() => {
        // Error handling is done in executeFlush
      });
    }, this.debounceMs);
  }

  private async executeFlush(retryCount = 0): Promise<void> {
    if (this.pendingChanges.size === 0) return;

    const changes = Array.from(this.pendingChanges.values()).slice(
      0,
      this.maxBatchSize
    );

    try {
      await this.flushTarget(changes);

      // Clear successfully flushed changes
      changes.forEach((change) => {
        this.pendingChanges.delete(change.entityId);
      });

      // If there are more changes, schedule another flush
      if (this.pendingChanges.size > 0) {
        this.scheduleDebouncedFlush();
      }
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.baseRetryDelay * Math.pow(2, retryCount);

        setTimeout(() => {
          this.executeFlush(retryCount + 1);
        }, delay);
      }
      // If max retries exceeded, data remains in pendingChanges for next flush attempt
    }
  }
}
