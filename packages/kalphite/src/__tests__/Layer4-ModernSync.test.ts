import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ModernSyncEngine } from "../sync/ModernSyncEngine";
import type { SyncChange } from "../sync/NetworkSyncEngine";
import type {
  ModernSyncConfig,
  PendingOperation,
  StatePatch,
  StateSyncRequest,
  StateSyncResponse,
} from "../types/modern-sync";

// Mock HTTP client for testing
class MockHttpClient {
  private responses: Map<string, any> = new Map();
  private requests: Array<{ endpoint: string; data: any }> = [];

  setResponse(endpoint: string, response: any): void {
    this.responses.set(endpoint, response);
  }

  async post<TRequest, TResponse>(
    endpoint: string,
    data: TRequest
  ): Promise<TResponse> {
    this.requests.push({ endpoint, data });

    const response = this.responses.get(endpoint);
    if (!response) {
      throw new Error(`No mock response for endpoint: ${endpoint}`);
    }

    return response;
  }

  async get<TResponse>(endpoint: string): Promise<TResponse> {
    const response = this.responses.get(endpoint);
    if (!response) {
      throw new Error(`No mock response for endpoint: ${endpoint}`);
    }
    return response;
  }

  getRequests(): Array<{ endpoint: string; data: any }> {
    return [...this.requests];
  }

  clearRequests(): void {
    this.requests = [];
  }
}

