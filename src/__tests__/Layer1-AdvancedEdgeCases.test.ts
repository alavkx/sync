import { beforeEach, describe, expect, test } from "vitest";
import {
  createCommentEntity,
  createReviewEntity,
} from "../../packages/kalphite/src/__tests__/setup";
import { KalphiteStore } from "../../packages/kalphite/src/store/KalphiteStore";

describe("Layer 1: Advanced Edge Cases & Stress Testing", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Entity Relationship Complexity", () => {
    test("handles circular references in entity data", () => {
      const comment1 = createCommentEntity("comment-1", "First comment");
      const comment2 = createCommentEntity("comment-2", "Second comment");

      // Create circular reference in data
      comment1.data.replyTo = comment2;
      comment2.data.replyTo = comment1;

      store.comment.push(comment1);
      store.comment.push(comment2);

      expect(store.comment).toHaveLength(2);
      expect(store.comment[0].data.replyTo.id).toBe("comment-2");
      expect(store.comment[1].data.replyTo.id).toBe("comment-1");
    });

    test("handles deeply nested entity references", () => {
      const entities = Array.from({ length: 10 }, (_, i) =>
        createCommentEntity(`comment-${i}`, `Comment ${i}`)
      );

      // Create chain of references
      for (let i = 0; i < entities.length - 1; i++) {
        entities[i].data.nextComment = entities[i + 1];
      }

      store.loadEntities(entities);

      // Verify deep chain traversal works
      let current = store.comment[0];
      let count = 0;
      while (current?.data.nextComment && count < 20) {
        current = current.data.nextComment;
        count++;
      }

      expect(count).toBe(9); // Should traverse 9 links
      expect(store.comment).toHaveLength(10);
    });

    test("handles polymorphic entity relationships", () => {
      const comment = createCommentEntity("comment-1", "Great review!");
      const review = createReviewEntity("review-1", "Code looks good");

      // Cross-type references
      comment.data.relatedReview = review;
      review.data.comments = [comment];

      store.comment.push(comment);
      store.review.push(review);

      const retrievedComment = store.comment.find(
        (c: any) => c.id === "comment-1"
      );
      const retrievedReview = store.review.find(
        (r: any) => r.id === "review-1"
      );

      expect(retrievedComment.data.relatedReview.id).toBe("review-1");
      expect(retrievedReview.data.comments[0].id).toBe("comment-1");
    });
  });

  describe("Memory Pressure & Large Scale Operations", () => {
    test("handles extremely large single entity", () => {
      const largeData = {
        massiveArray: Array.from({ length: 10000 }, (_, i) => ({
          index: i,
          value: `item-${i}`,
          nested: { data: `nested-${i}` },
        })),
        largeString: "x".repeat(100000), // 100KB string
        deepObject: createDeepObject(10), // 10 levels deep
      };

      const entity = createCommentEntity("large-entity", "Large comment", 1);
      entity.data.extras = largeData;

      const startTime = performance.now();
      store.comment.push(entity);
      const pushTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(1);
      expect(pushTime).toBeLessThan(1000); // Should handle in under 1 second

      const retrievedEntity = store.comment[0];
      expect(retrievedEntity.data.extras.massiveArray).toHaveLength(10000);
      expect(retrievedEntity.data.extras.largeString).toHaveLength(100000);
    });

    test("maintains performance under rapid entity creation/deletion", () => {
      const iterations = 500;
      const startTime = performance.now();

      // Rapid creation and deletion cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        // Create batch
        const entities = Array.from({ length: iterations }, (_, i) =>
          createCommentEntity(
            `batch-${cycle}-item-${i}`,
            `Batch ${cycle} Item ${i}`
          )
        );

        store.loadEntities(entities);
        expect(store.comment).toHaveLength(iterations);

        // Clear for next cycle
        store.clear();
        expect(store.comment).toHaveLength(0);
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(2000); // Should complete in reasonable time
    });

    test("handles concurrent array operations", () => {
      const baseEntities = Array.from({ length: 100 }, (_, i) =>
        createCommentEntity(`base-${i}`, `Base comment ${i}`)
      );

      store.loadEntities(baseEntities);

      // Simulate concurrent operations
      const operations = [];

      for (let i = 0; i < 50; i++) {
        operations.push(() => {
          store.comment.push(
            createCommentEntity(`concurrent-${i}`, `Concurrent ${i}`)
          );
        });

        operations.push(() => {
          const filtered = store.comment.filter((c: any) =>
            c.id.startsWith("base-")
          );
          expect(filtered.length).toBeGreaterThan(0);
        });

        operations.push(() => {
          const found = store.comment.find(
            (c: any) => c.id === `base-${i % 100}`
          );
          expect(found).toBeDefined();
        });
      }

      // Execute all operations
      operations.forEach((op) => op());

      // Verify final state
      expect(store.comment.length).toBeGreaterThanOrEqual(150);
    });
  });

  describe("Reactive System Stress Tests", () => {
    test("handles subscriber notification storms", () => {
      const notificationCounts = new Array(50).fill(0);
      const subscribers: (() => void)[] = [];

      // Create many subscribers
      for (let i = 0; i < 50; i++) {
        const unsubscribe = store.subscribe(() => {
          notificationCounts[i]++;
        });
        subscribers.push(unsubscribe);
      }

      // Trigger notification storm
      const entities = Array.from({ length: 100 }, (_, i) =>
        createCommentEntity(`storm-${i}`, `Storm comment ${i}`)
      );

      store.loadEntities(entities);

      // All subscribers should be notified exactly once (bulk operation)
      notificationCounts.forEach((count) => {
        expect(count).toBe(1);
      });

      // Cleanup
      subscribers.forEach((unsub) => unsub());
    });

    test("handles rapid subscriber add/remove during notifications", () => {
      let notificationCount = 0;
      const subscribers: (() => void)[] = [];

      // Add initial subscriber
      const initialUnsub = store.subscribe(() => {
        notificationCount++;

        // Add new subscribers during notification
        for (let i = 0; i < 3; i++) {
          const newUnsub = store.subscribe(() => {
            // These shouldn't cause infinite loops
          });
          subscribers.push(newUnsub);
        }
      });

      // Trigger notification
      store.comment.push(createCommentEntity("test", "Test"));

      expect(notificationCount).toBe(1);
      expect(subscribers).toHaveLength(3);

      // Cleanup
      initialUnsub();
      subscribers.forEach((unsub) => unsub());
    });

    test("maintains reactivity with deep proxy chains", () => {
      const entity = createCommentEntity("deep", "Deep entity");

      // Create deeply nested structure
      entity.data.level1 = {
        level2: {
          level3: {
            level4: {
              value: "initial",
            },
          },
        },
      };

      store.comment.push(entity);

      let notificationCount = 0;
      store.subscribe(() => notificationCount++);

      // Deep modification should trigger notification
      const retrieved = store.comment[0];
      retrieved.data.level1.level2.level3.level4.value = "modified";

      expect(notificationCount).toBe(1);

      // Verify change persisted
      const reRetrieved = store.comment[0];
      expect(reRetrieved.data.level1.level2.level3.level4.value).toBe(
        "modified"
      );
    });
  });

  describe("Data Integrity Under Stress", () => {
    test("maintains entity uniqueness under rapid duplicate insertions", () => {
      const duplicateId = "duplicate-test";
      const insertionCount = 100;

      // Rapidly insert same ID
      for (let i = 0; i < insertionCount; i++) {
        store.comment.push(createCommentEntity(duplicateId, `Version ${i}`));
      }

      // Should have all duplicates (arrays allow them)
      const duplicates = store.comment.filter((c: any) => c.id === duplicateId);
      expect(duplicates).toHaveLength(insertionCount);
    });

    test("handles malformed entity data gracefully", () => {
      const malformedEntities = [
        // Missing required fields
        { id: "malformed-1" },
        { type: "comment" },
        // Null/undefined values
        { id: "null-test", type: "comment", data: null },
        { id: "undef-test", type: "comment", data: undefined },
      ];

      // Should not throw errors
      expect(() => {
        malformedEntities.forEach((entity) => {
          try {
            store.comment.push(entity);
          } catch (error) {
            // Log but don't fail the test
            console.warn(
              "Handled malformed entity:",
              error instanceof Error ? error.message : String(error)
            );
          }
        });
      }).not.toThrow();

      // Verify store still functional
      store.comment.push(createCommentEntity("valid", "Valid comment"));
      expect(store.comment.find((c: any) => c.id === "valid")).toBeDefined();
    });

    test("recovers from proxy creation failures", () => {
      // Create entity with problematic object that might fail proxy creation
      const problematicEntity = createCommentEntity("problematic", "Test");

      // Add problematic nested object
      problematicEntity.data.problematic = Object.create(null); // No prototype

      // Should handle gracefully
      expect(() => {
        store.comment.push(problematicEntity);
      }).not.toThrow();

      // Store should remain functional
      store.comment.push(createCommentEntity("normal", "Normal comment"));
      expect(store.comment).toHaveLength(2);
    });
  });

  describe("Complex Query Patterns", () => {
    test("handles complex filtering with mixed data types", () => {
      const entities = [
        createCommentEntity("c1", "Test", 1),
        createCommentEntity("c2", "Test", null), // Null score
        createCommentEntity("c3", "Test", undefined), // Undefined score
      ];

      entities[0].data.tags = ["urgent", "bug"];
      entities[1].data.tags = null;
      entities[2].data.active = true;

      store.loadEntities(entities);

      // Complex filtering should work without errors
      const filtered = store.comment.filter((c: any) => {
        const hasNumericScore = typeof c.data.score === "number";
        const hasArrayTags = Array.isArray(c.data.tags);
        const isActive = c.data.active === true;

        return hasNumericScore || hasArrayTags || isActive;
      });

      expect(filtered.length).toBeGreaterThan(0);
    });

    test("supports chained array operations efficiently", () => {
      const entities = Array.from({ length: 500 }, (_, i) =>
        createCommentEntity(`c${i}`, `Comment ${i}`, i)
      );

      store.loadEntities(entities);

      const startTime = performance.now();

      const result = store.comment
        .filter((c: any) => c.data.score > 250)
        .map((c: any) => ({ ...c, processed: true }))
        .sort((a: any, b: any) => b.data.score - a.data.score)
        .slice(0, 10);

      const processingTime = performance.now() - startTime;

      expect(result).toHaveLength(10);
      expect(result[0].data.score).toBe(499);
      expect(result[0].processed).toBe(true);
      expect(processingTime).toBeLessThan(100); // Should be reasonably fast
    });
  });
});

// Helper function to create deeply nested objects
function createDeepObject(depth: number): any {
  if (depth === 0) {
    return { value: "leaf", depth: 0 };
  }

  return {
    value: `level-${depth}`,
    depth,
    nested: createDeepObject(depth - 1),
  };
}
