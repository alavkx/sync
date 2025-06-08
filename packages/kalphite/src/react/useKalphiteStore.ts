import { useSyncExternalStore } from "react";
import type { KalphiteStore } from "../store/KalphiteStore";

// Global store instance - will be set during initialization
let globalStore: KalphiteStore<any> | null = null;

export function setGlobalStore(store: KalphiteStore<any>): void {
  globalStore = store;
}

export function useKalphiteStore(): KalphiteStore<any> | null {
  return useSyncExternalStore(
    globalStore?.subscribe || (() => () => {}),
    () => globalStore,
    () => globalStore
  );
}
