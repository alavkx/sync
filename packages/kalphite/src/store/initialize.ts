import { setGlobalStore } from "../react/useKalphiteStore";
import type { KalphiteConfig } from "../types/config";
import type { StandardSchemaV1 } from "../types/StandardSchema";
import type { KalphiteStoreType } from "./KalphiteStore";
import { KalphiteStore } from "./KalphiteStore";

export async function initializeStore<TSchema extends StandardSchemaV1>(
  schema: TSchema,
  config: KalphiteConfig = {}
): Promise<KalphiteStoreType<TSchema>> {
  const store = KalphiteStore(schema, config);

  // Set as global store for React hook
  setGlobalStore(store);

  // Future: Initialize persistence layer, network sync, etc.

  return store;
}
