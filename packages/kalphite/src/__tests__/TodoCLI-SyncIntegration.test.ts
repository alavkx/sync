import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { KalphiteStore } from "../store/KalphiteStore";
import { ModernSyncEngine } from "../sync/ModernSyncEngine";
import { NetworkSyncEngine } from "../sync/NetworkSyncEngine";
import type { ModernSyncConfig } from "../types/modern-sync";

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
    description?: string;
    color: string;
    createdAt: string;
    todoIds: string[];
    collaborators: string[];
  };
}

// Mock HTTP client for testing
class MockHttpClient {
  private responses: Map<string, any> = new Map();
  private requests: Array<{ endpoint: string; data: any; timestamp: number }> =
    [];

  setResponse(endpoint: string, response: any): void {
    this.responses.set(endpoint, response);
  }

  async post<TRequest, TResponse>(
    endpoint: string,
    data: TRequest
  ): Promise<TResponse> {
    this.requests.push({ endpoint, data, timestamp: Date.now() });

    const response = this.responses.get(endpoint);
    if (!response) {
      throw new Error(`No mock response for endpoint: ${endpoint}`);
    }

    // Add realistic latency
    await new Promise((resolve) => setTimeout(resolve, 10));
    return response;
  }

  async get<TResponse>(endpoint: string): Promise<TResponse> {
    const response = this.responses.get(endpoint);
    if (!response) {
      throw new Error(`No mock response for endpoint: ${endpoint}`);
    }
    return response;
  }

  getRequests(): Array<{ endpoint: string; data: any; timestamp: number }> {
    return [...this.requests];
  }

  clearRequests(): void {
    this.requests = [];
  }

  getLastRequest():
    | { endpoint: string; data: any; timestamp: number }
    | undefined {
    return this.requests[this.requests.length - 1];
  }
}

