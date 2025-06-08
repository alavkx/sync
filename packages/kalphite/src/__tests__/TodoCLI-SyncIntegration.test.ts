import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createKalphiteStore } from "../store/KalphiteStore";
import { OperationSyncEngine } from "../sync/OperationSyncEngine";
import type { OperationSyncConfig } from "../types/operation-sync";

// Todo CLI entity types
interface TodoEntity {
  id: string;
  type: "todo";
  data: {
    title: string;
    description?: string;
    completed: boolean;
    priority: "low" | "medium" | "high";
    dueDate?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    userId?: string;
  };
}

interface ProjectEntity {
  id: string;
  type: "project";
  data: {
    name: string;
    color: string;
    createdAt: string;
    todoIds: string[];
    collaborators: string[];
  };
}

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

  getRequests(): Array<{ endpoint: string; data: any }> {
    return [...this.requests];
  }

  clearRequests(): void {
    this.requests = [];
  }
}

describe("Todo CLI: Sync Integration", () => {
  let store: any;
  let syncEngine: OperationSyncEngine;
  let mockHttpClient: MockHttpClient;

  const config: OperationSyncConfig = {
    baseUrl: "http://localhost:3000",
    operationsEndpoint: "/sync/operations",
    stateEndpoint: "/sync/state",
    notificationUrl: "ws://localhost:3000/ws",
    wsUrl: "ws://localhost:3000/ws",
    roomId: "test-room",
    clientId: "test-client",
    userId: "test-user",
    batchSize: 10,
    offlineQueueLimit: 1000,
  };

  // Helper functions
  const createTodo = (
    id: string,
    title: string,
    options: Partial<TodoEntity["data"]> = {}
  ): TodoEntity => ({
    id,
    type: "todo",
    data: {
      title,
      completed: false,
      priority: "medium",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: "user-1",
      ...options,
    },
  });

  const createProject = (
    id: string,
    name: string,
    options: Partial<ProjectEntity["data"]> = {}
  ): ProjectEntity => ({
    id,
    type: "project",
    data: {
      name,
      color: "#3498db",
      createdAt: new Date().toISOString(),
      todoIds: [],
      collaborators: ["user-1"],
      ...options,
    },
  });

  beforeEach(() => {
    store = createKalphiteStore(undefined, { syncConfig: config });
    syncEngine = new OperationSyncEngine(config);
    mockHttpClient = new MockHttpClient();

    // Inject mock HTTP client
    (syncEngine as any).httpClient = mockHttpClient;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await syncEngine.disconnect();
  });

  describe("🆕 Operation-Based Todo Operations", () => {
    test("should sync todo creation across clients", async () => {
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "cli-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Create todo locally
      const todo = createTodo("todo-1", "Implement user authentication", {
        priority: "high",
        tags: ["backend", "security"],
        dueDate: "2024-02-15",
      });

      store.todo.push(todo);

      // Execute operation
      await syncEngine.executeOperation("createTodo", [
        todo.id,
        todo.data.title,
        todo.data.priority,
        todo.data.tags,
        todo.data.dueDate,
      ]);

      // Verify operation was sent
      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].data.operations[0].name).toBe("createTodo");
      expect(requests[0].data.operations[0].args).toEqual([
        todo.id,
        todo.data.title,
        todo.data.priority,
        todo.data.tags,
        todo.data.dueDate,
      ]);
    });

    test("should handle todo updates and project associations", async () => {
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "cli-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
          {
            operationId: 2,
            clientId: "cli-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Create project and todo
      const project = createProject("proj-1", "Authentication");
      const todo = createTodo("todo-1", "Implement OAuth");

      store.project.push(project);
      store.todo.push(todo);

      // Update todo and associate with project
      await syncEngine.executeOperation("updateTodo", [
        todo.id,
        {
          completed: true,
          priority: "high",
          tags: ["oauth", "security"],
        },
      ]);

      await syncEngine.executeOperation("addTodoToProject", [
        project.id,
        todo.id,
      ]);

      // Verify operations were sent
      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(2);
      expect(requests[0].data.operations[0].name).toBe("updateTodo");
      expect(requests[1].data.operations[0].name).toBe("addTodoToProject");
    });

    test("should handle offline operations and queue management", async () => {
      // Simulate offline state
      (syncEngine as any).isOnline = () => false;

      // Execute operations while offline
      await syncEngine.executeOperation("createTodo", [
        "offline-todo-1",
        "Work on documentation",
        "medium",
      ]);

      await syncEngine.executeOperation("createTodo", [
        "offline-todo-2",
        "Fix offline bugs",
        "high",
      ]);

      await syncEngine.executeOperation("updateTodo", [
        "offline-todo-1",
        { tags: ["docs", "writing"] },
      ]);

      // Verify operations are queued
      const queuedOps = syncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(3);
      expect(queuedOps[0].name).toBe("createTodo");
      expect(queuedOps[1].name).toBe("createTodo");
      expect(queuedOps[2].name).toBe("updateTodo");

      // No HTTP requests should have been made
      expect(mockHttpClient.getRequests()).toHaveLength(0);
    });

    test("should sync queued operations when coming back online", async () => {
      // Start offline and queue operations
      (syncEngine as any).isOnline = () => false;

      await syncEngine.executeOperation("createProject", [
        "offline-proj-1",
        "Offline Work",
        "#34495e",
      ]);

      await syncEngine.executeOperation("createTodo", [
        "offline-todo-1",
        "Implement offline sync",
        "high",
      ]);

      expect(syncEngine.getQueuedOperations()).toHaveLength(2);

      // Mock successful sync responses
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "cli-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
          {
            operationId: 2,
            clientId: "cli-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Come back online and flush queue
      (syncEngine as any).isOnline = () => true;
      await syncEngine.flush();

      // Verify operations were sent
      const requests = mockHttpClient.getRequests();
      expect(requests.length).toBeGreaterThanOrEqual(1); // At least one batch was sent
      expect(syncEngine.getQueuedOperations()).toHaveLength(0); // Queue should be empty
    });

    test("should handle operation failures and retry logic", async () => {
      const failures: any[] = [];
      syncEngine.onOperationFailed((data) => failures.push(data));

      // Mock mixed success/failure response
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "cli-client-1",
            success: false,
            error: "Invalid todo ID format",
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Execute operation that will fail
      await syncEngine.executeOperation("updateTodo", [
        "invalid-id-format",
        { completed: true },
      ]);

      // Wait for failure processing
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(failures).toHaveLength(1);
      expect(failures[0].error).toBe("Invalid todo ID format");
      expect(failures[0].operation.name).toBe("updateTodo");
    });
  });

  describe("📊 Real-World Performance & Reliability", () => {
    test("should respect queue limits under memory pressure", async () => {
      const limitedEngine = new OperationSyncEngine({
        ...config,
        offlineQueueLimit: 3,
      });
      (limitedEngine as any).httpClient = mockHttpClient;
      (limitedEngine as any).isOnline = () => false;

      // Try to queue more operations than limit
      for (let i = 0; i < 10; i++) {
        await limitedEngine.executeOperation("createTodo", [
          `todo-limited-${i}`,
          `Limited todo ${i}`,
          "low",
        ]);
      }

      // Should respect queue limit by dropping oldest operations
      expect(limitedEngine.getQueuedOperations()).toHaveLength(3);

      // Should contain the last 3 operations
      const queuedOps = limitedEngine.getQueuedOperations();
      expect(queuedOps[0].args[0]).toBe("todo-limited-7");
      expect(queuedOps[1].args[0]).toBe("todo-limited-8");
      expect(queuedOps[2].args[0]).toBe("todo-limited-9");

      await limitedEngine.disconnect();
    });

    test("should maintain data consistency during network interruptions", async () => {
      let isOnline = true;
      (syncEngine as any).isOnline = () => isOnline;

      const confirmations: any[] = [];
      syncEngine.onOperationConfirmed((op) => confirmations.push(op));

      // Start with online operations
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "cli-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      await syncEngine.executeOperation("createTodo", [
        "todo-consistent-1",
        "Online todo",
        "medium",
      ]);

      // Go offline
      isOnline = false;

      await syncEngine.executeOperation("createTodo", [
        "todo-consistent-2",
        "Offline todo",
        "high",
      ]);

      // Come back online
      isOnline = true;
      mockHttpClient.clearRequests();
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 2,
            clientId: "cli-client-1",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      await syncEngine.flush();

      // Verify consistency - both operations should eventually be confirmed
      expect(confirmations.length).toBeGreaterThanOrEqual(1); // At least the online operation confirmed

      const requests = mockHttpClient.getRequests();
      expect(requests.length).toBeGreaterThanOrEqual(1); // At least the offline operation sent when back online

      // Find the offline todo in the requests
      const offlineRequest = requests.find((req) =>
        req.data.operations.some(
          (op: any) => op.args[0] === "todo-consistent-2"
        )
      );
      expect(offlineRequest).toBeDefined();
    });
  });

  it("should handle sync configuration", () => {
    const config: OperationSyncConfig = {
      baseUrl: "http://localhost:3000",
      operationsEndpoint: "/sync/operations",
      stateEndpoint: "/sync/state",
      notificationUrl: "ws://localhost:3000/ws",
      wsUrl: "ws://localhost:3000/ws",
      roomId: "test-room",
      clientId: "test-client",
      userId: "test-user",
      batchSize: 10,
      offlineQueueLimit: 1000,
    };

    const store = createKalphiteStore(undefined, { syncConfig: config });
    expect(store).toBeDefined();
  });
});
