// Mock interfaces for demo
interface Review {
  id: string;
  data: {
    title: string;
    author: string;
    branch: string;
    baseBranch: string;
    status: string;
    priority: string;
    assignedReviewers: string[];
    labels: string[];
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    createdAt: number;
    approvedBy: string[];
  };
}

const getReviewProgress = (review: Review) => ({
  approvalPercentage: Math.round(
    (review.data.approvedBy.length /
      Math.max(review.data.assignedReviewers.length, 1)) *
      100
  ),
});

const canMergeReview = (review: Review) => review.data.status === "approved";

interface ReviewListProps {
  reviews: Review[];
  selectedReviewId: string | null;
  onSelectReview: (id: string) => void;
}

export function ReviewList({
  reviews,
  selectedReviewId,
  onSelectReview,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="empty-reviews">
        <div className="empty-icon">📝</div>
        <p>No reviews found</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return "📝";
      case "open":
        return "🔵";
      case "in_review":
        return "👀";
      case "approved":
        return "✅";
      case "changes_requested":
        return "🔄";
      case "merged":
        return "🎉";
      case "closed":
        return "❌";
      default:
        return "📋";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "priority-critical";
      case "high":
        return "priority-high";
      case "medium":
        return "priority-medium";
      case "low":
        return "priority-low";
      default:
        return "priority-medium";
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  return (
    <div className="review-list">
      {reviews.map((review) => {
        const progress = getReviewProgress(review);
        const canMerge = canMergeReview(review);
        const isSelected = review.id === selectedReviewId;

        return (
          <div
            key={review.id}
            className={`review-item ${isSelected ? "selected" : ""}`}
            onClick={() => onSelectReview(review.id)}
          >
            <div className="review-header">
              <div className="review-title-row">
                <span className="status-icon">
                  {getStatusIcon(review.data.status)}
                </span>
                <h3 className="review-title" title={review.data.title}>
                  {review.data.title}
                </h3>
                <span
                  className={`priority-badge ${getPriorityColor(
                    review.data.priority
                  )}`}
                >
                  {review.data.priority}
                </span>
              </div>

              <div className="review-meta">
                <span className="review-author">by {review.data.author}</span>
                <span className="review-time">
                  {formatTimeAgo(review.data.createdAt)}
                </span>
              </div>
            </div>

            <div className="review-details">
              <div className="review-branch">
                {review.data.branch} → {review.data.baseBranch}
              </div>

              <div className="review-stats">
                <span className="stat">
                  <span className="stat-icon">📁</span>
                  {review.data.filesChanged}
                </span>
                <span className="stat">
                  <span className="stat-icon">+</span>
                  {review.data.linesAdded}
                </span>
                <span className="stat">
                  <span className="stat-icon">-</span>
                  {review.data.linesDeleted}
                </span>
              </div>

              {review.data.assignedReviewers.length > 0 && (
                <div className="review-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress.approvalPercentage}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {progress.approvalPercentage}% approved
                  </span>
                  {canMerge && (
                    <span className="merge-ready">🚀 Ready to merge</span>
                  )}
                </div>
              )}

              {review.data.labels.length > 0 && (
                <div className="review-labels">
                  {review.data.labels.slice(0, 3).map((label) => (
                    <span key={label} className="label">
                      {label}
                    </span>
                  ))}
                  {review.data.labels.length > 3 && (
                    <span className="label-more">
                      +{review.data.labels.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
