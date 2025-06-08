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

// Create the main Kalphite store
export const reviewStore = createKalphiteStore(EntitySchema, {
  enableDevtools: true,
  logLevel: "info",
});

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

export function clearStore() {
  reviewStore.clear();
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
