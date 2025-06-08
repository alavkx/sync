import { setGlobalStore } from "../react/useKalphiteStore";
import type { KalphiteConfig } from "../types/config";
import { KalphiteStore } from "./KalphiteStore";

export async function initializeStore(
  schema?: any,
  config?: KalphiteConfig
): Promise<KalphiteStore<any>> {
  // Create the store
  const store = new KalphiteStore(schema, config);

  // Set as global store for React hook
  setGlobalStore(store);

  // Future: Initialize persistence layer, network sync, etc.

  return store;
}
