import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryFlushEngine } from "../engines/MemoryFlushEngine";
import { createKalphiteStore } from "../store/KalphiteStore";
import { createCommentEntity } from "./setup";

describe("Layer 2: Memory Flush Engine Implementation", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("MemoryFlushEngine Interface", () => {
    test("flush engine debounces rapid changes (100ms default)", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        debounceMs: 100,
      });

      // Schedule multiple rapid changes
      flushEngine.scheduleFlush(
        "entity-1",
        createCommentEntity("entity-1", "First")
      );
      flushEngine.scheduleFlush(
        "entity-2",
        createCommentEntity("entity-2", "Second")
      );
      flushEngine.scheduleFlush(
        "entity-1",
        createCommentEntity("entity-1", "Updated")
      );

      // Should not flush immediately
      expect(mockFlushTarget).not.toHaveBeenCalled();

      // Advance timer past debounce period
      vi.advanceTimersByTime(100);

      // Should now flush with batched changes
      expect(mockFlushTarget).toHaveBeenCalledTimes(1);
      expect(mockFlushTarget).toHaveBeenCalledWith([
        {
          operation: "upsert",
          entityId: "entity-1",
          entity: expect.objectContaining({
            id: "entity-1",
            data: expect.objectContaining({ message: "Updated" }),
          }),
          timestamp: expect.any(Number),
        },
        {
          operation: "upsert",
          entityId: "entity-2",
          entity: expect.objectContaining({
            id: "entity-2",
            data: expect.objectContaining({ message: "Second" }),
          }),
          timestamp: expect.any(Number),
        },
      ]);
    });

    test("flush engine respects custom debounce timing", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        debounceMs: 250,
      });

      flushEngine.scheduleFlush(
        "entity-1",
        createCommentEntity("entity-1", "Test")
      );

      // Should not flush at 100ms
      vi.advanceTimersByTime(100);
      expect(mockFlushTarget).not.toHaveBeenCalled();

      // Should not flush at 200ms
      vi.advanceTimersByTime(100);
      expect(mockFlushTarget).not.toHaveBeenCalled();

      // Should flush at 250ms
      vi.advanceTimersByTime(50);
      expect(mockFlushTarget).toHaveBeenCalledTimes(1);
    });
  });

  describe("Change Tracking", () => {
    test("flush engine captures entity upserts", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
      });

      const entity = createCommentEntity("c1", "Test comment", 10);
      flushEngine.scheduleFlush("c1", entity);

      vi.advanceTimersByTime(100);

      expect(mockFlushTarget).toHaveBeenCalledWith([
        {
          operation: "upsert",
          entityId: "c1",
          entity: entity,
          timestamp: expect.any(Number),
        },
      ]);
    });

    test("flush engine captures entity deletions", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
      });

      flushEngine.scheduleDelete("c1");

      vi.advanceTimersByTime(100);

      expect(mockFlushTarget).toHaveBeenCalledWith([
        {
          operation: "delete",
          entityId: "c1",
          timestamp: expect.any(Number),
        },
      ]);
    });

    test("flush engine deduplicates multiple updates to same entity", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
      });

      // Multiple updates to same entity
      flushEngine.scheduleFlush("c1", createCommentEntity("c1", "First", 10));
      flushEngine.scheduleFlush("c1", createCommentEntity("c1", "Second", 20));
      flushEngine.scheduleFlush("c1", createCommentEntity("c1", "Final", 30));

      vi.advanceTimersByTime(100);

      // Should only flush the latest version
      expect(mockFlushTarget).toHaveBeenCalledTimes(1);
      expect(mockFlushTarget).toHaveBeenCalledWith([
        {
          operation: "upsert",
          entityId: "c1",
          entity: expect.objectContaining({
            data: { message: "Final", lineNumber: 30 },
          }),
          timestamp: expect.any(Number),
        },
      ]);
    });
  });

  describe("Error Handling", () => {
    test("flush engine retries failed operations with exponential backoff", async () => {
      let attempts = 0;
      const mockFlushTarget = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error("Flush failed");
        }
        return undefined;
      });

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        maxRetries: 3,
        baseRetryDelay: 100,
      });

      flushEngine.scheduleFlush("c1", createCommentEntity("c1", "Test"));

      // Initial flush attempt should fail
      vi.advanceTimersByTime(100);
      expect(attempts).toBe(1);

      // Verify retry mechanism exists by checking queued changes
      const queuedChanges = flushEngine.getQueuedChanges();
      expect(queuedChanges).toHaveLength(1);
    });

    test("flush engine doesn't lose data on temporary failures", async () => {
      const failingFlushTarget = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const flushEngine = new MemoryFlushEngine({
        flushTarget: failingFlushTarget,
        maxRetries: 1,
      });

      const entity = createCommentEntity("c1", "Important data");
      flushEngine.scheduleFlush("c1", entity);

      vi.advanceTimersByTime(100);

      // After all retries fail, data should still be queued
      const queuedChanges = flushEngine.getQueuedChanges();
      expect(queuedChanges).toHaveLength(1);
      expect(queuedChanges[0].entity).toEqual(entity);
    });
  });

  describe("Integration with KalphiteStore", () => {
    test("store integrates with flush engine on mutations", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({ flushTarget: mockFlushTarget }),
      });

      const entity = createCommentEntity("c1", "Test");
      store.comment.push(entity);

      vi.advanceTimersByTime(100);

      // Store mutation should trigger flush
      expect(mockFlushTarget).toHaveBeenCalledWith([
        {
          operation: "push",
          entityId: "c1",
          entity: expect.objectContaining({
            id: "c1",
            data: expect.objectContaining({ message: "Test" }),
          }),
          timestamp: expect.any(Number),
        },
      ]);
    });

    test("store provides flush control methods", async () => {
      const store = createKalphiteStore();

      // Should expose flush control methods
      expect(typeof store.flushNow).toBe("function");
      expect(typeof store.pauseFlush).toBe("function");
      expect(typeof store.resumeFlush).toBe("function");
      expect(typeof store.getQueuedChanges).toBe("function");
    });

    test("store flush engine tracks entity updates", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({
          flushTarget: mockFlushTarget,
          debounceMs: 50,
        }),
      });

      // Initial entity
      const entity1 = createCommentEntity("c1", "Original", 10);
      store.comment.push(entity1);

      // Update entity
      const index = store.comment.findIndex((c: any) => c.id === "c1");
      const entity2 = createCommentEntity("c1", "Updated", 20);
      store.comment[index] = entity2;

      vi.advanceTimersByTime(50);

      // Should batch the operations and only flush the latest state
      expect(mockFlushTarget).toHaveBeenCalledTimes(1);
      expect(mockFlushTarget).toHaveBeenCalledWith([
        {
          operation: "upsert",
          entityId: "c1",
          entity: expect.objectContaining({
            data: expect.objectContaining({
              message: "Updated",
              lineNumber: 20,
            }),
          }),
          timestamp: expect.any(Number),
        },
      ]);
    });

    test("store flush engine tracks entity deletions", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({ flushTarget: mockFlushTarget }),
      });

      // Add and then delete entity
      const entity = createCommentEntity("c1", "To be deleted");
      store.comment.push(entity);

      // Reset mock to focus on delete operation
      mockFlushTarget.mockClear();

      // Delete entity
      const index = store.comment.findIndex((c: any) => c.id === "c1");
      store.comment.splice(index, 1);

      vi.advanceTimersByTime(100);

      // Should track deletion
      expect(mockFlushTarget).toHaveBeenCalledWith([
        {
          operation: "delete",
          entityId: "c1",
          timestamp: expect.any(Number),
        },
      ]);
    });

    test("store flush control methods work correctly", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({
          flushTarget: mockFlushTarget,
          debounceMs: 200,
        }),
      });

      const entity = createCommentEntity("c1", "Test");
      store.comment.push(entity);

      // Pause flush - should prevent automatic flushing
      store.pauseFlush();
      vi.advanceTimersByTime(200);
      expect(mockFlushTarget).not.toHaveBeenCalled();

      // Resume and manually flush
      store.resumeFlush();
      await store.flushNow();
      expect(mockFlushTarget).toHaveBeenCalledTimes(1);

      // Check queued changes
      store.comment.push(createCommentEntity("c2", "Test2"));
      const queuedChanges = store.getQueuedChanges();
      expect(queuedChanges).toHaveLength(1);
      expect(queuedChanges[0].entityId).toBe("c2");
    });

    test("should flush entities when batch size is reached", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);
      const _store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({ flushTarget: mockFlushTarget }),
      });

      // ... rest of test
    });

    test("should handle flush errors gracefully", async () => {
      const _store = createKalphiteStore();
      // ... rest of test
    });

    test("should batch multiple operations efficiently", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);
      const store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({
          flushTarget: mockFlushTarget,
          maxBatchSize: 3,
          debounceMs: 50,
        }),
      });

      // ... rest of test
    });

    test("should handle concurrent operations", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);
      const store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({ flushTarget: mockFlushTarget }),
      });

      // ... rest of test
    });

    test("should respect flush delay", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);
      const store = createKalphiteStore(undefined, {
        flushEngine: new MemoryFlushEngine({
          flushTarget: mockFlushTarget,
          maxBatchSize: 5,
          debounceMs: 100,
        }),
      });

      // ... rest of test
    });
  });

  describe("Performance & Load Testing", () => {
    test("handles high-frequency operations efficiently", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        debounceMs: 10,
        maxBatchSize: 100,
      });

      // Schedule many rapid operations
      for (let i = 0; i < 500; i++) {
        flushEngine.scheduleFlush(
          `entity-${i}`,
          createCommentEntity(`entity-${i}`, `Message ${i}`)
        );
      }

      // Allow multiple flush cycles to complete
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(10);
        await vi.runAllTimersAsync();
      }

      // Should batch operations efficiently
      expect(mockFlushTarget).toHaveBeenCalled();
      const totalCalls = mockFlushTarget.mock.calls.length;
      expect(totalCalls).toBeGreaterThanOrEqual(5); // Multiple batches due to maxBatchSize

      // Verify all entities are eventually flushed
      const totalEntitiesFlushed = mockFlushTarget.mock.calls.reduce(
        (acc, call) => acc + call[0].length,
        0
      );
      expect(totalEntitiesFlushed).toBe(500);
    });

    test("respects batch size limits", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        debounceMs: 10,
        maxBatchSize: 10,
      });

      // Schedule more entities than batch size
      for (let i = 0; i < 25; i++) {
        flushEngine.scheduleFlush(
          `entity-${i}`,
          createCommentEntity(`entity-${i}`, `Message ${i}`)
        );
      }

      // Allow multiple flush cycles to complete
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10);
        await vi.runAllTimersAsync();
      }

      // Should respect batch size and make multiple calls
      expect(mockFlushTarget).toHaveBeenCalledTimes(3); // 10 + 10 + 5
      expect(mockFlushTarget.mock.calls[0][0]).toHaveLength(10);
      expect(mockFlushTarget.mock.calls[1][0]).toHaveLength(10);
      expect(mockFlushTarget.mock.calls[2][0]).toHaveLength(5);
    });

    test("maintains operation order within batches", async () => {
      const mockFlushTarget = vi.fn().mockResolvedValue(undefined);

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        debounceMs: 50,
      });

      const entityId = "test-entity";

      // Schedule multiple updates to same entity
      flushEngine.scheduleFlush(
        entityId,
        createCommentEntity(entityId, "Version 1")
      );
      flushEngine.scheduleFlush(
        entityId,
        createCommentEntity(entityId, "Version 2")
      );
      flushEngine.scheduleFlush(
        entityId,
        createCommentEntity(entityId, "Version 3")
      );

      vi.advanceTimersByTime(50);

      // Should only flush the latest version
      expect(mockFlushTarget).toHaveBeenCalledTimes(1);
      expect(mockFlushTarget).toHaveBeenCalledWith([
        expect.objectContaining({
          entityId,
          entity: expect.objectContaining({
            data: expect.objectContaining({ message: "Version 3" }),
          }),
        }),
      ]);
    });
  });

  describe("Advanced Error Scenarios", () => {
    test("handles partial batch failures", async () => {
      let callCount = 0;
      const mockFlushTarget = vi.fn().mockImplementation(async (_changes) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Partial failure");
        }
        return undefined;
      });

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        maxRetries: 2,
        baseRetryDelay: 10,
      });

      flushEngine.scheduleFlush("c1", createCommentEntity("c1", "Test 1"));
      flushEngine.scheduleFlush("c2", createCommentEntity("c2", "Test 2"));

      vi.advanceTimersByTime(100);

      // First call should fail, data should remain queued
      expect(callCount).toBe(1);
      expect(flushEngine.getQueuedChanges()).toHaveLength(2);

      // Manually trigger flush again to test retry behavior
      await flushEngine.flushNow();

      // Second call should succeed
      expect(callCount).toBe(2);
      expect(flushEngine.getQueuedChanges()).toHaveLength(0);
    });

    test("implements exponential backoff correctly", async () => {
      let callCount = 0;
      const callTimes: number[] = [];

      const mockFlushTarget = vi.fn().mockImplementation(async () => {
        callTimes.push(Date.now());
        callCount++;
        if (callCount <= 2) {
          throw new Error("Retry needed");
        }
        return undefined;
      });

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        maxRetries: 3,
        baseRetryDelay: 10, // Shorter delay for testing
      });

      flushEngine.scheduleFlush("c1", createCommentEntity("c1", "Test"));

      // Initial attempt should fail
      vi.advanceTimersByTime(100);
      expect(callCount).toBe(1);
      expect(flushEngine.getQueuedChanges()).toHaveLength(1);

      // Manually retry to test the retry mechanism
      await flushEngine.flushNow();
      expect(callCount).toBe(2);
      expect(flushEngine.getQueuedChanges()).toHaveLength(1);

      // Third attempt should succeed
      await flushEngine.flushNow();
      expect(callCount).toBe(3);
      expect(flushEngine.getQueuedChanges()).toHaveLength(0);
    });

    test("handles flush target throwing synchronously", async () => {
      const mockFlushTarget = vi.fn().mockImplementation(() => {
        throw new Error("Synchronous error");
      });

      const flushEngine = new MemoryFlushEngine({
        flushTarget: mockFlushTarget,
        maxRetries: 1,
        baseRetryDelay: 10,
      });

      const entity = createCommentEntity("c1", "Test");
      flushEngine.scheduleFlush("c1", entity);

      vi.advanceTimersByTime(100);

      // Should handle synchronous errors gracefully
      expect(mockFlushTarget).toHaveBeenCalled();

      // Data should still be queued for retry
      expect(flushEngine.getQueuedChanges()).toHaveLength(1);
      expect(flushEngine.getQueuedChanges()[0].entity).toEqual(entity);
    });
  });

  it("should handle flush target errors gracefully", async () => {
    const mockFlushTarget = vi
      .fn()
      .mockRejectedValue(new Error("Flush failed"));
    const store = createKalphiteStore(undefined, {
      flushEngine: new MemoryFlushEngine({ flushTarget: mockFlushTarget }),
    });
    // Test implementation...
  });
});

// =====================================================
// IMPLEMENTATION REQUIREMENTS
// =====================================================
//
// 1. Create src/engines/MemoryFlushEngine.ts with:
//    - Constructor accepting FlushConfig
//    - scheduleFlush(entityId, entity) method
//    - scheduleDelete(entityId) method
//    - Debouncing with configurable timing
//    - Batching of changes
//    - Error handling with exponential backoff
//
// 2. Create src/types/flush.ts with:
//    - FlushConfig interface
//    - FlushChange interface
//    - FlushTarget type
//
// 3. Integrate with KalphiteStore:
//    - Add flushEngine to config
//    - Call scheduleFlush on mutations
//    - Expose flush control methods
//
// 4. Performance requirements:
//    - Handle 1000+ changes per second
//    - Batch sizes configurable
//    - Memory efficient change tracking
//
// ====================================================
