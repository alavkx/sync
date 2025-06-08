#!/usr/bin/env node

import {
  createTodo,
  formatDueDate,
  generateId,
  isOverdue,
  sortTodosByPriority,
  type TodoPriority,
  type TodoStatus,
} from "./schema";
import { getStoreStats, loadDemoData, todoStore } from "./store";

// =====================================================
// TODO CLI - Kalphite Demonstration
// =====================================================

const commands = {
  // List todos
  list: () => {
    const todos = todoStore.todo;
    const projects = todoStore.project;

    if (todos.length === 0) {
      console.log(
        "📭 No todos found. Use 'todo add \"Task name\"' to create one."
      );
      return;
    }

    console.log(`\n📝 Todo List (${todos.length} items)\n`);

    const sortedTodos = sortTodosByPriority(todos);

    sortedTodos.forEach((todo, index) => {
      const project = projects.findById(todo.data.projectId || "");
      const projectName = project ? ` [${project.data.name}]` : "";
      const dueText = todo.data.dueDate
        ? ` (due: ${formatDueDate(todo.data.dueDate)})`
        : "";
      const overdue = isOverdue(todo) ? " ⚠️ OVERDUE" : "";
      const statusIcon = getStatusIcon(todo.data.status);
      const priorityIcon = getPriorityIcon(todo.data.priority);

      console.log(
        `${index + 1}. ${statusIcon} ${priorityIcon} ${
          todo.data.title
        }${projectName}${dueText}${overdue}`
      );
      if (todo.data.description) {
        console.log(`   📄 ${todo.data.description}`);
      }
      if (todo.data.tags.length > 0) {
        console.log(`   🏷️  ${todo.data.tags.join(", ")}`);
      }
    });
  },

  // Add new todo
  add: (title: string, ...options: string[]) => {
    if (!title) {
      console.log("❌ Please provide a todo title");
      return;
    }

    const todo = createTodo(generateId(), title, {
      status: "pending",
      priority: "medium",
    });

    const result = todoStore.todo.upsert(todo.id, todo);
    console.log(`✅ Added todo: "${result.data.title}" (ID: ${result.id})`);

    // Show immediate update - demonstrates memory-first approach
    console.log(`📊 Total todos: ${todoStore.todo.length}`);
  },

  // Complete a todo
  complete: (id: string) => {
    const todoIndex = parseInt(id) - 1;
    const todos = todoStore.todo;

    if (todoIndex < 0 || todoIndex >= todos.length) {
      console.log("❌ Invalid todo number");
      return;
    }

    const todo = todos[todoIndex];
    const updatedTodo = {
      ...todo,
      data: { ...todo.data, status: "completed" as TodoStatus },
      updatedAt: Date.now(),
    };

    todoStore.todo.upsert(todo.id, updatedTodo);
    console.log(`✅ Completed: "${todo.data.title}"`);
  },

  // Delete a todo
  delete: (id: string) => {
    const todoIndex = parseInt(id) - 1;
    const todos = todoStore.todo;

    if (todoIndex < 0 || todoIndex >= todos.length) {
      console.log("❌ Invalid todo number");
      return;
    }

    const todo = todos[todoIndex];
    const deleted = todoStore.todo.delete(todo.id);

    if (deleted) {
      console.log(`🗑️  Deleted: "${todo.data.title}"`);
    } else {
      console.log("❌ Failed to delete todo");
    }
  },

  // Filter by status
  status: (status: string) => {
    const validStatuses = ["pending", "in-progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      console.log(
        `❌ Invalid status. Valid options: ${validStatuses.join(", ")}`
      );
      return;
    }

    const filtered = todoStore.todo.where(
      (todo) => todo.data.status === status
    );
    console.log(
      `\n📝 Todos with status "${status}" (${filtered.length} items)\n`
    );

    filtered.forEach((todo, index) => {
      console.log(
        `${index + 1}. ${getPriorityIcon(todo.data.priority)} ${
          todo.data.title
        }`
      );
    });
  },

  // Filter by tag
  tag: (tagName: string) => {
    if (!tagName) {
      console.log("❌ Please provide a tag name");
      return;
    }

    const filtered = todoStore.todo.where((todo) =>
      todo.data.tags.includes(tagName)
    );
    console.log(`\n🏷️  Todos tagged "${tagName}" (${filtered.length} items)\n`);

    filtered.forEach((todo, index) => {
      console.log(
        `${index + 1}. ${getPriorityIcon(todo.data.priority)} ${
          todo.data.title
        }`
      );
    });
  },

  // Show projects
  projects: () => {
    const projects = todoStore.project;

    if (projects.length === 0) {
      console.log("📁 No projects found.");
      return;
    }

    console.log(`\n📁 Projects (${projects.length})\n`);

    projects.forEach((project, index) => {
      const projectTodos = todoStore.todo.where(
        (todo) => todo.data.projectId === project.id
      );
      const completed = projectTodos.filter(
        (todo) => todo.data.status === "completed"
      ).length;

      console.log(
        `${index + 1}. ${project.data.name} (${completed}/${
          projectTodos.length
        } completed)`
      );
      if (project.data.description) {
        console.log(`   📄 ${project.data.description}`);
      }
    });
  },

  // Performance test
  perf: () => {
    console.log("🚀 Performance test: Creating 1000 todos...");

    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      const todo = createTodo(generateId(), `Performance test todo ${i}`, {
        priority: i % 4 === 0 ? "urgent" : "medium",
        status: "pending",
      });
      todoStore.todo.upsert(todo.id, todo);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`✅ Created 1000 todos in ${duration.toFixed(2)}ms`);
    console.log(`📊 Total todos now: ${todoStore.todo.length}`);
    console.log(`⚡ Average: ${(duration / 1000).toFixed(3)}ms per todo`);

    // Test querying performance
    const queryStart = performance.now();
    const urgentTodos = todoStore.todo.where(
      (todo) => todo.data.priority === "urgent"
    );
    const queryTime = performance.now() - queryStart;

    console.log(
      `🔍 Found ${urgentTodos.length} urgent todos in ${queryTime.toFixed(2)}ms`
    );
  },

  // Show statistics
  stats: () => {
    const stats = getStoreStats();
    const todos = todoStore.todo;

    const byStatus = {
      pending: todos.filter((t) => t.data.status === "pending").length,
      "in-progress": todos.filter((t) => t.data.status === "in-progress")
        .length,
      completed: todos.filter((t) => t.data.status === "completed").length,
      cancelled: todos.filter((t) => t.data.status === "cancelled").length,
    };

    const overdue = todos.filter(isOverdue).length;

    console.log("\n📊 Statistics");
    console.log("─".repeat(20));
    console.log(`Total entities: ${stats.total}`);
    console.log(`Todos: ${stats.todos}`);
    console.log(`Projects: ${stats.projects}`);
    console.log(`Tags: ${stats.tags}`);
    console.log(`Users: ${stats.users}`);
    console.log(`Comments: ${stats.comments}`);
    console.log("\n📝 Todo Status");
    console.log("─".repeat(20));
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });
    console.log(`Overdue: ${overdue}`);
  },

  // Load demo data
  demo: () => {
    loadDemoData();
  },

  // Clear all data
  clear: () => {
    todoStore.clear();
    console.log("🧹 All data cleared");
  },

  // Help
  help: () => {
    console.log(`
📝 Todo CLI - Powered by Kalphite

COMMANDS:
  todo list                     List all todos
  todo add "Title"              Add a new todo
  todo complete <number>        Mark todo as complete
  todo delete <number>          Delete a todo
  todo status <status>          Filter by status (pending, in-progress, completed, cancelled)
  todo tag <tagname>            Filter by tag
  todo projects                 List all projects
  todo perf                     Run performance test
  todo stats                    Show statistics
  todo demo                     Load demo data
  todo clear                    Clear all data
  todo help                     Show this help

EXAMPLES:
  todo add "Buy groceries"
  todo complete 1
  todo status pending
  todo tag urgent

This CLI demonstrates Kalphite's memory-first, synchronous approach.
All operations are immediate - no async/await needed!
    `);
  },
};

// Helper functions
function getStatusIcon(status: TodoStatus): string {
  switch (status) {
    case "pending":
      return "⏳";
    case "in-progress":
      return "🔄";
    case "completed":
      return "✅";
    case "cancelled":
      return "❌";
    default:
      return "❓";
  }
}

function getPriorityIcon(priority: TodoPriority): string {
  switch (priority) {
    case "urgent":
      return "🔥";
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
    default:
      return "⚪";
  }
}

// =====================================================
// CLI RUNNER
// =====================================================

export function runCLI() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const params = args.slice(1);

  if (command in commands) {
    (commands as any)[command](...params);
  } else {
    console.log(`❌ Unknown command: ${command}`);
    commands.help();
  }
}

// Run if called directly
if (require.main === module) {
  runCLI();
}