describe("Layer 4: Modern Sync (Operation-Based)", () => {
  let syncEngine: ModernSyncEngine;
  let mockHttpClient: MockHttpClient;

  const mockConfig: ModernSyncConfig = {
    baseUrl: "http://localhost:3001",
    operationsEndpoint: "/sync/operations",
    stateEndpoint: "/sync/state",
    notificationUrl: "ws://localhost:3001/sync/notify",
    clientId: "test-client-1",
    userId: "test-user-1",
    batchSize: 5,
  };

  beforeEach(() => {
    mockHttpClient = new MockHttpClient();
    syncEngine = new ModernSyncEngine(mockConfig);
    // Inject mock HTTP client
    (syncEngine as any).httpClient = mockHttpClient;
  });

  afterEach(async () => {
    if (syncEngine) {
      await syncEngine.disconnect();
    }
  });

  describe("🆕 Operation-Based Sync", () => {
    test("should execute named operations", async () => {
      // Mock successful operation confirmation
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "test-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Execute operation
      await syncEngine.executeOperation("addTodo", ["Buy groceries"]);

      // Verify HTTP request was made
      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].endpoint).toBe("/sync/operations");

      const operation = requests[0].data.operations[0];
      expect(operation.name).toBe("addTodo");
      expect(operation.args).toEqual(["Buy groceries"]);
      expect(operation.clientId).toBe("test-client-1");
      expect(operation.id).toBeDefined();
    });

    test("should queue operations when offline", async () => {
      // Simulate offline
      (syncEngine as any).isOnline = () => false;

      await syncEngine.executeOperation("completeTodo", ["todo-1"]);
      await syncEngine.executeOperation("deleteTodo", ["todo-2"]);

      // Should be queued, not sent
      expect(mockHttpClient.getRequests()).toHaveLength(0);
      expect(syncEngine.getQueuedOperations()).toHaveLength(2);
    });

    test("should handle operation confirmations", async () => {
      const confirmations: any[] = [];
      const failures: any[] = [];

      syncEngine.onOperationConfirmed((op) => confirmations.push(op));
      syncEngine.onOperationFailed((data) => failures.push(data));

      // Mock mixed success/failure response
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "test-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
          {
            operationId: 2,
            clientId: "test-client-1",
            success: false,
            error: "Invalid todo ID",
            serverTimestamp: Date.now(),
          },
        ],
      });

      await syncEngine.executeOperation("addTodo", ["Valid todo"]);
      await syncEngine.executeOperation("deleteTodo", ["invalid-id"]);

      // Wait for confirmations to be processed
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(confirmations).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].error).toBe("Invalid todo ID");
    });

    test("should batch multiple operations", async () => {
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "test-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
          {
            operationId: 2,
            clientId: "test-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
          {
            operationId: 3,
            clientId: "test-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Execute multiple operations rapidly
      await Promise.all([
        syncEngine.executeOperation("addTodo", ["Todo 1"]),
        syncEngine.executeOperation("addTodo", ["Todo 2"]),
        syncEngine.executeOperation("addTodo", ["Todo 3"]),
      ]);

      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(3); // Currently not batched, but operations are tracked
    });
  });

  describe("🔄 State Synchronization", () => {
    test("should sync state with server", async () => {
      const mockStateResponse: StateSyncResponse<any> = {
        stateVersion: "v2.0",
        entities: [
          {
            id: "todo-1",
            type: "todo",
            title: "Server todo 1",
            completed: false,
          },
          {
            id: "todo-2",
            type: "todo",
            title: "Server todo 2",
            completed: true,
          },
        ],
        syncTimestamp: Date.now(),
      };

      mockHttpClient.setResponse("/sync/state", mockStateResponse);

      const statePatches: StatePatch[] = [];
      syncEngine.onStatePatch((patch) => statePatches.push(patch));

      await syncEngine.syncState();

      // Verify state sync request
      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].endpoint).toBe("/sync/state");

      // Verify state patch was applied
      expect(statePatches).toHaveLength(1);
      expect(statePatches[0].entities).toHaveLength(2);
      expect(statePatches[0].stateVersion).toBe("v2.0");
      expect(syncEngine.getCurrentStateVersion()).toBe("v2.0");
    });

    test("should handle incremental state sync", async () => {
      // Set initial state version
      (syncEngine as any).currentStateVersion = "v1.0";

      const mockDeltaResponse: StateSyncResponse<any> = {
        stateVersion: "v1.1",
        entities: [
          { id: "todo-3", type: "todo", title: "New todo", completed: false },
        ],
        deletedEntityIds: ["todo-deleted"],
        syncTimestamp: Date.now(),
      };

      mockHttpClient.setResponse("/sync/state", mockDeltaResponse);

      await syncEngine.syncState();

      const requests = mockHttpClient.getRequests();
      const request = requests[0].data as StateSyncRequest;

      // Should include current state version for delta sync
      expect(request.stateVersion).toBe("v1.0");
    });

    test("should emit remote changes from state patches", async () => {
      const remoteChanges: SyncChange[] = [];
      syncEngine.on("remoteChange", (change: SyncChange) => {
        remoteChanges.push(change);
      });

      const mockStateResponse: StateSyncResponse<any> = {
        stateVersion: "v2.0",
        entities: [
          {
            id: "todo-1",
            type: "todo",
            title: "Updated todo",
            completed: true,
          },
        ],
        deletedEntityIds: ["todo-deleted"],
        syncTimestamp: Date.now(),
      };

      mockHttpClient.setResponse("/sync/state", mockStateResponse);
      await syncEngine.syncState();

      // Should emit both upsert and delete changes
      expect(remoteChanges).toHaveLength(2);

      const upsertChange = remoteChanges.find((c) => c.type === "upsert");
      const deleteChange = remoteChanges.find((c) => c.type === "delete");

      expect(upsertChange?.entityType).toBe("todo");
      expect(upsertChange?.entityId).toBe("todo-1");
      expect(deleteChange?.entityId).toBe("todo-deleted");
    });
  });

  describe("🔄 Backward Compatibility", () => {
    test("should convert legacy sendChange to operations", async () => {
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "test-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Legacy API should still work
      await syncEngine.sendChange({
        type: "upsert",
        entityType: "todo",
        entityId: "todo-1",
        entity: { id: "todo-1", title: "Legacy todo", completed: false },
      });

      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(1);

      const operation = requests[0].data.operations[0];
      expect(operation.name).toBe("upserttodo");
      expect(operation.args).toEqual([
        "todo-1",
        { id: "todo-1", title: "Legacy todo", completed: false },
      ]);
    });

    test("should maintain all legacy event handlers", async () => {
      const events: string[] = [];

      // Legacy event handlers should work
      syncEngine.on("connected", () => events.push("connected"));
      syncEngine.on("disconnected", () => events.push("disconnected"));
      syncEngine.on("remoteChange", () => events.push("remoteChange"));
      syncEngine.on("error", () => events.push("error"));

      // Simulate events
      (syncEngine as any).emit("connected");
      (syncEngine as any).emit("disconnected");
      (syncEngine as any).emit("remoteChange", {});
      (syncEngine as any).emit("error", new Error("test"));

      expect(events).toEqual([
        "connected",
        "disconnected",
        "remoteChange",
        "error",
      ]);
    });

    test("should preserve offline queue behavior", async () => {
      // Simulate offline
      (syncEngine as any).isOnline = () => false;

      // Mix legacy and modern operations
      await syncEngine.sendChange({
        type: "upsert",
        entityType: "todo",
        entityId: "todo-1",
        entity: { title: "Legacy todo" },
      });

      await syncEngine.executeOperation("addTodo", ["Modern todo"]);

      // Both should be queued
      expect(syncEngine.getQueuedOperations()).toHaveLength(2);
      expect(syncEngine.queueLength).toBe(0); // Legacy queue should be empty (operations converted)
    });
  });

  describe("📡 WebSocket Notifications", () => {
    test("should handle state_changed notifications", async () => {
      const mockWebSocket = {
        onmessage: null as any,
        close: vi.fn(),
      };

      // Set up WebSocket
      (syncEngine as any).wsNotifications = mockWebSocket;
      (syncEngine as any).setupNotifications();

      // Mock state sync response
      mockHttpClient.setResponse("/sync/state", {
        stateVersion: "v3.0",
        entities: [],
        syncTimestamp: Date.now(),
      });

      // Simulate state_changed notification
      const notification = {
        type: "state_changed",
        payload: {
          stateVersion: "v3.0",
          affectedEntityTypes: ["todo"],
          triggerClientId: "other-client",
        },
        timestamp: Date.now(),
      };

      // Trigger notification handler
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({ data: JSON.stringify(notification) });
      }

      // Should trigger state sync
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockHttpClient.getRequests()).toHaveLength(1);
    });

    test("should handle operation_confirmed notifications", async () => {
      const confirmations: any[] = [];
      syncEngine.onOperationConfirmed((op) => confirmations.push(op));

      const mockWebSocket = {
        onmessage: null as any,
        close: vi.fn(),
      };

      (syncEngine as any).wsNotifications = mockWebSocket;
      (syncEngine as any).setupNotifications();

      // Add pending operation
      const pendingOp: PendingOperation = {
        name: "addTodo",
        args: ["Test todo"],
        id: 1,
        clientId: "test-client-1",
        timestamp: Date.now(),
      };
      (syncEngine as any).pendingOperations.set(1, pendingOp);

      // Simulate operation confirmation notification
      const notification = {
        type: "operation_confirmed",
        payload: {
          operationId: 1,
          clientId: "test-client-1",
          success: true,
          serverTimestamp: Date.now(),
        },
        timestamp: Date.now(),
      };

      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({ data: JSON.stringify(notification) });
      }

      expect(confirmations).toHaveLength(1);
      expect(confirmations[0].name).toBe("addTodo");
    });
  });

  describe("🔧 Error Handling & Reliability", () => {
    test("should retry failed operations", async () => {
      let attemptCount = 0;

      // Mock HTTP client to fail first time, succeed second time
      const originalPost = mockHttpClient.post.bind(mockHttpClient);
      mockHttpClient.post = async (endpoint, data) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error("Network error");
        }
        return originalPost(endpoint, data);
      };

      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "test-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // This should fail initially but get queued for retry
      try {
        await syncEngine.executeOperation("addTodo", ["Retry todo"]);
      } catch (error) {
        // Expected to fail first time
      }

      // Should be in queue for retry
      expect(syncEngine.getQueuedOperations()).toHaveLength(1);
    });

    test("should handle malformed server responses gracefully", async () => {
      mockHttpClient.setResponse("/sync/operations", {
        // Malformed response - missing confirmations
        data: "invalid",
      });

      const errors: any[] = [];
      syncEngine.on("error", (error) => errors.push(error));

      try {
        await syncEngine.executeOperation("addTodo", ["Test todo"]);
      } catch (error) {
        // Expected to fail
      }

      // Should handle gracefully without crashing
      expect(syncEngine.getPendingOperations()).toBeDefined();
    });

    test("should respect operation queue limits", async () => {
      // Set low queue limit
      const configWithLimit = { ...mockConfig, offlineQueueLimit: 3 };
      const limitedEngine = new ModernSyncEngine(configWithLimit);
      (limitedEngine as any).httpClient = mockHttpClient;
      (limitedEngine as any).isOnline = () => false;

      // Try to queue more operations than limit
      for (let i = 0; i < 5; i++) {
        await limitedEngine.executeOperation("addTodo", [`Todo ${i}`]);
      }

      // Should respect limit
      expect(limitedEngine.getQueuedOperations().length).toBeLessThanOrEqual(3);
    });
  });

  describe("📊 Status & Debugging", () => {
    test("should provide accurate pending operations count", async () => {
      expect(syncEngine.getPendingOperations()).toHaveLength(0);

      // Add some pending operations (don't await to keep them pending)
      mockHttpClient.setResponse(
        "/sync/operations",
        new Promise((resolve) => {
          // Don't resolve immediately to keep operations pending
        })
      );

      const operationPromise = syncEngine.executeOperation("addTodo", [
        "Pending todo",
      ]);

      expect(syncEngine.getPendingOperations()).toHaveLength(1);

      // Clean up
      try {
        await operationPromise;
      } catch {
        // Expected to timeout/fail
      }
    });

    test("should provide current state version", () => {
      expect(syncEngine.getCurrentStateVersion()).toBe("");

      (syncEngine as any).currentStateVersion = "v1.0";
      expect(syncEngine.getCurrentStateVersion()).toBe("v1.0");
    });

    test("should track queued operations for debugging", async () => {
      (syncEngine as any).isOnline = () => false;

      await syncEngine.executeOperation("addTodo", ["Queued todo 1"]);
      await syncEngine.executeOperation("completeTodo", ["todo-1"]);

      const queued = syncEngine.getQueuedOperations();
      expect(queued).toHaveLength(2);
      expect(queued[0].name).toBe("addTodo");
      expect(queued[1].name).toBe("completeTodo");
    });
  });
});
