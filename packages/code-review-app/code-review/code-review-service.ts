import type { SyncEngine, SyncEntity } from "../sync-engine/types";
import {
  type Comment,
  type CommentID,
  ENTITY_TYPES,
  type Review,
  type ReviewID,
  type ReviewStatus,
  type UserID,
  validateComment,
  validateCreateComment,
  validateCreateReview,
  validateReview,
} from "./types";

export class CodeReviewService {
  constructor(private syncEngine: SyncEngine, private currentUserId: UserID) {}

  // Comment operations
  async addComment(commentInput: {
    reviewId: ReviewID;
    filePath: string;
    lineNumber: number;
    side: "base" | "head";
    message: string;
  }): Promise<CommentID> {
    // Validate input before creating
    const commentData = validateCreateComment({
      ...commentInput,
      authorId: this.currentUserId,
    });

    const entityId = await this.syncEngine.create(
      ENTITY_TYPES.COMMENT,
      commentData
    );
    return entityId as CommentID;
  }

  async updateComment(
    commentId: CommentID,
    updates: { message: string }
  ): Promise<void> {
    await this.syncEngine.update(commentId, updates);
  }

  async deleteComment(commentId: CommentID): Promise<void> {
    await this.syncEngine.delete(commentId);
  }

  // Review operations
  async createReview(reviewInput: {
    id: ReviewID;
    baseCommit: string;
    headCommit: string;
  }): Promise<ReviewID> {
    // Validate input before creating
    const reviewData = validateCreateReview({
      ...reviewInput,
      authorId: this.currentUserId,
      status: "commented" as ReviewStatus,
    });

    const entityId = await this.syncEngine.create(
      ENTITY_TYPES.REVIEW,
      reviewData
    );
    return entityId as ReviewID;
  }

  async updateReviewStatus(
    reviewId: ReviewID,
    status: ReviewStatus
  ): Promise<void> {
    await this.syncEngine.update(reviewId, { status });
  }

  // Query operations
  getComment(commentId: CommentID): Comment | null {
    const entity = this.syncEngine.get(commentId);
    return entity ? this.entityToComment(entity) : null;
  }

  getComments(filePath?: string): Comment[] {
    const commentEntities = this.syncEngine.getByType(ENTITY_TYPES.COMMENT);
    const comments = commentEntities.map((entity) =>
      this.entityToComment(entity)
    );

    if (filePath) {
      return comments.filter((comment) => comment.filePath === filePath);
    }

    return comments;
  }

  getCommentsForLine(
    filePath: string,
    lineNumber: number,
    side: "base" | "head"
  ): Comment[] {
    return this.syncEngine
      .query(
        (entity) =>
          entity.type === ENTITY_TYPES.COMMENT &&
          entity.data.filePath === filePath &&
          entity.data.lineNumber === lineNumber &&
          entity.data.side === side
      )
      .map((entity) => this.entityToComment(entity));
  }

  getReview(reviewId: ReviewID): Review | null {
    const entity = this.syncEngine.get(reviewId);
    return entity ? this.entityToReview(entity) : null;
  }

  getAllReviews(): Review[] {
    const reviewEntities = this.syncEngine.getByType(ENTITY_TYPES.REVIEW);
    return reviewEntities.map((entity) => this.entityToReview(entity));
  }

  // Event subscriptions with domain-specific filtering
  onCommentChange(
    callback: (
      comment: Comment,
      operation: "create" | "update" | "delete"
    ) => void
  ): void {
    this.syncEngine.onEntityChange((entity, operation) => {
      if (entity.type === ENTITY_TYPES.COMMENT) {
        callback(this.entityToComment(entity), operation);
      }
    });
  }

  onReviewChange(
    callback: (
      review: Review,
      operation: "create" | "update" | "delete"
    ) => void
  ): void {
    this.syncEngine.onEntityChange((entity, operation) => {
      if (entity.type === ENTITY_TYPES.REVIEW) {
        callback(this.entityToReview(entity), operation);
      }
    });
  }

  // Sync operations (delegated to sync engine)
  async push(): Promise<void> {
    await this.syncEngine.push();
  }

  async pull(): Promise<void> {
    await this.syncEngine.pull();
  }

  // Private helper methods to convert between entities and domain objects
  private entityToComment(entity: SyncEntity): Comment {
    // Use zod validation to ensure entity data conforms to Comment schema
    const commentData = {
      id: entity.id as CommentID,
      reviewId: entity.data.reviewId,
      filePath: entity.data.filePath,
      lineNumber: entity.data.lineNumber,
      side: entity.data.side,
      authorId: entity.data.authorId,
      message: entity.data.message,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    return validateComment(commentData);
  }

  private entityToReview(entity: SyncEntity): Review {
    // Use zod validation to ensure entity data conforms to Review schema
    const reviewData = {
      id: entity.id as ReviewID,
      baseCommit: entity.data.baseCommit,
      headCommit: entity.data.headCommit,
      authorId: entity.data.authorId,
      status: entity.data.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    return validateReview(reviewData);
  }
}
