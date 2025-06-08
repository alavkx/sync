import { createKalphiteStore } from "../../kalphite/src/store/KalphiteStore";

// Initialize the Kalphite store with our schema
export async function setupStore() {
  const store = createKalphiteStore();
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
