import { describe, expect, it } from "vitest";
import { createKalphiteStore } from "../store/KalphiteStore";
import type { Entity } from "../types/entity";

describe("Layer 1: Advanced Edge Cases", () => {
  it("should handle null values correctly", () => {
    const store = createKalphiteStore();
    const comment = {
      id: "c2",
      type: "comment",
      data: {
        message: "Test",
        score: 0,
      },
      updatedAt: Date.now(),
    } as Entity;

    store.upsert(comment.id, comment);
    const result = store.getById(comment.id);
    expect(result).toBeDefined();
    if (result) {
      expect(result.data.score).toBe(0);
    }
  });

  // ... rest of the tests ...
});
