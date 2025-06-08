import { beforeEach, describe, expect, test } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity, createReviewEntity } from "./setup";

describe("New Array-Based API", () => {
  let store: ReturnType<typeof KalphiteStore>;

  beforeEach(() => {
    store = KalphiteStore();
  });

  describe("Basic Array Operations", () => {
    test("store.comments returns an array", () => {
      expect(Array.isArray(store.comments)).toBe(true);
      expect(store.comments).toHaveLength(0);
    });

    test("can push entities to arrays", () => {
      const comment1 = createCommentEntity("c1", "First comment", 10);
      const comment2 = createCommentEntity("c2", "Second comment", 20);

      store.comments.push(comment1);
      expect(store.comments).toHaveLength(1);
      expect(store.comments[0].id).toBe("c1");

      store.comments.push(comment2);
      expect(store.comments).toHaveLength(2);
      expect(store.comments[1].id).toBe("c2");
    });

    test("can modify entity properties directly", () => {
      const comment = createCommentEntity("c1", "Original message", 10);
      store.comments.push(comment);

      // Direct property modification
      store.comments[0].data.message = "Updated message";

      expect(store.comments[0].data.message).toBe("Updated message");
    });

    test("can use array assignment", () => {
      const comment = createCommentEntity("c1", "Test comment", 10);

      // Array assignment
      store.comments[0] = comment;

      expect(store.comments).toHaveLength(1);
      expect(store.comments[0].id).toBe("c1");
    });

    test("can use splice to delete entities", () => {
      const comment1 = createCommentEntity("c1", "First", 10);
      const comment2 = createCommentEntity("c2", "Second", 20);
      const comment3 = createCommentEntity("c3", "Third", 30);

      store.comments.push(comment1, comment2, comment3);
      expect(store.comments).toHaveLength(3);

      // Delete middle element
      store.comments.splice(1, 1);

      expect(store.comments).toHaveLength(2);
      expect(store.comments[0].id).toBe("c1");
      expect(store.comments[1].id).toBe("c3");
    });

    test("can use splice to insert entities", () => {
      const comment1 = createCommentEntity("c1", "First", 10);
      const comment3 = createCommentEntity("c3", "Third", 30);
      store.comments.push(comment1, comment3);

      const comment2 = createCommentEntity("c2", "Second", 20);

      // Insert in middle
      store.comments.splice(1, 0, comment2);

      expect(store.comments).toHaveLength(3);
      expect(store.comments[0].id).toBe("c1");
      expect(store.comments[1].id).toBe("c2");
      expect(store.comments[2].id).toBe("c3");
    });
  });

  describe("Reactivity", () => {
    test("array mutations trigger subscribers", () => {
      let updateCount = 0;
      const unsubscribe = store.subscribe(() => updateCount++);

      expect(updateCount).toBe(0);

      // Push should trigger update
      store.comments.push(createCommentEntity("c1", "Test", 1));
      expect(updateCount).toBe(1);

      // Property change should trigger update
      store.comments[0].data.message = "Updated";
      expect(updateCount).toBe(2);

      // Splice should trigger update
      store.comments.splice(0, 1);
      expect(updateCount).toBe(3);

      unsubscribe();
    });

    test("multiple array types work independently", () => {
      let updateCount = 0;
      const unsubscribe = store.subscribe(() => updateCount++);

      const comment = createCommentEntity("c1", "Comment", 1);
      const review = createReviewEntity("r1", "Review", "pending");

      store.comments.push(comment);
      store.reviews.push(review);

      expect(store.comments).toHaveLength(1);
      expect(store.reviews).toHaveLength(1);
      expect(updateCount).toBe(2);

      unsubscribe();
    });
  });

  describe("Standard Array Methods", () => {
    test("can use find() to locate entities", () => {
      const comment1 = createCommentEntity("c1", "First", 10);
      const comment2 = createCommentEntity("c2", "Second", 20);

      store.comments.push(comment1, comment2);

      const found = store.comments.find((c) => c.id === "c2");
      expect(found?.id).toBe("c2");
      expect(found?.data.message).toBe("Second");
    });

    test("can use filter() to query entities", () => {
      const comment1 = createCommentEntity("c1", "TODO: Fix bug", 10);
      const comment2 = createCommentEntity("c2", "Great work!", 20);
      const comment3 = createCommentEntity("c3", "TODO: Add tests", 30);

      store.comments.push(comment1, comment2, comment3);

      const todoComments = store.comments.filter((c) =>
        c.data.message.includes("TODO")
      );

      expect(todoComments).toHaveLength(2);
      expect(todoComments[0].id).toBe("c1");
      expect(todoComments[1].id).toBe("c3");
    });

    test("can use map() to transform data", () => {
      const comment1 = createCommentEntity("c1", "First", 10);
      const comment2 = createCommentEntity("c2", "Second", 20);

      store.comments.push(comment1, comment2);

      const messages = store.comments.map((c) => c.data.message);
      expect(messages).toEqual(["First", "Second"]);
    });

    test("can use sort() to order entities", () => {
      const comment1 = createCommentEntity("c1", "First", 30);
      const comment2 = createCommentEntity("c2", "Second", 10);
      const comment3 = createCommentEntity("c3", "Third", 20);

      store.comments.push(comment1, comment2, comment3);

      const sorted = [...store.comments].sort(
        (a, b) => a.data.lineNumber - b.data.lineNumber
      );

      expect(sorted[0].data.lineNumber).toBe(10);
      expect(sorted[1].data.lineNumber).toBe(20);
      expect(sorted[2].data.lineNumber).toBe(30);
    });
  });

  describe("Error Handling", () => {
    test("handles subscriber errors gracefully", () => {
      const erroringSubscriber = () => {
        throw new Error("Subscriber error");
      };

      let normalUpdates = 0;
      const normalSubscriber = () => normalUpdates++;

      const unsubscribe1 = store.subscribe(erroringSubscriber);
      const unsubscribe2 = store.subscribe(normalSubscriber);

      // Should not crash when triggering updates
      expect(() => {
        store.comments.push(createCommentEntity("c1", "Test", 1));
      }).not.toThrow();

      // Normal subscriber should still work
      expect(normalUpdates).toBe(1);

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe("Type Conversion", () => {
    test("handles singular to plural conversion", () => {
      // Both should work
      expect(Array.isArray(store.comment)).toBe(true);
      expect(Array.isArray(store.comments)).toBe(true);

      // They should be the same array
      const comment = createCommentEntity("c1", "Test", 1);
      store.comments.push(comment);

      expect(store.comment).toHaveLength(1);
      expect(store.comment[0].id).toBe("c1");
    });
  });
});
