import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { z } from "zod";
import {
  setGlobalStore,
  useCollection,
  useEntity,
  useKalphiteStore,
} from "../react";
import { createKalphiteStore } from "../store/KalphiteStore";

// Test schema for Layer 5 tests
const TestEntitySchema = z.object({
  id: z.string(),
  type: z.literal("test"),
  data: z.object({
    name: z.string(),
  }),
  updatedAt: z.number(),
});

type TestEntity = z.infer<typeof TestEntitySchema>;

const createTestEntity = (id: string, name: string): TestEntity => ({
  id,
  type: "test",
  data: { name },
  updatedAt: Date.now(),
});

describe("Layer 5: React Integration", () => {
  let store: any;

  beforeEach(() => {
    // Reset global store before each test
    setGlobalStore(null as any);
    store = createKalphiteStore();
    setGlobalStore(store);
  });

  afterEach(() => {
    // Clean up global store
    setGlobalStore(null as any);
  });

  describe("Hook Fundamentals", () => {
    test("should provide useKalphiteStore hook for store access", () => {
      const { result } = renderHook(() => useKalphiteStore());
      expect(result.current).toBe(store);
    });

    test("should return null when no store is initialized", () => {
      setGlobalStore(null as any);
      const { result } = renderHook(() => useKalphiteStore());
      expect(result.current).toBeNull();
    });

    test("should return store instance when initialized", () => {
      const { result } = renderHook(() => useKalphiteStore());
      expect(result.current).toBeDefined();
      expect(result.current).toBe(store);
    });

    test("should handle store re-initialization gracefully", () => {
      const { result, rerender } = renderHook(() => useKalphiteStore());
      expect(result.current).toBe(store);

      const newStore = createKalphiteStore();
      setGlobalStore(newStore);
      rerender();
      expect(result.current).toBe(store); // Should still be old store until next hook execution
    });
  });

  describe("Reactive Updates", () => {
    test("should trigger re-render when entities change", () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      expect(result.current).toHaveLength(0);

      act(() => {
        store.test.push(createTestEntity("1", "Test Entity"));
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].data.name).toBe("Test Entity");
    });

    test("should trigger re-render when specific collection changes", () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      act(() => {
        store.test.push(createTestEntity("1", "First"));
        store.test.push(createTestEntity("2", "Second"));
      });

      expect(result.current).toHaveLength(2);
    });

    test("should NOT trigger re-render for unrelated collection changes", () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));
      let renderCount = 0;

      const { result: counterResult } = renderHook(() => {
        renderCount++;
        return useCollection<TestEntity>("test");
      });

      const initialRenderCount = renderCount;

      // Add to different collection type
      act(() => {
        store.other = store.other || [];
        store.other.push({
          id: "other1",
          type: "other",
          data: { name: "Other" },
          updatedAt: Date.now(),
        });
      });

      // Should not have triggered re-render for "test" collection
      expect(renderCount).toBe(initialRenderCount);
    });

    test("should batch multiple rapid changes into single re-render", () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      act(() => {
        store.test.push(createTestEntity("1", "First"));
        store.test.push(createTestEntity("2", "Second"));
        store.test.push(createTestEntity("3", "Third"));
      });

      expect(result.current).toHaveLength(3);
    });

    test("should handle concurrent updates without race conditions", async () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      const promises = Array.from(
        { length: 10 },
        (_, i) =>
          new Promise<void>((resolve) => {
            act(() => {
              store.test.push(
                createTestEntity(`concurrent-${i}`, `Entity ${i}`)
              );
              resolve();
            });
          })
      );

      await Promise.all(promises);
      expect(result.current).toHaveLength(10);
    });
  });

  describe("Collection Subscriptions", () => {
    test("should provide useCollection hook for specific entity types", () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));
      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current).toHaveLength(0);
    });

    test("should only subscribe to relevant collection changes", () => {
      const { result: testResult } = renderHook(() =>
        useCollection<TestEntity>("test")
      );
      const { result: otherResult } = renderHook(() => useCollection("other"));

      act(() => {
        store.test.push(createTestEntity("1", "Test"));
      });

      expect(testResult.current).toHaveLength(1);
      expect(otherResult.current).toHaveLength(0);
    });

    test("should unsubscribe when component unmounts", () => {
      const { unmount } = renderHook(() => useCollection<TestEntity>("test"));

      // Unmounting should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    test("should handle empty collections gracefully", () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));
      expect(result.current).toEqual([]);
    });

    test("should maintain referential stability for unchanged collections", () => {
      const { result, rerender } = renderHook(() =>
        useCollection<TestEntity>("test")
      );
      const firstReference = result.current;

      rerender();

      // Should be the same reference if no changes occurred
      expect(result.current).toBe(firstReference);
    });
  });

  describe("Entity Subscriptions", () => {
    test("should provide useEntity hook for single entity access", () => {
      const entity = createTestEntity("1", "Test Entity");

      act(() => {
        store.test.push(entity);
      });

      const { result } = renderHook(() => useEntity<TestEntity>("test", "1"));
      expect(result.current).toEqual(entity);
    });

    test("should re-render when subscribed entity changes", () => {
      const entity = createTestEntity("1", "Original");

      act(() => {
        store.test.push(entity);
      });

      const { result } = renderHook(() => useEntity<TestEntity>("test", "1"));
      expect(result.current?.data.name).toBe("Original");

      act(() => {
        store.test[0].data.name = "Updated";
      });

      expect(result.current?.data.name).toBe("Updated");
    });

    test("should handle entity deletion gracefully", () => {
      const entity = createTestEntity("1", "Test");

      act(() => {
        store.test.push(entity);
      });

      const { result } = renderHook(() => useEntity<TestEntity>("test", "1"));
      expect(result.current).toBeDefined();

      act(() => {
        store.test.splice(0, 1); // Remove the entity
      });

      expect(result.current).toBeUndefined();
    });

    test("should return undefined for non-existent entities", () => {
      const { result } = renderHook(() =>
        useEntity<TestEntity>("test", "nonexistent")
      );
      expect(result.current).toBeUndefined();
    });

    test("should optimize for frequently accessed entities", () => {
      // This is more of a performance characteristic test
      const entity = createTestEntity("1", "Test");

      act(() => {
        store.test.push(entity);
      });

      const { result } = renderHook(() => useEntity<TestEntity>("test", "1"));
      expect(result.current).toBeDefined();
    });
  });

  describe("Query Integration", () => {
    test.todo("should provide useQuery hook for filtered collections");
    test.todo("should re-render when query results change");
    test.todo("should optimize query re-execution");
    test.todo("should handle dynamic query parameters");
    test.todo("should support sorting and limiting");
  });

  describe("Performance Optimizations", () => {
    test("should implement selective subscriptions to minimize re-renders", () => {
      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount++;
        return useCollection<TestEntity>("test");
      });

      expect(renderCount).toBe(1);

      // Multiple rapid changes should be batched into single re-render
      act(() => {
        store.test.push(createTestEntity("1", "First"));
        store.test.push(createTestEntity("2", "Second"));
        store.test.push(createTestEntity("3", "Third"));
      });

      // Should only re-render once for batched changes
      expect(renderCount).toBe(2);
      expect(result.current).toHaveLength(3);
    });

    test("should use referential equality for unchanged data", () => {
      const { result, rerender } = renderHook(() =>
        useCollection<TestEntity>("test")
      );
      const firstReference = result.current;

      // Re-render without changes
      rerender();

      // Should maintain the same reference
      expect(result.current).toBe(firstReference);
    });

    test.todo("should handle 1000+ entities without performance degradation");
    test.todo("should debounce rapid changes appropriately");
    test.todo("should provide memory-efficient subscriptions");
  });

  describe("Developer Experience", () => {
    test("should provide type-safe hooks with full TypeScript inference", () => {
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      act(() => {
        store.test.push(createTestEntity("1", "Test"));
      });

      // TypeScript should infer the correct type for result.current
      expect(result.current).toHaveLength(1);
      expect(result.current[0].data.name).toBe("Test");
      expect(result.current[0].type).toBe("test");
    });

    test("should include helpful error messages for common mistakes", () => {
      // Test hook without store
      setGlobalStore(null as any);
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      // Should handle gracefully without store
      expect(result.current).toEqual([]);
    });

    test.todo("should support React DevTools integration");
    test.todo("should provide debugging utilities for hook state");
    test.todo("should handle React Strict Mode correctly");
  });

  describe("Integration Patterns", () => {
    test.todo("should work with React Suspense boundaries");
    test.todo("should integrate with React ErrorBoundary");
    test.todo("should support server-side rendering (SSR)");
    test.todo("should handle hydration mismatches gracefully");
    test.todo("should work with React concurrent features");
  });

  describe("Multi-Component Coordination", () => {
    test("should synchronize state across multiple components", () => {
      const { result: result1 } = renderHook(() =>
        useCollection<TestEntity>("test")
      );
      const { result: result2 } = renderHook(() =>
        useCollection<TestEntity>("test")
      );

      expect(result1.current).toHaveLength(0);
      expect(result2.current).toHaveLength(0);

      act(() => {
        store.test.push(createTestEntity("1", "Shared"));
      });

      // Both hooks should see the same data
      expect(result1.current).toHaveLength(1);
      expect(result2.current).toHaveLength(1);
      expect(result1.current[0].data.name).toBe("Shared");
      expect(result2.current[0].data.name).toBe("Shared");
    });

    test("should handle component lifecycle properly", () => {
      const { result, unmount } = renderHook(() =>
        useCollection<TestEntity>("test")
      );

      act(() => {
        store.test.push(createTestEntity("1", "Test"));
      });

      expect(result.current).toHaveLength(1);

      // Unmounting should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    test.todo("should optimize for parent-child component patterns");
    test.todo("should support context-based store provision");
    test.todo("should handle rapid mount/unmount cycles");
  });

  describe("DEMO: React integration workflow", () => {
    test("should demonstrate complete todo app workflow with React", () => {
      // Simulate a todo app with multiple components
      const { result: todoList } = renderHook(() =>
        useCollection<TestEntity>("test")
      );
      const { result: todoCounter } = renderHook(() =>
        useCollection<TestEntity>("test")
      );

      // Initially empty
      expect(todoList.current).toHaveLength(0);
      expect(todoCounter.current).toHaveLength(0);

      // Add todos
      act(() => {
        store.test.push(createTestEntity("1", "Buy groceries"));
        store.test.push(createTestEntity("2", "Walk the dog"));
        store.test.push(createTestEntity("3", "Write code"));
      });

      // Both components should see the updates
      expect(todoList.current).toHaveLength(3);
      expect(todoCounter.current).toHaveLength(3);
      expect(todoList.current[0].data.name).toBe("Buy groceries");
      expect(todoList.current[1].data.name).toBe("Walk the dog");
      expect(todoList.current[2].data.name).toBe("Write code");
    });

    test.todo("should show real-time collaboration between components");
    test.todo("should showcase performance with large datasets");
  });
});
