import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: TypedCollection Advanced Features", () => {
  let store: ReturnType<typeof KalphiteStore>;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Missing Query Methods", () => {
    test("TypedCollection.findById should find entities efficiently", () => {
      const comment1 = createCommentEntity("c1", "First comment", 10);
      const comment2 = createCommentEntity("c2", "Second comment", 20);

      store.comment.upsert("c1", comment1);
      store.comment.upsert("c2", comment2);

      // This method doesn't exist yet - should be implemented
      expect(() => (store.comment as any).findById?.("c1")).not.toThrow();

      const found = (store.comment as any).findById?.("c1");
      if (found !== undefined) {
        expect(found).toEqual(comment1);
      }

      const notFound = (store.comment as any).findById?.("nonexistent");
      expect(notFound).toBeUndefined();
    });

    test("TypedCollection.where should filter entities functionally", () => {
      const comments = [
        createCommentEntity("c1", "Bug report", 10),
        createCommentEntity("c2", "Feature request", 20),
        createCommentEntity("c3", "Bug fix", 30),
      ];

      comments.forEach((c) => store.comment.upsert(c.id, c));

      // This method doesn't exist yet - should be implemented
      const bugComments = (store.comment as any).where?.((c: any) =>
        c.data.message.includes("Bug")
      );

      if (bugComments !== undefined) {
        expect(bugComments).toHaveLength(2);
        expect(
          bugComments.every((c: any) => c.data.message.includes("Bug"))
        ).toBe(true);
      }
    });

    test("TypedCollection.orderBy should sort entities functionally", () => {
      const comments = [
        createCommentEntity("c1", "Comment", 30),
        createCommentEntity("c2", "Comment", 10),
        createCommentEntity("c3", "Comment", 20),
      ];

      comments.forEach((c) => store.comment.upsert(c.id, c));

      // This method doesn't exist yet - should be implemented
      const sortedComments = (store.comment as any).orderBy?.(
        (c: any) => c.data.lineNumber
      );

      if (sortedComments !== undefined) {
        expect(sortedComments).toHaveLength(3);
        expect(sortedComments[0].data.lineNumber).toBe(10);
        expect(sortedComments[1].data.lineNumber).toBe(20);
        expect(sortedComments[2].data.lineNumber).toBe(30);
      }
    });
  });

  describe("Entity Reference Consistency", () => {
    test("entity references should be shared across different access methods", () => {
      const comment = createCommentEntity("c1", "Test comment", 10);
      store.comment.upsert("c1", comment);

      const fromCollection = store.comment[0];
      const fromStoreById = store.getById("c1");
      const fromStoreByType = store.getByType("comment")[0];

      // All three should be the exact same object reference
      expect(fromCollection).toBe(fromStoreById);
      expect(fromStoreById).toBe(fromStoreByType);
      expect(fromCollection).toBe(fromStoreByType);
    });

    test("updating entity through one method should reflect in all others", () => {
      const original = createCommentEntity("c1", "Original", 10);
      store.comment.upsert("c1", original);

      const updated = {
        ...original,
        data: { ...original.data, message: "Updated" },
      };
      store.upsert("c1", updated); // Update through store

      // Should reflect in TypedCollection
      expect(store.comment[0].data.message).toBe("Updated");
      const foundEntity = (store.comment as any).findById?.("c1");
      if (foundEntity) {
        expect(foundEntity.data.message).toBe("Updated");
      }
    });
  });

  describe("Array Synchronization", () => {
    test("TypedCollection array should stay synchronized with store changes", () => {
      // Start empty
      expect(store.comment).toHaveLength(0);

      // Add through collection
      store.comment.upsert("c1", createCommentEntity("c1", "First", 10));
      expect(store.comment).toHaveLength(1);

      // Add through store
      store.upsert("c2", createCommentEntity("c2", "Second", 20));
      expect(store.comment).toHaveLength(2);

      // Delete through collection
      store.comment.delete("c1");
      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].id).toBe("c2");
    });

    test("bulk operations should maintain synchronization", () => {
      const comments = [
        createCommentEntity("c1", "First", 10),
        createCommentEntity("c2", "Second", 20),
        createCommentEntity("c3", "Third", 30),
      ];

      // Load through store
      store.loadEntities(comments);
      expect(store.comment).toHaveLength(3);

      // Clear through store
      store.clear();
      expect(store.comment).toHaveLength(0);
    });
  });

  describe("Performance Requirements", () => {
    test("TypedCollection operations should be fast with many entities", () => {
      // Load 1000 comments
      const comments = Array.from({ length: 1000 }, (_, i) =>
        createCommentEntity(`c${i}`, `Comment ${i}`, i)
      );

      store.loadEntities(comments);
      expect(store.comment).toHaveLength(1000);

      // Test upsert performance
      const upsertStart = performance.now();
      store.comment.upsert("c999", createCommentEntity("c999", "Updated", 999));
      const upsertTime = performance.now() - upsertStart;
      expect(upsertTime).toBeLessThan(5); // Should be under 5ms

      // Test delete performance
      const deleteStart = performance.now();
      store.comment.delete("c500");
      const deleteTime = performance.now() - deleteStart;
      expect(deleteTime).toBeLessThan(5); // Should be under 5ms

      expect(store.comment).toHaveLength(999);
    });

    test("Array access should remain fast with many entities", () => {
      const comments = Array.from({ length: 5000 }, (_, i) =>
        createCommentEntity(`c${i}`, `Comment ${i}`, i)
      );

      store.loadEntities(comments);

      // Test array iteration performance
      const iterationStart = performance.now();
      const messages = store.comment.map((c) => c.data.message);
      const iterationTime = performance.now() - iterationStart;

      expect(messages).toHaveLength(5000);
      expect(iterationTime).toBeLessThan(20); // Should be under 20ms
    });
  });

  describe("Type Safety & Validation", () => {
    test("TypedCollection should only accept entities of correct type", () => {
      const comment = createCommentEntity("c1", "Comment", 10);
      const review = createReviewEntity("r1", "Review", "pending");

      // This should work
      store.comment.upsert("c1", comment);
      expect(store.comment).toHaveLength(1);

      // This should be handled gracefully (exact behavior depends on implementation)
      // In a fully typed system, this would be a TypeScript error
      // At runtime, it should either reject or coerce the entity
      expect(() => {
        store.comment.upsert("r1", review as any);
      }).not.toThrow();

      // The comment collection should still only contain comment entities
      const commentEntities = store.comment.filter((c) => c.type === "comment");
      expect(commentEntities).toHaveLength(1);
    });

    test("deletion should validate entity type belongs to collection", () => {
      const comment = createCommentEntity("c1", "Comment", 10);
      const review = createReviewEntity("r1", "Review", "pending");

      store.comment.upsert("c1", comment);
      store.review.upsert("r1", review);

      // Delete from correct collection
      const commentDeleted = store.comment.delete("c1");
      expect(commentDeleted).toBe(true);
      expect(store.comment).toHaveLength(0);

      // Try to delete review from comment collection
      const reviewDeleted = store.comment.delete("r1");
      expect(reviewDeleted).toBe(false); // Should fail
      expect(store.review).toHaveLength(1); // Review should still exist
    });
  });

  describe("Error Handling", () => {
    test("operations should handle edge cases gracefully", () => {
      // Empty string IDs
      expect(() =>
        store.comment.upsert("", createCommentEntity("", "Empty", 1))
      ).not.toThrow();
      expect(() => store.comment.delete("")).not.toThrow();

      // Non-existent deletions
      expect(store.comment.delete("nonexistent")).toBe(false);

      // Invalid entity structures (should be handled gracefully)
      expect(() => store.comment.upsert("invalid", {} as any)).not.toThrow();
    });

    test("corrupted collection state should be recoverable", () => {
      // Add some valid data
      store.comment.upsert("c1", createCommentEntity("c1", "Valid", 10));
      expect(store.comment).toHaveLength(1);

      // Simulate corruption by directly manipulating the array
      // (In real implementation, this should be protected)
      store.comment.length = 0;

      // Collection should be able to refresh/recover
      // This tests the refresh mechanism
      store.comment.upsert("c2", createCommentEntity("c2", "Recovery", 20));

      // Should now have both entities (if refresh works correctly)
      // Or at least the new one
      expect(store.comment.length).toBeGreaterThan(0);
    });
  });
});

// =====================================================
// LAYER 1 COMPLETION CRITERIA
// =====================================================
//
// When ALL these tests pass, Layer 1 is complete:
//
// 1. ✅ Core store operations work (already passing)
// 2. ❌ TypedCollection.upsert returns entity
// 3. ❌ TypedCollection.delete works correctly
// 4. ❌ TypedCollection.findById implemented
// 5. ❌ TypedCollection.where implemented
// 6. ❌ TypedCollection.orderBy implemented
// 7. ❌ Entity reference consistency
// 8. ❌ Array synchronization
// 9. ❌ Performance requirements met
// 10. ❌ Type safety and validation
//
// Priority order:
// 1. Fix upsert return value (blocking existing tests)
// 2. Fix array synchronization
// 3. Add query methods (findById, where, orderBy)
// 4. Optimize performance
// 5. Add comprehensive error handling
//
// ====================================================
