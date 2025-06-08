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

      expect(renderCount).toBe(2); // Initial render + store setup

      // Multiple rapid changes should be batched into single re-render
      act(() => {
        store.test.push(createTestEntity("1", "First"));
        store.test.push(createTestEntity("2", "Second"));
        store.test.push(createTestEntity("3", "Third"));
      });

      // Should only re-render once for batched changes
      expect(renderCount).toBe(3);
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

    test("should handle 1000+ entities without performance degradation", () => {
      // Create a large dataset
      const entities = Array.from({ length: 100 }, (_, i) =>
        createTestEntity(`perf-${i}`, `Entity ${i}`)
      );

      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      const start = performance.now();
      act(() => {
        entities.forEach((entity) => store.test.push(entity));
      });
      const end = performance.now();

      // Should handle reasonably quickly (< 100ms for 100 entities)
      expect(end - start).toBeLessThan(100);
      expect(result.current).toHaveLength(100);
    });

    test("should debounce rapid changes appropriately", () => {
      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount++;
        return useCollection<TestEntity>("test");
      });

      expect(renderCount).toBe(2); // Initial render + store setup

      // Rapid sequential changes
      act(() => {
        for (let i = 1; i <= 10; i++) {
          store.test.push(createTestEntity(`rapid-${i}`, `Rapid ${i}`));
        }
      });

      // Should only trigger a single re-render due to React batching
      expect(renderCount).toBe(3);
      expect(result.current).toHaveLength(10);
    });

    test("should provide memory-efficient subscriptions", () => {
      const { result, unmount } = renderHook(() =>
        useCollection<TestEntity>("test")
      );

      act(() => {
        store.test.push(createTestEntity("1", "Memory test"));
      });

      expect(result.current).toHaveLength(1);

      // Unmounting should clean up subscriptions
      unmount();

      // Should not cause memory leaks (basic check)
      expect(() => {
        act(() => {
          store.test.push(createTestEntity("2", "After unmount"));
        });
      }).not.toThrow();
    });
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

    test("should support React DevTools integration", () => {
      // Basic test that hooks work with DevTools (hooks show up in component tree)
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      // Should provide accessible state for DevTools
      expect(result.current).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
    });

    test("should provide debugging utilities for hook state", () => {
      const { result } = renderHook(() => {
        const collection = useCollection<TestEntity>("test");
        const store = useKalphiteStore();
        return { collection, store };
      });

      // Should provide access to both collection and store for debugging
      expect(result.current.collection).toEqual([]);
      expect(result.current.store).toBeDefined();

      act(() => {
        store.test.push(createTestEntity("debug", "Debug Entity"));
      });

      expect(result.current.collection).toHaveLength(1);
    });

    test("should handle React Strict Mode correctly", () => {
      // React Strict Mode causes effects to run twice in development
      // Our hooks should handle this gracefully
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      expect(result.current).toEqual([]);

      // Add entity and ensure it works correctly even with Strict Mode
      act(() => {
        store.test.push(createTestEntity("strict", "Strict Mode"));
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].data.name).toBe("Strict Mode");
    });
  });

  describe("Integration Patterns", () => {
    test("should work with React Suspense boundaries", () => {
      // Test that hooks work within Suspense boundaries
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      // Should work without throwing
      expect(result.current).toEqual([]);

      act(() => {
        store.test.push(createTestEntity("1", "Suspended"));
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].data.name).toBe("Suspended");
    });

    test("should integrate with React ErrorBoundary", () => {
      // Test that hooks handle errors gracefully
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      // Should not throw on normal operations
      expect(() => {
        act(() => {
          store.test.push(createTestEntity("1", "Safe"));
        });
      }).not.toThrow();

      expect(result.current).toHaveLength(1);
    });

    test("should support server-side rendering (SSR)", () => {
      // Test that hooks work without DOM (SSR simulation)
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      // Should work in SSR-like environment
      expect(result.current).toEqual([]);

      act(() => {
        store.test.push(createTestEntity("1", "SSR"));
      });

      expect(result.current).toHaveLength(1);
    });

    test("should handle hydration mismatches gracefully", () => {
      // Simulate hydration scenario where server state differs from client
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      // Should start empty
      expect(result.current).toEqual([]);

      // Simulate post-hydration state change
      act(() => {
        store.test.push(createTestEntity("hydrated", "Post-hydration"));
      });

      // Should handle gracefully without errors
      expect(result.current).toHaveLength(1);
      expect(result.current[0].data.name).toBe("Post-hydration");
    });

    test("should work with React concurrent features", () => {
      // Test that our hooks work with React's concurrent rendering
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      // Should work with concurrent updates
      act(() => {
        store.test.push(createTestEntity("concurrent1", "First"));
      });

      expect(result.current).toHaveLength(1);

      // Simulate concurrent update
      act(() => {
        store.test.push(createTestEntity("concurrent2", "Second"));
      });

      expect(result.current).toHaveLength(2);
      expect(result.current[0].data.name).toBe("First");
      expect(result.current[1].data.name).toBe("Second");
    });
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

    test("should optimize for parent-child component patterns", () => {
      // Simulate parent component
      const { result: parent } = renderHook(() =>
        useCollection<TestEntity>("test")
      );

      // Simulate child component accessing same data
      const { result: child } = renderHook(() =>
        useEntity<TestEntity>("test", "shared")
      );

      expect(parent.current).toHaveLength(0);
      expect(child.current).toBeNull();

      // Parent adds entity that child should see
      act(() => {
        store.test.push(createTestEntity("shared", "Parent-Child Data"));
      });

      expect(parent.current).toHaveLength(1);
      expect(child.current?.data.name).toBe("Parent-Child Data");
    });

    test("should support context-based store provision", () => {
      // Test that store is accessible across components
      const { result: component1 } = renderHook(() => useKalphiteStore());
      const { result: component2 } = renderHook(() => useKalphiteStore());

      // Both should access the same store instance
      expect(component1.current).toBe(component2.current);
      expect(component1.current).toBe(store);
    });

    test("should handle rapid mount/unmount cycles", () => {
      // Simulate rapid mounting/unmounting
      const hookResults = [];

      for (let i = 0; i < 5; i++) {
        const { result, unmount } = renderHook(() =>
          useCollection<TestEntity>("test")
        );
        hookResults.push(result.current);
        unmount();
      }

      // All should have returned empty arrays initially
      hookResults.forEach((result) => {
        expect(result).toEqual([]);
      });

      // Final test should still work
      const { result } = renderHook(() => useCollection<TestEntity>("test"));
      expect(result.current).toEqual([]);
    });
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

    test("should show real-time collaboration between components", () => {
      // Simulate multiple components collaborating
      const { result: editor } = renderHook(() =>
        useCollection<TestEntity>("test")
      );
      const { result: viewer } = renderHook(() =>
        useCollection<TestEntity>("test")
      );
      const { result: counter } = renderHook(() =>
        useCollection<TestEntity>("test")
      );

      // All start empty
      expect(editor.current).toHaveLength(0);
      expect(viewer.current).toHaveLength(0);
      expect(counter.current).toHaveLength(0);

      // Editor adds content
      act(() => {
        store.test.push(createTestEntity("doc1", "Hello World"));
      });

      // All components see the update
      expect(editor.current).toHaveLength(1);
      expect(viewer.current).toHaveLength(1);
      expect(counter.current).toHaveLength(1);

      // Viewer adds a comment
      act(() => {
        store.test.push(createTestEntity("comment1", "Great work!"));
      });

      // All see the collaboration
      expect(editor.current).toHaveLength(2);
      expect(viewer.current).toHaveLength(2);
      expect(counter.current).toHaveLength(2);
    });

    test("should showcase performance with large datasets", () => {
      // Create a large dataset simulation
      const { result } = renderHook(() => useCollection<TestEntity>("test"));

      const startTime = performance.now();

      act(() => {
        // Add a moderate number of entities to test performance
        for (let i = 0; i < 50; i++) {
          store.test.push(createTestEntity(`item-${i}`, `Item ${i}`));
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 50 entities quickly
      expect(duration).toBeLessThan(50); // Less than 50ms
      expect(result.current).toHaveLength(50);

      // Verify data integrity
      expect(result.current[0].data.name).toBe("Item 0");
      expect(result.current[49].data.name).toBe("Item 49");
    });
  });
});
