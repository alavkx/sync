import { z } from "zod";

// Base schemas
export const UserIDSchema = z.string().min(1);
export const ReviewIDSchema = z.string().min(1);
export const CommentIDSchema = z.string().min(1);

// Derived types
export type UserID = z.infer<typeof UserIDSchema>;
export type ReviewID = z.infer<typeof ReviewIDSchema>;
export type CommentID = z.infer<typeof CommentIDSchema>;

// User schema
export const UserSchema = z.object({
  id: UserIDSchema,
  username: z.string().min(1).max(50),
  email: z.string().email(),
});

export type User = z.infer<typeof UserSchema>;

// Comment schema
export const CommentSchema = z.object({
  id: CommentIDSchema,
  reviewId: ReviewIDSchema,
  filePath: z.string().min(1),
  lineNumber: z.number().int().positive(),
  side: z.enum(["base", "head"]),
  authorId: UserIDSchema,
  message: z.string().min(1).max(1000),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Comment = z.infer<typeof CommentSchema>;

// Review status schema
export const ReviewStatusSchema = z.enum([
  "commented",
  "approved",
  "changes_requested",
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// Review schema
export const ReviewSchema = z.object({
  id: ReviewIDSchema,
  baseCommit: z.string().min(1),
  headCommit: z.string().min(1),
  authorId: UserIDSchema,
  status: ReviewStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Review = z.infer<typeof ReviewSchema>;

// Entity type constants with validation
export const EntityTypesSchema = z.object({
  COMMENT: z.literal("comment"),
  REVIEW: z.literal("review"),
  USER: z.literal("user"),
});

export const ENTITY_TYPES = {
  COMMENT: "comment",
  REVIEW: "review",
  USER: "user",
} as const;

// Input schemas for creating entities (without generated fields)
export const CreateCommentSchema = CommentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CreateReviewSchema = ReviewSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateCommentSchema = CommentSchema.partial().required({
  id: true,
});
export const UpdateReviewSchema = ReviewSchema.partial().required({ id: true });

export type CreateComment = z.infer<typeof CreateCommentSchema>;
export type CreateReview = z.infer<typeof CreateReviewSchema>;
export type UpdateComment = z.infer<typeof UpdateCommentSchema>;
export type UpdateReview = z.infer<typeof UpdateReviewSchema>;

// Validation helpers
export const validateUser = (data: unknown): User => UserSchema.parse(data);

export const validateComment = (data: unknown): Comment =>
  CommentSchema.parse(data);

export const validateReview = (data: unknown): Review =>
  ReviewSchema.parse(data);

export const validateCreateComment = (data: unknown): CreateComment =>
  CreateCommentSchema.parse(data);

export const validateCreateReview = (data: unknown): CreateReview =>
  CreateReviewSchema.parse(data);

export const validateUpdateComment = (data: unknown): UpdateComment =>
  UpdateCommentSchema.parse(data);

export const validateUpdateReview = (data: unknown): UpdateReview =>
  UpdateReviewSchema.parse(data);
