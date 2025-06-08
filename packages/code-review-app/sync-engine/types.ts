// Generic sync engine types - domain agnostic
import { z } from "zod";

// Base schemas
export const ClientIDSchema = z.string().min(1);
export const VersionSchema = z.number().int().min(0);
export const EntityIDSchema = z.string().min(1);
export const EntityTypeSchema = z.string().min(1);

// Derived types
export type ClientID = z.infer<typeof ClientIDSchema>;
export type Version = z.infer<typeof VersionSchema>;
export type EntityID = z.infer<typeof EntityIDSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;

// Generic data entity schema
export const SyncEntitySchema = z.object({
  id: EntityIDSchema,
  type: EntityTypeSchema,
  data: z.record(z.any()),
  createdAt: z.date(),
  updatedAt: z.date(),
  isDeleted: z.boolean().optional(),
});

export type SyncEntity = z.infer<typeof SyncEntitySchema>;

// Generic change operation schema
export const ChangeSchema = z.object({
  id: z.string().min(1),
  clientId: ClientIDSchema,
  timestamp: z.number().int().positive(),
  entityId: EntityIDSchema,
  entityType: EntityTypeSchema,
  operation: z.enum(["upsert", "delete"]),
  data: z.record(z.any()),
  previousData: z.record(z.any()).optional(),
});

export type Change = z.infer<typeof ChangeSchema>;

// Sync state schema
export const SyncStateSchema = z.object({
  version: VersionSchema,
  lastSyncedVersion: VersionSchema,
  pendingChanges: z.array(ChangeSchema),
  entities: z.map(EntityIDSchema, SyncEntitySchema),
});

export type SyncState = z.infer<typeof SyncStateSchema>;

// Query specification for unified query interface
export interface QuerySpec {
  entityType?: EntityType;
  entityId?: EntityID;
  where?: (entity: SyncEntity) => boolean;
  orderBy?: keyof SyncEntity;
  limit?: number;
}

// Generic sync engine interface
export interface SyncEngine {
  // Core operations
  upsert(
    entityId: EntityID,
    entityType: EntityType,
    data: Record<string, any>
  ): Promise<void>;
  delete(entityId: EntityID): Promise<void>;

  // Query operations
  query(querySpec: QuerySpec): Promise<SyncEntity[]>;

  // Sync operations
  push(): Promise<void>;
  pull(): Promise<void>;

  // State management
  getState(): SyncState;

  // Event handlers
  onStateChange(callback: (state: SyncState) => void): void;
  onSyncError(callback: (error: Error) => void): void;
  onEntityChange(
    callback: (
      entity: SyncEntity,
      operation: "create" | "update" | "delete"
    ) => void
  ): void;
}

// Validation helpers
export const validateSyncEntity = (data: unknown): SyncEntity =>
  SyncEntitySchema.parse(data);

export const validateChange = (data: unknown): Change =>
  ChangeSchema.parse(data);

export const validateSyncState = (data: unknown): SyncState =>
  SyncStateSchema.parse(data);
