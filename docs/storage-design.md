# Storage Design: Production-Ready Sync Engine

> **🎯 Goal**: Implement persistent storage for our sync engine using PGlite (frontend/backend) and TanStack Start RPC endpoints, following [Replicache's proven architecture](https://doc.replicache.dev/concepts/how-it-works).

## 1. Storage Architecture Overview

### Current State (In-Memory Only)

```typescript
// Current sync engine uses memory storage
class SimpleSyncEngine {
  private state: SyncState = {
    entities: new Map(), // ❌ Lost on page refresh
    pendingChanges: [], // ❌ Lost on page refresh
    version: 0, // ❌ Resets to 0
  };
}
```

### Target Architecture (Persistent Storage)

```
┌─────────────────────────────────────┐
│           Frontend Client           │
│  ┌─────────────────────────────────┐│
│  │        PGlite Browser DB        ││
│  │  • Entities table               ││
│  │  • Changes/mutations table      ││
│  │  • Client state (version, etc) ││
│  └─────────────────────────────────┘│
└─────────────────┬───────────────────┘
                  │ TanStack RPC
                  │ Push/Pull
┌─────────────────▼───────────────────┐
│            Backend Server           │
│  ┌─────────────────────────────────┐│
│  │      PGlite/Postgres DB         ││
│  │  • Entities table               ││
│  │  • Replication log              ││
│  │  • Client version vectors       ││
│  │  • Global version counter       ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

## 2. Frontend Storage: PGlite in Browser

### PGlite Setup & Configuration

Following [PGlite documentation](https://github.com/electric-sql/pglite), we'll use IndexedDB persistence:

```typescript
// src/storage/client-db.ts
import { PGlite } from "@electric-sql/pglite";
import { type SyncEntity, type Change } from "../sync-engine/types";

export class ClientDatabase {
  private db: PGlite;

  constructor() {
    // Persist to IndexedDB for offline capability
    this.db = new PGlite("idb://sync-engine-db");
  }

  async initialize(): Promise<void> {
    // Create tables for sync engine
    await this.db.exec(`
      -- Entities storage (domain objects: comments, reviews, etc)
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_deleted BOOLEAN DEFAULT FALSE,
        version INTEGER NOT NULL DEFAULT 0
      );

      -- Client-side change log (Replicache pattern)
      CREATE TABLE IF NOT EXISTS client_changes (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        data JSONB NOT NULL,
        previous_data JSONB,
        is_synced BOOLEAN DEFAULT FALSE
      );

      -- Client state (version tracking)
      CREATE TABLE IF NOT EXISTS client_state (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at);
      CREATE INDEX IF NOT EXISTS idx_changes_synced ON client_changes(is_synced);
      CREATE INDEX IF NOT EXISTS idx_changes_timestamp ON client_changes(timestamp);
    `);

    // Initialize client state if not exists
    await this.db.exec(`
      INSERT INTO client_state (key, value) 
      VALUES ('version', '0'), ('last_synced_version', '0')
      ON CONFLICT (key) DO NOTHING;
    `);
  }

  // Entity operations
  async saveEntity(entity: SyncEntity): Promise<void> {
    await this.db.query(
      `
      INSERT INTO entities (id, type, data, created_at, updated_at, is_deleted, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        is_deleted = EXCLUDED.is_deleted,
        version = EXCLUDED.version
    `,
      [
        entity.id,
        entity.type,
        JSON.stringify(entity.data),
        entity.createdAt,
        entity.updatedAt,
        entity.isDeleted || false,
        0, // Will be set by server
      ]
    );
  }

  async getEntity(id: string): Promise<SyncEntity | null> {
    const result = await this.db.query(
      `
      SELECT * FROM entities WHERE id = $1 AND is_deleted = FALSE
    `,
      [id]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async getEntitiesByType(type: string): Promise<SyncEntity[]> {
    const result = await this.db.query(
      `
      SELECT * FROM entities WHERE type = $1 AND is_deleted = FALSE
      ORDER BY updated_at DESC
    `,
      [type]
    );

    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  // Change log operations (Replicache pattern)
  async saveChange(change: Change): Promise<void> {
    await this.db.query(
      `
      INSERT INTO client_changes (
        id, client_id, timestamp, entity_id, entity_type,
        operation, data, previous_data, is_synced
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        change.id,
        change.clientId,
        change.timestamp,
        change.entityId,
        change.entityType,
        change.operation,
        JSON.stringify(change.data),
        change.previousData ? JSON.stringify(change.previousData) : null,
        false,
      ]
    );
  }

  async getPendingChanges(): Promise<Change[]> {
    const result = await this.db.query(`
      SELECT * FROM client_changes 
      WHERE is_synced = FALSE 
      ORDER BY timestamp ASC
    `);

    return result.rows.map((row) => this.mapRowToChange(row));
  }

  async markChangesSynced(changeIds: string[]): Promise<void> {
    if (changeIds.length === 0) return;

    const placeholders = changeIds.map((_, i) => `$${i + 1}`).join(",");
    await this.db.query(
      `
      UPDATE client_changes 
      SET is_synced = TRUE 
      WHERE id IN (${placeholders})
    `,
      changeIds
    );
  }

  // Client state management
  async getClientVersion(): Promise<number> {
    const result = await this.db.query(`
      SELECT value FROM client_state WHERE key = 'version'
    `);
    return parseInt(result.rows[0]?.value || "0");
  }

  async setClientVersion(version: number): Promise<void> {
    await this.db.query(
      `
      UPDATE client_state SET value = $1 WHERE key = 'version'
    `,
      [version.toString()]
    );
  }

  async getLastSyncedVersion(): Promise<number> {
    const result = await this.db.query(`
      SELECT value FROM client_state WHERE key = 'last_synced_version'
    `);
    return parseInt(result.rows[0]?.value || "0");
  }

  async setLastSyncedVersion(version: number): Promise<void> {
    await this.db.query(
      `
      UPDATE client_state SET value = $1 WHERE key = 'last_synced_version'
    `,
      [version.toString()]
    );
  }

  private mapRowToEntity(row: any): SyncEntity {
    return {
      id: row.id,
      type: row.type,
      data: JSON.parse(row.data),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isDeleted: row.is_deleted,
    };
  }

  private mapRowToChange(row: any): Change {
    return {
      id: row.id,
      clientId: row.client_id,
      timestamp: row.timestamp,
      entityId: row.entity_id,
      entityType: row.entity_type,
      operation: row.operation,
      data: JSON.parse(row.data),
      previousData: row.previous_data
        ? JSON.parse(row.previous_data)
        : undefined,
    };
  }
}
```

## 3. Backend Storage: PGlite/Postgres Server

### Server Database Schema

```typescript
// src/storage/server-db.ts
import { PGlite } from "@electric-sql/pglite";
import { type SyncEntity, type Change } from "../sync-engine/types";

export class ServerDatabase {
  private db: PGlite;

  constructor() {
    // For development, use file system persistence
    // For production, could use regular Postgres
    this.db = new PGlite("./data/server-db");
  }

  async initialize(): Promise<void> {
    await this.db.exec(`
      -- Entities storage (authoritative server copy)
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_deleted BOOLEAN DEFAULT FALSE,
        version INTEGER NOT NULL DEFAULT 0
      );

      -- Replication log (Replicache pattern)
      -- Records all changes with global ordering
      CREATE TABLE IF NOT EXISTS replication_log (
        id SERIAL PRIMARY KEY,
        version INTEGER NOT NULL UNIQUE,
        client_id TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        data JSONB NOT NULL,
        previous_data JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Client version vectors (track what each client has seen)
      CREATE TABLE IF NOT EXISTS client_versions (
        client_id TEXT PRIMARY KEY,
        last_seen_version INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Global version counter
      CREATE TABLE IF NOT EXISTS global_state (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_version ON entities(version);
      CREATE INDEX IF NOT EXISTS idx_replication_log_version ON replication_log(version);
      CREATE INDEX IF NOT EXISTS idx_replication_log_client ON replication_log(client_id);
    `);

    // Initialize global version counter
    await this.db.exec(`
      INSERT INTO global_state (key, value) 
      VALUES ('current_version', 0)
      ON CONFLICT (key) DO NOTHING;
    `);
  }

  // Version management (Replicache pattern)
  async getCurrentVersion(): Promise<number> {
    const result = await this.db.query(`
      SELECT value FROM global_state WHERE key = 'current_version'
    `);
    return result.rows[0]?.value || 0;
  }

  async incrementVersion(): Promise<number> {
    await this.db.query(`
      UPDATE global_state SET value = value + 1 WHERE key = 'current_version'
    `);
    return this.getCurrentVersion();
  }

  // Push operations (client → server)
  async pushChanges(clientId: string, changes: Change[]): Promise<void> {
    await this.db.query("BEGIN");

    try {
      for (const change of changes) {
        const newVersion = await this.incrementVersion();

        // Apply change to entities table
        await this.applyChangeToEntity(change);

        // Record in replication log
        await this.db.query(
          `
          INSERT INTO replication_log (
            version, client_id, timestamp, entity_id, entity_type,
            operation, data, previous_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
          [
            newVersion,
            change.clientId,
            change.timestamp,
            change.entityId,
            change.entityType,
            change.operation,
            JSON.stringify(change.data),
            change.previousData ? JSON.stringify(change.previousData) : null,
          ]
        );
      }

      // Update client version tracker
      await this.db.query(
        `
        INSERT INTO client_versions (client_id, last_seen_version)
        VALUES ($1, $2)
        ON CONFLICT (client_id) DO UPDATE SET
          last_seen_version = EXCLUDED.last_seen_version,
          updated_at = NOW()
      `,
        [clientId, await this.getCurrentVersion()]
      );

      await this.db.query("COMMIT");
    } catch (error) {
      await this.db.query("ROLLBACK");
      throw error;
    }
  }

  // Pull operations (server → client)
  async pullChanges(
    clientId: string,
    lastSeenVersion: number
  ): Promise<{
    changes: Change[];
    currentVersion: number;
  }> {
    // Get all changes since client's last seen version
    const result = await this.db.query(
      `
      SELECT * FROM replication_log 
      WHERE version > $1 
      ORDER BY version ASC
    `,
      [lastSeenVersion]
    );

    const changes = result.rows.map((row) => ({
      id: `server-${row.id}`,
      clientId: row.client_id,
      timestamp: row.timestamp,
      entityId: row.entity_id,
      entityType: row.entity_type,
      operation: row.operation,
      data: JSON.parse(row.data),
      previousData: row.previous_data
        ? JSON.parse(row.previous_data)
        : undefined,
    }));

    return {
      changes,
      currentVersion: await this.getCurrentVersion(),
    };
  }

  private async applyChangeToEntity(change: Change): Promise<void> {
    switch (change.operation) {
      case "create":
        await this.db.query(
          `
          INSERT INTO entities (id, type, data, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = NOW()
        `,
          [change.entityId, change.entityType, JSON.stringify(change.data)]
        );
        break;

      case "update":
        await this.db.query(
          `
          UPDATE entities 
          SET data = $1, updated_at = NOW()
          WHERE id = $2
        `,
          [JSON.stringify(change.data), change.entityId]
        );
        break;

      case "delete":
        await this.db.query(
          `
          UPDATE entities 
          SET is_deleted = TRUE, updated_at = NOW()
          WHERE id = $1
        `,
          [change.entityId]
        );
        break;
    }
  }
}
```

## 4. TanStack Start RPC Endpoints

### Server Functions for Sync Operations

Following [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/server-functions):

```typescript
// src/api/sync.ts
import { createServerFn } from "@tanstack/start";
import { ServerDatabase } from "../storage/server-db";
import { type Change } from "../sync-engine/types";

// Initialize server database
const serverDb = new ServerDatabase();
await serverDb.initialize();

// Push endpoint: Client sends changes to server
export const pushChanges = createServerFn(
  "POST",
  async (payload: { clientId: string; changes: Change[] }) => {
    try {
      await serverDb.pushChanges(payload.clientId, payload.changes);
      return { success: true };
    } catch (error) {
      console.error("Push failed:", error);
      throw new Error("Failed to push changes");
    }
  }
);

// Pull endpoint: Client gets changes from server
export const pullChanges = createServerFn(
  "POST",
  async (payload: { clientId: string; lastSeenVersion: number }) => {
    try {
      const result = await serverDb.pullChanges(
        payload.clientId,
        payload.lastSeenVersion
      );
      return result;
    } catch (error) {
      console.error("Pull failed:", error);
      throw new Error("Failed to pull changes");
    }
  }
);

// Health check endpoint
export const healthCheck = createServerFn("GET", async () => {
  const version = await serverDb.getCurrentVersion();
  return {
    status: "ok",
    version,
    timestamp: Date.now(),
  };
});
```

## 5. Updated Sync Engine: Persistent Storage Integration

### Enhanced SyncEngine with Real Storage

```typescript
// src/sync-engine/PersistentSyncEngine.ts
import {
  type SyncEngine,
  type SyncEntity,
  type Change,
  type SyncState,
} from "./types";
import { ClientDatabase } from "../storage/client-db";
import { pushChanges, pullChanges } from "../api/sync";

export class PersistentSyncEngine implements SyncEngine {
  private clientDb: ClientDatabase;
  private stateChangeCallbacks: ((state: SyncState) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private entityChangeCallbacks: ((
    entity: SyncEntity,
    operation: "create" | "update" | "delete"
  ) => void)[] = [];

  constructor(private clientId: string) {
    this.clientDb = new ClientDatabase();
  }

  async initialize(): Promise<void> {
    await this.clientDb.initialize();

    // Start background sync
    this.startBackgroundSync();
  }

  // Core operations: Upsert, Delete, Query
  async upsert(
    entityId: string,
    entityType: string,
    data: Record<string, any>
  ): Promise<void> {
    const now = new Date();
    const existingEntity = await this.clientDb.getEntity(entityId);

    const entity: SyncEntity = {
      id: entityId,
      type: entityType,
      data,
      createdAt: existingEntity?.createdAt || now,
      updatedAt: now,
    };

    // Save to local database (upsert)
    await this.clientDb.saveEntity(entity);

    // Create change record (always "upsert" operation)
    const change: Change = {
      id: crypto.randomUUID(),
      clientId: this.clientId,
      timestamp: Date.now(),
      entityId,
      entityType,
      operation: "upsert",
      data,
      previousData: existingEntity?.data,
    };

    await this.clientDb.saveChange(change);

    // Notify listeners (determine if this was create or update for UI)
    const operation = existingEntity ? "update" : "create";
    this.notifyEntityChange(entity, operation);
    await this.notifyStateChange();
  }

  async delete(entityId: string): Promise<void> {
    const existingEntity = await this.clientDb.getEntity(entityId);
    if (!existingEntity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const deletedEntity: SyncEntity = {
      ...existingEntity,
      isDeleted: true,
      updatedAt: new Date(),
    };

    await this.clientDb.saveEntity(deletedEntity);

    const change: Change = {
      id: crypto.randomUUID(),
      clientId: this.clientId,
      timestamp: Date.now(),
      entityId,
      entityType: existingEntity.type,
      operation: "delete",
      data: deletedEntity.data,
      previousData: existingEntity.data,
    };

    await this.clientDb.saveChange(change);

    this.notifyEntityChange(deletedEntity, "delete");
    await this.notifyStateChange();
  }

  // Query operations (unified query interface)
  async query(querySpec: {
    entityType?: string;
    entityId?: string;
    where?: (entity: SyncEntity) => boolean;
    orderBy?: keyof SyncEntity;
    limit?: number;
  }): Promise<SyncEntity[]> {
    // Single entity by ID
    if (querySpec.entityId) {
      const entity = await this.clientDb.getEntity(querySpec.entityId);
      return entity ? [entity] : [];
    }

    // By entity type
    if (querySpec.entityType) {
      let entities = await this.clientDb.getEntitiesByType(
        querySpec.entityType
      );

      // Apply filters
      if (querySpec.where) {
        entities = entities.filter(querySpec.where);
      }

      // Apply ordering and limit
      if (querySpec.orderBy) {
        entities.sort((a, b) => {
          const aVal = a[querySpec.orderBy!];
          const bVal = b[querySpec.orderBy!];
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        });
      }

      if (querySpec.limit) {
        entities = entities.slice(0, querySpec.limit);
      }

      return entities;
    }

    // All entities (use sparingly)
    return this.clientDb.getAllEntities();
  }

  // Sync operations (now using RPC!)
  async push(): Promise<void> {
    try {
      const pendingChanges = await this.clientDb.getPendingChanges();

      if (pendingChanges.length === 0) return;

      await pushChanges({
        clientId: this.clientId,
        changes: pendingChanges,
      });

      // Mark changes as synced
      const changeIds = pendingChanges.map((c) => c.id);
      await this.clientDb.markChangesSynced(changeIds);

      console.log(`Pushed ${pendingChanges.length} changes`);
    } catch (error) {
      this.notifyError(error as Error);
    }
  }

  async pull(): Promise<void> {
    try {
      const lastSeenVersion = await this.clientDb.getLastSyncedVersion();

      const result = await pullChanges({
        clientId: this.clientId,
        lastSeenVersion,
      });

      // Apply remote changes to local database
      for (const change of result.changes) {
        await this.applyRemoteChange(change);
      }

      // Update last synced version
      await this.clientDb.setLastSyncedVersion(result.currentVersion);

      if (result.changes.length > 0) {
        console.log(`Pulled ${result.changes.length} changes`);
        await this.notifyStateChange();
      }
    } catch (error) {
      this.notifyError(error as Error);
    }
  }

  async getState(): Promise<SyncState> {
    const version = await this.clientDb.getClientVersion();
    const lastSyncedVersion = await this.clientDb.getLastSyncedVersion();
    const pendingChanges = await this.clientDb.getPendingChanges();

    // Note: For entities map, would need to implement efficient loading
    // For now, return minimal state
    return {
      version,
      lastSyncedVersion,
      pendingChanges,
      entities: new Map(), // TODO: Implement efficient entity loading
    };
  }

  // Background sync every 5 seconds
  private startBackgroundSync(): void {
    setInterval(async () => {
      await this.pull();
      await this.push();
    }, 5000);
  }

  private async applyRemoteChange(change: Change): Promise<void> {
    // Apply change to local database
    switch (change.operation) {
      case "create":
      case "update":
        const entity: SyncEntity = {
          id: change.entityId,
          type: change.entityType,
          data: change.data,
          createdAt: new Date(), // Server should provide this
          updatedAt: new Date(),
          isDeleted: change.operation === "delete",
        };
        await this.clientDb.saveEntity(entity);
        this.notifyEntityChange(entity, change.operation);
        break;

      case "delete":
        const existingEntity = await this.clientDb.getEntity(change.entityId);
        if (existingEntity) {
          const deletedEntity = { ...existingEntity, isDeleted: true };
          await this.clientDb.saveEntity(deletedEntity);
          this.notifyEntityChange(deletedEntity, "delete");
        }
        break;
    }
  }

  // Event handling (unchanged)
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

  private async notifyStateChange(): Promise<void> {
    const state = await this.getState();
    this.stateChangeCallbacks.forEach((callback) => callback(state));
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
```

## 6. Migration Path & Implementation Plan

### Phase 1: Database Classes

1. Install PGlite dependency
2. Implement ClientDatabase class
3. Implement ServerDatabase class
4. Test basic CRUD operations

### Phase 2: TanStack Start Integration

1. Create server functions for push/pull
2. Test RPC endpoints
3. Implement error handling

### Phase 3: Persistent Sync Engine

1. Build PersistentSyncEngine
2. Update React hooks
3. Test offline/online scenarios

### Phase 4: Migration & Testing

1. Update components to use persistent engine
2. Test multi-client synchronization
3. Verify conflict resolution

## 7. Testing Strategy

### Required Tests

- [ ] Frontend PGlite initialization and CRUD
- [ ] Backend database schema and operations
- [ ] TanStack Start RPC functionality
- [ ] End-to-end sync flow
- [ ] Offline → Online sync scenarios
- [ ] Concurrent modification handling

## Next Steps

**Ready to implement Phase 1: Database Classes with PGlite?**

This storage design follows Replicache's proven patterns while leveraging PGlite for true offline capability and TanStack Start for type-safe RPC communication.
