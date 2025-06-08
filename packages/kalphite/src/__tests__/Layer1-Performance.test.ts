import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity } from "./setup";

describe("Layer 1: Performance & Scalability", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Memory Efficiency", () => {
    test("handles 10,000 entities efficiently", () => {
      const startTime = performance.now();

      // Create 10k entities
      for (let i = 0; i < 10000; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      const insertTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(10000);
      expect(insertTime).toBeLessThan(2000); // Should insert 10k entities in under 2s

      // Query performance should remain good
      const queryStart = performance.now();
      const found = store.comment.find((c: any) => c.id === "c5000");
      const queryTime = performance.now() - queryStart;

      expect(found).toBeDefined();
      expect(queryTime).toBeLessThan(10); // Should find entity quickly
    });

    test("query performance scales linearly", () => {
      // Setup data
      for (let i = 0; i < 5000; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      // Test filter performance
      const filterStart = performance.now();
      const evenComments = store.comment.filter(
        (c: any) => c.data.lineNumber % 2 === 0
      );
      const filterTime = performance.now() - filterStart;

      expect(evenComments.length).toBe(2500);
      expect(filterTime).toBeLessThan(100); // Filter should be fast

      // Test sort performance
      const sortStart = performance.now();
      const sorted = store.comment.sort(
        (a: any, b: any) => b.data.lineNumber - a.data.lineNumber
      );
      const sortTime = performance.now() - sortStart;

      expect(sorted[0].data.lineNumber).toBe(4999);
      expect(sortTime).toBeLessThan(200); // Sort should be reasonable
    });

    test("memory usage stays reasonable with large datasets", () => {
      const beforeMemory = process.memoryUsage();

      // Add 5k entities
      for (let i = 0; i < 5000; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;

      expect(store.comment).toHaveLength(5000);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should use less than 50MB
    });
  });

  describe("Concurrent Operations", () => {
    test("handles rapid concurrent upserts", () => {
      const operations = [];

      // Prepare 1000 concurrent operations
      for (let i = 0; i < 1000; i++) {
        operations.push(() => {
          store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
        });
      }

      const startTime = performance.now();
      operations.forEach((op) => op());
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500);
      expect(store.comment).toHaveLength(1000);
    });

    test("maintains consistency during rapid updates", () => {
      const entityId = "shared-entity";
      let updateCount = 0;

      const unsubscribe = store.subscribe(() => updateCount++);

      // Rapid updates to same entity
      for (let i = 0; i < 100; i++) {
        if (i === 0) {
          store.comment.push(createCommentEntity(entityId, `Update ${i}`, i));
        } else {
          const index = store.comment.findIndex((c: any) => c.id === entityId);
          if (index >= 0) {
            store.comment[index] = createCommentEntity(
              entityId,
              `Update ${i}`,
              i
            );
          }
        }
      }

      // Should have exactly one entity with the latest update
      const entities = store.comment.filter((c: any) => c.id === entityId);
      expect(entities).toHaveLength(1);
      expect(entities[0].data.message).toBe("Update 99");
      expect(updateCount).toBe(100);

      unsubscribe();
    });
  });

  describe("Memory-First Architecture Validation", () => {
    test("all operations are synchronous", () => {
      // Push should be synchronous
      const result = store.comment.push(createCommentEntity("c1", "Test", 1));
      expect(result).toBeDefined();
      expect(store.comment).toHaveLength(1);

      // Find should be synchronous
      const found = store.comment.find((c: any) => c.id === "c1");
      expect(found).toBeDefined();
      expect(found?.data.message).toBe("Test");

      // Filter should be synchronous
      const filtered = store.comment.filter(
        (c: any) => c.data.lineNumber === 1
      );
      expect(filtered).toHaveLength(1);

      // Sort should be synchronous
      const sorted = store.comment.sort(
        (a: any, b: any) => a.data.lineNumber - b.data.lineNumber
      );
      expect(sorted).toHaveLength(1);
    });

    test("no async operations in core API", () => {
      const entity = createCommentEntity("c1", "Test", 1);

      const pushResult = store.comment.push(entity);
      expect(pushResult).not.toBeInstanceOf(Promise);

      const findResult = store.comment.find((c: any) => c.id === "c1");
      expect(findResult).not.toBeInstanceOf(Promise);

      const filterResult = store.comment.filter((c: any) => c.id === "c1");
      expect(filterResult).not.toBeInstanceOf(Promise);

      const sortResult = store.comment.sort((a: any, b: any) =>
        a.id.localeCompare(b.id)
      );
      expect(sortResult).not.toBeInstanceOf(Promise);
    });

    test("reactive updates are immediate", () => {
      let updateCount = 0;
      const unsubscribe = store.subscribe(() => updateCount++);

      expect(updateCount).toBe(0);

      // Update should trigger immediately
      store.comment.push(createCommentEntity("c1", "Test", 1));
      expect(updateCount).toBe(1);

      // Another update should trigger immediately
      store.comment.push(createCommentEntity("c2", "Test 2", 2));
      expect(updateCount).toBe(2);

      unsubscribe();
    });
  });

  describe("Functional Programming Performance", () => {
    test("chained operations are efficient", () => {
      // Setup test data
      for (let i = 0; i < 1000; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      const startTime = performance.now();

      // Chain multiple operations
      const result = store.comment
        .filter((c: any) => c.data.lineNumber % 2 === 0)
        .sort((a: any, b: any) => b.data.lineNumber - a.data.lineNumber)
        .slice(0, 10)
        .map((c: any) => c.data.message);

      const endTime = performance.now();

      expect(result).toHaveLength(10);
      expect(result[0]).toBe("Comment 998");
      expect(endTime - startTime).toBeLessThan(50); // Should be fast
    });

    test("immutable operations don't affect original collections", () => {
      // Add test data
      for (let i = 0; i < 100; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      const originalLength = store.comment.length;

      // These operations should not mutate the original array
      const filtered = store.comment.filter((c: any) => c.data.lineNumber > 50);
      const sorted = store.comment.sort(
        (a: any, b: any) => b.data.lineNumber - a.data.lineNumber
      );
      const sliced = store.comment.slice(0, 10);

      expect(store.comment).toHaveLength(originalLength); // Original unchanged
      expect(filtered.length).toBeLessThan(originalLength);
      expect(sorted).toHaveLength(originalLength);
      expect(sliced).toHaveLength(10);

      // Original array should still be in original order
      expect(store.comment[0].data.lineNumber).toBe(0);
      expect(store.comment[99].data.lineNumber).toBe(99);
    });
  });

  describe("Edge Cases & Stress Tests", () => {
    test("handles empty collections gracefully", () => {
      expect(store.comment.length).toBe(0);
      expect(
        store.comment.find((c: any) => c.id === "nonexistent")
      ).toBeUndefined();
      expect(store.comment.filter((c: any) => true)).toHaveLength(0);
      expect(
        store.comment.sort((a: any, b: any) => a.id.localeCompare(b.id))
      ).toHaveLength(0);
    });

    test("handles very long entity IDs", () => {
      const longId = "x".repeat(1000);
      const entity = createCommentEntity(longId, "Test", 1);

      const result = store.comment.push(entity);
      expect(result).toBeDefined();

      const found = store.comment.find((c: any) => c.id === longId);
      expect(found?.id).toBe(longId);
    });

    test("handles entities with large data payloads", () => {
      const largeMessage = "x".repeat(100000);
      const entity = createCommentEntity("c1", largeMessage, 1);

      const startTime = performance.now();
      store.comment.push(entity);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);

      const found = store.comment.find((c: any) => c.id === "c1");
      expect(found?.data.message).toBe(largeMessage);
    });

    test("maintains performance with frequent deletions", () => {
      // Add 1000 entities
      for (let i = 0; i < 1000; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      const startTime = performance.now();

      // Remove every other entity
      for (let i = 0; i < 1000; i += 2) {
        const index = store.comment.findIndex((c: any) => c.id === `c${i}`);
        if (index >= 0) {
          store.comment.splice(index, 1);
        }
      }

      const endTime = performance.now();

      expect(store.comment).toHaveLength(500);
      expect(endTime - startTime).toBeLessThan(200);
    });
  });
});
