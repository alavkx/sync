export interface KalphiteConfig {
  // Flush timing configuration
  flushDebounceMs?: number;
  networkPushDebounceMs?: number;
  networkPullIntervalMs?: number;

  // Storage configuration
  databaseName?: string;

  // Development options
  enableDevtools?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error" | "silent";
}
