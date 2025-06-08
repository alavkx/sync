import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Acceptance: Basic Usage (Local-Only)", () => {
  let store: KalphiteStore;

  beforeEach(() => {
    store = new KalphiteStore();
  });

  test("complete user workflow: create, read, update, collaborate", () => {
    // ====== SCENARIO: Code Review App Usage ======

    // 1. User loads existing review data
    const existingReview = createReviewEntity(
      "review-1",
      "Fix authentication bug",
      "pending"
    );
    const existingComment = createCommentEntity(
      "comment-1",
      "This looks good to me",
      45
    );

    store.loadEntities([existingReview, existingComment]);

    // Verify data is immediately available (synchronous)
    expect(store.getById("review-1")).toEqual(existingReview);
    expect(store.getByType("comment")).toHaveLength(1);

    // 2. User adds a new comment (optimistic update)
    const newComment = createCommentEntity(
      "comment-2",
      "Consider adding error handling here",
      67
    );
    store.upsert("comment-2", newComment);

    // Comment is immediately available
    const allComments = store.getByType("comment");
    expect(allComments).toHaveLength(2);
    expect(allComments.find((c) => c.id === "comment-2")?.data.message).toBe(
      "Consider adding error handling here"
    );

    // 3. User modifies existing comment
    const updatedComment = {
      ...newComment,
      data: {
        ...newComment.data,
        message: "Consider adding error handling here + tests",
      },
    };
    store.upsert("comment-2", updatedComment);

    // Update is immediately reflected
    const modifiedComment = store.getById("comment-2");
    expect(modifiedComment?.data.message).toBe(
      "Consider adding error handling here + tests"
    );

    // 4. User updates review status
    const updatedReview = {
      ...existingReview,
      data: { ...existingReview.data, status: "approved" },
    };
    store.upsert("review-1", updatedReview);

    // Status change is immediate
    const currentReview = store.getById("review-1");
    expect(currentReview?.data.status).toBe("approved");

    // 5. Verify final state
    expect(store.getAll()).toHaveLength(3); // 1 review + 2 comments
    expect(store.getByType("review")).toHaveLength(1);
    expect(store.getByType("comment")).toHaveLength(2);

    // All data is consistent and immediately accessible
    const finalState = {
      reviews: store.getByType("review"),
      comments: store.getByType("comment"),
    };

    expect(finalState.reviews[0].data.status).toBe("approved");
    expect(finalState.comments).toHaveLength(2);
    expect(
      finalState.comments.some((c) => c.data.message.includes("+ tests"))
    ).toBe(true);
  });

  test("UI stays responsive during bulk operations", () => {
    // Simulate loading a large code review with many comments
    const largeReview = createReviewEntity(
      "large-review",
      "Large feature review"
    );
    const manyComments = Array.from({ length: 100 }, (_, i) =>
      createCommentEntity(`comment-${i}`, `Comment ${i}`, i + 1)
    );

    const allEntities = [largeReview, ...manyComments];

    // Bulk load should be fast
    const startTime = performance.now();
    store.loadEntities(allEntities);
    const loadTime = performance.now() - startTime;

    // Verify all data loaded correctly
    expect(store.getAll()).toHaveLength(101);
    expect(store.getByType("comment")).toHaveLength(100);
    expect(loadTime).toBeLessThan(20); // Should load 100 entities in under 20ms

    // Subsequent operations should remain fast
    const queryStart = performance.now();
    const comments = store.getByType("comment");
    const queryTime = performance.now() - queryStart;

    expect(comments).toHaveLength(100);
    expect(queryTime).toBeLessThan(5); // Query should be under 5ms

    // Adding new entities should be instant
    const addStart = performance.now();
    store.upsert(
      "comment-new",
      createCommentEntity("comment-new", "New comment")
    );
    const addTime = performance.now() - addStart;

    expect(addTime).toBeLessThan(1); // Adding should be sub-millisecond
    expect(store.getByType("comment")).toHaveLength(101);
  });

  test("change subscription works for reactive UI updates", () => {
    // Simulate React component subscriptions
    let uiUpdateCount = 0;
    let lastCommentCount = 0;

    // Subscribe to changes (like React would)
    const unsubscribe = store.subscribe(() => {
      uiUpdateCount++;
      lastCommentCount = store.getByType("comment").length;
    });

    // Initial state
    expect(uiUpdateCount).toBe(0);

    // Add first comment - should trigger update
    store.upsert(
      "comment-1",
      createCommentEntity("comment-1", "First comment")
    );
    expect(uiUpdateCount).toBe(1);
    expect(lastCommentCount).toBe(1);

    // Add second comment - should trigger another update
    store.upsert(
      "comment-2",
      createCommentEntity("comment-2", "Second comment")
    );
    expect(uiUpdateCount).toBe(2);
    expect(lastCommentCount).toBe(2);

    // Bulk load should trigger only one update
    const bulkComments = [
      createCommentEntity("comment-3", "Third"),
      createCommentEntity("comment-4", "Fourth"),
      createCommentEntity("comment-5", "Fifth"),
    ];

    store.loadEntities(bulkComments);
    expect(uiUpdateCount).toBe(3); // Only one additional update
    expect(lastCommentCount).toBe(5);

    // Unsubscribe should stop updates
    unsubscribe();
    store.upsert("comment-6", createCommentEntity("comment-6", "Sixth"));
    expect(uiUpdateCount).toBe(3); // Should not increase
  });

  test("error handling doesn't break the store", () => {
    // Store should be resilient to various edge cases

    // Empty string IDs
    expect(() =>
      store.upsert("", createCommentEntity("", "Empty ID"))
    ).not.toThrow();

    // Null/undefined data
    expect(() => store.upsert("null-test", null as any)).not.toThrow();
    expect(() =>
      store.upsert("undefined-test", undefined as any)
    ).not.toThrow();

    // Invalid queries
    expect(store.getById("nonexistent")).toBeUndefined();
    expect(store.getByType("nonexistent")).toEqual([]);

    // Store should remain functional
    store.upsert(
      "recovery-test",
      createCommentEntity("recovery-test", "Recovery")
    );
    expect(store.getById("recovery-test")).toBeDefined();
    expect(store.getAll().length).toBeGreaterThan(0);
  });

  test("memory-first philosophy: everything is synchronous", () => {
    // This test validates that Kalphite delivers on its core promise:
    // "All operations are synchronous, no loading states needed"

    const entities = [
      createReviewEntity("sync-review", "Sync test review"),
      createCommentEntity("sync-comment-1", "Sync comment 1"),
      createCommentEntity("sync-comment-2", "Sync comment 2"),
    ];

    // ✅ Load operation is synchronous
    store.loadEntities(entities);
    const loadedEntities = store.getAll(); // ← Synchronous, no await needed
    expect(loadedEntities).toHaveLength(3);

    // ✅ Upsert operation is synchronous
    store.upsert(
      "sync-comment-3",
      createCommentEntity("sync-comment-3", "Sync comment 3")
    );
    const allComments = store.getByType("comment"); // ← Synchronous, no await needed
    expect(allComments).toHaveLength(3);

    // ✅ Query operations are synchronous
    const review = store.getById("sync-review"); // ← Synchronous, no await needed
    expect(review).toBeDefined();
    expect(review?.data.title).toBe("Sync test review");

    // ✅ Type filtering is synchronous
    const comments = store.getByType("comment"); // ← Synchronous, no await needed
    const reviews = store.getByType("review"); // ← Synchronous, no await needed
    expect(comments).toHaveLength(3);
    expect(reviews).toHaveLength(1);

    // 🎯 This is the revolutionary insight:
    // NO async/await, NO loading states, NO stale data possible
    // Everything is immediately available because it lives in memory
  });
});

// =====================================================
// COMPLETION CRITERIA FOR BASIC USAGE (Phase 1)
// =====================================================
// When these acceptance tests pass, Kalphite is ready for:
// - Local-only applications
// - Prototyping and development
// - Single-user scenarios
// - Learning and experimentation
//
// Next Phase: Add persistence and multi-user sync
// ====================================================
