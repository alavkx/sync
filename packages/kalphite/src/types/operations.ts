import type { Entity, EntityId, EntityType } from "./entity";

export interface ChangeOperation {
  entityId: EntityId;
  entityType: EntityType;
  operation: "upsert" | "delete";
  data?: any;
  timestamp: number;
}

export interface FlushOperation {
  entityId: EntityId;
  entity: Entity | { deleted: true };
  timestamp: number;
}
