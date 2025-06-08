import { beforeEach, describe, expect, test } from "vitest";
import {
  createProject,
  createTodo,
  generateId,
  type TodoStatus,
} from "../../examples/todo-cli/schema";
import {
  clearAllData,
  getStoreStats,
  loadDemoData,
  todoStore,
} from "../../examples/todo-cli/store";

describe("Real-World Usage: Todo CLI with Kalphite", () => {
  beforeEach(() => {
    clearAllData();
  });

  describe("Basic Todo Operations", () => {
    test("should create and retrieve todos synchronously", () => {
      // This demonstrates the memory-first approach - no async needed
      const todo = createTodo(generateId(), "Buy groceries", {
        priority: "high",
        tags: ["shopping", "urgent"],
      });

      // Upsert returns the entity immediately
      const result = todoStore.todo.upsert(todo.id, todo);
      expect(result).toEqual(todo);

      // Data is immediately available
      expect(todoStore.todo).toHaveLength(1);
      expect(todoStore.todo[0]).toEqual(todo);

      // Can find by ID immediately
      const found = todoStore.todo.findById(todo.id);
      expect(found).toEqual(todo);
    });

    test("should handle todo status updates", () => {
      const todo = createTodo(generateId(), "Complete project", {
        status: "pending",
        priority: "urgent",
      });

      todoStore.todo.upsert(todo.id, todo);

      // Update status
      const completed = {
        ...todo,
        data: { ...todo.data, status: "completed" as TodoStatus },
        updatedAt: Date.now(),
      };

      todoStore.todo.upsert(todo.id, completed);

      // Verify update is immediate
      const updated = todoStore.todo.findById(todo.id);
      expect(updated?.data.status).toBe("completed");
      expect(todoStore.todo).toHaveLength(1); // Same todo, just updated
    });

    test("should delete todos correctly", () => {
      const todo1 = createTodo(generateId(), "Task 1");
      const todo2 = createTodo(generateId(), "Task 2");

      todoStore.todo.upsert(todo1.id, todo1);
      todoStore.todo.upsert(todo2.id, todo2);
      expect(todoStore.todo).toHaveLength(2);

      // Delete one todo
      const deleted = todoStore.todo.delete(todo1.id);
      expect(deleted).toBe(true);
      expect(todoStore.todo).toHaveLength(1);
      expect(todoStore.todo[0].id).toBe(todo2.id);

      // Try to delete non-existent todo
      const notDeleted = todoStore.todo.delete("nonexistent");
      expect(notDeleted).toBe(false);
    });
  });

  describe("Query Operations (Functional Style)", () => {
    beforeEach(() => {
      // Set up test data
      const todos = [
        createTodo(generateId(), "Urgent bug fix", {
          priority: "urgent",
          status: "pending",
          tags: ["bug", "urgent"],
        }),
        createTodo(generateId(), "Code review", {
          priority: "high",
          status: "in-progress",
          tags: ["review"],
        }),
        createTodo(generateId(), "Documentation", {
          priority: "medium",
          status: "pending",
          tags: ["docs"],
        }),
        createTodo(generateId(), "Refactoring", {
          priority: "low",
          status: "completed",
          tags: ["cleanup"],
        }),
        createTodo(generateId(), "Another bug", {
          priority: "urgent",
          status: "cancelled",
          tags: ["bug"],
        }),
      ];

      todos.forEach((todo) => todoStore.todo.upsert(todo.id, todo));
    });

    test("should filter todos by status using where()", () => {
      const pending = todoStore.todo.where(
        (todo) => todo.data.status === "pending"
      );
      const completed = todoStore.todo.where(
        (todo) => todo.data.status === "completed"
      );
      const inProgress = todoStore.todo.where(
        (todo) => todo.data.status === "in-progress"
      );

      expect(pending).toHaveLength(2);
      expect(completed).toHaveLength(1);
      expect(inProgress).toHaveLength(1);

      // Verify specific todos
      expect(pending.every((todo) => todo.data.status === "pending")).toBe(
        true
      );
      expect(completed[0].data.title).toBe("Refactoring");
    });

    test("should filter todos by priority", () => {
      const urgent = todoStore.todo.where(
        (todo) => todo.data.priority === "urgent"
      );
      const high = todoStore.todo.where(
        (todo) => todo.data.priority === "high"
      );

      expect(urgent).toHaveLength(2);
      expect(high).toHaveLength(1);

      expect(urgent.every((todo) => todo.data.priority === "urgent")).toBe(
        true
      );
    });

    test("should filter todos by tags", () => {
      const bugTodos = todoStore.todo.where((todo) =>
        todo.data.tags.includes("bug")
      );
      const urgentTodos = todoStore.todo.where((todo) =>
        todo.data.tags.includes("urgent")
      );

      expect(bugTodos).toHaveLength(2);
      expect(urgentTodos).toHaveLength(1);

      expect(bugTodos.every((todo) => todo.data.tags.includes("bug"))).toBe(
        true
      );
    });

    test("should sort todos by priority using orderBy()", () => {
      const sortedByPriority = todoStore.todo.orderBy((todo) => {
        const priorities = { urgent: 4, high: 3, medium: 2, low: 1 };
        return -priorities[todo.data.priority]; // Negative for descending order
      });

      // Should be sorted by priority (descending)
      expect(sortedByPriority[0].data.priority).toBe("urgent");
      expect(sortedByPriority[sortedByPriority.length - 1].data.priority).toBe(
        "low"
      );
    });

    test("should chain functional operations", () => {
      // Find all urgent pending todos and sort by title
      const urgentPending = todoStore.todo
        .where((todo) => todo.data.status === "pending")
        .filter((todo) => todo.data.priority === "urgent")
        .sort((a, b) => a.data.title.localeCompare(b.data.title));

      expect(urgentPending).toHaveLength(1);
      expect(urgentPending[0].data.title).toBe("Urgent bug fix");
    });
  });

  describe("Project Organization", () => {
    test("should organize todos by projects", () => {
      const user = todoStore.user[0] || { id: "user1" };
      const project = createProject(generateId(), "Web App", user.id, {
        description: "Main web application project",
      });

      todoStore.project.upsert(project.id, project);

      // Create todos for the project
      const todos = [
        createTodo(generateId(), "Setup routing", { projectId: project.id }),
        createTodo(generateId(), "Add authentication", {
          projectId: project.id,
        }),
        createTodo(generateId(), "Personal task"), // No project
      ];

      todos.forEach((todo) => todoStore.todo.upsert(todo.id, todo));

      // Find todos for the project
      const projectTodos = todoStore.todo.where(
        (todo) => todo.data.projectId === project.id
      );
      const personalTodos = todoStore.todo.where(
        (todo) => !todo.data.projectId
      );

      expect(projectTodos).toHaveLength(2);
      expect(personalTodos).toHaveLength(1);
      expect(
        projectTodos.every((todo) => todo.data.projectId === project.id)
      ).toBe(true);
    });
  });

  describe("Performance Testing", () => {
    test("should handle 1000+ todos efficiently", () => {
      const startTime = performance.now();

      // Create 1000 todos
      for (let i = 0; i < 1000; i++) {
        const todo = createTodo(generateId(), `Todo ${i}`, {
          priority: i % 4 === 0 ? "urgent" : "medium",
          status: i % 3 === 0 ? "completed" : "pending",
          tags: [`tag-${i % 5}`],
        });
        todoStore.todo.upsert(todo.id, todo);
      }

      const createTime = performance.now() - startTime;
      expect(createTime).toBeLessThan(100); // Should create 1000 todos in under 100ms
      expect(todoStore.todo).toHaveLength(1000);

      // Test query performance
      const queryStart = performance.now();
      const urgentTodos = todoStore.todo.where(
        (todo) => todo.data.priority === "urgent"
      );
      const queryTime = performance.now() - queryStart;

      expect(queryTime).toBeLessThan(10); // Query should be under 10ms
      expect(urgentTodos.length).toBeGreaterThan(200); // Should find ~250 urgent todos

      // Test array operations performance
      const mapStart = performance.now();
      const titles = todoStore.todo.map((todo) => todo.data.title);
      const mapTime = performance.now() - mapStart;

      expect(mapTime).toBeLessThan(10); // Map should be under 10ms
      expect(titles).toHaveLength(1000);
    });

    test("should maintain performance with frequent updates", () => {
      // Create initial todos
      const initialTodos = Array.from({ length: 100 }, (_, i) =>
        createTodo(generateId(), `Initial todo ${i}`)
      );
      initialTodos.forEach((todo) => todoStore.todo.upsert(todo.id, todo));

      const updateStart = performance.now();

      // Perform many updates
      for (let i = 0; i < 500; i++) {
        const todo = todoStore.todo[i % 100];
        const updated = {
          ...todo,
          data: { ...todo.data, status: "in-progress" as TodoStatus },
          updatedAt: Date.now(),
        };
        todoStore.todo.upsert(todo.id, updated);
      }

      const updateTime = performance.now() - updateStart;
      expect(updateTime).toBeLessThan(50); // 500 updates in under 50ms

      // Verify data integrity
      expect(todoStore.todo).toHaveLength(100);
      expect(
        todoStore.todo.every((todo) => todo.data.status === "in-progress")
      ).toBe(true);
    });
  });

  describe("Demo Data Integration", () => {
    test("should load demo data correctly", () => {
      loadDemoData();

      const stats = getStoreStats();

      expect(stats.todos).toBeGreaterThan(0);
      expect(stats.projects).toBeGreaterThan(0);
      expect(stats.tags).toBeGreaterThan(0);
      expect(stats.users).toBeGreaterThan(0);

      // Verify specific demo data
      const urgentTodos = todoStore.todo.where(
        (todo) => todo.data.priority === "urgent"
      );
      expect(urgentTodos.length).toBeGreaterThan(0);

      const projects = todoStore.project;
      expect(projects.some((p) => p.data.name === "Getting Started")).toBe(
        true
      );
    });

    test("should demonstrate real-world usage patterns", () => {
      loadDemoData();

      // Simulate user interactions
      const newTodo = createTodo(generateId(), "User-created task", {
        priority: "high",
        tags: ["new", "user-created"],
      });

      todoStore.todo.upsert(newTodo.id, newTodo);

      // Mark a todo as complete
      const firstTodo = todoStore.todo[0];
      const completed = {
        ...firstTodo,
        data: { ...firstTodo.data, status: "completed" as TodoStatus },
        updatedAt: Date.now(),
      };
      todoStore.todo.upsert(firstTodo.id, completed);

      // Filter and display
      const completedTodos = todoStore.todo.where(
        (todo) => todo.data.status === "completed"
      );
      const highPriorityTodos = todoStore.todo.where(
        (todo) => todo.data.priority === "high"
      );

      expect(completedTodos.length).toBeGreaterThan(0);
      expect(highPriorityTodos.length).toBeGreaterThan(0);

      // All operations are synchronous - no promises needed!
      expect(todoStore.todo.findById(newTodo.id)).toEqual(newTodo);
    });
  });

  describe("Memory-First Philosophy Validation", () => {
    test("all operations should be synchronous", () => {
      // No async/await in any of these operations
      const todo = createTodo(generateId(), "Sync test");

      const result = todoStore.todo.upsert(todo.id, todo);
      const found = todoStore.todo.findById(todo.id);
      const filtered = todoStore.todo.where((t) => t.id === todo.id);
      const all = todoStore.todo.map((t) => t.data.title);

      // All operations return immediately
      expect(result).toEqual(todo);
      expect(found).toEqual(todo);
      expect(filtered).toHaveLength(1);
      expect(all).toContain("Sync test");

      const deleted = todoStore.todo.delete(todo.id);
      expect(deleted).toBe(true);
      expect(todoStore.todo.findById(todo.id)).toBeUndefined();
    });

    test("should maintain referential consistency", () => {
      const todo = createTodo(generateId(), "Reference test");
      todoStore.todo.upsert(todo.id, todo);

      // All access methods should return the same reference
      const fromArray = todoStore.todo[0];
      const fromFindById = todoStore.todo.findById(todo.id);
      const fromStore = todoStore.getById(todo.id);

      expect(fromArray).toBe(fromFindById);
      expect(fromFindById).toBe(fromStore);
    });

    test("should demonstrate UI-ready data flow", () => {
      // Simulate React component behavior
      let renderCount = 0;
      const mockRerender = () => renderCount++;

      // Subscribe to changes
      const unsubscribe = todoStore.subscribe(mockRerender);

      expect(renderCount).toBe(0);

      // Add todo - should trigger render
      const todo = createTodo(generateId(), "UI test");
      todoStore.todo.upsert(todo.id, todo);
      expect(renderCount).toBe(1);

      // Update todo - should trigger render
      const updated = {
        ...todo,
        data: { ...todo.data, status: "completed" as TodoStatus },
      };
      todoStore.todo.upsert(todo.id, updated);
      expect(renderCount).toBe(2);

      // Delete todo - should trigger render
      todoStore.todo.delete(todo.id);
      expect(renderCount).toBe(3);

      unsubscribe();

      // After unsubscribe, no more renders
      todoStore.todo.upsert(
        generateId(),
        createTodo(generateId(), "No render")
      );
      expect(renderCount).toBe(3);
    });
  });
});

// =====================================================
// INTEGRATION TEST SUMMARY
// =====================================================
//
// These tests demonstrate:
// 1. ✅ Real-world usage patterns with actual CLI app
// 2. ✅ Memory-first synchronous operations
// 3. ✅ Functional programming query methods
// 4. ✅ Performance at scale (1000+ entities)
// 5. ✅ React-ready subscription system
// 6. ✅ Complex data relationships (todos + projects + tags)
//
// Next: These tests will guide Layer 2-4 implementation
// - Layer 2: Add persistence (flush engine)
// - Layer 3: Add local database (PGlite)
// - Layer 4: Add network sync (real-time)
//
// ====================================================
