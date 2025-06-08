import { useEffect, useRef, useState } from "react";
import type { Entity } from "../types/entity";
import { useKalphiteStore } from "./useKalphiteStore";

export function useCollection<T extends Entity = Entity>(type: string): T[] {
  const store = useKalphiteStore();
  const [collection, setCollection] = useState<T[]>([]);
  const lastCollectionRef = useRef<T[]>([]);

  useEffect(() => {
    if (!store) {
      setCollection([]);
      return;
    }

    // Initial load
    const initialCollection = (store[type] as T[]) || [];
    setCollection(initialCollection);
    lastCollectionRef.current = initialCollection;

    // Subscribe to changes
    const unsubscribe = store.subscribe(() => {
      const newCollection = (store[type] as T[]) || [];

      // Only update if the collection actually changed (referential equality check)
      if (newCollection !== lastCollectionRef.current) {
        setCollection(newCollection);
        lastCollectionRef.current = newCollection;
      }
    });

    return unsubscribe;
  }, [store, type]);

  return collection;
}
