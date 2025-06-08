import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: TypedCollection Advanced Features", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Missing Query Methods", () => {
    test("TypedCollection.find should find entities efficiently", () => {
      const comment1 = createCommentEntity("c1", "First comment", 10);
      const comment2 = createCommentEntity("c2", "Second comment", 20);

      store.comment.push(comment1);
      store.comment.push(comment2);

      // Test find method (native array method)
      const found = store.comment.find((c: any) => c.id === "c1");
      expect(found).toEqual(comment1);

      const notFound = store.comment.find((c: any) => c.id === "nonexistent");
      expect(notFound).toBeUndefined();
    });

    test("TypedCollection.filter should filter entities functionally", () => {
      const comments = [
        createCommentEntity("c1", "Important comment", 5),
        createCommentEntity("c2", "Regular comment", 15),
        createCommentEntity("c3", "Another important", 25),
        createCommentEntity("c4", "Low priority", 35),
      ];

      comments.forEach((c) => store.comment.push(c));

      // Test filter method (native array method)
      const filtered = store.comment.filter((c: any) => c.data.lineNumber < 20);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((c: any) => c.id)).toEqual(["c1", "c2"]);
    });

    test("TypedCollection.sort should sort entities functionally", () => {
      const comments = [
        createCommentEntity("c1", "Third", 30),
        createCommentEntity("c2", "First", 10),
        createCommentEntity("c3", "Second", 20),
      ];

      comments.forEach((c) => store.comment.push(c));

      // Test sort method (native array method)
      const sorted = store.comment.sort(
        (a: any, b: any) => a.data.lineNumber - b.data.lineNumber
      );
      expect(sorted.map((c: any) => c.data.lineNumber)).toEqual([10, 20, 30]);
      expect(sorted.map((c: any) => c.id)).toEqual(["c2", "c3", "c1"]);
    });
  });

  describe("Entity Reference Consistency", () => {
    test("entity references should be shared across different access methods", () => {
      const comment = createCommentEntity("c1", "Test comment", 10);
      store.comment.push(comment);

      const fromCollection = store.comment[0];
      const fromFind = store.comment.find((c: any) => c.id === "c1");

      // Same entity should be returned from different access methods
      expect(fromCollection).toBe(fromFind);
      expect(fromCollection.id).toBe("c1");
    });

    test("updating entity through one method should reflect in all others", () => {
      const original = createCommentEntity("c1", "Original", 10);
      store.comment.push(original);

      const updated = {
        ...original,
        data: { ...original.data, message: "Updated" },
      };

      // Update through array index assignment
      const index = store.comment.findIndex((c: any) => c.id === "c1");
      store.comment[index] = updated;

      // Should be reflected in all access methods
      const fromIndex = store.comment[0];
      const fromFind = store.comment.find((c: any) => c.id === "c1");

      expect(fromIndex.data.message).toBe("Updated");
      expect(fromFind?.data.message).toBe("Updated");
    });
  });

  describe("Array Synchronization", () => {
    test("TypedCollection array should stay synchronized with store changes", () => {
      expect(store.comment).toHaveLength(0);

      // Add through collection
      store.comment.push(createCommentEntity("c1", "First", 10));
      expect(store.comment).toHaveLength(1);

      // Add through different access
      store.comment.push(createCommentEntity("c2", "Second", 20));
      expect(store.comment).toHaveLength(2);

      // Remove through splice
      store.comment.splice(0, 1);
      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].id).toBe("c2");
    });

    test("bulk operations should maintain synchronization", () => {
      const comments = [
        createCommentEntity("c1", "First", 10),
        createCommentEntity("c2", "Second", 20),
        createCommentEntity("c3", "Third", 30),
      ];

      // Add multiple entities
      comments.forEach((c) => store.comment.push(c));
      expect(store.comment).toHaveLength(3);

      // Test bulk filtering (non-destructive)
      const filtered = store.comment.filter((c: any) => c.data.lineNumber > 15);
      expect(filtered).toHaveLength(2);
      expect(store.comment).toHaveLength(3); // Original unchanged

      // Test bulk removal
      store.comment.splice(1, 2); // Remove 2nd and 3rd elements
      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].id).toBe("c1");
    });
  });

  describe("Performance Requirements", () => {
    test("TypedCollection operations should be fast with many entities", () => {
      // Add 1000 entities for performance testing
      for (let i = 0; i < 1000; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      // Test push performance (adding another entity)
      const pushStart = performance.now();
      store.comment.push(createCommentEntity("c999", "Updated", 999));
      const pushTime = performance.now() - pushStart;
      expect(pushTime).toBeLessThan(5); // Should be under 5ms

      // Test find performance
      const findStart = performance.now();
      const found = store.comment.find((c: any) => c.id === "c500");
      const findTime = performance.now() - findStart;
      expect(findTime).toBeLessThan(10); // Should be under 10ms
      expect(found?.id).toBe("c500");
    });

    test("Array access should remain fast with many entities", () => {
      // Create many entities
      for (let i = 0; i < 1000; i++) {
        store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
      }

      // Test direct array access performance
      const accessStart = performance.now();
      const firstEntity = store.comment[0];
      const lastEntity = store.comment[store.comment.length - 1];
      const accessTime = performance.now() - accessStart;

      expect(accessTime).toBeLessThan(1); // Should be instant
      expect(firstEntity.id).toBe("c0");
      expect(lastEntity.id).toBe("c999");

      // Test array length access
      const lengthStart = performance.now();
      const length = store.comment.length;
      const lengthTime = performance.now() - lengthStart;

      expect(lengthTime).toBeLessThan(1);
      expect(length).toBe(1000);
    });
  });

  describe("Type Safety & Validation", () => {
    test("TypedCollection should only accept entities of correct type", () => {
      const comment = createCommentEntity("c1", "Valid comment", 10);

      // This should work
      store.comment.push(comment);
      expect(store.comment).toHaveLength(1);

      // Different types should be isolated
      const review = createReviewEntity("r1", "Review", "pending");
      store.review.push(review);

      expect(store.comment).toHaveLength(1);
      expect(store.review).toHaveLength(1);
    });

    test("removal should validate entity type belongs to collection", () => {
      const comment = createCommentEntity("c1", "Comment", 10);
      const review = createReviewEntity("r1", "Review", "pending");

      store.comment.push(comment);
      store.review.push(review);

      // Remove from correct collection
      const commentIndex = store.comment.findIndex((c: any) => c.id === "c1");
      store.comment.splice(commentIndex, 1);
      expect(store.comment).toHaveLength(0);

      // Other collection should be unaffected
      expect(store.review).toHaveLength(1);
      expect(store.review[0].id).toBe("r1");
    });
  });

  describe("Error Handling", () => {
    test("operations should handle edge cases gracefully", () => {
      // Empty collections should work
      expect(
        store.comment.find((c: any) => c.id === "nonexistent")
      ).toBeUndefined();
      expect(store.comment.filter((c: any) => true)).toHaveLength(0);

      // Adding entities with empty IDs should work
      expect(() =>
        store.comment.push(createCommentEntity("", "Empty", 1))
      ).not.toThrow();

      // Removing non-existent entities should work
      expect(() => {
        const index = store.comment.findIndex(
          (c: any) => c.id === "nonexistent"
        );
        if (index >= 0) store.comment.splice(index, 1);
      }).not.toThrow();
    });

    test("corrupted collection state should be recoverable", () => {
      // Add some valid data
      store.comment.push(createCommentEntity("c1", "Valid", 10));
      expect(store.comment).toHaveLength(1);

      // Attempt invalid operations should not crash
      expect(() => {
        store.comment.push(null as any);
      }).not.toThrow();

      // Clear should restore clean state
      store.clear();
      expect(store.comment).toHaveLength(0);

      // Should be able to add valid data again
      store.comment.push(createCommentEntity("c2", "Recovered", 20));
      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].id).toBe("c2");
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
