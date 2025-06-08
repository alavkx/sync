import { useEffect, useState } from "react";
// Import the actual Kalphite store and schema
import { createDemoData, reviewStore } from "../../../store";

// Real implementation connecting to Kalphite store
export function useKalphiteStore(_store: any) {
  return reviewStore;
}

// Real hook that connects to Kalphite collections
export function useCollection<T = any>(collectionName: string): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    // Get initial data
    const collection = (reviewStore as any)[collectionName];
    if (collection) {
      setData([...collection]);
    }

    // Subscribe to changes
    const unsubscribe = reviewStore.subscribe(() => {
      const updatedCollection = (reviewStore as any)[collectionName];
      if (updatedCollection) {
        setData([...updatedCollection]);
      }
    });

    return unsubscribe;
  }, [collectionName]);

  return data;
}

// Function to load actual demo data using the store's createDemoData
export function loadDemoData() {
  createDemoData();
}

// Function to clear all data
export function clearAllData() {
  reviewStore.clear();
}
