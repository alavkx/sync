export type EntityId = string;
export type EntityType = string;

export interface Entity {
  id: EntityId;
  type: EntityType;
  data: any;
  updatedAt: number;
}
