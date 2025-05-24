import { useEffect, useState } from "react";
import { SimpleSyncEngine } from "./SyncEngine";
import type { SyncState } from "./types";

export function useSyncEngine(clientId: string) {
  const [engine] = useState(() => new SimpleSyncEngine(clientId));
  const [state, setState] = useState<SyncState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Initial state load
    engine.getState().then(setState);

    // Subscribe to state changes
    engine.onStateChange(setState);
    engine.onSyncError(setError);

    // Set up periodic sync
    const syncInterval = setInterval(() => {
      engine.push();
      engine.pull();
    }, 5000); // Sync every 5 seconds

    return () => {
      clearInterval(syncInterval);
    };
  }, [engine]);

  return {
    state,
    error,
    applyChange: engine.applyChange.bind(engine),
    push: engine.push.bind(engine),
    pull: engine.pull.bind(engine),
  };
}
