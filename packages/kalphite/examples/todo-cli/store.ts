import { ensureZodStandardSchema } from "../../src/adapters/ZodStandardSchemaAdapter";
import { KalphiteStore } from "../../src/store/KalphiteStore";
import {
  createProject,
  createTag,
  createTodo,
  createUser,
  EntitySchema,
  generateId,
  type Entity,
} from "./schema";

// =====================================================
// TODO CLI STORE - Kalphite Integration
// =====================================================

// Convert Zod schema to Standard Schema compliant format
const standardEntitySchema = ensureZodStandardSchema(EntitySchema);

// Create the Kalphite store with our properly adapted schema
export const todoStore = KalphiteStore(standardEntitySchema, {
  enableDevtools: true,
  logLevel: "info",
});

// Export typed collections for easy access
export const todos = todoStore.todo;
export const projects = todoStore.project;
export const tags = todoStore.tag;
export const users = todoStore.user;
export const comments = todoStore.comment;

// Store reference for global access
export { todoStore as store };

// =====================================================
// STORE UTILITIES
// =====================================================

export function clearAllData() {
  todoStore.clear();
}

export function getStoreStats() {
  return {
    todos: todoStore.todo.length,
    projects: todoStore.project.length,
    tags: todoStore.tag.length,
    users: todoStore.user.length,
    comments: todoStore.comment.length,
    total: todoStore.getAll().length,
  };
}

export function exportData(): Entity[] {
  return todoStore.getAll();
}

export function importData(entities: Entity[]) {
  todoStore.loadEntities(entities);
}

// =====================================================
// DEMO DATA LOADER
// =====================================================

export function loadDemoData() {
  // Create demo user
  const user = createUser(generateId(), "Demo User", "demo@example.com");
  todoStore.user.upsert(user.id, user);

  // Create demo project
  const project = createProject(generateId(), "Getting Started", user.id, {
    description: "Learn how to use the todo CLI",
    color: "#3B82F6",
  });
  todoStore.project.upsert(project.id, project);

  // Create demo tags
  const urgentTag = createTag(generateId(), "urgent", { color: "#EF4444" });
  const workTag = createTag(generateId(), "work", { color: "#8B5CF6" });
  const personalTag = createTag(generateId(), "personal", { color: "#10B981" });

  todoStore.tag.upsert(urgentTag.id, urgentTag);
  todoStore.tag.upsert(workTag.id, workTag);
  todoStore.tag.upsert(personalTag.id, personalTag);

  // Create demo todos
  const todos = [
    createTodo(generateId(), "Welcome to Todo CLI", {
      description: "This is your first todo item. Try marking it as complete!",
      status: "pending",
      priority: "medium",
      projectId: project.id,
      tags: ["personal"],
    }),
    createTodo(generateId(), "Read the documentation", {
      description: "Learn about all the available commands",
      status: "pending",
      priority: "high",
      projectId: project.id,
      tags: ["work"],
    }),
    createTodo(generateId(), "Create your first project", {
      description: "Projects help organize your todos",
      status: "pending",
      priority: "medium",
      projectId: project.id,
      tags: ["work"],
    }),
    createTodo(generateId(), "Set up persistent storage", {
      description: "Enable Layer 2 for persistent storage across sessions",
      status: "pending",
      priority: "low",
      projectId: project.id,
      tags: ["work"],
    }),
    createTodo(generateId(), "URGENT: Test performance", {
      description: "Verify Kalphite can handle 1000+ todos efficiently",
      status: "in-progress",
      priority: "urgent",
      projectId: project.id,
      tags: ["urgent", "work"],
      dueDate: Date.now() + 24 * 60 * 60 * 1000, // Due tomorrow
    }),
  ];

  todos.forEach((todo) => todoStore.todo.upsert(todo.id, todo));

  console.log("📝 Demo data loaded successfully!");
  console.log(`Created ${todos.length} todos, 1 project, 3 tags, and 1 user`);
}
