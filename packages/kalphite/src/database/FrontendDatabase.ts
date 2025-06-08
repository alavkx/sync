import { PGlite } from "@electric-sql/pglite";

export interface FrontendDatabaseConfig {
  schema: any;
  dbName: string;
}

export class FrontendDatabase {
  private db: PGlite | null = null;
  private isInitialized = false;
  public config: FrontendDatabaseConfig;

  constructor(config: FrontendDatabaseConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.db = new PGlite(this.config.dbName);
    await this.db.waitReady;
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
  }

  async isReady(): Promise<boolean> {
    return this.isInitialized && this.db !== null;
  }

  async upsert(entityType: string, id: string, entity: any): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.ensureTableExists(entityType);

    await this.db.query(
      `INSERT INTO ${entityType} (id, data, updated_at) 
       VALUES ($1, $2, $3)
       ON CONFLICT (id) 
       DO UPDATE SET 
         data = EXCLUDED.data,
         updated_at = EXCLUDED.updated_at`,
      [
        id,
        JSON.stringify(entity.data),
        new Date(entity.updatedAt).toISOString(),
      ]
    );
  }

  async getById(entityType: string, id: string): Promise<any | null> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const result = await this.db.query(
        `SELECT * FROM ${entityType} WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) return null;
      return this.reconstructEntity(entityType, result.rows[0]);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return null;
      }
      throw error;
    }
  }

  async getByType(entityType: string): Promise<any[]> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      const result = await this.db.query(`SELECT * FROM ${entityType}`);
      return result.rows.map((row) => this.reconstructEntity(entityType, row));
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return [];
      }
      throw error;
    }
  }

  async rawQuery(query: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error("Database not initialized");
    const result = await this.db.query(query, params);
    return result.rows;
  }

  private async ensureTableExists(entityType: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    try {
      // Try to query the table to see if it exists
      await this.db.query(`SELECT 1 FROM ${entityType} LIMIT 1`);
    } catch (error) {
      // Table doesn't exist, create it
      await this.db.exec(`
        CREATE TABLE ${entityType} (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  }

  private reconstructEntity(entityType: string, row: any): any {
    return {
      id: row.id,
      type: entityType,
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }
}
