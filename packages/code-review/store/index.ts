import { initializeStore } from "@kalphite/sync-engine";
import { EntitySchema } from "../code-review/schema";

// Initialize the Kalphite store with our schema
export async function setupStore() {
  const store = await initializeStore(EntitySchema, {
    enableDevtools: true,
    logLevel: "debug",
  });

  return store;
}

// Initialize store on app startup
let storePromise: Promise<any> | null = null;

export function getStore() {
  if (!storePromise) {
    storePromise = setupStore();
  }
  return storePromise;
}
