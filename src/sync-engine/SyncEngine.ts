import {
  type Change,
  type ClientID,
  ClientIDSchema,
  type EntityID,
  EntityIDSchema,
  type EntityType,
  EntityTypeSchema,
  type SyncEngine,
  type SyncEntity,
  type SyncState,
  validateChange,
  validateSyncEntity,
} from "./types";

export class SimpleSyncEngine implements SyncEngine {
  private state: SyncState;
  private stateChangeCallbacks: ((state: SyncState) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private entityChangeCallbacks: ((
    entity: SyncEntity,
    operation: "create" | "update" | "delete"
  ) => void)[] = [];

  constructor(private clientId: ClientID) {
    // Validate clientId
    ClientIDSchema.parse(clientId);

    this.state = {
      version: 0,
      lastSyncedVersion: 0,
      pendingChanges: [],
      entities: new Map(),
    };
  }

  // Core operations
  async create(
    entityType: EntityType,
    data: Record<string, any>
  ): Promise<EntityID> {
    // Validate inputs
    EntityTypeSchema.parse(entityType);

    const entityId = crypto.randomUUID();
    const now = new Date();

    const entityData: SyncEntity = {
      id: entityId,
      type: entityType,
      data,
      createdAt: now,
      updatedAt: now,
    };

    // Validate entity before storing
    const entity = validateSyncEntity(entityData);

    // Add to local state (optimistic update)
    this.state.entities.set(entityId, entity);

    // Create change for sync
    const changeData: Change = {
      id: crypto.randomUUID(),
      clientId: this.clientId,
      timestamp: Date.now(),
      entityId,
      entityType,
      operation: "create",
      data,
    };

    // Validate change before storing
    const change = validateChange(changeData);

    this.state = {
      ...this.state,
      version: this.state.version + 1,
      pendingChanges: [...this.state.pendingChanges, change],
    };

    this.notifyStateChange();
    this.notifyEntityChange(entity, "create");

    return entityId;
  }

  async update(entityId: EntityID, data: Record<string, any>): Promise<void> {
    // Validate inputs
    EntityIDSchema.parse(entityId);

    const existingEntity = this.state.entities.get(entityId);
    if (!existingEntity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const updatedEntityData: SyncEntity = {
      ...existingEntity,
      data: { ...existingEntity.data, ...data },
      updatedAt: new Date(),
    };

    // Validate entity before storing
    const updatedEntity = validateSyncEntity(updatedEntityData);

    // Update local state
    this.state.entities.set(entityId, updatedEntity);

    // Create change for sync
    const changeData: Change = {
      id: crypto.randomUUID(),
      clientId: this.clientId,
      timestamp: Date.now(),
      entityId,
      entityType: existingEntity.type,
      operation: "update",
      data: updatedEntity.data,
      previousData: existingEntity.data,
    };

    // Validate change before storing
    const change = validateChange(changeData);

    this.state = {
      ...this.state,
      version: this.state.version + 1,
      pendingChanges: [...this.state.pendingChanges, change],
    };

    this.notifyStateChange();
    this.notifyEntityChange(updatedEntity, "update");
  }

  async delete(entityId: EntityID): Promise<void> {
    // Validate inputs
    EntityIDSchema.parse(entityId);

    const existingEntity = this.state.entities.get(entityId);
    if (!existingEntity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const deletedEntityData: SyncEntity = {
      ...existingEntity,
      isDeleted: true,
      updatedAt: new Date(),
    };

    // Validate entity before storing
    const deletedEntity = validateSyncEntity(deletedEntityData);

    // Update local state
    this.state.entities.set(entityId, deletedEntity);

    // Create change for sync
    const changeData: Change = {
      id: crypto.randomUUID(),
      clientId: this.clientId,
      timestamp: Date.now(),
      entityId,
      entityType: existingEntity.type,
      operation: "delete",
      data: deletedEntity.data,
      previousData: existingEntity.data,
    };

    // Validate change before storing
    const change = validateChange(changeData);

    this.state = {
      ...this.state,
      version: this.state.version + 1,
      pendingChanges: [...this.state.pendingChanges, change],
    };

    this.notifyStateChange();
    this.notifyEntityChange(deletedEntity, "delete");
  }

  // Query operations
  get(entityId: EntityID): SyncEntity | null {
    EntityIDSchema.parse(entityId);

    const entity = this.state.entities.get(entityId);
    return entity && !entity.isDeleted ? entity : null;
  }

  getByType(entityType: EntityType): SyncEntity[] {
    EntityTypeSchema.parse(entityType);

    return Array.from(this.state.entities.values()).filter(
      (entity) => entity.type === entityType && !entity.isDeleted
    );
  }

  query(predicate: (entity: SyncEntity) => boolean): SyncEntity[] {
    return Array.from(this.state.entities.values()).filter(
      (entity) => !entity.isDeleted && predicate(entity)
    );
  }

  // Sync operations
  async push(): Promise<void> {
    if (this.state.pendingChanges.length === 0) return;

    try {
      // TODO: Implement actual server communication
      // For now, simulate a successful push
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Pushing changes:", this.state.pendingChanges);

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
      // For now, simulate receiving changes from server
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate receiving changes from other clients
      const serverChanges: Change[] = [];

      // Apply server changes to local state
      for (const change of serverChanges) {
        this.applyRemoteChange(change);
      }

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

  // State management
  getState(): SyncState {
    return this.state;
  }

  // Event handlers
  onStateChange(callback: (state: SyncState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  onSyncError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  onEntityChange(
    callback: (
      entity: SyncEntity,
      operation: "create" | "update" | "delete"
    ) => void
  ): void {
    this.entityChangeCallbacks.push(callback);
  }

  // Private methods
  private applyRemoteChange(change: Change): void {
    // Validate incoming change
    const validatedChange = validateChange(change);

    const existingEntity = this.state.entities.get(validatedChange.entityId);

    if (
      validatedChange.operation === "create" ||
      validatedChange.operation === "update"
    ) {
      const entityData: SyncEntity = {
        id: validatedChange.entityId,
        type: validatedChange.entityType,
        data: validatedChange.data,
        createdAt: existingEntity?.createdAt || new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      // Validate entity before storing
      const entity = validateSyncEntity(entityData);
      this.state.entities.set(validatedChange.entityId, entity);
      this.notifyEntityChange(entity, validatedChange.operation);
    } else if (validatedChange.operation === "delete" && existingEntity) {
      const deletedEntityData: SyncEntity = {
        ...existingEntity,
        isDeleted: true,
        updatedAt: new Date(),
      };

      // Validate entity before storing
      const deletedEntity = validateSyncEntity(deletedEntityData);
      this.state.entities.set(validatedChange.entityId, deletedEntity);
      this.notifyEntityChange(deletedEntity, "delete");
    }
  }

  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach((callback) => callback(this.state));
  }

  private notifyError(error: Error): void {
    this.errorCallbacks.forEach((callback) => callback(error));
  }

  private notifyEntityChange(
    entity: SyncEntity,
    operation: "create" | "update" | "delete"
  ): void {
    this.entityChangeCallbacks.forEach((callback) =>
      callback(entity, operation)
    );
  }
}
