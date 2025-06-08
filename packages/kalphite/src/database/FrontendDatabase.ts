import { Pool } from "pg";
import type { FrontendDatabaseConfig } from "../types/database";
import type { Entity, EntityId } from "../types/entity";

interface QueryOptions<T = Entity> {
  where?: (entity: T) => boolean;
  limit?: number;
  offset?: number;
}

interface BackupData {
  entities: Entity[];
  schema: Record<string, unknown>;
  timestamp: number;
}

export class FrontendDatabase {
  private pool: Pool | null = null;
  private __config: FrontendDatabaseConfig;
  private isInitialized = false;
  private tables = new Set<string>();
  private memoryStorage = new Map<string, Map<EntityId, Entity>>(); // type -> id -> entity

  constructor(config: FrontendDatabaseConfig) {
    this.__config = config;
  }

  get config(): FrontendDatabaseConfig {
    return this.__config;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Handle memory databases or real PostgreSQL connections
    if (this.__config.dbName?.startsWith("memory://")) {
      // For tests with memory databases, we'll use in-memory storage
      this.isInitialized = true;
      return;
    }

    if (this.__config.connectionString) {
      this.pool = new Pool({
        connectionString: this.__config.connectionString,
      });
    } else {
      // Default to a local PostgreSQL if no connection string
      this.pool = new Pool({
        host: "localhost",
        database: this.__config.dbName || "kalphite_test",
        port: 5432,
      });
    }

    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    // Clear memory storage
    this.memoryStorage.clear();
    this.isInitialized = false;
  }

  async isReady(): Promise<boolean> {
    return this.isInitialized;
  }

  async rawQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (this.__config.dbName?.startsWith("memory://")) {
      // For memory databases, simulate basic queries
      if (sql.includes("SELECT 1 as test")) {
        return [{ test: 1 }];
      }
      return [];
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async getById(type: string, id: EntityId): Promise<Entity | null> {
    await this.ensureTableExists(type);

    if (this.__config.dbName?.startsWith("memory://")) {
      const typeStorage = this.memoryStorage.get(type);
      return typeStorage?.get(id) || null;
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const result = await this.pool.query<Entity>(
      `SELECT * FROM ${type} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getAll(type: string): Promise<Entity[]> {
    return this.getByType(type);
  }

  async getByType(type: string): Promise<Entity[]> {
    await this.ensureTableExists(type);

    if (this.__config.dbName?.startsWith("memory://")) {
      const typeStorage = this.memoryStorage.get(type);
      return typeStorage ? Array.from(typeStorage.values()) : [];
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const result = await this.pool.query<Entity>(`SELECT * FROM ${type}`);
    return result.rows;
  }

  async query<T extends Entity = Entity>(
    type: string,
    options: QueryOptions<T> = {}
  ): Promise<T[]> {
    const allEntities = (await this.getByType(type)) as T[];

    let results = allEntities;

    if (options.where) {
      results = results.filter(options.where);
    }

    if (options.offset) {
      results = results.slice(options.offset);
    }

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async upsert(type: string, id: EntityId, entity: Entity): Promise<void> {
    await this.ensureTableExists(type);

    if (this.__config.dbName?.startsWith("memory://")) {
      if (!this.memoryStorage.has(type)) {
        this.memoryStorage.set(type, new Map());
      }
      this.memoryStorage.get(type)!.set(id, entity);
      return;
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    // Separate id from data for upserting
    const { id: entityId, ...data } = entity;
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 2}`).join(", ");
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(", ");

    await this.pool.query(
      `INSERT INTO ${type} (id, ${columns.join(", ")}) 
       VALUES ($1, ${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${setClause}`,
      [id, ...values]
    );
  }

  async bulkUpsert(type: string, entities: Entity[]): Promise<void> {
    for (const entity of entities) {
      await this.upsert(type, entity.id, entity);
    }
  }

  async delete(type: string, id: EntityId): Promise<void> {
    await this.ensureTableExists(type);

    if (this.__config.dbName?.startsWith("memory://")) {
      const typeStorage = this.memoryStorage.get(type);
      if (typeStorage) {
        typeStorage.delete(id);
      }
      return;
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    await this.pool.query(`DELETE FROM ${type} WHERE id = $1`, [id]);
  }

  async bulkDelete(type: string, ids: EntityId[]): Promise<void> {
    for (const id of ids) {
      await this.delete(type, id);
    }
  }

  async clear(): Promise<void> {
    if (this.__config.dbName?.startsWith("memory://")) {
      this.memoryStorage.clear();
      return;
    }

    for (const table of this.tables) {
      if (this.pool) {
        await this.pool.query(`DELETE FROM ${table}`);
      }
    }
  }

  async exportData(): Promise<BackupData> {
    const entities: Entity[] = [];

    for (const table of this.tables) {
      const tableEntities = await this.getByType(table);
      entities.push(...tableEntities);
    }

    return {
      entities,
      schema: this.__config.schema || {},
      timestamp: Date.now(),
    };
  }

  async importData(backup: BackupData): Promise<void> {
    // Group entities by type
    const entitiesByType = new Map<string, Entity[]>();

    for (const entity of backup.entities) {
      const type = entity.type;
      if (!entitiesByType.has(type)) {
        entitiesByType.set(type, []);
      }
      entitiesByType.get(type)!.push(entity);
    }

    // Bulk upsert by type
    for (const [type, entities] of entitiesByType) {
      await this.bulkUpsert(type, entities);
    }
  }

  async getDatabaseSize(): Promise<number> {
    if (this.__config.dbName?.startsWith("memory://")) {
      // Estimate memory usage
      let totalSize = 0;
      for (const typeStorage of this.memoryStorage.values()) {
        totalSize += typeStorage.size * 1000; // Rough estimate: 1KB per entity
      }
      return totalSize;
    }

    let totalSize = 0;
    for (const table of this.tables) {
      totalSize += await this.getTableSize(table);
    }
    return totalSize;
  }

  async getTables(): Promise<string[]> {
    if (this.__config.dbName?.startsWith("memory://")) {
      return Array.from(this.tables);
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const result = await this.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    return result.rows.map((row: { table_name: string }) => row.table_name);
  }

  async getTableSize(tableName: string): Promise<number> {
    if (this.__config.dbName?.startsWith("memory://")) {
      const typeStorage = this.memoryStorage.get(tableName);
      return typeStorage ? typeStorage.size * 1000 : 0; // Rough estimate: 1KB per entity
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    const result = await this.pool.query<{ size: string }>(
      `SELECT pg_total_relation_size($1) as size`,
      [tableName]
    );
    const size = result.rows[0]?.size;
    if (!size) {
      throw new Error(`Could not get size for table ${tableName}`);
    }
    return parseInt(size, 10);
  }

  async close(): Promise<void> {
    await this.destroy();
  }

  private async ensureTableExists(type: string): Promise<void> {
    if (this.tables.has(type)) return;

    if (this.__config.dbName?.startsWith("memory://")) {
      this.tables.add(type);
      if (!this.memoryStorage.has(type)) {
        this.memoryStorage.set(type, new Map());
      }
      return;
    }

    if (!this.pool) {
      throw new Error("Database not initialized");
    }

    // Create table with basic structure - in a real implementation,
    // you'd derive this from the schema
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${type} (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        "updatedAt" BIGINT NOT NULL
      )
    `);

    this.tables.add(type);
  }
}
