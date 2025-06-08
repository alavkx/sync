import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: In-Memory Store", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Core Entity Operations", () => {
    test("array push adds new entities correctly", () => {
      const entity = createCommentEntity("comment-1", "Hello World");

      store.comment.push(entity);

      const retrieved = store.comment.find((e: any) => e.id === "comment-1");
      expect(retrieved).toEqual(entity);
    });

    test("array operations update existing entities correctly", () => {
      const entity1 = createCommentEntity("comment-1", "Hello");
      const entity2 = createCommentEntity("comment-1", "Hello Updated");

      store.comment.push(entity1);

      // Update by finding and replacing
      const index = store.comment.findIndex((e: any) => e.id === "comment-1");
      store.comment[index] = entity2;

      const retrieved = store.comment.find((e: any) => e.id === "comment-1");
      expect(retrieved?.data.message).toBe("Hello Updated");
    });

    test("array find returns correct entity or undefined", () => {
      const entity = createCommentEntity("comment-1", "Test");
      store.comment.push(entity);

      expect(store.comment.find((e: any) => e.id === "comment-1")).toEqual(
        entity
      );
      expect(
        store.comment.find((e: any) => e.id === "nonexistent")
      ).toBeUndefined();
    });

    test("type arrays filter entities by type correctly", () => {
      const comment1 = createCommentEntity("comment-1", "Comment 1");
      const comment2 = createCommentEntity("comment-2", "Comment 2");
      const review1 = createReviewEntity("review-1", "Review 1");

      store.comment.push(comment1);
      store.comment.push(comment2);
      store.review.push(review1);

      const comments = store.comment;
      const reviews = store.review;

      expect(comments).toHaveLength(2);
      expect(reviews).toHaveLength(1);
      expect(comments.every((c: any) => c.type === "comment")).toBe(true);
      expect(reviews.every((r: any) => r.type === "review")).toBe(true);
    });

    test("arrays contain all entities of their type", () => {
      const comment = createCommentEntity("comment-1", "Comment");
      const review = createReviewEntity("review-1", "Review");

      store.comment.push(comment);
      store.review.push(review);

      const allComments = store.comment;
      const allReviews = store.review;

      expect(allComments).toHaveLength(1);
      expect(allReviews).toHaveLength(1);
      // Check by ID since entities get wrapped in proxies
      expect(allComments[0].id).toBe(comment.id);
      expect(allReviews[0].id).toBe(review.id);
    });

    test("store.clear() removes all entities", () => {
      store.comment.push(createCommentEntity("comment-1", "Test"));
      store.review.push(createReviewEntity("review-1", "Test"));

      expect(store.comment).toHaveLength(1);
      expect(store.review).toHaveLength(1);

      store.clear();

      expect(store.comment).toHaveLength(0);
      expect(store.review).toHaveLength(0);
      expect(
        store.comment.find((e: any) => e.id === "comment-1")
      ).toBeUndefined();
    });
  });

  describe("Bulk Operations", () => {
    test("loadEntities() loads multiple entities efficiently", () => {
      const entities = [
        createCommentEntity("comment-1", "Comment 1"),
        createCommentEntity("comment-2", "Comment 2"),
        createReviewEntity("review-1", "Review 1"),
      ];

      store.loadEntities(entities);

      expect(store.comment).toHaveLength(2);
      expect(store.review).toHaveLength(1);
    });
  });

  describe("Subscription & Change Detection", () => {
    test("store.subscribe() notifies subscribers on changes", () => {
      let notificationCount = 0;

      const unsubscribe = store.subscribe(() => {
        notificationCount++;
      });

      store.comment.push(createCommentEntity("comment-1", "Test"));
      expect(notificationCount).toBe(1);

      store.comment.push(createCommentEntity("comment-2", "Test2"));
      expect(notificationCount).toBe(2);

      unsubscribe();

      store.comment.push(createCommentEntity("comment-3", "Test3"));
      expect(notificationCount).toBe(2); // Should not increase after unsubscribe
    });

    test("multiple subscribers work independently", () => {
      let count1 = 0,
        count2 = 0;

      const unsub1 = store.subscribe(() => count1++);
      const unsub2 = store.subscribe(() => count2++);

      store.comment.push(createCommentEntity("comment-1", "Test"));
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      unsub1();

      store.comment.push(createCommentEntity("comment-2", "Test2"));
      expect(count1).toBe(1); // Should not increase
      expect(count2).toBe(2); // Should increase

      unsub2();
    });

    test("loadEntities() triggers single notification for bulk operations", () => {
      let notificationCount = 0;

      store.subscribe(() => notificationCount++);

      const entities = [
        createCommentEntity("comment-1", "Comment 1"),
        createCommentEntity("comment-2", "Comment 2"),
        createReviewEntity("review-1", "Review 1"),
      ];

      store.loadEntities(entities);

      // Should only trigger one notification despite loading multiple entities
      expect(notificationCount).toBe(1);
    });
  });

  describe("Memory Efficiency", () => {
    test("stores large number of entities efficiently", () => {
      const entityCount = 1000;
      const entities = Array.from({ length: entityCount }, (_, i) =>
        createCommentEntity(`comment-${i}`, `Message ${i}`, i)
      );

      const startTime = performance.now();
      store.loadEntities(entities);
      const loadTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(entityCount);
      expect(loadTime).toBeLessThan(50); // Should load 1000 entities in under 50ms
    });

    test("read operations are fast even with many entities", () => {
      const entityCount = 10000;
      const entities = Array.from({ length: entityCount }, (_, i) =>
        createCommentEntity(`comment-${i}`, `Message ${i}`, i)
      );

      store.loadEntities(entities);

      // Test find performance
      const findStart = performance.now();
      store.comment.find((e: any) => e.id === "comment-5000");
      const findTime = performance.now() - findStart;
      expect(findTime).toBeLessThan(1); // Should be sub-millisecond

      // Test array access performance
      const arrayAccessStart = performance.now();
      const comments = store.comment;
      const arrayAccessTime = performance.now() - arrayAccessStart;
      expect(comments).toHaveLength(entityCount);
      expect(arrayAccessTime).toBeLessThan(10); // Should complete in under 10ms
    });
  });

  describe("Edge Cases", () => {
    test("handles undefined/null entity IDs gracefully", () => {
      const testEntity = createCommentEntity("", "Test");

      expect(() => {
        store.comment.push(testEntity);
      }).not.toThrow();

      expect(store.comment.find((e: any) => e.id === "")).toEqual(testEntity);
    });

    test("handles duplicate entity IDs correctly", () => {
      const entity1 = createCommentEntity("duplicate", "First");
      const entity2 = createCommentEntity("duplicate", "Second");

      store.comment.push(entity1);
      store.comment.push(entity2);

      // Should have both entities (arrays allow duplicates)
      const retrieved = store.comment.filter((e: any) => e.id === "duplicate");
      expect(retrieved).toHaveLength(2);
    });

    test("handles empty type filtering", () => {
      store.comment.push(createCommentEntity("comment-1", "Test"));

      const emptyResults = store.nonexistent || [];
      expect(emptyResults).toHaveLength(0);
    });
  });
});

// These tests demonstrate the completion criteria for Layer 1
// When these pass, the in-memory store is fully functional
// Next: Schema validation and React integration tests
