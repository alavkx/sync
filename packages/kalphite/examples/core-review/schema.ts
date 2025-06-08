import { z } from "zod";

// Utility function for generating unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Base entity schema for all review entities
const BaseEntitySchema = z.object({
  id: z.string(),
  updatedAt: z.number(),
});

// Review status and priority enums
const ReviewStatusSchema = z.enum([
  "draft",
  "open",
  "in_review",
  "approved",
  "changes_requested",
  "merged",
  "closed",
]);

const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);
const TaskStatusSchema = z.enum([
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);

// Core Review entity - represents a pull request or code review
const ReviewSchema = BaseEntitySchema.extend({
  type: z.literal("review"),
  data: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    branch: z.string(),
    baseBranch: z.string().default("main"),
    status: ReviewStatusSchema,
    priority: PrioritySchema.default("medium"),
    isDraft: z.boolean().default(false),
    createdAt: z.number(),
    assignedReviewers: z.array(z.string()).default([]),
    approvedBy: z.array(z.string()).default([]),
    changesRequestedBy: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
    filesChanged: z.number().default(0),
    linesAdded: z.number().default(0),
    linesDeleted: z.number().default(0),
  }),
});

// Comment entity - inline and general comments
const CommentSchema = BaseEntitySchema.extend({
  type: z.literal("comment"),
  data: z.object({
    reviewId: z.string(),
    author: z.string(),
    content: z.string(),
    filePath: z.string().optional(), // For inline comments
    lineNumber: z.number().optional(), // For inline comments
    lineType: z.enum(["addition", "deletion", "context"]).optional(),
    isResolved: z.boolean().default(false),
    isCode: z.boolean().default(false), // Whether this is a code suggestion
    parentCommentId: z.string().optional(), // For threading
    createdAt: z.number(),
  }),
});

// File entity - tracks files in the review
const FileSchema = BaseEntitySchema.extend({
  type: z.literal("file"),
  data: z.object({
    reviewId: z.string(),
    path: z.string(),
    status: z.enum(["added", "modified", "deleted", "renamed"]),
    linesAdded: z.number().default(0),
    linesDeleted: z.number().default(0),
    oldPath: z.string().optional(), // For renamed files
    isBinary: z.boolean().default(false),
    language: z.string().optional(),
    hasConflicts: z.boolean().default(false),
  }),
});

// Reviewer entity - people involved in reviews
const ReviewerSchema = BaseEntitySchema.extend({
  type: z.literal("reviewer"),
  data: z.object({
    name: z.string(),
    email: z.string(),
    username: z.string(),
    avatar: z.string().optional(),
    role: z.enum(["author", "reviewer", "maintainer", "guest"]),
    isActive: z.boolean().default(true),
    reviewCount: z.number().default(0),
    expertise: z.array(z.string()).default([]), // Programming languages, domains
  }),
});

// Task entity - action items from reviews
const TaskSchema = BaseEntitySchema.extend({
  type: z.literal("task"),
  data: z.object({
    reviewId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    assignee: z.string(),
    priority: PrioritySchema.default("medium"),
    status: TaskStatusSchema,
    dueDate: z.number().optional(),
    createdAt: z.number(),
    completedAt: z.number().optional(),
    labels: z.array(z.string()).default([]),
    relatedCommentId: z.string().optional(),
  }),
});

// Union schema for all entities
export const EntitySchema = z.discriminatedUnion("type", [
  ReviewSchema,
  CommentSchema,
  FileSchema,
  ReviewerSchema,
  TaskSchema,
]);

// Type exports
export type Review = z.infer<typeof ReviewSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type File = z.infer<typeof FileSchema>;
export type Reviewer = z.infer<typeof ReviewerSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Entity = z.infer<typeof EntitySchema>;

// Helper functions for creating entities
export function createReview(
  title: string,
  description: string,
  author: string,
  branch: string,
  options: Partial<Review["data"]> = {}
): Review {
  return {
    id: generateId(),
    type: "review",
    data: {
      title,
      description,
      author,
      branch,
      baseBranch: "main",
      status: "draft",
      priority: "medium",
      isDraft: true,
      createdAt: Date.now(),
      assignedReviewers: [],
      approvedBy: [],
      changesRequestedBy: [],
      labels: [],
      filesChanged: 0,
      linesAdded: 0,
      linesDeleted: 0,
      ...options,
    },
    updatedAt: Date.now(),
  };
}

export function createComment(
  reviewId: string,
  author: string,
  content: string,
  options: Partial<Comment["data"]> = {}
): Comment {
  return {
    id: generateId(),
    type: "comment",
    data: {
      reviewId,
      author,
      content,
      isResolved: false,
      isCode: false,
      createdAt: Date.now(),
      ...options,
    },
    updatedAt: Date.now(),
  };
}

export function createFile(
  reviewId: string,
  path: string,
  status: File["data"]["status"],
  options: Partial<File["data"]> = {}
): File {
  return {
    id: generateId(),
    type: "file",
    data: {
      reviewId,
      path,
      status,
      linesAdded: 0,
      linesDeleted: 0,
      isBinary: false,
      hasConflicts: false,
      ...options,
    },
    updatedAt: Date.now(),
  };
}

export function createReviewer(
  name: string,
  email: string,
  username: string,
  role: Reviewer["data"]["role"],
  options: Partial<Reviewer["data"]> = {}
): Reviewer {
  return {
    id: generateId(),
    type: "reviewer",
    data: {
      name,
      email,
      username,
      role,
      isActive: true,
      reviewCount: 0,
      expertise: [],
      ...options,
    },
    updatedAt: Date.now(),
  };
}

export function createTask(
  reviewId: string,
  title: string,
  assignee: string,
  options: Partial<Task["data"]> = {}
): Task {
  return {
    id: generateId(),
    type: "task",
    data: {
      reviewId,
      title,
      assignee,
      priority: "medium",
      status: "open",
      createdAt: Date.now(),
      labels: [],
      ...options,
    },
    updatedAt: Date.now(),
  };
}

// Utility functions for working with reviews
export function isReviewComplete(review: Review): boolean {
  return ["approved", "merged", "closed"].includes(review.data.status);
}

export function getReviewProgress(review: Review): {
  approvalPercentage: number;
  isFullyApproved: boolean;
  pendingReviewers: string[];
} {
  const assigned = review.data.assignedReviewers.length;
  const approved = review.data.approvedBy.length;

  return {
    approvalPercentage: assigned > 0 ? (approved / assigned) * 100 : 0,
    isFullyApproved: assigned > 0 && approved >= assigned,
    pendingReviewers: review.data.assignedReviewers.filter(
      (reviewer) => !review.data.approvedBy.includes(reviewer)
    ),
  };
}

export function canMergeReview(review: Review): boolean {
  const progress = getReviewProgress(review);
  return (
    review.data.status === "approved" &&
    progress.isFullyApproved &&
    review.data.changesRequestedBy.length === 0
  );
}
