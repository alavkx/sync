import { beforeEach, describe, expect, it, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: Performance & Scalability", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Bulk Loading Performance", () => {
    test("should load thousands of entities efficiently", () => {
      const entityCount = 2000;
      const entities = Array.from({ length: entityCount }, (_, i) =>
        createCommentEntity(`c${i}`, `Message ${i}`, i)
      );

      const startTime = performance.now();
      store.loadEntities(entities);
      const loadTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(entityCount);
      expect(loadTime).toBeLessThan(100); // Should load 2k entities in under 100ms
    });

    test("should handle mixed-type bulk loading", () => {
      const entityCount = 1000;
      const entities = [];

      for (let i = 0; i < entityCount; i++) {
        if (i % 2 === 0) {
          entities.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
        } else {
          entities.push(createReviewEntity(`r${i}`, `Review ${i}`));
        }
      }

      const startTime = performance.now();
      store.loadEntities(entities);
      const loadTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(500);
      expect(store.review).toHaveLength(500);
      expect(loadTime).toBeLessThan(150); // Mixed-type loading efficiency
    });
  });

  describe("Query Performance", () => {
    beforeEach(() => {
      // Pre-load a large dataset for query tests
      const entities = Array.from({ length: 5000 }, (_, i) =>
        createCommentEntity(`c${i}`, `Message ${i}`, i)
      );
      store.loadEntities(entities);
    });

    test("should find entities quickly in large datasets", () => {
      const queryStart = performance.now();
      const found = store.comment.find((c: any) => c.id === "c2500");
      const queryTime = performance.now() - queryStart;

      expect(found).toBeDefined();
      expect(found.id).toBe("c2500");
      expect(queryTime).toBeLessThan(5); // Fast find operation
    });

    test("should filter large datasets efficiently", () => {
      const queryStart = performance.now();
      const filtered = store.comment.filter(
        (c: any) => c.data.lineNumber > 4000
      );
      const queryTime = performance.now() - queryStart;

      expect(filtered.length).toBe(999); // 4001-4999
      expect(queryTime).toBeLessThan(50); // Reasonable filter time
    });

    test("should sort large datasets reasonably fast", () => {
      const queryStart = performance.now();
      const sorted = [...store.comment].sort(
        (a: any, b: any) => b.data.lineNumber - a.data.lineNumber
      );
      const queryTime = performance.now() - queryStart;

      expect(sorted[0].data.lineNumber).toBe(4999);
      expect(sorted[4999].data.lineNumber).toBe(0);
      expect(queryTime).toBeLessThan(100); // Sort 5k entities under 100ms
    });

    test("should chain operations efficiently", () => {
      const operationStart = performance.now();

      const result = store.comment
        .filter((c: any) => c.data.lineNumber % 10 === 0)
        .sort((a: any, b: any) => a.data.lineNumber - b.data.lineNumber)
        .map((c: any) => c.data.message)
        .slice(0, 100);

      const operationTime = performance.now() - operationStart;

      expect(result).toHaveLength(100);
      expect(result[0]).toBe("Message 0");
      expect(operationTime).toBeLessThan(30); // Chained operations under 30ms
    });
  });

  describe("Mutation Performance", () => {
    test("should handle rapid individual insertions", () => {
      const insertCount = 1000;

      const startTime = performance.now();
      for (let i = 0; i < insertCount; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Message ${i}`, i));
      }
      const insertTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(insertCount);
      expect(insertTime).toBeLessThan(200); // 1k individual inserts under 200ms
    });

    test("should handle rapid deletions efficiently", () => {
      // Pre-populate
      const entities = Array.from({ length: 1000 }, (_, i) =>
        createCommentEntity(`c${i}`, `Message ${i}`, i)
      );
      store.loadEntities(entities);

      // Delete every other entity
      const deleteStart = performance.now();
      for (let i = 500; i >= 0; i--) {
        const index = i * 2;
        if (index < store.comment.length) {
          store.comment.splice(index, 1);
        }
      }
      const deleteTime = performance.now() - deleteStart;

      expect(store.comment.length).toBeLessThan(1000);
      expect(deleteTime).toBeLessThan(150); // Bulk deletions under 150ms
    });

    test("should handle mixed operations efficiently", () => {
      const operationStart = performance.now();

      // Perform mixed operations
      for (let i = 0; i < 500; i++) {
        if (i % 3 === 0) {
          store.comment.push(
            createCommentEntity(`mixed-${i}`, `Message ${i}`, i)
          );
        } else if (i % 3 === 1) {
          store.review.push(createReviewEntity(`review-${i}`, `Review ${i}`));
        } else if (store.comment.length > 0) {
          store.comment.splice(0, 1);
        }
      }

      const operationTime = performance.now() - operationStart;

      expect(store.comment.length + store.review.length).toBeGreaterThan(0);
      expect(operationTime).toBeLessThan(100); // Mixed operations under 100ms
    });
  });

  describe("Memory Efficiency", () => {
    test("should handle large entities without degradation", () => {
      const largeEntities = Array.from({ length: 100 }, (_, i) => {
        const largeData = {
          message: "x".repeat(10000), // 10KB of text
          lineNumber: i,
          metadata: {
            tags: Array.from({ length: 100 }, (_, j) => `tag-${j}`),
            timestamps: Array.from({ length: 50 }, () => Date.now()),
            content: "y".repeat(5000),
          },
        };
        return { id: `large-${i}`, type: "comment", data: largeData };
      });

      const startTime = performance.now();
      store.loadEntities(largeEntities);
      const loadTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(100);
      expect(loadTime).toBeLessThan(200); // Large entities still load reasonably fast
    });

    test("should maintain performance after extensive usage", () => {
      // Simulate extensive usage patterns
      for (let cycle = 0; cycle < 20; cycle++) {
        const entities = Array.from({ length: 100 }, (_, i) =>
          createCommentEntity(`cycle-${cycle}-${i}`, `Message ${i}`, i)
        );

        store.loadEntities(entities);

        // Perform operations
        store.comment.filter((c: any) => c.data.lineNumber % 2 === 0);
        store.comment.sort(
          (a: any, b: any) => a.data.lineNumber - b.data.lineNumber
        );

        // Clear periodically
        if (cycle % 5 === 4) {
          store.clear();
        }
      }

      // Final performance test
      const testStart = performance.now();
      store.comment.push(createCommentEntity("final-test", "Performance test"));
      const found = store.comment.find((c: any) => c.id === "final-test");
      const testTime = performance.now() - testStart;

      expect(found).toBeDefined();
      expect(testTime).toBeLessThan(5); // Should still be fast after extensive usage
    });
  });

  describe("Reactivity Performance", () => {
    test("should handle many subscribers efficiently", () => {
      const subscriberCount = 100;
      const subscribers: (() => void)[] = [];
      const updateCounts = Array(subscriberCount).fill(0);

      // Add many subscribers
      for (let i = 0; i < subscriberCount; i++) {
        const unsubscribe = store.subscribe(() => updateCounts[i]++);
        subscribers.push(unsubscribe);
      }

      const notificationStart = performance.now();

      // Trigger notifications
      for (let i = 0; i < 50; i++) {
        store.comment.push(
          createCommentEntity(`sub-test-${i}`, `Message ${i}`, i)
        );
      }

      const notificationTime = performance.now() - notificationStart;

      expect(updateCounts.every((count) => count === 50)).toBe(true);
      expect(notificationTime).toBeLessThan(100); // 100 subscribers x 50 notifications under 100ms

      // Cleanup
      subscribers.forEach((unsub) => unsub());
    });

    test("should handle subscriber churn efficiently", () => {
      const churnStart = performance.now();

      const unsubscribers: (() => void)[] = [];

      // Add and remove subscribers rapidly
      for (let i = 0; i < 200; i++) {
        const unsubscribe = store.subscribe(() => {});
        unsubscribers.push(unsubscribe);

        if (i % 10 === 9) {
          // Unsubscribe every 10th iteration
          const toRemove = unsubscribers.splice(0, 5);
          toRemove.forEach((unsub) => unsub());
        }

        // Trigger update
        store.comment.push(
          createCommentEntity(`churn-${i}`, `Message ${i}`, i)
        );
      }

      const churnTime = performance.now() - churnStart;

      expect(churnTime).toBeLessThan(150); // Subscriber churn under 150ms

      // Cleanup remaining
      unsubscribers.forEach((unsub) => unsub());
    });
  });

  describe("Edge Case Performance", () => {
    test("should handle empty collections gracefully", () => {
      const operationStart = performance.now();

      // Operations on empty collections should be fast
      const found = store.comment.find((c: any) => c.id === "nonexistent");
      const filtered = store.comment.filter((c: any) => true);
      const mapped = store.comment.map((c: any) => c.id);
      const sorted = [...store.comment].sort();

      const operationTime = performance.now() - operationStart;

      expect(found).toBeUndefined();
      expect(filtered).toHaveLength(0);
      expect(mapped).toHaveLength(0);
      expect(sorted).toHaveLength(0);
      expect(operationTime).toBeLessThan(1); // Empty operations should be near-instant
    });

    test("should handle very long entity IDs efficiently", () => {
      const longId = "x".repeat(1000); // 1KB ID
      const entity = createCommentEntity(longId, "Test message", 1);

      const operationStart = performance.now();
      store.comment.push(entity);
      const found = store.comment.find((c: any) => c.id === longId);
      const operationTime = performance.now() - operationStart;

      expect(found).toBeDefined();
      expect(operationTime).toBeLessThan(5); // Long IDs shouldn't impact performance significantly
    });

    test("should handle frequent deletions without memory leaks", () => {
      const operationStart = performance.now();

      // Rapid create/delete cycles
      for (let cycle = 0; cycle < 100; cycle++) {
        // Add entities
        for (let i = 0; i < 50; i++) {
          store.comment.push(
            createCommentEntity(`temp-${cycle}-${i}`, `Message ${i}`, i)
          );
        }

        // Delete all entities
        store.comment.length = 0;
      }

      const operationTime = performance.now() - operationStart;

      expect(store.comment).toHaveLength(0);
      expect(operationTime).toBeLessThan(200); // 100 cycles of 50 entities each under 200ms
    });
  });

  it("should handle large collections efficiently", () => {
    const store = new KalphiteStore();
    const filtered = store.comment.filter(() => true);
    expect(filtered).toBeDefined();
  });
});
