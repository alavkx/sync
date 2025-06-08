import { z } from "zod";

// =====================================================
// TODO CLI SCHEMA - Real-world Kalphite Testing
// =====================================================

// Base entity interface that all entities must implement
export const BaseEntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  updatedAt: z.number(),
  createdAt: z.number(),
});

// =====================================================
// CORE ENTITIES
// =====================================================

// Todo Item - the main entity
export const TodoSchema = z.object({
  id: z.string(),
  type: z.literal("todo"),
  updatedAt: z.number(),
  createdAt: z.number(),
  data: z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    status: z.enum(["pending", "in-progress", "completed", "cancelled"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    dueDate: z.number().optional(), // Unix timestamp
    projectId: z.string().optional(),
    tags: z.array(z.string()).default([]),
    assigneeId: z.string().optional(),
    estimatedMinutes: z.number().optional(),
    actualMinutes: z.number().optional(),
  }),
});

// Project/List - group todos
export const ProjectSchema = z.object({
  id: z.string(),
  type: z.literal("project"),
  updatedAt: z.number(),
  createdAt: z.number(),
  data: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i)
      .optional(),
    archived: z.boolean().default(false),
    ownerId: z.string(),
  }),
});

// Tag - for categorization
export const TagSchema = z.object({
  id: z.string(),
  type: z.literal("tag"),
  updatedAt: z.number(),
  createdAt: z.number(),
  data: z.object({
    name: z.string().min(1).max(50),
    color: z
      .string()
      .regex(/^#[0-9A-F]{6}$/i)
      .optional(),
    description: z.string().optional(),
  }),
});

// User - for multi-user support (Layer 4)
export const UserSchema = z.object({
  id: z.string(),
  type: z.literal("user"),
  updatedAt: z.number(),
  createdAt: z.number(),
  data: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    avatarUrl: z.string().url().optional(),
    preferences: z
      .object({
        defaultPriority: z
          .enum(["low", "medium", "high", "urgent"])
          .default("medium"),
        dateFormat: z
          .enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"])
          .default("MM/DD/YYYY"),
        theme: z.enum(["light", "dark", "auto"]).default("auto"),
      })
      .default({}),
  }),
});

// Comment - for todo discussions (Layer 4)
export const CommentSchema = z.object({
  id: z.string(),
  type: z.literal("comment"),
  updatedAt: z.number(),
  createdAt: z.number(),
  data: z.object({
    todoId: z.string(),
    authorId: z.string(),
    content: z.string().min(1).max(1000),
    edited: z.boolean().default(false),
  }),
});

// =====================================================
// UNION SCHEMA FOR KALPHITE
// =====================================================

export const EntitySchema = z.discriminatedUnion("type", [
  TodoSchema,
  ProjectSchema,
  TagSchema,
  UserSchema,
  CommentSchema,
]);

// =====================================================
// TYPE EXPORTS
// =====================================================

export type Entity = z.infer<typeof EntitySchema>;
export type Todo = z.infer<typeof TodoSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type User = z.infer<typeof UserSchema>;
export type Comment = z.infer<typeof CommentSchema>;

export type TodoStatus = Todo["data"]["status"];
export type TodoPriority = Todo["data"]["priority"];

// =====================================================
// ENTITY FACTORIES
// =====================================================

export function createTodo(
  id: string,
  title: string,
  options: Partial<Todo["data"]> = {}
): Todo {
  const now = Date.now();
  return {
    id,
    type: "todo",
    createdAt: now,
    updatedAt: now,
    data: {
      title,
      description: "",
      status: "pending",
      priority: "medium",
      tags: [],
      ...options,
    },
  };
}

export function createProject(
  id: string,
  name: string,
  ownerId: string,
  options: Partial<Project["data"]> = {}
): Project {
  const now = Date.now();
  return {
    id,
    type: "project",
    createdAt: now,
    updatedAt: now,
    data: {
      name,
      ownerId,
      archived: false,
      ...options,
    },
  };
}

export function createTag(
  id: string,
  name: string,
  options: Partial<Tag["data"]> = {}
): Tag {
  const now = Date.now();
  return {
    id,
    type: "tag",
    createdAt: now,
    updatedAt: now,
    data: {
      name,
      ...options,
    },
  };
}

export function createUser(
  id: string,
  name: string,
  email: string,
  options: Partial<User["data"]> = {}
): User {
  const now = Date.now();
  return {
    id,
    type: "user",
    createdAt: now,
    updatedAt: now,
    data: {
      name,
      email,
      preferences: {
        defaultPriority: "medium",
        dateFormat: "MM/DD/YYYY",
        theme: "auto",
      },
      ...options,
    },
  };
}

export function createComment(
  id: string,
  todoId: string,
  authorId: string,
  content: string,
  options: Partial<Comment["data"]> = {}
): Comment {
  const now = Date.now();
  return {
    id,
    type: "comment",
    createdAt: now,
    updatedAt: now,
    data: {
      todoId,
      authorId,
      content,
      edited: false,
      ...options,
    },
  };
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isOverdue(todo: Todo): boolean {
  if (!todo.data.dueDate) return false;
  return todo.data.dueDate < Date.now() && todo.data.status !== "completed";
}

export function formatDueDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function getProjectTodos(todos: Todo[], projectId: string): Todo[] {
  return todos.filter((todo) => todo.data.projectId === projectId);
}

export function getTodosByTag(todos: Todo[], tagName: string): Todo[] {
  return todos.filter((todo) => todo.data.tags.includes(tagName));
}

export function getTodosByStatus(todos: Todo[], status: TodoStatus): Todo[] {
  return todos.filter((todo) => todo.data.status === status);
}

export function sortTodosByPriority(todos: Todo[]): Todo[] {
  const priorityOrder: Record<TodoPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return [...todos].sort(
    (a, b) => priorityOrder[b.data.priority] - priorityOrder[a.data.priority]
  );
}

export function sortTodosByDueDate(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (!a.data.dueDate && !b.data.dueDate) return 0;
    if (!a.data.dueDate) return 1;
    if (!b.data.dueDate) return -1;
    return a.data.dueDate - b.data.dueDate;
  });
}
