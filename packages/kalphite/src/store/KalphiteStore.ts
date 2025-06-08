import type { KalphiteConfig } from "../types/config";
import type { EntityId, EntityType } from "../types/entity";
import { TypedCollection } from "./TypedCollection";

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

class KalphiteStoreImpl<TSchema extends StandardSchemaV1 = any> {
  public _entities = new Map<EntityId, InferOutput<TSchema>>();
  private subscribers = new Set<() => void>();
  private schema?: TSchema;
  private config: KalphiteConfig;
  private typeCollections = new Map<string, TypedCollection>();

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

    // Invalidate cached type collections
    this.typeCollections.clear();

    this.notifySubscribers();
    this.scheduleFlush(entityId, entity);
  }

  // Fast synchronous read operations
  getById(id: EntityId): InferOutput<TSchema> | undefined {
    return this._entities.get(id);
  }

  getByType(type: EntityType): InferOutput<TSchema>[] {
    return Array.from(this._entities.values()).filter(
      (entity) => entity && (entity as any).type === type
    );
  }

  getAll(): InferOutput<TSchema>[] {
    return Array.from(this._entities.values());
  }

  // NEW API: Get typed collection for a specific entity type
  getTypeCollection(type: string): TypedCollection {
    if (!this.typeCollections.has(type)) {
      const entities = this.getByType(type);
      const collection = new TypedCollection(type, this, entities);
      this.typeCollections.set(type, collection);
    }
    return this.typeCollections.get(type)!;
  }

  // Bulk operations
  loadEntities(entities: InferOutput<TSchema>[]): void {
    entities.forEach((entity) => {
      this._entities.set((entity as any).id, entity);
    });

    // Invalidate cached type collections
    this.typeCollections.clear();

    this.notifySubscribers();
  }

  clear(): void {
    this._entities.clear();
    this.typeCollections.clear();
    this.notifySubscribers();
  }

  // React integration
  subscribe = (callback: () => void): (() => void) => {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  };

  notifySubscribers(): void {
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

// Export a Proxy-wrapped store that provides dynamic property access
export function KalphiteStore<TSchema extends StandardSchemaV1 = any>(
  schema?: TSchema,
  config: KalphiteConfig = {}
): KalphiteStoreImpl<TSchema> & Record<string, TypedCollection> {
  const store = new KalphiteStoreImpl(schema, config);

  return new Proxy(store, {
    get(target, prop) {
      // If it's a known method/property, return it
      if (prop in target || typeof prop === "symbol") {
        return (target as any)[prop];
      }

      // If it's a string property (entity type), return a TypedCollection
      if (typeof prop === "string") {
        return target.getTypeCollection(prop);
      }

      return undefined;
    },
  }) as KalphiteStoreImpl<TSchema> & Record<string, TypedCollection>;
}
