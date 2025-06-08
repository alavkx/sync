import { createKalphiteStore } from "../../src/store/KalphiteStore";
import type { Entity } from "./schema";
import {
  createComment,
  createProject,
  createTodo,
  EntitySchema,
} from "./schema";

// =====================================================
// TODO CLI STORE - Kalphite Integration
// =====================================================

// Create store with schema and config
export const todoStore = createKalphiteStore(EntitySchema, {
  enableDevtools: true,
  logLevel: "info",
});

// Export typed collections for easy access
export const todos = todoStore.todo;
export const projects = todoStore.project;
export const comments = todoStore.comment;

// Store reference for global access
export function getStore() {
  return todoStore;
}

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
  // Create demo project
  const project = createProject("demo-project", "Demo Project", "demo-user", {
    description: "This is a demo project",
  });
  todoStore.project.push(project);

  // Create demo todo
  const todo = createTodo("demo-todo", "Demo Todo", {
    description: "This is a demo todo",
    projectId: project.id,
    tags: ["demo"],
  });
  todoStore.todo.push(todo);

  // Create demo comment
  const comment = createComment(
    "demo-comment",
    todo.id,
    "demo-user",
    "This is a demo comment"
  );
  todoStore.comment.push(comment);

  console.log("📝 Demo data loaded successfully!");
  console.log(`Created 1 project, 1 todo, and 1 comment`);
}

export function createTask(
  id: string,
  projectId: string,
  title: string,
  description: string
): Entity {
  return {
    id,
    type: "task",
    data: {
      projectId,
      title,
      description,
      status: "pending",
      priority: "medium",
    },
    updatedAt: Date.now(),
  };
}
