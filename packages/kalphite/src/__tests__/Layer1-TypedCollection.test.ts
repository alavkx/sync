import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: TypedCollection API", () => {
  let store: ReturnType<typeof KalphiteStore>;

  beforeEach(() => {
    store = KalphiteStore();
  });

  test("store.comment returns TypedCollection with Array methods", () => {
    const comment1 = createCommentEntity("c1", "First comment", 10);
    const comment2 = createCommentEntity("c2", "Second comment", 20);

    store.upsert("c1", comment1);
    store.upsert("c2", comment2);

    const comments = store.comment;

    // Should behave like an Array
    expect(comments).toHaveLength(2);
    expect(comments[0]).toEqual(comment1);
    expect(comments.find((c) => c.id === "c2")).toEqual(comment2);
    expect(comments.map((c) => c.data.message)).toEqual([
      "First comment",
      "Second comment",
    ]);
  });

  test("TypedCollection.upsert adds and updates entities", () => {
    const comment = createCommentEntity("c1", "Original message", 10);

    // Add new entity
    const result = store.comment.upsert("c1", comment);
    expect(result).toEqual(comment);
    expect(store.comment).toHaveLength(1);
    expect(store.comment[0]).toEqual(comment);

    // Update existing entity
    const updated = {
      ...comment,
      data: { ...comment.data, message: "Updated message" },
    };
    store.comment.upsert("c1", updated);

    expect(store.comment).toHaveLength(1);
    expect(store.comment[0].data.message).toBe("Updated message");
  });

  test("TypedCollection.delete removes entities", () => {
    const comment1 = createCommentEntity("c1", "First", 10);
    const comment2 = createCommentEntity("c2", "Second", 20);

    store.comment.upsert("c1", comment1);
    store.comment.upsert("c2", comment2);
    expect(store.comment).toHaveLength(2);

    // Delete existing entity
    const deleted = store.comment.delete("c1");
    expect(deleted).toBe(true);
    expect(store.comment).toHaveLength(1);
    expect(store.comment[0].id).toBe("c2");

    // Delete non-existent entity
    const notDeleted = store.comment.delete("nonexistent");
    expect(notDeleted).toBe(false);
    expect(store.comment).toHaveLength(1);
  });

  test("TypedCollection mutations trigger React updates", () => {
    let updateCount = 0;
    const unsubscribe = store.subscribe(() => updateCount++);

    // Initial state
    expect(updateCount).toBe(0);

    // upsert should trigger update
    store.comment.upsert("c1", createCommentEntity("c1", "Test", 10));
    expect(updateCount).toBe(1);

    // delete should trigger update
    store.comment.delete("c1");
    expect(updateCount).toBe(2);

    unsubscribe();
  });

  test("TypedCollection preserves entity references", () => {
    const comment = createCommentEntity("c1", "Test", 10);
    store.comment.upsert("c1", comment);

    // Same entity should be returned from different access methods
    const fromCollection = store.comment[0];
    const fromStore = store.getById("c1");
    const fromTypeQuery = store.getByType("comment")[0];

    expect(fromCollection).toBe(fromStore);
    expect(fromStore).toBe(fromTypeQuery);
  });

  test("different TypedCollections are isolated", () => {
    const comment = createCommentEntity("c1", "Comment", 10);
    const review = createReviewEntity("r1", "Review", "pending");

    store.comment.upsert("c1", comment);
    store.review.upsert("r1", review);

    expect(store.comment).toHaveLength(1);
    expect(store.review).toHaveLength(1);
    expect(store.comment[0].type).toBe("comment");
    expect(store.review[0].type).toBe("review");
  });

  test("TypedCollection handles rapid mutations efficiently", () => {
    const startTime = performance.now();

    // Rapid upserts
    for (let i = 0; i < 1000; i++) {
      store.comment.upsert(
        `c${i}`,
        createCommentEntity(`c${i}`, `Comment ${i}`, i)
      );
    }

    const upsertTime = performance.now() - startTime;
    expect(store.comment).toHaveLength(1000);
    expect(upsertTime).toBeLessThan(100); // 1000 upserts in <100ms

    // Rapid access
    const accessStart = performance.now();
    const allComments = store.comment.map((c) => c.data.message);
    const accessTime = performance.now() - accessStart;

    expect(allComments).toHaveLength(1000);
    expect(accessTime).toBeLessThan(10); // Access in <10ms
  });

  test("TypedCollection validation with schema", () => {
    // This test assumes schema validation is configured
    // Implementation should handle validation errors gracefully

    const validComment = createCommentEntity("c1", "Valid", 10);
    const result = store.comment.upsert("c1", validComment);
    expect(result).toEqual(validComment);

    // Invalid entity should be handled (exact behavior depends on schema)
    const invalidEntity = { id: "c2", type: "comment" }; // missing required fields
    expect(() =>
      store.comment.upsert("c2", invalidEntity as any)
    ).not.toThrow();
  });
});
