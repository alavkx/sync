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
  upsert(entityId: EntityId, entity: T): void {
    // Delegate to store's upsert method
    this.store.upsert(entityId, entity);

    // Update our local array representation
    this.refresh();
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

  // Override toJSON for serialization
  toJSON(): T[] {
    return Array.from(this);
  }

  // Ensure proper instanceof behavior
  static get [Symbol.species]() {
    return Array;
  }
}
