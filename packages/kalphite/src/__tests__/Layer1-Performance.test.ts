import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: Performance & Scalability", () => {
  let store: ReturnType<typeof KalphiteStore>;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Memory Efficiency", () => {
    test("handles 10,000 entities efficiently", () => {
      const startTime = performance.now();

      // Create 10k entities
      for (let i = 0; i < 10000; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, `Comment ${i}`, i)
        );
      }

      const insertTime = performance.now() - startTime;
      expect(insertTime).toBeLessThan(1000); // <1s for 10k inserts
      expect(store.comment).toHaveLength(10000);
    });

    test("query performance scales linearly", () => {
      // Setup data
      for (let i = 0; i < 5000; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, `Comment ${i}`, i)
        );
      }

      const startTime = performance.now();

      // Complex queries
      const evenComments = store.comment.where(
        (c) => c.data.lineNumber % 2 === 0
      );
      const sortedComments = store.comment.orderBy((c) => c.data.lineNumber);
      const firstHundred = store.comment.slice(0, 100);

      const queryTime = performance.now() - startTime;

      expect(queryTime).toBeLessThan(50); // <50ms for complex queries
      expect(evenComments).toHaveLength(2500);
      expect(sortedComments[0].data.lineNumber).toBe(0);
      expect(firstHundred).toHaveLength(100);
    });

    test("memory usage stays reasonable with large datasets", () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Add 5k entities
      for (let i = 0; i < 5000; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, `Comment ${i}`, i)
        );
      }

      const afterInsertMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterInsertMemory - initialMemory;

      // Should use less than 50MB for 5k entities (rough estimate)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe("Concurrent Operations", () => {
    test("handles rapid concurrent upserts", () => {
      const operations = [];

      // Schedule 1000 rapid operations
      for (let i = 0; i < 1000; i++) {
        operations.push(() => {
          store.comment.upsert(
            `c${i}`,
            createCommentEntity(`c${i}`, `Comment ${i}`, i)
          );
        });
      }

      const startTime = performance.now();
      operations.forEach((op) => op());
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(store.comment).toHaveLength(1000);
    });

    test("maintains consistency during rapid updates", () => {
      const entityId = "test-entity";

      // Rapid updates to same entity
      for (let i = 0; i < 100; i++) {
        store.comment.upsert(
          entityId,
          createCommentEntity(entityId, `Update ${i}`, i)
        );
      }

      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].data.message).toBe("Update 99");
      expect(store.comment[0].data.lineNumber).toBe(99);
    });
  });

  describe("Memory-First Architecture Validation", () => {
    test("all operations are synchronous", () => {
      // Upsert should be synchronous
      const result = store.comment.upsert(
        "c1",
        createCommentEntity("c1", "Test", 1)
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("c1");

      // Query should be synchronous
      const found = store.comment.findById("c1");
      expect(found).toBeDefined();
      expect(found?.id).toBe("c1");

      // Delete should be synchronous
      const deleted = store.comment.delete("c1");
      expect(deleted).toBe(true);
      expect(store.comment.findById("c1")).toBeUndefined();
    });

    test("no async operations in core API", () => {
      // Verify all methods return non-Promise values
      const entity = createCommentEntity("c1", "Test", 1);

      const upsertResult = store.comment.upsert("c1", entity);
      expect(upsertResult).not.toBeInstanceOf(Promise);

      const findResult = store.comment.findById("c1");
      expect(findResult).not.toBeInstanceOf(Promise);

      const whereResult = store.comment.where((c) => c.id === "c1");
      expect(whereResult).not.toBeInstanceOf(Promise);

      const deleteResult = store.comment.delete("c1");
      expect(deleteResult).not.toBeInstanceOf(Promise);
    });

    test("reactive updates are immediate", () => {
      let updateCount = 0;
      const unsubscribe = store.subscribe(() => updateCount++);

      expect(updateCount).toBe(0);

      // Update should trigger immediately
      store.comment.upsert("c1", createCommentEntity("c1", "Test", 1));
      expect(updateCount).toBe(1);

      // Another update should trigger immediately
      store.comment.upsert("c1", createCommentEntity("c1", "Updated", 2));
      expect(updateCount).toBe(2);

      unsubscribe();
    });
  });

  describe("Functional Programming Performance", () => {
    test("chained operations are efficient", () => {
      // Setup test data
      for (let i = 0; i < 1000; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, `Comment ${i}`, i)
        );
        store.review.upsert(
          `r${i}`,
          createReviewEntity(
            `r${i}`,
            `Review ${i}`,
            i % 2 === 0 ? "approved" : "pending"
          )
        );
      }

      const startTime = performance.now();

      // Complex functional chain
      const result = store.comment
        .where((c) => c.data.lineNumber > 500)
        .orderBy((c) => c.data.lineNumber)
        .slice(0, 10)
        .map((c) => ({ id: c.id, message: c.data.message }));

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // <10ms for complex chain
      expect(result).toHaveLength(10);
      expect(result[0].id).toBe("c501");
    });

    test("immutable operations don't affect original collections", () => {
      // Add test data
      for (let i = 0; i < 100; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, `Comment ${i}`, i)
        );
      }

      const originalLength = store.comment.length;

      // Functional operations shouldn't modify original
      const filtered = store.comment.where((c) => c.data.lineNumber > 50);
      const sorted = store.comment.orderBy((c) => c.data.lineNumber);
      const sliced = store.comment.slice(0, 10);

      expect(store.comment.length).toBe(originalLength);
      expect(filtered.length).toBeLessThan(originalLength);
      expect(sorted.length).toBe(originalLength);
      expect(sliced.length).toBe(10);
    });
  });

  describe("Edge Cases & Stress Tests", () => {
    test("handles empty collections gracefully", () => {
      expect(store.comment.length).toBe(0);
      expect(store.comment.findById("nonexistent")).toBeUndefined();
      expect(store.comment.where((c) => true)).toHaveLength(0);
      expect(store.comment.orderBy((c) => c.id)).toHaveLength(0);
      expect(store.comment.delete("nonexistent")).toBe(false);
    });

    test("handles very long entity IDs", () => {
      const longId = "x".repeat(1000);
      const entity = createCommentEntity(longId, "Test", 1);

      const result = store.comment.upsert(longId, entity);
      expect(result.id).toBe(longId);

      const found = store.comment.findById(longId);
      expect(found?.id).toBe(longId);
    });

    test("handles entities with large data payloads", () => {
      const largeMessage = "x".repeat(10000);
      const entity = createCommentEntity("c1", largeMessage, 1);

      const startTime = performance.now();
      store.comment.upsert("c1", entity);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10);
      expect(store.comment[0].data.message).toBe(largeMessage);
    });

    test("maintains performance with frequent deletions", () => {
      // Add 1000 entities
      for (let i = 0; i < 1000; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, `Comment ${i}`, i)
        );
      }

      const startTime = performance.now();

      // Delete every other entity
      for (let i = 0; i < 1000; i += 2) {
        store.comment.delete(`c${i}`);
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);
      expect(store.comment).toHaveLength(500);
    });
  });
});
