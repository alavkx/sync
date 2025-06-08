import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: In-Memory Store", () => {
  let store: KalphiteStore;

  beforeEach(() => {
    store = new KalphiteStore();
  });

  describe("Core Entity Operations", () => {
    test("store.upsert() adds new entities correctly", () => {
      const entity = createCommentEntity("comment-1", "Hello World");

      store.upsert("comment-1", entity);

      const retrieved = store.getById("comment-1");
      expect(retrieved).toEqual(entity);
    });

    test("store.upsert() updates existing entities correctly", () => {
      const entity1 = createCommentEntity("comment-1", "Hello");
      const entity2 = createCommentEntity("comment-1", "Hello Updated");

      store.upsert("comment-1", entity1);
      store.upsert("comment-1", entity2);

      const retrieved = store.getById("comment-1");
      expect(retrieved?.data.message).toBe("Hello Updated");
    });

    test("store.getById() returns correct entity or undefined", () => {
      const entity = createCommentEntity("comment-1", "Test");
      store.upsert("comment-1", entity);

      expect(store.getById("comment-1")).toEqual(entity);
      expect(store.getById("nonexistent")).toBeUndefined();
    });

    test("store.getByType() filters entities by type correctly", () => {
      const comment1 = createCommentEntity("comment-1", "Comment 1");
      const comment2 = createCommentEntity("comment-2", "Comment 2");
      const review1 = createReviewEntity("review-1", "Review 1");

      store.upsert("comment-1", comment1);
      store.upsert("comment-2", comment2);
      store.upsert("review-1", review1);

      const comments = store.getByType("comment");
      const reviews = store.getByType("review");

      expect(comments).toHaveLength(2);
      expect(reviews).toHaveLength(1);
      expect(comments.every((c) => c.type === "comment")).toBe(true);
      expect(reviews.every((r) => r.type === "review")).toBe(true);
    });

    test("store.getAll() returns all entities", () => {
      const comment = createCommentEntity("comment-1", "Comment");
      const review = createReviewEntity("review-1", "Review");

      store.upsert("comment-1", comment);
      store.upsert("review-1", review);

      const all = store.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(comment);
      expect(all).toContain(review);
    });

    test("store.clear() removes all entities", () => {
      store.upsert("comment-1", createCommentEntity("comment-1", "Test"));
      store.upsert("review-1", createReviewEntity("review-1", "Test"));

      expect(store.getAll()).toHaveLength(2);

      store.clear();

      expect(store.getAll()).toHaveLength(0);
      expect(store.getById("comment-1")).toBeUndefined();
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

      expect(store.getAll()).toHaveLength(3);
      expect(store.getByType("comment")).toHaveLength(2);
      expect(store.getByType("review")).toHaveLength(1);
    });
  });

  describe("Subscription & Change Detection", () => {
    test("store.subscribe() notifies subscribers on changes", () => {
      let notificationCount = 0;

      const unsubscribe = store.subscribe(() => {
        notificationCount++;
      });

      store.upsert("comment-1", createCommentEntity("comment-1", "Test"));
      expect(notificationCount).toBe(1);

      store.upsert("comment-2", createCommentEntity("comment-2", "Test2"));
      expect(notificationCount).toBe(2);

      unsubscribe();

      store.upsert("comment-3", createCommentEntity("comment-3", "Test3"));
      expect(notificationCount).toBe(2); // Should not increase after unsubscribe
    });

    test("multiple subscribers work independently", () => {
      let count1 = 0,
        count2 = 0;

      const unsub1 = store.subscribe(() => count1++);
      const unsub2 = store.subscribe(() => count2++);

      store.upsert("comment-1", createCommentEntity("comment-1", "Test"));
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      unsub1();

      store.upsert("comment-2", createCommentEntity("comment-2", "Test2"));
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

      expect(store.getAll()).toHaveLength(entityCount);
      expect(loadTime).toBeLessThan(50); // Should load 1000 entities in under 50ms
    });

    test("read operations are fast even with many entities", () => {
      const entityCount = 10000;
      const entities = Array.from({ length: entityCount }, (_, i) =>
        createCommentEntity(`comment-${i}`, `Message ${i}`, i)
      );

      store.loadEntities(entities);

      // Test getById performance
      const getByIdStart = performance.now();
      store.getById("comment-5000");
      const getByIdTime = performance.now() - getByIdStart;
      expect(getByIdTime).toBeLessThan(1); // Should be sub-millisecond

      // Test getByType performance
      const getByTypeStart = performance.now();
      const comments = store.getByType("comment");
      const getByTypeTime = performance.now() - getByTypeStart;
      expect(comments).toHaveLength(entityCount);
      expect(getByTypeTime).toBeLessThan(10); // Should complete in under 10ms
    });
  });

  describe("Edge Cases", () => {
    test("handles undefined/null entity IDs gracefully", () => {
      const testEntity = createCommentEntity("", "Test");

      expect(() => {
        store.upsert("", testEntity);
      }).not.toThrow();

      expect(store.getById("")).toEqual(testEntity);
    });

    test("handles duplicate entity IDs correctly", () => {
      const entity1 = createCommentEntity("duplicate", "First");
      const entity2 = createCommentEntity("duplicate", "Second");

      store.upsert("duplicate", entity1);
      store.upsert("duplicate", entity2);

      const retrieved = store.getById("duplicate");
      expect(retrieved?.data.message).toBe("Second");
    });

    test("handles empty type filtering", () => {
      store.upsert("comment-1", createCommentEntity("comment-1", "Test"));

      const emptyResults = store.getByType("nonexistent-type");
      expect(emptyResults).toEqual([]);
    });
  });
});

// These tests demonstrate the completion criteria for Layer 1
// When these pass, the in-memory store is fully functional
// Next: Schema validation and React integration tests
