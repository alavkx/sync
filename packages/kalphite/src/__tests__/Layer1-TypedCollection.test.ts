import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("Layer 1: TypedCollection API", () => {
  let store: any;

  beforeEach(() => {
    store = KalphiteStore();
  });

  test("store.comment returns TypedCollection with Array methods", () => {
    const comment1 = createCommentEntity("c1", "First comment", 10);
    const comment2 = createCommentEntity("c2", "Second comment", 20);

    store.comment.push(comment1);
    store.comment.push(comment2);

    // Should behave like array
    expect(store.comment).toHaveLength(2);
    expect(store.comment[0]).toEqual(comment1);
    expect(store.comment[1]).toEqual(comment2);

    // Should have array methods
    expect(typeof store.comment.push).toBe("function");
    expect(typeof store.comment.slice).toBe("function");
    expect(typeof store.comment.filter).toBe("function");
    expect(typeof store.comment.map).toBe("function");
    expect(typeof store.comment.find).toBe("function");
    expect(typeof store.comment.sort).toBe("function");
  });

  test("TypedCollection.push adds entities", () => {
    const comment = createCommentEntity("c1", "Test comment", 10);

    // Add new entity
    const result = store.comment.push(comment);
    expect(result).toBeDefined();
    expect(store.comment).toHaveLength(1);
    expect(store.comment[0]).toEqual(comment);

    // Add another entity
    const comment2 = createCommentEntity("c2", "Second comment", 20);
    store.comment.push(comment2);
    expect(store.comment).toHaveLength(2);
    expect(store.comment[1]).toEqual(comment2);
  });

  test("TypedCollection.splice removes entities", () => {
    const comment1 = createCommentEntity("c1", "First", 10);
    const comment2 = createCommentEntity("c2", "Second", 20);

    store.comment.push(comment1);
    store.comment.push(comment2);
    expect(store.comment).toHaveLength(2);

    // Remove first entity
    const removed = store.comment.splice(0, 1);
    expect(removed).toHaveLength(1);
    expect(removed[0]).toEqual(comment1);
    expect(store.comment).toHaveLength(1);
    expect(store.comment[0]).toEqual(comment2);
  });

  test("TypedCollection mutations trigger React updates", () => {
    let updateCount = 0;
    const unsubscribe = store.subscribe(() => updateCount++);

    expect(updateCount).toBe(0);

    // Push should trigger update
    store.comment.push(createCommentEntity("c1", "Test", 10));
    expect(updateCount).toBe(1);

    // Splice should trigger update
    store.comment.splice(0, 1);
    expect(updateCount).toBe(2);

    unsubscribe();
  });

  test("TypedCollection preserves entity references", () => {
    const comment = createCommentEntity("c1", "Test", 10);
    store.comment.push(comment);

    // Same entity should be returned from different access methods
    const fromArray = store.comment[0];
    const fromFind = store.comment.find((c: any) => c.id === "c1");

    expect(fromArray).toBe(fromFind); // Same reference
    expect(fromArray).toEqual(comment);
  });

  test("different TypedCollections are isolated", () => {
    const comment = createCommentEntity("c1", "Comment", 10);
    const review = createReviewEntity("r1", "Review", "pending");

    store.comment.push(comment);
    store.review.push(review);

    expect(store.comment).toHaveLength(1);
    expect(store.review).toHaveLength(1);

    expect(store.comment[0]).toEqual(comment);
    expect(store.review[0]).toEqual(review);
  });

  test("TypedCollection handles rapid mutations efficiently", () => {
    const startTime = performance.now();

    // Rapid pushes
    for (let i = 0; i < 1000; i++) {
      store.comment.push(createCommentEntity(`c${i}`, `Comment ${i}`, i));
    }

    const pushTime = performance.now() - startTime;

    expect(pushTime).toBeLessThan(200); // Should be fast
    expect(store.comment).toHaveLength(1000);

    // Test array operations are fast
    const opStart = performance.now();
    const filtered = store.comment.filter(
      (c: any) => c.data.lineNumber % 2 === 0
    );
    const sorted = store.comment.sort(
      (a: any, b: any) => a.data.lineNumber - b.data.lineNumber
    );
    const opTime = performance.now() - opStart;

    expect(opTime).toBeLessThan(100);
    expect(filtered.length).toBe(500);
    expect(sorted[0].data.lineNumber).toBe(0);
  });

  test("TypedCollection validation with schema", () => {
    // This test validates that entities maintain their structure
    // when stored in TypedCollections

    const validComment = createCommentEntity("c1", "Valid", 10);
    const result = store.comment.push(validComment);
    expect(result).toBeDefined();

    const retrieved = store.comment[0];
    expect(retrieved.id).toBe("c1");
    expect(retrieved.type).toBe("comment");
    expect(retrieved.data.message).toBe("Valid");
    expect(retrieved.data.lineNumber).toBe(10);
  });
});
