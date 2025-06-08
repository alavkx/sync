import { beforeEach, describe, expect, test } from "vitest";
import { createKalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: Core Store Operations", () => {
  let store: any;

  beforeEach(() => {
    store = createKalphiteStore();
  });

  describe("Array Interface", () => {
    test("should return reactive arrays for entity types", () => {
      expect(Array.isArray(store.comment)).toBe(true);
      expect(Array.isArray(store.review)).toBe(true);
      expect(store.comment).toHaveLength(0);
      expect(store.review).toHaveLength(0);
    });

    test("should support plural form access (comments/reviews)", () => {
      expect(Array.isArray(store.comments)).toBe(true);
      expect(Array.isArray(store.reviews)).toBe(true);
      expect(store.comments).toBe(store.comment); // Same reference
      expect(store.reviews).toBe(store.review); // Same reference
    });

    test("should have standard array methods", () => {
      const methods = [
        "push",
        "splice",
        "find",
        "filter",
        "map",
        "sort",
        "slice",
      ];
      methods.forEach((method) => {
        expect(typeof store.comment[method]).toBe("function");
      });
    });
  });

  describe("Entity Operations", () => {
    test("should add entities with push", () => {
      const entity = createCommentEntity("c1", "Hello World", 10);

      const result = store.comment.push(entity);
      expect(result).toBeDefined();
      expect(store.comment).toHaveLength(1);
      expect(store.comment[0]).toEqual(entity);
    });

    test("should handle multiple entities", () => {
      const entities = [
        createCommentEntity("c1", "First", 10),
        createCommentEntity("c2", "Second", 20),
        createCommentEntity("c3", "Third", 30),
      ];

      entities.forEach((entity) => store.comment.push(entity));

      expect(store.comment).toHaveLength(3);
      expect(store.comment[0].data.message).toBe("First");
      expect(store.comment[2].data.message).toBe("Third");
    });

    test("should update entities via array assignment", () => {
      const original = createCommentEntity("c1", "Original", 10);
      store.comment.push(original);

      const updated = createCommentEntity("c1", "Updated", 10);
      store.comment[0] = updated;

      expect(store.comment[0].data.message).toBe("Updated");
    });

    test("should update entities via direct property modification", () => {
      const entity = createCommentEntity("c1", "Original", 10);
      store.comment.push(entity);

      store.comment[0].data.message = "Modified";

      expect(store.comment[0].data.message).toBe("Modified");
    });

    test("should remove entities with splice", () => {
      const entities = [
        createCommentEntity("c1", "First", 10),
        createCommentEntity("c2", "Second", 20),
        createCommentEntity("c3", "Third", 30),
      ];
      entities.forEach((entity) => store.comment.push(entity));

      const removed = store.comment.splice(1, 1);

      expect(removed).toHaveLength(1);
      expect(removed[0].id).toBe("c2");
      expect(store.comment).toHaveLength(2);
      expect(store.comment[0].id).toBe("c1");
      expect(store.comment[1].id).toBe("c3");
    });

    test("should insert entities with splice", () => {
      store.comment.push(createCommentEntity("c1", "First", 10));
      store.comment.push(createCommentEntity("c3", "Third", 30));

      const middle = createCommentEntity("c2", "Middle", 20);
      store.comment.splice(1, 0, middle);

      expect(store.comment).toHaveLength(3);
      expect(store.comment[0].id).toBe("c1");
      expect(store.comment[1].id).toBe("c2");
      expect(store.comment[2].id).toBe("c3");
    });

    test("should clear all entities", () => {
      store.comment.push(createCommentEntity("c1", "Test", 10));
      store.review.push(createReviewEntity("r1", "Test"));

      expect(store.comment).toHaveLength(1);
      expect(store.review).toHaveLength(1);

      store.clear();

      expect(store.comment).toHaveLength(0);
      expect(store.review).toHaveLength(0);
    });
  });

  describe("Query Operations", () => {
    beforeEach(() => {
      const entities = [
        createCommentEntity("c1", "First comment", 10),
        createCommentEntity("c2", "Second comment", 20),
        createCommentEntity("c3", "TODO: Fix bug", 30),
        createCommentEntity("c4", "Great work!", 40),
        createCommentEntity("c5", "TODO: Add tests", 50),
      ];
      entities.forEach((entity) => store.comment.push(entity));
    });

    test("should find entities by predicate", () => {
      const found = store.comment.find((c: any) => c.id === "c2");
      expect(found?.data.message).toBe("Second comment");

      const notFound = store.comment.find((c: any) => c.id === "nonexistent");
      expect(notFound).toBeUndefined();
    });

    test("should filter entities", () => {
      const todoComments = store.comment.filter((c: any) =>
        c.data.message.includes("TODO")
      );

      expect(todoComments).toHaveLength(2);
      expect(todoComments[0].id).toBe("c3");
      expect(todoComments[1].id).toBe("c5");
    });

    test("should transform with map", () => {
      const messages = store.comment.map((c: any) => c.data.message);
      expect(messages).toHaveLength(5);
      expect(messages[0]).toBe("First comment");
    });

    test("should sort entities", () => {
      const sorted = [...store.comment].sort(
        (a: any, b: any) => b.data.lineNumber - a.data.lineNumber
      );

      expect(sorted[0].data.lineNumber).toBe(50);
      expect(sorted[4].data.lineNumber).toBe(10);
    });
  });

  describe("Type Isolation", () => {
    test("should maintain separate arrays for different types", () => {
      const comment = createCommentEntity("c1", "Comment", 10);
      const review = createReviewEntity("r1", "Review");

      store.comment.push(comment);
      store.review.push(review);

      expect(store.comment).toHaveLength(1);
      expect(store.review).toHaveLength(1);
      expect(store.comment[0].type).toBe("comment");
      expect(store.review[0].type).toBe("review");
    });

    test("should not affect other types when modifying one type", () => {
      store.comment.push(createCommentEntity("c1", "Comment", 10));
      store.review.push(createReviewEntity("r1", "Review"));

      store.comment.splice(0, 1);

      expect(store.comment).toHaveLength(0);
      expect(store.review).toHaveLength(1); // Unchanged
    });

    test("should handle mixed-type bulk operations", () => {
      const mixedEntities = [
        createCommentEntity("c1", "Comment 1", 10),
        createReviewEntity("r1", "Review 1"),
        createCommentEntity("c2", "Comment 2", 20),
        createReviewEntity("r2", "Review 2"),
      ];

      store.loadEntities(mixedEntities);

      expect(store.comment).toHaveLength(2);
      expect(store.review).toHaveLength(2);
      expect(store.comment[0].id).toBe("c1");
      expect(store.review[0].id).toBe("r1");
    });
  });

  describe("Bulk Operations", () => {
    test("should load multiple entities efficiently", () => {
      const entities = [
        createCommentEntity("c1", "Comment 1", 10),
        createCommentEntity("c2", "Comment 2", 20),
        createReviewEntity("r1", "Review 1"),
      ];

      const startTime = performance.now();
      store.loadEntities(entities);
      const loadTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(2);
      expect(store.review).toHaveLength(1);
      expect(loadTime).toBeLessThan(10); // Fast bulk loading
    });

    test("should handle large datasets efficiently", () => {
      const entityCount = 1000;
      const entities = Array.from({ length: entityCount }, (_, i) =>
        createCommentEntity(`c${i}`, `Message ${i}`, i)
      );

      const startTime = performance.now();
      store.loadEntities(entities);
      const loadTime = performance.now() - startTime;

      expect(store.comment).toHaveLength(entityCount);
      expect(loadTime).toBeLessThan(100); // Should handle 1k entities quickly
    });
  });

  describe("Reactivity", () => {
    test("should notify subscribers on mutations", () => {
      let notificationCount = 0;
      const unsubscribe = store.subscribe(() => notificationCount++);

      expect(notificationCount).toBe(0);

      store.comment.push(createCommentEntity("c1", "Test", 10));
      expect(notificationCount).toBe(1);

      store.comment[0].data.message = "Updated";
      expect(notificationCount).toBe(2);

      store.comment.splice(0, 1);
      expect(notificationCount).toBe(3);

      unsubscribe();

      store.comment.push(createCommentEntity("c2", "No notification", 20));
      expect(notificationCount).toBe(3); // Should not increase
    });

    test("should support multiple independent subscribers", () => {
      let count1 = 0,
        count2 = 0;
      const unsub1 = store.subscribe(() => count1++);
      const unsub2 = store.subscribe(() => count2++);

      store.comment.push(createCommentEntity("c1", "Test", 10));
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      unsub1();
      store.comment.push(createCommentEntity("c2", "Test2", 20));
      expect(count1).toBe(1); // No longer subscribed
      expect(count2).toBe(2); // Still subscribed

      unsub2();
    });

    test("should batch bulk operations to single notification", () => {
      let notificationCount = 0;
      store.subscribe(() => notificationCount++);

      const entities = [
        createCommentEntity("c1", "Comment 1", 10),
        createCommentEntity("c2", "Comment 2", 20),
        createReviewEntity("r1", "Review 1"),
      ];

      store.loadEntities(entities);

      expect(notificationCount).toBe(1); // Single notification for bulk operation
    });

    test("should handle subscriber errors gracefully", () => {
      let normalUpdates = 0;

      const erroringSubscriber = () => {
        throw new Error("Subscriber error");
      };
      const normalSubscriber = () => normalUpdates++;

      const unsub1 = store.subscribe(erroringSubscriber);
      const unsub2 = store.subscribe(normalSubscriber);

      expect(() => {
        store.comment.push(createCommentEntity("c1", "Test", 10));
      }).not.toThrow();

      expect(normalUpdates).toBe(1); // Normal subscriber should still work

      unsub1();
      unsub2();
    });
  });

  describe("Entity Identity & References", () => {
    test("should maintain entity identity across operations", () => {
      const entity = createCommentEntity("c1", "Test", 10);
      store.comment.push(entity);

      const fromArray = store.comment[0];
      const fromFind = store.comment.find((c: any) => c.id === "c1");

      expect(fromArray).toBe(fromFind); // Same reference
      expect(fromArray.id).toBe(entity.id);
    });

    test("should handle duplicate IDs correctly", () => {
      const entity1 = createCommentEntity("duplicate", "First", 10);
      const entity2 = createCommentEntity("duplicate", "Second", 20);

      store.comment.push(entity1);
      store.comment.push(entity2);

      // Store should handle duplicates (implementation-specific behavior)
      expect(store.comment.length).toBeGreaterThan(0);
      const foundEntities = store.comment.filter(
        (c: any) => c.id === "duplicate"
      );
      expect(foundEntities.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty string IDs", () => {
      const entity = createCommentEntity("", "Empty ID", 10);

      expect(() => {
        store.comment.push(entity);
      }).not.toThrow();

      const found = store.comment.find((c: any) => c.id === "");
      expect(found).toBeDefined();
    });

    test("should handle null/undefined gracefully", () => {
      expect(() => {
        store.comment.push(null as any);
        store.comment.push(undefined as any);
      }).not.toThrow();

      // Store should remain functional
      store.comment.push(createCommentEntity("recovery", "Still works", 10));
      const working = store.comment.find((c: any) => c?.id === "recovery");
      expect(working).toBeDefined();
    });

    test("should handle malformed queries", () => {
      store.comment.push(createCommentEntity("c1", "Test", 10));

      expect(
        store.comment.find((c: any) => c?.id === "nonexistent")
      ).toBeUndefined();
      expect(store.nonexistent || []).toEqual([]);
    });

    test("should maintain performance with large queries", () => {
      const entityCount = 5000;
      const entities = Array.from({ length: entityCount }, (_, i) =>
        createCommentEntity(`c${i}`, `Message ${i}`, i)
      );

      store.loadEntities(entities);

      const queryStart = performance.now();
      const found = store.comment.find((c: any) => c.id === "c2500");
      const queryTime = performance.now() - queryStart;

      expect(found).toBeDefined();
      expect(queryTime).toBeLessThan(10); // Fast queries even with 5k entities
    });
  });
});
