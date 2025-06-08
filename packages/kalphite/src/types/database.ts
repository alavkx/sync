export interface FrontendDatabaseConfig {
  connectionString: string;
  schema?: Record<string, unknown>;
}