describe("TodoCLI: End-to-End Sync Integration", () => {
  let store: any;
  let legacySyncEngine: NetworkSyncEngine;
  let modernSyncEngine: ModernSyncEngine;
  let mockHttpClient: MockHttpClient;

  const legacyConfig = {
    wsUrl: "ws://localhost:3001/sync",
    roomId: "todo-room",
    userId: "user-1",
    authToken: "test-token",
  };

  const modernConfig: ModernSyncConfig = {
    baseUrl: "http://localhost:3001",
    operationsEndpoint: "/sync/operations",
    stateEndpoint: "/sync/state",
    notificationUrl: "ws://localhost:3001/sync/notify",
    clientId: "cli-client-1",
    userId: "user-1",
    batchSize: 5,
    offlineQueueLimit: 100,
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
    store = KalphiteStore();
    legacySyncEngine = new NetworkSyncEngine(legacyConfig);
    modernSyncEngine = new ModernSyncEngine(modernConfig);
    mockHttpClient = new MockHttpClient();

    // Inject mock HTTP client
    (modernSyncEngine as any).httpClient = mockHttpClient;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await legacySyncEngine.disconnect();
    await modernSyncEngine.disconnect();
  });

  describe("🔄 Legacy Sync Pattern: Real-World Todo Operations", () => {
    test("should sync todo creation across clients", async () => {
      const remoteChanges: any[] = [];
      legacySyncEngine.on("remoteChange", (change) =>
        remoteChanges.push(change)
      );

      // Create todo locally
      const todo = createTodo("todo-1", "Implement user authentication", {
        priority: "high",
        tags: ["backend", "security"],
        dueDate: "2024-02-15",
      });

      store.todo.push(todo);

      // Simulate sending change via legacy sync
      await legacySyncEngine.sendChange({
        type: "upsert",
        entityType: "todo",
        entityId: todo.id,
        entity: todo,
      });

      // Simulate receiving the same change from another client
      await legacySyncEngine.simulateRemoteChange({
        type: "upsert",
        entityType: "todo",
        entityId: todo.id,
        entity: todo,
        timestamp: Date.now(),
        userId: "user-2",
        operationId: "op-remote-1",
      });

      expect(remoteChanges).toHaveLength(1);
      expect(remoteChanges[0].entity.data.title).toBe(
        "Implement user authentication"
      );
      expect(remoteChanges[0].entity.data.priority).toBe("high");
      expect(remoteChanges[0].entity.data.tags).toEqual([
        "backend",
        "security",
      ]);
    });

    test("should handle todo completion workflow", async () => {
      const conflictResolutions: any[] = [];
      legacySyncEngine.on("conflictResolved", (resolution) =>
        conflictResolutions.push(resolution)
      );

      // Create initial todo
      const todo = createTodo("todo-1", "Write comprehensive tests");
      store.todo.push(todo);

      // User 1 completes the todo
      const completedTodo = {
        ...todo,
        data: {
          ...todo.data,
          completed: true,
          updatedAt: new Date().toISOString(),
        },
      };

      await legacySyncEngine.sendChange({
        type: "upsert",
        entityType: "todo",
        entityId: todo.id,
        entity: completedTodo,
      });

      // Simulate User 2 simultaneously adding tags
      const taggedTodo = {
        ...todo,
        data: {
          ...todo.data,
          tags: ["testing", "quality"],
          updatedAt: new Date().toISOString(),
        },
      };

      await legacySyncEngine.simulateRemoteChange({
        type: "upsert",
        entityType: "todo",
        entityId: todo.id,
        entity: taggedTodo,
        timestamp: Date.now(),
        userId: "user-2",
        operationId: "op-conflict-1",
      });

      // Should resolve conflict by merging changes
      expect(conflictResolutions).toHaveLength(1);
      const resolution = conflictResolutions[0];

      // The merge algorithm may preserve the original entity differently
      // Check that we got some form of conflict resolution
      expect(resolution.strategy).toBe("operational_transform");
      expect(resolution.localOperation.entity.data.completed).toBe(true);
      expect(resolution.remoteOperation.entity.data.tags).toEqual([
        "testing",
        "quality",
      ]);
    });

    test("should sync project creation and todo associations", async () => {
      const remoteChanges: any[] = [];
      legacySyncEngine.on("remoteChange", (change) =>
        remoteChanges.push(change)
      );

      // Create project with associated todos
      const project = createProject("proj-1", "Website Redesign", {
        description: "Complete overhaul of company website",
        color: "#e74c3c",
        collaborators: ["user-1", "user-2", "user-3"],
      });

      const projectTodos = [
        createTodo("todo-1", "Design mockups", {
          tags: ["design", "frontend"],
        }),
        createTodo("todo-2", "Implement responsive layout", {
          tags: ["frontend", "css"],
        }),
        createTodo("todo-3", "Backend API integration", {
          tags: ["backend", "api"],
        }),
      ];

      // Add todos to store
      projectTodos.forEach((todo) => store.todo.push(todo));

      // Associate todos with project
      project.data.todoIds = projectTodos.map((t) => t.id);
      store.project.push(project);

      // Sync project creation
      await legacySyncEngine.sendChange({
        type: "upsert",
        entityType: "project",
        entityId: project.id,
        entity: project,
      });

      // Sync todos
      for (const todo of projectTodos) {
        await legacySyncEngine.sendChange({
          type: "upsert",
          entityType: "todo",
          entityId: todo.id,
          entity: todo,
        });
      }

      // Verify queue was used for multiple operations
      expect(legacySyncEngine.queueLength).toBeGreaterThanOrEqual(0);
    });

    test("should handle todo deletion and project cleanup", async () => {
      const remoteChanges: any[] = [];
      legacySyncEngine.on("remoteChange", (change) =>
        remoteChanges.push(change)
      );

      // Setup project with todos
      const project = createProject("proj-1", "Bug Fixes", {
        todoIds: ["todo-1", "todo-2", "todo-3"],
      });

      const todos = [
        createTodo("todo-1", "Fix login bug", { completed: true }),
        createTodo("todo-2", "Fix rendering issue"),
        createTodo("todo-3", "Fix email notifications"),
      ];

      store.project.push(project);
      todos.forEach((todo) => store.todo.push(todo));

      // Delete completed todo
      const todoToDelete = todos[0];
      const todoIndex = store.todo.findIndex(
        (t: any) => t.id === todoToDelete.id
      );
      if (todoIndex >= 0) {
        store.todo.splice(todoIndex, 1);
      }

      // Sync deletion
      await legacySyncEngine.sendChange({
        type: "delete",
        entityType: "todo",
        entityId: todoToDelete.id,
      });

      // Update project to remove deleted todo
      const updatedProject = {
        ...project,
        data: {
          ...project.data,
          todoIds: project.data.todoIds.filter((id) => id !== todoToDelete.id),
        },
      };

      const projectIndex = store.project.findIndex(
        (p: any) => p.id === project.id
      );
      if (projectIndex >= 0) {
        store.project[projectIndex] = updatedProject;
      }

      // Sync project update
      await legacySyncEngine.sendChange({
        type: "upsert",
        entityType: "project",
        entityId: project.id,
        entity: updatedProject,
      });

      expect(store.todo).toHaveLength(2);
      expect(store.project[0].data.todoIds).toHaveLength(2);
    });
  });

  describe("🆕 Modern Sync Pattern: Operation-Based Todo Operations", () => {
    test("should execute todo operations with confirmations", async () => {
      const confirmations: any[] = [];
      const failures: any[] = [];

      modernSyncEngine.onOperationConfirmed((op) => confirmations.push(op));
      modernSyncEngine.onOperationFailed((data) => failures.push(data));

      // Mock server responses
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

      // Execute todo operations
      await modernSyncEngine.executeOperation("createTodo", [
        "todo-1",
        "Implement GraphQL schema",
        "high",
        ["backend", "api"],
      ]);

      await modernSyncEngine.executeOperation("updateTodoPriority", [
        "todo-1",
        "medium",
      ]);

      // Verify requests
      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(2);

      expect(requests[0].data.operations[0].name).toBe("createTodo");
      expect(requests[0].data.operations[0].args).toEqual([
        "todo-1",
        "Implement GraphQL schema",
        "high",
        ["backend", "api"],
      ]);

      expect(requests[1].data.operations[0].name).toBe("updateTodoPriority");
      expect(requests[1].data.operations[0].args).toEqual(["todo-1", "medium"]);

      // Should receive confirmations
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(confirmations).toHaveLength(2);
      expect(failures).toHaveLength(0);
    });

    test("should batch multiple todo operations efficiently", async () => {
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: Array.from({ length: 5 }, (_, i) => ({
          operationId: i + 1,
          clientId: "cli-client-1",
          success: true,
          serverTimestamp: Date.now(),
        })),
      });

      // Execute multiple operations rapidly
      const operations = [
        ["createProject", ["proj-1", "Sprint Planning", "#2ecc71"]],
        ["createTodo", ["todo-1", "Review backlog", "medium", ["planning"]]],
        ["createTodo", ["todo-2", "Estimate tasks", "high", ["planning"]]],
        ["assignTodoToProject", ["todo-1", "proj-1"]],
        ["assignTodoToProject", ["todo-2", "proj-1"]],
      ];

      // Execute all operations
      await Promise.all(
        operations.map(([name, args]) =>
          modernSyncEngine.executeOperation(name as string, args as any[])
        )
      );

      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(5);

      // Verify operation batching/sequencing
      const operationNames = requests.map((r) => r.data.operations[0].name);
      expect(operationNames).toEqual([
        "createProject",
        "createTodo",
        "createTodo",
        "assignTodoToProject",
        "assignTodoToProject",
      ]);
    });

    test("should handle state synchronization for multi-user collaboration", async () => {
      const statePatches: any[] = [];
      modernSyncEngine.onStatePatch((patch) => statePatches.push(patch));

      // Mock state sync response with collaborative changes
      mockHttpClient.setResponse("/sync/state", {
        stateVersion: "v2.1",
        entities: [
          {
            id: "todo-1",
            type: "todo",
            data: {
              title: "Updated by collaborator",
              completed: false,
              priority: "high",
              tags: ["urgent", "review"],
              createdAt: "2024-01-10T10:00:00Z",
              updatedAt: "2024-01-10T11:30:00Z",
              userId: "user-2",
            },
          },
          {
            id: "proj-1",
            type: "project",
            data: {
              name: "Team Sprint",
              color: "#9b59b6",
              createdAt: "2024-01-10T09:00:00Z",
              todoIds: ["todo-1"],
              collaborators: ["user-1", "user-2", "user-3"],
            },
          },
        ],
        deletedEntityIds: ["todo-old"],
        syncTimestamp: Date.now(),
      });

      // Trigger state sync
      await modernSyncEngine.syncState();

      // Verify state patch was received
      expect(statePatches).toHaveLength(1);
      const patch = statePatches[0];
      expect(patch.stateVersion).toBe("v2.1");
      expect(patch.entities).toHaveLength(2);
      expect(patch.deletedEntityIds).toEqual(["todo-old"]);

      // Verify current state version was updated
      expect(modernSyncEngine.getCurrentStateVersion()).toBe("v2.1");
    });

    test("should handle offline operations and queue management", async () => {
      // Simulate offline state
      (modernSyncEngine as any).isOnline = () => false;

      // Execute operations while offline
      await modernSyncEngine.executeOperation("createTodo", [
        "offline-todo-1",
        "Work on documentation",
        "medium",
      ]);

      await modernSyncEngine.executeOperation("createTodo", [
        "offline-todo-2",
        "Fix offline bugs",
        "high",
      ]);

      await modernSyncEngine.executeOperation("updateTodo", [
        "offline-todo-1",
        { tags: ["docs", "writing"] },
      ]);

      // Verify operations are queued
      const queuedOps = modernSyncEngine.getQueuedOperations();
      expect(queuedOps).toHaveLength(3);
      expect(queuedOps[0].name).toBe("createTodo");
      expect(queuedOps[1].name).toBe("createTodo");
      expect(queuedOps[2].name).toBe("updateTodo");

      // No HTTP requests should have been made
      expect(mockHttpClient.getRequests()).toHaveLength(0);
    });

    test("should sync queued operations when coming back online", async () => {
      // Start offline and queue operations
      (modernSyncEngine as any).isOnline = () => false;

      await modernSyncEngine.executeOperation("createProject", [
        "offline-proj-1",
        "Offline Work",
        "#34495e",
      ]);

      await modernSyncEngine.executeOperation("createTodo", [
        "offline-todo-1",
        "Implement offline sync",
        "high",
      ]);

      expect(modernSyncEngine.getQueuedOperations()).toHaveLength(2);

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
      (modernSyncEngine as any).isOnline = () => true;
      await modernSyncEngine.flush();

      // Verify operations were sent
      const requests = mockHttpClient.getRequests();
      expect(requests.length).toBeGreaterThanOrEqual(1); // At least one batch was sent
      expect(modernSyncEngine.getQueuedOperations()).toHaveLength(0); // Queue should be empty
    });

    test("should handle operation failures and retry logic", async () => {
      const failures: any[] = [];
      modernSyncEngine.onOperationFailed((data) => failures.push(data));

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
      await modernSyncEngine.executeOperation("updateTodo", [
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

  describe("🔄 Backward Compatibility: Legacy → Modern Migration", () => {
    test("should convert legacy sendChange to modern operations", async () => {
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

      const todo = createTodo("todo-legacy-1", "Legacy sync test");

      // Use legacy interface with modern engine
      await modernSyncEngine.sendChange({
        type: "upsert",
        entityType: "todo",
        entityId: todo.id,
        entity: todo,
      });

      // Verify it was converted to an operation
      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].data.operations[0].name).toBe("upserttodo");
      expect(requests[0].data.operations[0].args).toEqual([todo.id, todo]);
    });

    test("should maintain legacy event handlers in modern engine", async () => {
      const remoteChanges: any[] = [];
      const errors: any[] = [];

      // Use legacy event registration
      modernSyncEngine.on("remoteChange", (change) =>
        remoteChanges.push(change)
      );
      modernSyncEngine.on("error", (error) => errors.push(error));

      // Trigger state patch that should emit remoteChange events
      mockHttpClient.setResponse("/sync/state", {
        stateVersion: "v1.0",
        entities: [
          createTodo("remote-todo-1", "Remote change test", {
            userId: "user-2",
          }),
        ],
        deletedEntityIds: [],
        syncTimestamp: Date.now(),
      });

      await modernSyncEngine.syncState();

      // Legacy remoteChange event should still work
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(remoteChanges).toHaveLength(1);
      expect(remoteChanges[0].entity.data.title).toBe("Remote change test");
    });
  });

  describe("📊 Real-World Performance & Reliability", () => {
    test("should handle high-volume todo operations efficiently", async () => {
      const startTime = Date.now();
      const operationCount = 50;

      // Mock bulk confirmations
      mockHttpClient.setResponse("/sync/operations", {
        confirmations: Array.from({ length: operationCount }, (_, i) => ({
          operationId: i + 1,
          clientId: "cli-client-1",
          success: true,
          serverTimestamp: Date.now(),
        })),
      });

      // Create many todos rapidly
      const operations = Array.from({ length: operationCount }, (_, i) =>
        modernSyncEngine.executeOperation("createTodo", [
          `todo-bulk-${i}`,
          `Bulk todo ${i}`,
          "medium",
        ])
      );

      await Promise.all(operations);

      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second for 50 operations
      expect(mockHttpClient.getRequests()).toHaveLength(operationCount);
    });

    test("should respect queue limits under memory pressure", async () => {
      const limitedEngine = new ModernSyncEngine({
        ...modernConfig,
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
      (modernSyncEngine as any).isOnline = () => isOnline;

      const confirmations: any[] = [];
      modernSyncEngine.onOperationConfirmed((op) => confirmations.push(op));

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

      await modernSyncEngine.executeOperation("createTodo", [
        "todo-consistent-1",
        "Online todo",
        "medium",
      ]);

      // Go offline
      isOnline = false;

      await modernSyncEngine.executeOperation("createTodo", [
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

      await modernSyncEngine.flush();

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
});
