import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: Data Consistency & Integrity", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Entity Reference Integrity", () => {
    test("maintains entity identity across operations", () => {
      const entity = createCommentEntity("identity-test", "Original message");
      store.comment.push(entity);

      // Get reference through different methods
      const byIndex = store.comment[0];
      const byFind = store.comment.find((c: any) => c.id === "identity-test");
      const byFilter = store.comment.filter(
        (c: any) => c.id === "identity-test"
      )[0];

      // All should reference the same entity
      expect(byIndex.id).toBe("identity-test");
      expect(byFind.id).toBe("identity-test");
      expect(byFilter.id).toBe("identity-test");

      // Modify through one reference
      byIndex.data.message = "Modified message";

      // Changes should be visible through all references
      expect(byFind.data.message).toBe("Modified message");
      expect(byFilter.data.message).toBe("Modified message");
    });

    test("handles entity updates consistently", () => {
      const original = createCommentEntity("update-test", "Original", 10);
      store.comment.push(original);

      const updated = createCommentEntity("update-test", "Updated", 20);

      // Update by replacing in array
      const index = store.comment.findIndex((c: any) => c.id === "update-test");
      store.comment[index] = updated;

      // Verify update took effect
      const retrieved = store.comment.find((c: any) => c.id === "update-test");
      expect(retrieved.data.message).toBe("Updated");
      expect(retrieved.data.lineNumber).toBe(20);
    });

    test("maintains referential integrity with deep objects", () => {
      const entity = createCommentEntity("deep-test", "Deep structure");
      entity.data.metadata = {
        author: { name: "John", id: "user-1" },
        tags: ["urgent", "bug"],
        timestamps: { created: Date.now(), updated: Date.now() },
      };

      store.comment.push(entity);

      const retrieved = store.comment[0];

      // Modify nested object
      retrieved.data.metadata.author.name = "Jane";
      retrieved.data.metadata.tags.push("enhancement");

      // Verify changes are preserved
      const reRetrieved = store.comment.find((c: any) => c.id === "deep-test");
      expect(reRetrieved.data.metadata.author.name).toBe("Jane");
      expect(reRetrieved.data.metadata.tags).toContain("enhancement");
      expect(reRetrieved.data.metadata.tags).toHaveLength(3);
    });
  });

  describe("Concurrent Operations Safety", () => {
    test("handles rapid concurrent modifications", () => {
      const entityId = "concurrent-test";
      store.comment.push(createCommentEntity(entityId, "Initial", 0));

      // Simulate rapid concurrent modifications
      const operations = 100;
      let updateCount = 0;

      for (let i = 0; i < operations; i++) {
        const current = store.comment.find((c: any) => c.id === entityId);
        if (current) {
          current.data.message = `Update ${i}`;
          current.data.lineNumber = i;
          updateCount++;
        }
      }

      // Verify final state
      const final = store.comment.find((c: any) => c.id === entityId);
      expect(final.data.message).toBe(`Update ${operations - 1}`);
      expect(final.data.lineNumber).toBe(operations - 1);
      expect(updateCount).toBe(operations);
    });

    test("maintains array consistency during mixed operations", () => {
      // Start with some entities
      for (let i = 0; i < 10; i++) {
        store.comment.push(createCommentEntity(`init-${i}`, `Initial ${i}`, i));
      }

      // Mix of operations: add, update, query
      for (let cycle = 0; cycle < 20; cycle++) {
        // Add new entity
        store.comment.push(
          createCommentEntity(`cycle-${cycle}`, `Cycle ${cycle}`, cycle + 100)
        );

        // Update existing entity
        const existing = store.comment.find(
          (c: any) => c.id === `init-${cycle % 10}`
        );
        if (existing) {
          existing.data.message = `Updated in cycle ${cycle}`;
        }

        // Query operations
        const filtered = store.comment.filter(
          (c: any) => c.data.lineNumber > 5
        );
        const sorted = store.comment.sort(
          (a: any, b: any) => a.data.lineNumber - b.data.lineNumber
        );

        // Verify integrity
        expect(filtered.length).toBeGreaterThan(0);
        expect(sorted.length).toBe(store.comment.length);
      }

      // Final verification
      expect(store.comment.length).toBe(30); // 10 initial + 20 added
    });

    test("handles bulk operations atomicity", () => {
      const initialCount = 100;
      const bulkEntities = Array.from({ length: initialCount }, (_, i) =>
        createCommentEntity(`bulk-${i}`, `Bulk ${i}`, i)
      );

      // Single bulk operation
      store.loadEntities(bulkEntities);
      expect(store.comment.length).toBe(initialCount);

      // All entities should be present and correct
      for (let i = 0; i < initialCount; i++) {
        const entity = store.comment.find((c: any) => c.id === `bulk-${i}`);
        expect(entity).toBeDefined();
        expect(entity.data.message).toBe(`Bulk ${i}`);
        expect(entity.data.lineNumber).toBe(i);
      }
    });
  });

  describe("Memory Management & Cleanup", () => {
    test("properly cleans up after clear operations", () => {
      // Fill store with data
      for (let i = 0; i < 1000; i++) {
        store.comment.push(
          createCommentEntity(`cleanup-${i}`, `Message ${i}`, i)
        );
      }

      expect(store.comment.length).toBe(1000);

      // Clear and verify complete cleanup
      store.clear();
      expect(store.comment.length).toBe(0);
      expect(store.review.length).toBe(0);

      // Verify no stale references
      expect(
        store.comment.find((c: any) => c.id === "cleanup-0")
      ).toBeUndefined();
      expect(store.comment.filter((c: any) => true)).toHaveLength(0);

      // Store should be fully functional after clear
      store.comment.push(createCommentEntity("post-clear", "After clear"));
      expect(store.comment.length).toBe(1);
      expect(store.comment[0].data.message).toBe("After clear");
    });

    test("handles memory pressure gracefully", () => {
      const largeSets = 5;
      const setSize = 500;

      // Create and destroy large data sets multiple times
      for (let set = 0; set < largeSets; set++) {
        // Create large dataset
        const entities = Array.from({ length: setSize }, (_, i) => {
          const entity = createCommentEntity(
            `set-${set}-item-${i}`,
            `Large message ${"x".repeat(1000)}`,
            i
          );
          entity.data.largeArray = new Array(100).fill(`data-${i}`);
          return entity;
        });

        store.loadEntities(entities);
        expect(store.comment.length).toBe(setSize);

        // Perform operations on large dataset
        const filtered = store.comment.filter(
          (c: any) => c.data.lineNumber % 10 === 0
        );
        expect(filtered.length).toBe(setSize / 10);

        // Clear for next iteration
        store.clear();
        expect(store.comment.length).toBe(0);
      }

      // Verify store still responsive after pressure test
      store.comment.push(createCommentEntity("final-test", "Final test"));
      expect(store.comment.length).toBe(1);
    });

    test("maintains performance after extensive usage", () => {
      const operationCycles = 50;
      const entitiesPerCycle = 50;

      // Extensive usage pattern
      for (let cycle = 0; cycle < operationCycles; cycle++) {
        // Add entities
        for (let i = 0; i < entitiesPerCycle; i++) {
          store.comment.push(
            createCommentEntity(`cycle-${cycle}-${i}`, `Message ${i}`, i)
          );
        }

        // Perform various operations
        store.comment.filter((c: any) => c.data.lineNumber % 2 === 0);
        store.comment.sort(
          (a: any, b: any) => a.data.lineNumber - b.data.lineNumber
        );
        store.comment.find(
          (c: any) =>
            c.id === `cycle-${cycle}-${Math.floor(entitiesPerCycle / 2)}`
        );

        // Clear every few cycles
        if (cycle % 10 === 9) {
          store.clear();
        }
      }

      // Performance test after extensive usage
      const startTime = performance.now();
      store.comment.push(createCommentEntity("perf-test", "Performance test"));
      const found = store.comment.find((c: any) => c.id === "perf-test");
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should still be fast
      expect(found.data.message).toBe("Performance test");
    });
  });

  describe("Edge Cases & Error Recovery", () => {
    test("handles extreme entity data variations", () => {
      const extremeEntities = [
        // Empty strings
        createCommentEntity("", "", 0),
        // Very long strings
        createCommentEntity(
          "long-id-" + "x".repeat(1000),
          "x".repeat(10000),
          999999
        ),
        // Special characters
        createCommentEntity(
          "special-!@#$%^&*()",
          "Message with 🚀 emojis and \n newlines",
          -1
        ),
        // Numeric strings
        createCommentEntity("123456", "789", 0),
      ];

      expect(() => {
        extremeEntities.forEach((entity) => store.comment.push(entity));
      }).not.toThrow();

      expect(store.comment.length).toBe(4);

      // Verify all entities are retrievable
      extremeEntities.forEach((entity) => {
        const found = store.comment.find((c: any) => c.id === entity.id);
        expect(found).toBeDefined();
        expect(found.data.message).toBe(entity.data.message);
      });
    });

    test("recovers from malformed operations", () => {
      // Start with valid data
      store.comment.push(createCommentEntity("valid-1", "Valid message"));
      expect(store.comment.length).toBe(1);

      // Attempt various malformed operations
      expect(() => {
        store.comment.push(null);
      }).not.toThrow();

      expect(() => {
        store.comment.push(undefined);
      }).not.toThrow();

      expect(() => {
        store.comment.push({});
      }).not.toThrow();

      // Store should remain functional
      store.comment.push(createCommentEntity("valid-2", "Still works"));

      const validEntities = store.comment.filter(
        (c: any) => c && c.id && c.id.startsWith("valid")
      );
      expect(validEntities.length).toBeGreaterThanOrEqual(2);
    });

    test("maintains data consistency under error conditions", () => {
      // Add initial data
      for (let i = 0; i < 10; i++) {
        store.comment.push(
          createCommentEntity(`stable-${i}`, `Stable ${i}`, i)
        );
      }

      let notificationCount = 0;
      let errorCount = 0;

      // Add subscriber that sometimes throws errors
      const unsubscribe = store.subscribe(() => {
        notificationCount++;
        if (notificationCount % 3 === 0) {
          errorCount++;
          throw new Error("Subscriber error");
        }
      });

      // Continue operations despite subscriber errors
      for (let i = 10; i < 20; i++) {
        store.comment.push(
          createCommentEntity(`error-test-${i}`, `Error test ${i}`, i)
        );
      }

      // Verify data integrity maintained
      expect(store.comment.length).toBe(20);
      expect(errorCount).toBeGreaterThan(0); // Some errors should have occurred
      expect(notificationCount).toBe(20); // All notifications should have been attempted

      // All entities should be accessible
      for (let i = 0; i < 20; i++) {
        const entityId = i < 10 ? `stable-${i}` : `error-test-${i}`;
        const found = store.comment.find((c: any) => c.id === entityId);
        expect(found).toBeDefined();
      }

      unsubscribe();
    });
  });

  describe("Cross-Type Consistency", () => {
    test("maintains isolation between entity types", () => {
      // Add entities of different types
      for (let i = 0; i < 10; i++) {
        store.comment.push(
          createCommentEntity(`comment-${i}`, `Comment ${i}`, i)
        );
        store.review.push(createReviewEntity(`review-${i}`, `Review ${i}`));
      }

      expect(store.comment.length).toBe(10);
      expect(store.review.length).toBe(10);

      // Operations on one type shouldn't affect the other
      store.comment.splice(0, 5);
      expect(store.comment.length).toBe(5);
      expect(store.review.length).toBe(10); // Unchanged

      // Clear one type
      store.comment.length = 0;
      expect(store.comment.length).toBe(0);
      expect(store.review.length).toBe(10); // Still unchanged

      // Verify reviews are still accessible
      const review = store.review.find((r: any) => r.id === "review-0");
      expect(review).toBeDefined();
      expect(review.data.title).toBe("Review 0");
    });

    test("handles mixed-type bulk operations", () => {
      const mixedEntities = [];

      // Create mixed array of entities
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          mixedEntities.push(
            createCommentEntity(`mixed-comment-${i}`, `Comment ${i}`, i)
          );
        } else {
          mixedEntities.push(
            createReviewEntity(`mixed-review-${i}`, `Review ${i}`)
          );
        }
      }

      // Load mixed entities
      store.loadEntities(mixedEntities);

      // Verify proper type separation
      expect(store.comment.length).toBe(10); // Even indices
      expect(store.review.length).toBe(10); // Odd indices

      // Verify entities are in correct collections
      store.comment.forEach((c: any) => {
        expect(c.type).toBe("comment");
        expect(c.id).toMatch(/mixed-comment-\d+/);
      });

      store.review.forEach((r: any) => {
        expect(r.type).toBe("review");
        expect(r.id).toMatch(/mixed-review-\d+/);
      });
    });
  });
});
