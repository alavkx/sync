import { useEffect, useState } from "react";
import type { Entity, EntityId } from "../types/entity";
import { useKalphiteStore } from "./useKalphiteStore";

export function useEntity<T extends Entity = Entity>(
  type: string,
  id: EntityId
): T | undefined {
  const store = useKalphiteStore();
  const [entity, setEntity] = useState<T | undefined>(undefined);

  useEffect(() => {
    if (!store) {
      setEntity(undefined);
      return;
    }

    // Initial load
    const collection = (store[type] as T[]) || [];
    const initialEntity = collection.find((e: T) => e.id === id);
    setEntity(initialEntity);

    // Subscribe to changes
    const unsubscribe = store.subscribe(() => {
      const newCollection = (store[type] as T[]) || [];
      const newEntity = newCollection.find((e: T) => e.id === id);
      setEntity(newEntity);
    });

    return unsubscribe;
  }, [store, type, id]);

  return entity;
}
