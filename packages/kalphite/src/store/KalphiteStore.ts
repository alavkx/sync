import type { KalphiteConfig } from "../types/config";
import type { EntityId, EntityType } from "../types/entity";

// Standard Schema integration (using conditional types for compatibility)
type StandardSchemaV1 = {
  "~standard": {
    validate: (
      input: unknown
    ) =>
      | { issues: any[] }
      | { issues: undefined; value: any }
      | Promise<{ issues: any[] } | { issues: undefined; value: any }>;
  };
};

type InferOutput<T extends StandardSchemaV1> = T extends {
  "~standard": { validate: (input: unknown) => any };
}
  ? any // Will be properly typed when Standard Schema is available
  : never;

export class KalphiteStore<TSchema extends StandardSchemaV1 = any> {
  private _entities = new Map<EntityId, InferOutput<TSchema>>();
  private subscribers = new Set<() => void>();
  private schema?: TSchema;
  private config: KalphiteConfig;

  constructor(schema?: TSchema, config: KalphiteConfig = {}) {
    this.schema = schema;
    this.config = {
      flushDebounceMs: 100,
      networkPushDebounceMs: 1000,
      networkPullIntervalMs: 5000,
      databaseName: "kalphite-db",
      enableDevtools: false,
      logLevel: "info",
      ...config,
    };
  }

  // Type-safe upsert with optional schema validation
  upsert(entityId: EntityId, entity: unknown): void {
    if (this.schema) {
      const result = this.schema["~standard"].validate(entity);

      // Handle async validation
      if (result instanceof Promise) {
        result.then((validationResult) => {
          if (validationResult.issues) {
            this.log("error", "Validation failed:", validationResult.issues);
            return;
          }
          this.setEntity(entityId, validationResult.value);
        });
        return;
      }

      // Handle sync validation
      if (result.issues) {
        this.log("error", "Validation failed:", result.issues);
        return;
      }

      this.setEntity(entityId, result.value);
    } else {
      // No schema validation - direct set
      this.setEntity(entityId, entity as InferOutput<TSchema>);
    }
  }

  // Direct entity setting with change tracking
  private setEntity(entityId: EntityId, entity: InferOutput<TSchema>): void {
    this._entities.set(entityId, entity);
    this.notifySubscribers();

    // Trigger flush (would integrate with MemoryFlushEngine)
    this.scheduleFlush(entityId, entity);
  }

  // Fast synchronous read operations
  getById(id: EntityId): InferOutput<TSchema> | undefined {
    return this._entities.get(id);
  }

  getByType(type: EntityType): InferOutput<TSchema>[] {
    return Array.from(this._entities.values()).filter(
      (entity) => (entity as any).type === type
    );
  }

  getAll(): InferOutput<TSchema>[] {
    return Array.from(this._entities.values());
  }

  // Bulk operations
  loadEntities(entities: InferOutput<TSchema>[]): void {
    entities.forEach((entity) => {
      this._entities.set((entity as any).id, entity);
    });
    this.notifySubscribers();
  }

  clear(): void {
    this._entities.clear();
    this.notifySubscribers();
  }

  // React integration
  subscribe = (callback: () => void): (() => void) => {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  };

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback());
  }

  // Placeholder for flush scheduling (would integrate with MemoryFlushEngine)
  private scheduleFlush(
    entityId: EntityId,
    entity: InferOutput<TSchema>
  ): void {
    // This would trigger the memory flush engine
    if (this.config.enableDevtools) {
      this.log("debug", `Scheduled flush for entity ${entityId}`);
    }
  }

  // Logging utility
  private log(level: string, ...args: any[]): void {
    const levels = ["debug", "info", "warn", "error", "silent"];
    const configLevel = this.config.logLevel || "info";

    if (levels.indexOf(level) >= levels.indexOf(configLevel)) {
      const logFn = console[level as keyof Console] as (...args: any[]) => void;
      logFn?.(...args);
    }
  }
}
