import type { KalphiteStoreType } from "../store/KalphiteStore";

// Global store instance - will be set during initialization
let globalStore: KalphiteStoreType<any> | null = null;

export function setGlobalStore(store: KalphiteStoreType<any>): void {
  globalStore = store;
}

export function useKalphiteStore(): KalphiteStoreType<any> | null {
  return globalStore;
}
