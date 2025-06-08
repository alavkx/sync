import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Integration: Error Handling & Edge Cases", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Malformed Data Handling", () => {
    test("handles entities with missing required fields", () => {
      const malformedEntity = {
        // Missing id, type, data fields
        randomField: "value",
      };

      expect(() => {
        store.comment.push(malformedEntity);
      }).not.toThrow();

      // Store should remain functional
      const validEntity = createCommentEntity("valid-1", "Valid comment");
      store.comment.push(validEntity);
      expect(store.comment.find((c: any) => c.id === "valid-1")).toBeDefined();
    });

    test("handles entities with null/undefined values", () => {
      const entityWithNulls = {
        id: "null-entity",
        type: "comment",
        data: {
          message: null,
          lineNumber: undefined,
          author: "",
        },
      };

      expect(() => store.comment.push(entityWithNulls)).not.toThrow();

      const retrieved = store.comment.find((c: any) => c.id === "null-entity");
      expect(retrieved).toBeDefined();
      expect(retrieved?.data.message).toBeNull();
      expect(retrieved?.data.lineNumber).toBeUndefined();
    });

    test("handles circular references gracefully", () => {
      const entity1: any = createCommentEntity("circular-1", "First");
      const entity2: any = createCommentEntity("circular-2", "Second");

      // Create circular reference
      entity1.data.reference = entity2;
      entity2.data.reference = entity1;

      expect(() => {
        store.comment.push(entity1);
        store.comment.push(entity2);
      }).not.toThrow();

      const retrieved1 = store.comment.find((c: any) => c.id === "circular-1");
      const retrieved2 = store.comment.find((c: any) => c.id === "circular-2");

      expect(retrieved1).toBeDefined();
      expect(retrieved2).toBeDefined();
    });

    test("handles extremely large entity data", () => {
      const largeMessage = "x".repeat(100000); // 100KB string
      const largeEntity = createCommentEntity("large-entity", largeMessage);

      const startTime = performance.now();
      store.comment.push(largeEntity);
      const storeTime = performance.now() - startTime;

      expect(storeTime).toBeLessThan(50); // Should handle large data quickly

      const retrieved = store.comment.find((c: any) => c.id === "large-entity");
      expect(retrieved?.data.message).toBe(largeMessage);
    });
  });

  describe("Memory Pressure & Performance", () => {
    test("handles thousands of entities without degradation", () => {
      const ENTITY_COUNT = 5000;
      const entities = Array.from({ length: ENTITY_COUNT }, (_, i) =>
        createCommentEntity(`stress-${i}`, `Stress test comment ${i}`, i)
      );

      const startTime = performance.now();
      entities.forEach((entity) => store.comment.push(entity));
      const insertTime = performance.now() - startTime;

      expect(insertTime).toBeLessThan(500); // Should insert 5k entities in under 500ms
      expect(store.comment).toHaveLength(ENTITY_COUNT);

      // Query performance should remain good
      const queryStart = performance.now();
      const midEntity = store.comment.find((c: any) => c.id === "stress-2500");
      const queryTime = performance.now() - queryStart;

      expect(queryTime).toBeLessThan(50); // Query should be fast even with lots of data
      expect(midEntity).toBeDefined();
      expect(midEntity?.data.message).toBe("Stress test comment 2500");
    });

    test("handles rapid successive operations", () => {
      const OPERATION_COUNT = 1000;

      const startTime = performance.now();

      for (let i = 0; i < OPERATION_COUNT; i++) {
        // Create
        const entity = createCommentEntity(`rapid-${i}`, `Rapid ${i}`);
        store.comment.push(entity);

        // Read
        const retrieved = store.comment.find((c: any) => c.id === `rapid-${i}`);
        expect(retrieved).toBeDefined();

        // Update
        if (i % 2 === 0) {
          const index = store.comment.findIndex(
            (c: any) => c.id === `rapid-${i}`
          );
          store.comment[index] = {
            ...entity,
            data: { ...entity.data, message: `Updated ${i}` },
          };
        }
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // 1000 CRUD cycles in under 1 second
      expect(store.comment).toHaveLength(OPERATION_COUNT);
    });
  });

  describe("Concurrent Access Patterns", () => {
    test("handles multiple subscribers updating simultaneously", () => {
      let subscriber1Updates = 0;
      let subscriber2Updates = 0;
      let subscriber3Updates = 0;

      const unsub1 = store.subscribe(() => subscriber1Updates++);
      const unsub2 = store.subscribe(() => subscriber2Updates++);
      const unsub3 = store.subscribe(() => subscriber3Updates++);

      // Simulate concurrent updates
      for (let i = 0; i < 10; i++) {
        store.comment.push(
          createCommentEntity(`concurrent-${i}`, `Message ${i}`)
        );
      }

      expect(subscriber1Updates).toBe(10);
      expect(subscriber2Updates).toBe(10);
      expect(subscriber3Updates).toBe(10);
      expect(store.comment).toHaveLength(10);

      unsub1();
      unsub2();
      unsub3();

      // After unsubscribe, no more updates
      store.comment.push(createCommentEntity("final", "Final message"));
      expect(subscriber1Updates).toBe(10);
      expect(subscriber2Updates).toBe(10);
      expect(subscriber3Updates).toBe(10);
    });

    test("subscription updates don't interfere with each other", () => {
      const updates: any[] = [];

      const unsubscribe = store.subscribe(() => {
        // Subscriber modifies store during notification
        if (store.comment.length === 1) {
          store.comment.push(
            createCommentEntity("subscriber-added", "Added by subscriber")
          );
        }
        updates.push(store.comment.length);
      });

      store.comment.push(createCommentEntity("trigger", "Trigger"));

      expect(updates).toEqual([1, 2]); // Two updates: first entity, then subscriber addition
      expect(store.comment).toHaveLength(2);

      unsubscribe();
    });
  });

  describe("Data Integrity", () => {
    test("maintains consistency during bulk operations", () => {
      const comments = Array.from({ length: 100 }, (_, i) =>
        createCommentEntity(`bulk-${i}`, `Bulk comment ${i}`, i)
      );
      const reviews = Array.from({ length: 50 }, (_, i) =>
        createReviewEntity(`bulk-review-${i}`, `Bulk review ${i}`)
      );

      // Load all at once
      store.loadEntities([...comments, ...reviews]);

      expect(store.comment).toHaveLength(100);
      expect(store.review).toHaveLength(50);

      // Verify random sampling for integrity
      const randomCommentIndex = Math.floor(Math.random() * 100);
      const randomComment = store.comment.find(
        (c: any) => c.id === `bulk-${randomCommentIndex}`
      );
      expect(randomComment?.data.message).toBe(
        `Bulk comment ${randomCommentIndex}`
      );
      expect(randomComment?.data.lineNumber).toBe(randomCommentIndex);

      const randomReviewIndex = Math.floor(Math.random() * 50);
      const randomReview = store.review.find(
        (r: any) => r.id === `bulk-review-${randomReviewIndex}`
      );
      expect(randomReview?.data.title).toBe(`Bulk review ${randomReviewIndex}`);
    });

    test("handles duplicate IDs gracefully", () => {
      const entity1 = createCommentEntity("duplicate-id", "First version");
      const entity2 = createCommentEntity("duplicate-id", "Second version");

      store.comment.push(entity1);
      store.comment.push(entity2);

      // Both should exist in the array (no automatic deduplication)
      expect(store.comment).toHaveLength(2);

      const duplicates = store.comment.filter(
        (c: any) => c.id === "duplicate-id"
      );
      expect(duplicates).toHaveLength(2);
      expect(duplicates[0].data.message).toBe("First version");
      expect(duplicates[1].data.message).toBe("Second version");
    });

    test("preserves entity relationships", () => {
      const review = createReviewEntity("review-1", "Code Review");
      const comment1 = createCommentEntity("comment-1", "First comment", 10);
      const comment2 = createCommentEntity("comment-2", "Second comment", 20);

      // Add review relationship to comments
      (comment1.data as any).reviewId = "review-1";
      (comment2.data as any).reviewId = "review-1";

      store.review.push(review);
      store.comment.push(comment1);
      store.comment.push(comment2);

      // Verify relationships maintained
      const relatedComments = store.comment.filter(
        (c: any) => c.data.reviewId === "review-1"
      );
      expect(relatedComments).toHaveLength(2);

      const targetReview = store.review.find((r: any) => r.id === "review-1");
      expect(targetReview).toBeDefined();
      expect(targetReview?.data.title).toBe("Code Review");
    });
  });

  describe("Edge Case Recovery", () => {
    test("recovers from subscriber errors", () => {
      let goodSubscriberCalls = 0;

      // Subscriber that throws errors
      const badUnsubscribe = store.subscribe(() => {
        throw new Error("Subscriber error");
      });

      // Subscriber that works
      const goodUnsubscribe = store.subscribe(() => {
        goodSubscriberCalls++;
      });

      // Store should continue working despite subscriber errors
      expect(() => {
        store.comment.push(createCommentEntity("error-test", "Test"));
      }).not.toThrow();

      expect(store.comment).toHaveLength(1);
      expect(goodSubscriberCalls).toBe(1); // Good subscriber should still be called

      badUnsubscribe();
      goodUnsubscribe();
    });

    test("handles memory cleanup correctly", () => {
      // Fill store with data
      const entities = Array.from({ length: 1000 }, (_, i) =>
        createCommentEntity(`cleanup-${i}`, `Message ${i}`)
      );

      entities.forEach((entity) => store.comment.push(entity));
      expect(store.comment).toHaveLength(1000);

      // Clear store
      store.clear();
      expect(store.comment).toHaveLength(0);
      expect(store.review).toHaveLength(0);

      // Store should still be functional after clear
      const newEntity = createCommentEntity("post-clear", "After clear");
      store.comment.push(newEntity);
      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].data.message).toBe("After clear");
    });

    test("maintains performance after heavy usage", () => {
      // Heavy usage pattern
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add many entities
        for (let i = 0; i < 100; i++) {
          store.comment.push(
            createCommentEntity(`cycle-${cycle}-${i}`, `Message ${i}`)
          );
        }

        // Query extensively
        for (let i = 0; i < 50; i++) {
          store.comment.find((c: any) => c.id === `cycle-${cycle}-${i}`);
        }

        // Clear periodically
        if (cycle % 3 === 0) {
          store.clear();
        }
      }

      // Performance should still be good
      const perfTestStart = performance.now();
      store.comment.push(createCommentEntity("perf-test", "Performance test"));
      const perfTestTime = performance.now() - perfTestStart;

      expect(perfTestTime).toBeLessThan(5); // Should still be fast

      const retrieved = store.comment.find((c: any) => c.id === "perf-test");
      expect(retrieved?.data.message).toBe("Performance test");
    });
  });
});
