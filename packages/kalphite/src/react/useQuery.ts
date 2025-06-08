import { useEffect, useMemo, useState } from "react";
import type { Entity } from "../types/entity";
import { useKalphiteStore } from "./useKalphiteStore";

interface QueryOptions<T = Entity> {
  where?: (entity: T) => boolean;
  sortBy?: (a: T, b: T) => number;
  limit?: number;
  offset?: number;
}

export function useQuery<T extends Entity = Entity>(
  type: string,
  options: QueryOptions<T> = {}
): T[] {
  const store = useKalphiteStore();
  const [results, setResults] = useState<T[]>([]);

  // Memoize the query function to avoid unnecessary re-executions
  const queryFn = useMemo(() => {
    return (collection: T[]): T[] => {
      let filtered = collection;

      if (options.where) {
        filtered = filtered.filter(options.where);
      }

      if (options.sortBy) {
        filtered = [...filtered].sort(options.sortBy);
      }

      if (options.offset) {
        filtered = filtered.slice(options.offset);
      }

      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }

      return filtered;
    };
  }, [options.where, options.sortBy, options.limit, options.offset]);

  useEffect(() => {
    if (!store) {
      setResults([]);
      return;
    }

    // Initial query
    const collection = (store[type] as T[]) || [];
    const initialResults = queryFn(collection);
    setResults(initialResults);

    // Subscribe to changes and re-run query
    const unsubscribe = store.subscribe(() => {
      const newCollection = (store[type] as T[]) || [];
      const newResults = queryFn(newCollection);
      setResults(newResults);
    });

    return unsubscribe;
  }, [store, type, queryFn]);

  return results;
}
