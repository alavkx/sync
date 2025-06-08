import { MemoryFlushEngine } from "../../src/engines/MemoryFlushEngine";
import { createKalphiteStore } from "../../src/store/KalphiteStore";
import {
  EntitySchema,
  createComment,
  createFile,
  createReview,
  createReviewer,
  createTask,
  type Entity,
} from "./schema";

// CORE-REVIEW STORE - Kalphite Integration
// High-performance code review management with Kalphite's memory-first architecture

// Create a flush engine for persistence (works offline)
const flushEngine = new MemoryFlushEngine({
  flushTarget: async (changes) => {
    console.log("💾 Persisting changes:", changes.length, "entities");

    // Store locally first (always works)
    const stored = localStorage.getItem("kalphite-review-data") || "[]";
    const data = JSON.parse(stored);

    changes.forEach((change) => {
      const existing = data.findIndex(
        (item: any) => item.entityId === change.entityId
      );
      if (change.operation === "delete") {
        if (existing >= 0) {
          data.splice(existing, 1);
        }
      } else {
        if (existing >= 0) {
          data[existing] = change;
        } else {
          data.push(change);
        }
      }
    });

    localStorage.setItem("kalphite-review-data", JSON.stringify(data));
    console.log("💿 Stored locally:", data.length, "entities");

    // Try network persistence (optional)
    try {
      const response = await fetch("http://localhost:3001/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });

      if (response.ok) {
        console.log("☁️ Network sync successful");
      } else {
        console.warn("❌ Network sync failed:", response.status);
      }
    } catch (error) {
      console.warn(
        "❌ Network sync failed (offline mode):",
        error instanceof Error ? error.message : String(error)
      );
    }
  },
  debounceMs: 1000, // 1 second debounce for better demo visibility
  maxBatchSize: 50,
});

// Create the main Kalphite store with persistence
export const reviewStore = createKalphiteStore(EntitySchema, {
  enableDevtools: true,
  logLevel: "info",
  flushEngine,
});

// Load any previously stored data from localStorage
function loadStoredData() {
  try {
    const stored = localStorage.getItem("kalphite-review-data");
    if (stored) {
      const data = JSON.parse(stored);
      const entities = data.map((change: any) => change.entity).filter(Boolean);
      if (entities.length > 0) {
        reviewStore.loadEntities(entities as any);
        console.log(
          "💿 Loaded from local storage:",
          entities.length,
          "entities"
        );
      }
    }
  } catch (error) {
    console.warn("Failed to load stored data:", error);
  }
}

// Auto-load stored data on initialization
loadStoredData();

// Export data management functions
export function clearAllData() {
  reviewStore.clear();
  localStorage.removeItem("kalphite-review-data");
  console.log("🗑️ Cleared all data");
}

export function exportData() {
  const data = localStorage.getItem("kalphite-review-data");
  if (data) {
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "review-data.json";
    a.click();
    URL.revokeObjectURL(url);
    console.log("📁 Data exported");
  }
}

// Convenient collection accessors
export const reviews = reviewStore.review;
export const comments = reviewStore.comment;
export const files = reviewStore.file;
export const reviewers = reviewStore.reviewer;
export const tasks = reviewStore.task;

// Store management functions
export function getStore() {
  return reviewStore;
}

export function getStoreStats() {
  return {
    reviews: reviewStore.review.length,
    comments: reviewStore.comment.length,
    files: reviewStore.file.length,
    reviewers: reviewStore.reviewer.length,
    tasks: reviewStore.task.length,
    total: reviewStore.getAll().length,
  };
}

export function getAllEntities(): Entity[] {
  return reviewStore.getAll();
}

export function loadEntities(entities: Entity[]) {
  reviewStore.loadEntities(entities);
}

// Demo data creation
export function createDemoData() {
  console.log("Creating demo review data...");

  // Create reviewers first
  const alice = createReviewer(
    "Alice Johnson",
    "alice@company.com",
    "alice",
    "maintainer",
    {
      expertise: ["TypeScript", "React", "Node.js"],
      reviewCount: 47,
    }
  );

  const bob = createReviewer("Bob Chen", "bob@company.com", "bob", "reviewer", {
    expertise: ["Python", "Docker", "PostgreSQL"],
    reviewCount: 23,
  });

  const charlie = createReviewer(
    "Charlie Smith",
    "charlie@company.com",
    "charlie",
    "author",
    {
      expertise: ["JavaScript", "Vue.js", "CSS"],
      reviewCount: 12,
    }
  );

  reviewStore.reviewer.push(alice);
  reviewStore.reviewer.push(bob);
  reviewStore.reviewer.push(charlie);

  // Create a demo review
  const review = createReview(
    "Add user authentication system",
    "Implements JWT-based authentication with login, logout, and session management. Includes middleware for protected routes and password hashing.",
    charlie.data.username,
    "feature/auth-system",
    {
      status: "in_review",
      priority: "high",
      isDraft: false,
      assignedReviewers: [alice.data.username, bob.data.username],
      labels: ["security", "backend", "breaking-change"],
      filesChanged: 8,
      linesAdded: 342,
      linesDeleted: 18,
    }
  );

  reviewStore.review.push(review);

  // Add files to the review
  const authFiles = [
    createFile(review.id, "src/auth/middleware.ts", "added", {
      linesAdded: 87,
      language: "typescript",
    }),
    createFile(review.id, "src/auth/jwt.ts", "added", {
      linesAdded: 124,
      language: "typescript",
    }),
    createFile(review.id, "src/routes/auth.ts", "added", {
      linesAdded: 95,
      language: "typescript",
    }),
    createFile(review.id, "src/models/User.ts", "modified", {
      linesAdded: 36,
      linesDeleted: 18,
      language: "typescript",
    }),
  ];

  authFiles.forEach((file) => reviewStore.file.push(file));

  // Add comments
  const comments = [
    createComment(
      review.id,
      alice.data.username,
      "Great implementation! The JWT middleware looks solid. Just a few minor suggestions.",
      {
        filePath: "src/auth/middleware.ts",
        lineNumber: 23,
        lineType: "addition",
      }
    ),
    createComment(
      review.id,
      bob.data.username,
      "We should add rate limiting to the auth endpoints to prevent brute force attacks.",
      {
        filePath: "src/routes/auth.ts",
        lineNumber: 45,
        lineType: "addition",
        isCode: true,
      }
    ),
    createComment(
      review.id,
      alice.data.username,
      "Consider using bcrypt with a higher cost factor for password hashing in production.",
      {
        filePath: "src/auth/jwt.ts",
        lineNumber: 67,
        lineType: "context",
      }
    ),
  ];

  comments.forEach((comment) => reviewStore.comment.push(comment));

  // Add tasks
  const reviewTasks = [
    createTask(
      review.id,
      "Add rate limiting to auth endpoints",
      bob.data.username,
      {
        priority: "high",
        description:
          "Implement rate limiting to prevent brute force attacks on login",
        relatedCommentId: comments[1].id,
      }
    ),
    createTask(
      review.id,
      "Update password hashing cost factor",
      charlie.data.username,
      {
        priority: "medium",
        description: "Increase bcrypt cost factor for production security",
        relatedCommentId: comments[2].id,
      }
    ),
    createTask(
      review.id,
      "Add integration tests for auth flow",
      charlie.data.username,
      {
        priority: "medium",
        description: "Create comprehensive tests for login/logout workflows",
      }
    ),
  ];

  reviewTasks.forEach((task) => reviewStore.task.push(task));

  console.log(
    `Created demo data: 1 review, ${authFiles.length} files, ${comments.length} comments, ${reviewTasks.length} tasks`
  );
}
