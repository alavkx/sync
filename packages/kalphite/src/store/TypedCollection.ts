import type { EntityId } from "../types/entity";

export class TypedCollection<T = any> extends Array<T> {
  private entityType: string;
  private store: any; // Will be properly typed when integrated

  constructor(entityType: string, store: any, entities: T[] = []) {
    super();
    this.entityType = entityType;
    this.store = store;
    this.push(...entities);

    // Make the array behavior work correctly
    Object.setPrototypeOf(this, TypedCollection.prototype);
  }

  // Mutation methods specific to this entity type
  upsert(entityId: EntityId, entity: T): T {
    // Delegate to store's upsert method
    this.store.upsert(entityId, entity);

    // Update our local array representation
    this.refresh();

    // Return the entity for functional chaining
    return entity;
  }

  delete(entityId: EntityId): boolean {
    // Find and remove from store
    const existingIndex = this.findIndex((e: any) => e?.id === entityId);
    if (existingIndex === -1) return false;

    // Remove from store's internal map
    this.store._entities.delete(entityId);

    // Update our local array and notify subscribers
    this.refresh();
    this.store.notifySubscribers();

    return true;
  }

  // Refresh our array contents from the store
  private refresh(): void {
    // Clear current contents
    this.length = 0;

    // Get fresh data from store
    const entities = this.store.getByType(this.entityType);
    this.push(...entities);
  }

  // Query methods for functional programming style
  findById(id: EntityId): T | undefined {
    return this.find((entity: any) => entity?.id === id);
  }

  where(predicate: (entity: T) => boolean): T[] {
    return this.filter(predicate);
  }

  orderBy(keySelector: (entity: T) => any): T[] {
    return [...this].sort((a, b) => {
      const aKey = keySelector(a);
      const bKey = keySelector(b);
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });
  }

  // Override toJSON for serialization
  toJSON(): T[] {
    return Array.from(this);
  }

  // Ensure proper instanceof behavior
  static get [Symbol.species]() {
    return Array;
  }
}
