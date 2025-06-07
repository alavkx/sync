import { useEffect, useState } from "react";
import { SimpleSyncEngine } from "./SyncEngine";
import type { ClientID, SyncState } from "./types";

export function useSyncEngine(clientId: ClientID) {
  const [engine] = useState(() => new SimpleSyncEngine(clientId));
  const [state, setState] = useState<SyncState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Initial state load
    setState(engine.getState());

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
    // Raw engine access
    engine,

    // State
    state,
    error,

    // Core operations
    create: engine.create.bind(engine),
    update: engine.update.bind(engine),
    delete: engine.delete.bind(engine),

    // Query operations
    get: engine.get.bind(engine),
    getByType: engine.getByType.bind(engine),
    query: engine.query.bind(engine),

    // Sync operations
    push: engine.push.bind(engine),
    pull: engine.pull.bind(engine),

    // Event subscriptions
    onEntityChange: engine.onEntityChange.bind(engine),
  };
}
