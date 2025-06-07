import { useEffect, useState } from "react";
import { useSyncEngine } from "../sync-engine/useSyncEngine";
import { CodeReviewService } from "./code-review-service";
import type { Comment, Review, UserID } from "./types";

export function useCodeReview(currentUserId: UserID) {
  const { engine, state, error } = useSyncEngine(
    `client-${currentUserId}-${Date.now()}`
  );
  const [service] = useState(
    () => new CodeReviewService(engine, currentUserId)
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Subscribe to domain-specific changes
  useEffect(() => {
    const updateComments = () => setComments(service.getComments());
    const updateReviews = () => setReviews(service.getAllReviews());

    // Initial load
    updateComments();
    updateReviews();

    // Subscribe to changes
    service.onCommentChange(updateComments);
    service.onReviewChange(updateReviews);
  }, [service]);

  return {
    // State
    state,
    error,
    comments,
    reviews,

    // Service instance for advanced usage
    service,

    // Comment operations
    addComment: service.addComment.bind(service),
    updateComment: service.updateComment.bind(service),
    deleteComment: service.deleteComment.bind(service),

    // Review operations
    createReview: service.createReview.bind(service),
    updateReviewStatus: service.updateReviewStatus.bind(service),

    // Query helpers
    getComment: service.getComment.bind(service),
    getCommentsForLine: service.getCommentsForLine.bind(service),
    getReview: service.getReview.bind(service),

    // Sync operations
    push: service.push.bind(service),
    pull: service.pull.bind(service),
  };
}
