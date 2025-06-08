import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  EntitySchema,
  createComment,
  createFile,
  createReview,
  createReviewer,
  createTask,
  type Comment,
} from "../../examples/core-review/schema";
import { createKalphiteStore } from "../store/KalphiteStore";
import { OperationSyncEngine } from "../sync/OperationSyncEngine";
import type { OperationSyncConfig } from "../types/operation-sync";

// Mock HTTP client for testing sync functionality
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

describe("Code Review Tool: Multi-Client Integration", () => {
  let storeClient1: any;
  let storeClient2: any;
  let syncEngineClient1: OperationSyncEngine;
  let syncEngineClient2: OperationSyncEngine;
  let mockHttpClient1: MockHttpClient;
  let mockHttpClient2: MockHttpClient;

  const configClient1: OperationSyncConfig = {
    baseUrl: "http://localhost:3000",
    operationsEndpoint: "/sync/operations",
    stateEndpoint: "/sync/state",
    notificationUrl: "ws://localhost:3000/ws",
    wsUrl: "ws://localhost:3000/ws",
    roomId: "code-review-room",
    clientId: "reviewer-alice",
    userId: "alice",
    batchSize: 10,
    offlineQueueLimit: 1000,
  };

  const configClient2: OperationSyncConfig = {
    ...configClient1,
    clientId: "reviewer-bob",
    userId: "bob",
  };

  beforeEach(() => {
    // Initialize stores for both clients
    storeClient1 = createKalphiteStore(EntitySchema, {
      enableDevtools: false,
      logLevel: "error",
    });
    storeClient2 = createKalphiteStore(EntitySchema, {
      enableDevtools: false,
      logLevel: "error",
    });

    // Initialize sync engines
    syncEngineClient1 = new OperationSyncEngine(configClient1);
    syncEngineClient2 = new OperationSyncEngine(configClient2);

    // Initialize mock HTTP clients
    mockHttpClient1 = new MockHttpClient();
    mockHttpClient2 = new MockHttpClient();

    // Inject mock HTTP clients
    (syncEngineClient1 as any).httpClient = mockHttpClient1;
    (syncEngineClient2 as any).httpClient = mockHttpClient2;

    // Set default responses
    const defaultSyncResponse = {
      stateVersion: "v1",
      syncTimestamp: Date.now(),
      entities: [],
      deletedEntityIds: [],
    };

    mockHttpClient1.setResponse("/sync/state", defaultSyncResponse);
    mockHttpClient2.setResponse("/sync/state", defaultSyncResponse);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await syncEngineClient1.disconnect();
    await syncEngineClient2.disconnect();
  });

  describe("👥 Code Review Workflow - Happy Path", () => {
    test("should handle complete review workflow with two reviewers", async () => {
      // Setup: Create reviewers
      const alice = createReviewer(
        "Alice Johnson",
        "alice@company.com",
        "alice",
        "maintainer",
        {
          expertise: ["TypeScript", "React", "Security"],
          reviewCount: 45,
        }
      );

      const bob = createReviewer(
        "Bob Chen",
        "bob@company.com",
        "bob",
        "reviewer",
        {
          expertise: ["Node.js", "GraphQL", "Testing"],
          reviewCount: 32,
        }
      );

      // Add reviewers to both stores
      storeClient1.reviewer.push(alice);
      storeClient1.reviewer.push(bob);
      storeClient2.reviewer.push(alice);
      storeClient2.reviewer.push(bob);

      // Alice creates a review
      const review = createReview(
        "Add GraphQL API for user management",
        "Implements CRUD operations for users with proper authentication and authorization",
        "alice",
        "feature/graphql-users",
        {
          status: "open",
          priority: "high",
          assignedReviewers: ["bob"],
          filesChanged: 5,
          linesAdded: 287,
          linesDeleted: 23,
        }
      );

      storeClient1.review.push(review);

      // Add files to the review
      const reviewFiles = [
        createFile(review.id, "src/graphql/resolvers/user.ts", "added", {
          linesAdded: 156,
          language: "typescript",
        }),
        createFile(review.id, "src/graphql/schema/user.graphql", "added", {
          linesAdded: 45,
          language: "graphql",
        }),
        createFile(review.id, "src/middleware/auth.ts", "modified", {
          linesAdded: 67,
          linesDeleted: 15,
          language: "typescript",
        }),
        createFile(review.id, "src/tests/user.test.ts", "added", {
          linesAdded: 89,
          language: "typescript",
        }),
      ];

      reviewFiles.forEach((file) => storeClient1.file.push(file));

      // Verify review creation
      expect(storeClient1.review.length).toBe(1);
      expect(storeClient1.file.length).toBe(4);
      expect(storeClient1.review[0].data.status).toBe("open");
      expect(storeClient1.review[0].data.assignedReviewers).toContain("bob");

      // Bob reviews the code and adds comments
      const bobComments = [
        createComment(
          review.id,
          "bob",
          "Great implementation! The resolvers look clean.",
          {
            filePath: "src/graphql/resolvers/user.ts",
            lineNumber: 25,
            lineType: "addition",
          }
        ),
        createComment(
          review.id,
          "bob",
          "Consider adding input validation for the email field.",
          {
            filePath: "src/graphql/resolvers/user.ts",
            lineNumber: 78,
            lineType: "addition",
            isCode: true,
          }
        ),
        createComment(
          review.id,
          "bob",
          "We should add rate limiting to these endpoints.",
          {
            filePath: "src/middleware/auth.ts",
            lineNumber: 42,
            lineType: "context",
          }
        ),
      ];

      bobComments.forEach((comment) => storeClient2.comment.push(comment));

      // Bob creates tasks based on review
      const reviewTasks = [
        createTask(review.id, "Add email validation", "alice", {
          priority: "medium",
          description: "Add proper email format validation in user resolver",
          relatedCommentId: bobComments[1].id,
        }),
        createTask(review.id, "Implement rate limiting", "alice", {
          priority: "high",
          description: "Add rate limiting middleware for GraphQL endpoints",
          relatedCommentId: bobComments[2].id,
        }),
      ];

      reviewTasks.forEach((task) => storeClient2.task.push(task));

      // Verify Bob's interactions
      expect(storeClient2.comment.length).toBe(3);
      expect(storeClient2.task.length).toBe(2);
      expect(
        storeClient2.comment.every((c: Comment) => c.data.author === "bob")
      ).toBe(true);
      expect(
        storeClient2.task.every((t: any) => t.data.assignee === "alice")
      ).toBe(true);

      // Alice addresses the feedback
      const aliceResponse = createComment(
        review.id,
        "alice",
        "Thanks for the review! I'll address these points.",
        {
          parentCommentId: bobComments[1].id,
        }
      );

      storeClient1.comment.push(aliceResponse);

      // Alice completes tasks
      const completedTasks = storeClient1.task.filter(
        (t: any) => t.data.reviewId === review.id
      );
      completedTasks.forEach((task: any) => {
        task.data.status = "completed";
        task.data.completedAt = Date.now();
        task.updatedAt = Date.now();
      });

      // Bob approves the review - first sync the review to Client 2
      storeClient2.review.push(review);
      const updatedReview = storeClient2.review.find(
        (r: any) => r.id === review.id
      );
      if (updatedReview) {
        updatedReview.data.status = "approved";
        updatedReview.data.approvedBy.push("bob");
        updatedReview.updatedAt = Date.now();
      }

      // Verify final state
      expect(storeClient1.comment.length).toBe(1); // Alice's response
      expect(storeClient2.review[0]?.data.status).toBe("approved");
      expect(storeClient2.review[0]?.data.approvedBy).toContain("bob");
    });

    test("should handle review status transitions correctly", async () => {
      const author = createReviewer(
        "Charlie Dev",
        "charlie@company.com",
        "charlie",
        "author"
      );
      const reviewer = createReviewer(
        "Diana Lead",
        "diana@company.com",
        "diana",
        "maintainer"
      );

      storeClient1.reviewer.push(author, reviewer);
      storeClient2.reviewer.push(author, reviewer);

      // Create review in draft status
      const review = createReview(
        "Fix authentication bug",
        "Addresses security vulnerability in JWT validation",
        "charlie",
        "fix/auth-bug",
        {
          status: "draft",
          isDraft: true,
          assignedReviewers: ["diana"],
        }
      );

      storeClient1.review.push(review);

      // Verify initial draft state
      expect(review.data.status).toBe("draft");
      expect(review.data.isDraft).toBe(true);

      // Author moves to open for review
      review.data.status = "open";
      review.data.isDraft = false;
      review.updatedAt = Date.now();

      expect(review.data.status).toBe("open");
      expect(review.data.isDraft).toBe(false);

      // Reviewer starts review
      review.data.status = "in_review";
      review.updatedAt = Date.now();

      // Reviewer requests changes
      review.data.status = "changes_requested";
      review.data.changesRequestedBy.push("diana");
      review.updatedAt = Date.now();

      const changeRequest = createComment(
        review.id,
        "diana",
        "Please add unit tests for the JWT validation logic."
      );
      storeClient2.comment.push(changeRequest);

      expect(review.data.status).toBe("changes_requested");
      expect(review.data.changesRequestedBy).toContain("diana");

      // Author addresses changes and reopens
      review.data.status = "open";
      review.data.changesRequestedBy = [];
      review.updatedAt = Date.now();

      const authorUpdate = createComment(
        review.id,
        "charlie",
        "Added comprehensive unit tests as requested."
      );
      storeClient1.comment.push(authorUpdate);

      // Reviewer approves
      review.data.status = "approved";
      review.data.approvedBy.push("diana");
      review.updatedAt = Date.now();

      // Final merge
      review.data.status = "merged";
      review.updatedAt = Date.now();

      expect(review.data.status).toBe("merged");
      expect(review.data.approvedBy).toContain("diana");
    });
  });

  describe("🔄 Sync Functionality - Multi-Client", () => {
    test("should sync review creation between clients", async () => {
      // Setup sync responses
      mockHttpClient1.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "reviewer-alice",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      mockHttpClient2.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 1,
            clientId: "reviewer-bob",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Client 1 creates a review
      const review = createReview(
        "Implement caching layer",
        "Add Redis caching for frequently accessed data",
        "alice",
        "feature/caching"
      );

      storeClient1.review.push(review);

      // Execute sync operation
      await syncEngineClient1.executeOperation("createReview", [
        review.id,
        review.data.title,
        review.data.description,
        review.data.author,
        review.data.branch,
      ]);

      // Verify operation was sent
      const requests1 = mockHttpClient1.getRequests();
      expect(requests1).toHaveLength(1);
      expect(requests1[0].data.operations[0].name).toBe("createReview");
      expect(requests1[0].data.operations[0].args).toEqual([
        review.id,
        review.data.title,
        review.data.description,
        review.data.author,
        review.data.branch,
      ]);

      // Simulate Client 2 receiving the sync
      storeClient2.review.push(review);

      expect(storeClient1.review.length).toBe(1);
      expect(storeClient2.review.length).toBe(1);
      expect(storeClient2.review[0].id).toBe(review.id);
    });

    test("should sync comment additions across clients", async () => {
      // Setup
      const review = createReview(
        "Test review",
        "Description",
        "alice",
        "test-branch"
      );
      storeClient1.review.push(review);
      storeClient2.review.push(review);

      mockHttpClient1.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 2,
            clientId: "reviewer-alice",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Client 1 adds comment
      const comment = createComment(
        review.id,
        "alice",
        "This looks good to me!",
        {
          filePath: "src/main.ts",
          lineNumber: 15,
          lineType: "addition",
        }
      );

      storeClient1.comment.push(comment);

      await syncEngineClient1.executeOperation("addComment", [
        comment.id,
        comment.data.reviewId,
        comment.data.author,
        comment.data.content,
        comment.data.filePath,
        comment.data.lineNumber,
      ]);

      // Verify sync request
      const requests = mockHttpClient1.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].data.operations[0].name).toBe("addComment");

      // Simulate Client 2 receiving the comment
      storeClient2.comment.push(comment);

      expect(storeClient1.comment.length).toBe(1);
      expect(storeClient2.comment.length).toBe(1);
      expect(storeClient2.comment[0].data.content).toBe(
        "This looks good to me!"
      );
    });

    test("should handle concurrent operations from multiple clients", async () => {
      // Setup review in both stores
      const review = createReview(
        "Concurrent test",
        "Testing concurrent ops",
        "alice",
        "test"
      );
      storeClient1.review.push(review);
      storeClient2.review.push(review);

      // Setup sync responses
      mockHttpClient1.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 3,
            clientId: "reviewer-alice",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      mockHttpClient2.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 4,
            clientId: "reviewer-bob",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Both clients add comments simultaneously
      const aliceComment = createComment(review.id, "alice", "Alice's comment");
      const bobComment = createComment(review.id, "bob", "Bob's comment");

      storeClient1.comment.push(aliceComment);
      storeClient2.comment.push(bobComment);

      // Execute operations concurrently
      await Promise.all([
        syncEngineClient1.executeOperation("addComment", [
          aliceComment.id,
          aliceComment.data.reviewId,
          aliceComment.data.author,
          aliceComment.data.content,
        ]),
        syncEngineClient2.executeOperation("addComment", [
          bobComment.id,
          bobComment.data.reviewId,
          bobComment.data.author,
          bobComment.data.content,
        ]),
      ]);

      // Verify both operations were sent
      const requests1 = mockHttpClient1.getRequests();
      const requests2 = mockHttpClient2.getRequests();

      expect(requests1).toHaveLength(1);
      expect(requests2).toHaveLength(1);

      // Simulate both clients receiving both comments
      storeClient1.comment.push(bobComment);
      storeClient2.comment.push(aliceComment);

      expect(storeClient1.comment.length).toBe(2);
      expect(storeClient2.comment.length).toBe(2);

      const client1Authors = storeClient1.comment.map(
        (c: Comment) => c.data.author
      );
      const client2Authors = storeClient2.comment.map(
        (c: Comment) => c.data.author
      );

      expect(client1Authors).toContain("alice");
      expect(client1Authors).toContain("bob");
      expect(client2Authors).toContain("alice");
      expect(client2Authors).toContain("bob");
    });

    test("should sync task assignments and completions", async () => {
      // Setup
      const review = createReview(
        "Task sync test",
        "Testing task sync",
        "alice",
        "task-test"
      );
      storeClient1.review.push(review);
      storeClient2.review.push(review);

      mockHttpClient1.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 5,
            clientId: "reviewer-alice",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      mockHttpClient2.setResponse("/sync/operations", {
        confirmations: [
          {
            operationId: 6,
            clientId: "reviewer-bob",
            success: true,
            serverTimestamp: Date.now(),
          },
        ],
      });

      // Client 1 creates task
      const task = createTask(review.id, "Fix linting errors", "bob", {
        priority: "medium",
        description: "Address ESLint issues in the codebase",
      });

      storeClient1.task.push(task);

      await syncEngineClient1.executeOperation("createTask", [
        task.id,
        task.data.reviewId,
        task.data.title,
        task.data.assignee,
        task.data.priority,
      ]);

      // Simulate Client 2 receiving the task
      storeClient2.task.push(task);

      expect(storeClient2.task.length).toBe(1);
      expect(storeClient2.task[0].data.assignee).toBe("bob");
      expect(storeClient2.task[0].data.status).toBe("open");

      // Client 2 (Bob) completes the task
      const completedTask = storeClient2.task[0];
      completedTask.data.status = "completed";
      completedTask.data.completedAt = Date.now();
      completedTask.updatedAt = Date.now();

      await syncEngineClient2.executeOperation("completeTask", [
        completedTask.id,
        completedTask.data.completedAt,
      ]);

      // Simulate Client 1 receiving the completion
      const client1Task = storeClient1.task.find((t: any) => t.id === task.id);
      if (client1Task) {
        client1Task.data.status = "completed";
        client1Task.data.completedAt = completedTask.data.completedAt;
        client1Task.updatedAt = completedTask.updatedAt;
      }

      expect(client1Task?.data.status).toBe("completed");
      expect(client1Task?.data.completedAt).toBeDefined();

      // Verify sync operations
      const requests1 = mockHttpClient1.getRequests();
      const requests2 = mockHttpClient2.getRequests();

      expect(requests1).toHaveLength(1);
      expect(requests2).toHaveLength(1);
      expect(requests1[0].data.operations[0].name).toBe("createTask");
      expect(requests2[0].data.operations[0].name).toBe("completeTask");
    });
  });

  describe("📊 Integration Scenarios", () => {
    test("should handle complete end-to-end review workflow with sync", async () => {
      // This test combines both code review functionality and sync
      const alice = createReviewer(
        "Alice",
        "alice@test.com",
        "alice",
        "author"
      );
      const bob = createReviewer("Bob", "bob@test.com", "bob", "reviewer");

      // Setup reviewers in both stores
      [storeClient1, storeClient2].forEach((store) => {
        store.reviewer.push(alice, bob);
      });

      // Setup sync responses for multiple operations
      const mockResponses = Array.from({ length: 10 }, (_, i) => ({
        operationId: i + 1,
        clientId: i % 2 === 0 ? "reviewer-alice" : "reviewer-bob",
        success: true,
        serverTimestamp: Date.now() + i,
      }));

      mockHttpClient1.setResponse("/sync/operations", {
        confirmations: mockResponses,
      });
      mockHttpClient2.setResponse("/sync/operations", {
        confirmations: mockResponses,
      });

      // 1. Alice creates review
      const review = createReview(
        "Complete E2E Feature",
        "Full end-to-end implementation with tests",
        "alice",
        "feature/e2e",
        { assignedReviewers: ["bob"], priority: "high" }
      );

      storeClient1.review.push(review);
      await syncEngineClient1.executeOperation("createReview", [
        review.id,
        review.data.title,
      ]);

      // 2. Sync to Bob's client
      storeClient2.review.push(review);

      // 3. Bob adds review comments
      const comments = [
        createComment(review.id, "bob", "Overall structure looks great!"),
        createComment(review.id, "bob", "Need to add error handling here", {
          filePath: "src/api.ts",
          lineNumber: 45,
          lineType: "addition",
        }),
      ];

      comments.forEach((comment) => {
        storeClient2.comment.push(comment);
      });

      await syncEngineClient2.executeOperation("addComment", [
        comments[0].id,
        review.id,
      ]);
      await syncEngineClient2.executeOperation("addComment", [
        comments[1].id,
        review.id,
      ]);

      // 4. Sync comments to Alice
      comments.forEach((comment) => storeClient1.comment.push(comment));

      // 5. Alice creates task based on feedback
      const task = createTask(review.id, "Add error handling", "alice", {
        description: "Add proper error handling to API calls",
        priority: "high",
      });

      storeClient1.task.push(task);
      await syncEngineClient1.executeOperation("createTask", [
        task.id,
        review.id,
      ]);

      // 6. Sync task to Bob
      storeClient2.task.push(task);

      // 7. Alice completes task
      task.data.status = "completed";
      task.data.completedAt = Date.now();
      await syncEngineClient1.executeOperation("completeTask", [task.id]);

      // 8. Bob approves review
      review.data.status = "approved";
      review.data.approvedBy.push("bob");
      await syncEngineClient2.executeOperation("approveReview", [
        review.id,
        "bob",
      ]);

      // Verify final state across both clients
      expect(storeClient1.review.length).toBe(1);
      expect(storeClient2.review.length).toBe(1);
      expect(storeClient1.comment.length).toBe(2);
      expect(storeClient2.comment.length).toBe(2);
      expect(storeClient1.task.length).toBe(1);
      expect(storeClient2.task.length).toBe(1);

      // Verify review is approved
      expect(review.data.status).toBe("approved");
      expect(review.data.approvedBy).toContain("bob");

      // Verify task is completed
      expect(task.data.status).toBe("completed");
      expect(task.data.completedAt).toBeDefined();

      // Verify sync operations were executed
      const totalRequests =
        mockHttpClient1.getRequests().length +
        mockHttpClient2.getRequests().length;
      expect(totalRequests).toBeGreaterThan(0);
    });
  });
});
