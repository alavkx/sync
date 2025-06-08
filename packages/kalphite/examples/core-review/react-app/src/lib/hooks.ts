import { useEffect, useState } from "react";

// Simple mock implementation of Kalphite React hooks for the demo
// In a real implementation, these would connect to actual Kalphite store

const mockStore = {
  review: [] as any[],
  file: [] as any[],
  comment: [] as any[],
  task: [] as any[],
  reviewer: [] as any[],
};

// Mock hook to simulate useKalphiteStore
export function useKalphiteStore(store: any) {
  return store;
}

// Mock hook to simulate useCollection
export function useCollection<T = any>(collectionName: string): T[] {
  const [data, setData] = useState<T[]>(
    mockStore[collectionName as keyof typeof mockStore] || []
  );

  // In real implementation, this would subscribe to store changes
  useEffect(() => {
    // Simulate reactive updates
    const interval = setInterval(() => {
      // Force re-render to simulate reactivity
      setData([...(mockStore[collectionName as keyof typeof mockStore] || [])]);
    }, 1000);

    return () => clearInterval(interval);
  }, [collectionName]);

  return data;
}

// Function to simulate adding demo data
export function loadDemoData() {
  const now = Date.now();

  // Add demo review
  const demoReview = {
    id: "demo-review-1",
    data: {
      title: "Add authentication middleware for API endpoints",
      description:
        "Implement JWT-based authentication middleware to secure our API endpoints. This includes token validation, user context injection, and proper error handling for unauthorized requests.",
      author: "alice",
      branch: "feature/auth-middleware",
      baseBranch: "main",
      status: "in_review",
      priority: "high",
      labels: ["security", "backend", "auth"],
      assignedReviewers: ["bob", "carol"],
      approvedBy: ["bob"],
      changesRequestedBy: [],
      filesChanged: 4,
      linesAdded: 156,
      linesDeleted: 23,
      createdAt: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      updatedAt: now - 4 * 60 * 60 * 1000, // 4 hours ago
    },
  };

  // Add demo files
  const demoFiles = [
    {
      id: "file-1",
      data: {
        reviewId: "demo-review-1",
        path: "src/middleware/auth.ts",
        status: "added",
        language: "typescript",
        linesAdded: 87,
        linesDeleted: 0,
      },
    },
    {
      id: "file-2",
      data: {
        reviewId: "demo-review-1",
        path: "src/utils/jwt.ts",
        status: "added",
        language: "typescript",
        linesAdded: 45,
        linesDeleted: 0,
      },
    },
    {
      id: "file-3",
      data: {
        reviewId: "demo-review-1",
        path: "src/routes/api.ts",
        status: "modified",
        language: "typescript",
        linesAdded: 24,
        linesDeleted: 23,
      },
    },
  ];

  // Add demo comments
  const demoComments = [
    {
      id: "comment-1",
      data: {
        reviewId: "demo-review-1",
        author: "bob",
        content:
          "Great implementation! The error handling looks solid. Just one suggestion about the token expiry validation.",
        filePath: "src/middleware/auth.ts",
        lineNumber: 42,
        isResolved: false,
        createdAt: now - 6 * 60 * 60 * 1000, // 6 hours ago
      },
    },
    {
      id: "comment-2",
      data: {
        reviewId: "demo-review-1",
        author: "carol",
        content: "Should we add rate limiting to prevent brute force attacks?",
        filePath: "src/middleware/auth.ts",
        lineNumber: 78,
        isResolved: false,
        createdAt: now - 3 * 60 * 60 * 1000, // 3 hours ago
      },
    },
  ];

  // Add demo tasks
  const demoTasks = [
    {
      id: "task-1",
      data: {
        reviewId: "demo-review-1",
        title: "Add unit tests for auth middleware",
        description:
          "Write comprehensive tests covering success and failure cases",
        assignee: "alice",
        status: "todo",
        priority: "high",
        createdAt: now - 12 * 60 * 60 * 1000, // 12 hours ago
      },
    },
    {
      id: "task-2",
      data: {
        reviewId: "demo-review-1",
        title: "Update API documentation",
        description: "Document the new authentication requirements",
        assignee: "bob",
        status: "in_progress",
        priority: "medium",
        createdAt: now - 8 * 60 * 60 * 1000, // 8 hours ago
      },
    },
  ];

  // Add demo reviewers
  const demoReviewers = [
    {
      id: "reviewer-1",
      data: {
        username: "alice",
        name: "Alice Johnson",
        email: "alice@company.com",
        role: "Senior Developer",
        expertise: ["React", "TypeScript", "Node.js"],
      },
    },
    {
      id: "reviewer-2",
      data: {
        username: "bob",
        name: "Bob Smith",
        email: "bob@company.com",
        role: "Lead Developer",
        expertise: ["Python", "Django", "PostgreSQL"],
      },
    },
    {
      id: "reviewer-3",
      data: {
        username: "carol",
        name: "Carol Williams",
        email: "carol@company.com",
        role: "Frontend Specialist",
        expertise: ["React", "CSS", "UI/UX"],
      },
    },
  ];

  // Update mock store
  mockStore.review = [demoReview];
  mockStore.file = demoFiles;
  mockStore.comment = demoComments;
  mockStore.task = demoTasks;
  mockStore.reviewer = demoReviewers;
}

// Function to clear all data
export function clearAllData() {
  mockStore.review = [];
  mockStore.file = [];
  mockStore.comment = [];
  mockStore.task = [];
  mockStore.reviewer = [];
}
