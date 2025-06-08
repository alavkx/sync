import { Pool } from "pg";
import type { FrontendDatabaseConfig } from "../types/database";
import type { Entity, EntityId } from "../types/entity";

export class FrontendDatabase {
  private pool: Pool;
  private config: FrontendDatabaseConfig;

  constructor(config: FrontendDatabaseConfig) {
    this.config = config;
    this.pool = new Pool({
      connectionString: config.connectionString,
    });
  }

  async getById(type: string, id: EntityId): Promise<Entity | null> {
    const result = await this.pool.query<Entity>(
      `SELECT * FROM ${type} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getAll(type: string): Promise<Entity[]> {
    const result = await this.pool.query<Entity>(`SELECT * FROM ${type}`);
    return result.rows;
  }

  async upsert(type: string, entity: Entity): Promise<void> {
    const { id, ...data } = entity;
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

    await this.pool.query(
      `INSERT INTO ${type} (id, ${columns.join(", ")}) 
       VALUES ($1, ${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${setClause}`,
      [id, ...values]
    );
  }

  async delete(type: string, id: EntityId): Promise<void> {
    await this.pool.query(`DELETE FROM ${type} WHERE id = $1`, [id]);
  }

  async getTables(): Promise<string[]> {
    const result = await this.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    return result.rows.map((row: { table_name: string }) => row.table_name);
  }

  async getTableSize(tableName: string): Promise<number> {
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
    await this.pool.end();
  }
}
