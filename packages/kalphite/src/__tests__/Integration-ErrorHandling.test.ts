import { beforeEach, describe, expect, test } from "vitest";
import { MemoryFlushEngine } from "../engines/MemoryFlushEngine";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Integration: Error Handling & Edge Cases", () => {
  let store: ReturnType<typeof KalphiteStore>;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Schema Validation Edge Cases", () => {
    test("handles malformed entity data gracefully", () => {
      // Test with missing required fields
      const malformedEntity = { id: "test", type: "comment" } as any;

      // Should not throw, but handle gracefully
      expect(() => {
        store.comment.upsert("test", malformedEntity);
      }).not.toThrow();
    });

    test("handles null and undefined values", () => {
      const entityWithNulls = createCommentEntity(
        "c1",
        null as any,
        undefined as any
      );

      expect(() => {
        store.comment.upsert("c1", entityWithNulls);
      }).not.toThrow();

      const retrieved = store.comment.findById("c1");
      expect(retrieved).toBeDefined();
    });

    test("handles circular references in entity data", () => {
      const entity = createCommentEntity("c1", "Test", 1);
      // Create circular reference
      (entity as any).circular = entity;

      expect(() => {
        store.comment.upsert("c1", entity);
      }).not.toThrow();
    });
  });

  describe("Memory Pressure Scenarios", () => {
    test("handles rapid entity creation and deletion", () => {
      // Simulate memory pressure with rapid create/delete cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        // Create 1000 entities
        for (let i = 0; i < 1000; i++) {
          store.comment.upsert(
            `c${i}`,
            createCommentEntity(`c${i}`, `Comment ${i}`, i)
          );
        }

        // Delete all entities
        for (let i = 0; i < 1000; i++) {
          store.comment.delete(`c${i}`);
        }

        expect(store.comment).toHaveLength(0);
      }
    });

    test("maintains performance under memory pressure", () => {
      // Fill up memory with large entities
      const largeData = "x".repeat(1000);

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, largeData, i)
        );
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // Should still be fast
      expect(store.comment).toHaveLength(1000);
    });
  });

  describe("Concurrent Access Patterns", () => {
    test("handles interleaved reads and writes", () => {
      const operations = [];

      // Mix of read and write operations
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          operations.push(() =>
            store.comment.upsert(
              `c${i}`,
              createCommentEntity(`c${i}`, `Comment ${i}`, i)
            )
          );
        } else if (i % 3 === 1) {
          operations.push(() =>
            store.comment.findById(`c${Math.floor(i / 3)}`)
          );
        } else {
          operations.push(() =>
            store.comment.where((c) => c.data.lineNumber < i)
          );
        }
      }

      // Execute all operations
      operations.forEach((op) => op());

      // Verify final state is consistent
      const finalCount = store.comment.length;
      expect(finalCount).toBeGreaterThan(0);
      expect(finalCount).toBeLessThanOrEqual(34); // Only every 3rd operation was an upsert
    });

    test("maintains data integrity during rapid updates", () => {
      const entityId = "shared-entity";
      let updateCount = 0;

      // Subscribe to changes
      const unsubscribe = store.subscribe(() => updateCount++);

      // Rapid updates to same entity
      for (let i = 0; i < 50; i++) {
        store.comment.upsert(
          entityId,
          createCommentEntity(entityId, `Update ${i}`, i)
        );
      }

      // Should have exactly one entity with the latest update
      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].data.message).toBe("Update 49");
      expect(updateCount).toBe(50);

      unsubscribe();
    });
  });

  describe("Flush Engine Error Scenarios", () => {
    test("handles flush target failures gracefully", () => {
      const failingFlushTarget = () => {
        throw new Error("Network failure");
      };

      const flushEngine = new MemoryFlushEngine({
        flushTarget: failingFlushTarget,
        maxRetries: 1,
        debounceMs: 10,
      });

      // Should not throw when scheduling flushes
      expect(() => {
        flushEngine.scheduleFlush("c1", createCommentEntity("c1", "Test", 1));
      }).not.toThrow();

      // Data should remain queued after failure
      const queuedChanges = flushEngine.getQueuedChanges();
      expect(queuedChanges).toHaveLength(1);
    });

    test("handles async flush target errors", async () => {
      const asyncFailingTarget = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        throw new Error("Async failure");
      };

      const flushEngine = new MemoryFlushEngine({
        flushTarget: asyncFailingTarget,
        maxRetries: 1,
        debounceMs: 10,
      });

      flushEngine.scheduleFlush("c1", createCommentEntity("c1", "Test", 1));

      // Should handle async errors without crashing
      await new Promise((resolve) => setTimeout(resolve, 50));

      const queuedChanges = flushEngine.getQueuedChanges();
      expect(queuedChanges).toHaveLength(1);
    });
  });

  describe("Boundary Conditions", () => {
    test("handles empty string entity IDs", () => {
      const entity = createCommentEntity("", "Empty ID test", 1);

      const result = store.comment.upsert("", entity);
      expect(result.id).toBe("");

      const found = store.comment.findById("");
      expect(found).toBeDefined();
    });

    test("handles special characters in entity IDs", () => {
      const specialIds = [
        "id-with-dashes",
        "id_with_underscores",
        "id.with.dots",
        "id with spaces",
        "id/with/slashes",
        "id@with@symbols",
        "id#with#hash",
        "id%with%percent",
      ];

      specialIds.forEach((id) => {
        const entity = createCommentEntity(id, `Test for ${id}`, 1);

        expect(() => {
          store.comment.upsert(id, entity);
        }).not.toThrow();

        const found = store.comment.findById(id);
        expect(found?.id).toBe(id);
      });
    });

    test("handles very large collections", () => {
      // Test with 50k entities (stress test)
      const startTime = performance.now();

      for (let i = 0; i < 50000; i++) {
        store.comment.upsert(
          `c${i}`,
          createCommentEntity(`c${i}`, `Comment ${i}`, i)
        );
      }

      const insertTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(50000);
      expect(insertTime).toBeLessThan(5000); // Should complete in <5s

      // Test query performance on large collection
      const queryStart = performance.now();
      const found = store.comment.findById("c25000");
      const queryTime = performance.now() - queryStart;

      expect(found).toBeDefined();
      expect(queryTime).toBeLessThan(10); // Should be very fast
    });
  });

  describe("Type Safety Edge Cases", () => {
    test("handles mixed entity types in same collection", () => {
      // This tests the type system's flexibility
      const comment = createCommentEntity("c1", "Comment", 1);
      const review = createReviewEntity("r1", "Review", "approved");

      // Should be able to store different types
      store.comment.upsert("c1", comment);
      store.review.upsert("r1", review);

      expect(store.comment).toHaveLength(1);
      expect(store.review).toHaveLength(1);
      expect(store.comment[0].type).toBe("comment");
      expect(store.review[0].type).toBe("review");
    });

    test("maintains type consistency across operations", () => {
      const entity = createCommentEntity("c1", "Test", 1);

      // Upsert should maintain type
      const upserted = store.comment.upsert("c1", entity);
      expect(upserted.type).toBe("comment");

      // Find should maintain type
      const found = store.comment.findById("c1");
      expect(found?.type).toBe("comment");

      // Collection access should maintain type
      expect(store.comment[0].type).toBe("comment");
    });
  });

  describe("Subscription Error Handling", () => {
    test("handles subscriber errors gracefully", () => {
      const erroringSubscriber = () => {
        throw new Error("Subscriber error");
      };

      const normalSubscriber = () => {
        // Normal subscriber
      };

      // Subscribe both
      const unsubscribe1 = store.subscribe(erroringSubscriber);
      const unsubscribe2 = store.subscribe(normalSubscriber);

      // Should not crash when triggering updates
      expect(() => {
        store.comment.upsert("c1", createCommentEntity("c1", "Test", 1));
      }).not.toThrow();

      unsubscribe1();
      unsubscribe2();
    });

    test("handles unsubscribe during notification", () => {
      let unsubscribe: (() => void) | undefined;

      const selfUnsubscribingSubscriber = () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };

      unsubscribe = store.subscribe(selfUnsubscribingSubscriber);

      // Should handle self-unsubscription gracefully
      expect(() => {
        store.comment.upsert("c1", createCommentEntity("c1", "Test", 1));
      }).not.toThrow();
    });
  });
});
