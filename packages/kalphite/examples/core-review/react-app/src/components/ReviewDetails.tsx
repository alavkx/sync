import { useState } from "react";
import { useCollection } from "../lib/hooks";

interface ReviewDetailsProps {
  review: any;
  onClose: () => void;
}

export function ReviewDetails({ review, onClose }: ReviewDetailsProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "files" | "comments" | "tasks"
  >("overview");

  // Get related entities using Kalphite React hooks
  const files = useCollection("file").filter(
    (f: any) => f.data.reviewId === review.id
  );
  const comments = useCollection("comment").filter(
    (c: any) => c.data.reviewId === review.id
  );
  const tasks = useCollection("task").filter(
    (t: any) => t.data.reviewId === review.id
  );
  const reviewers = useCollection("reviewer");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "status-draft";
      case "open":
        return "status-open";
      case "in_review":
        return "status-review";
      case "approved":
        return "status-approved";
      case "changes_requested":
        return "status-changes";
      case "merged":
        return "status-merged";
      case "closed":
        return "status-closed";
      default:
        return "status-default";
    }
  };

  const getFileIcon = (status: string) => {
    switch (status) {
      case "added":
        return "➕";
      case "modified":
        return "📝";
      case "deleted":
        return "❌";
      case "renamed":
        return "🔄";
      default:
        return "📄";
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getReviewerInfo = (username: string) => {
    return reviewers.find((r: any) => r.data.username === username);
  };

  return (
    <div className="review-details">
      <div className="review-details-header">
        <div className="header-main">
          <div className="title-section">
            <h1 className="review-title">{review.data.title}</h1>
            <span
              className={`status-badge ${getStatusColor(review.data.status)}`}
            >
              {review.data.status.replace("_", " ").toUpperCase()}
            </span>
          </div>

          <div className="review-meta">
            <div className="meta-item">
              <span className="meta-label">Author:</span>
              <span className="meta-value">{review.data.author}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Branch:</span>
              <span className="meta-value code">
                {review.data.branch} → {review.data.baseBranch}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Created:</span>
              <span className="meta-value">
                {formatTimestamp(review.data.createdAt)}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Priority:</span>
              <span
                className={`priority-badge priority-${review.data.priority}`}
              >
                {review.data.priority}
              </span>
            </div>
          </div>
        </div>

        <button className="close-btn" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      {review.data.description && (
        <div className="review-description">
          <h3>Description</h3>
          <p>{review.data.description}</p>
        </div>
      )}

      <div className="review-tabs">
        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Overview
          </button>
          <button
            className={`tab-btn ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            📁 Files ({files.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "comments" ? "active" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            💬 Comments ({comments.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            ✅ Tasks ({tasks.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "overview" && (
            <div className="overview-tab">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{review.data.filesChanged}</div>
                  <div className="stat-label">Files Changed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number stat-positive">
                    +{review.data.linesAdded}
                  </div>
                  <div className="stat-label">Lines Added</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number stat-negative">
                    -{review.data.linesDeleted}
                  </div>
                  <div className="stat-label">Lines Deleted</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">
                    {review.data.assignedReviewers.length}
                  </div>
                  <div className="stat-label">Reviewers</div>
                </div>
              </div>

              <div className="reviewers-section">
                <h3>Reviewers</h3>
                <div className="reviewers-list">
                  {review.data.assignedReviewers.map((username: string) => {
                    const reviewer = getReviewerInfo(username);
                    const hasApproved =
                      review.data.approvedBy.includes(username);
                    const hasRequestedChanges =
                      review.data.changesRequestedBy.includes(username);

                    return (
                      <div key={username} className="reviewer-item">
                        <div className="reviewer-info">
                          <span className="reviewer-name">
                            {reviewer?.data.name || username}
                          </span>
                          <span className="reviewer-username">@{username}</span>
                        </div>
                        <div className="reviewer-status">
                          {hasApproved && (
                            <span className="status-approved">✅ Approved</span>
                          )}
                          {hasRequestedChanges && (
                            <span className="status-changes">
                              🔄 Changes Requested
                            </span>
                          )}
                          {!hasApproved && !hasRequestedChanges && (
                            <span className="status-pending">⏳ Pending</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {review.data.labels.length > 0 && (
                <div className="labels-section">
                  <h3>Labels</h3>
                  <div className="labels-list">
                    {review.data.labels.map((label: string) => (
                      <span key={label} className="label">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "files" && (
            <div className="files-tab">
              {files.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📁</div>
                  <p>No files changed</p>
                </div>
              ) : (
                <div className="files-list">
                  {files.map((file: any) => (
                    <div key={file.id} className="file-item">
                      <div className="file-header">
                        <span className="file-icon">
                          {getFileIcon(file.data.status)}
                        </span>
                        <span className="file-path">{file.data.path}</span>
                        <span className="file-status">{file.data.status}</span>
                      </div>
                      <div className="file-stats">
                        <span className="stat-positive">
                          +{file.data.linesAdded}
                        </span>
                        <span className="stat-negative">
                          -{file.data.linesDeleted}
                        </span>
                        {file.data.language && (
                          <span className="file-language">
                            {file.data.language}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "comments" && (
            <div className="comments-tab">
              {comments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <p>No comments yet</p>
                </div>
              ) : (
                <div className="comments-list">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-header">
                        <span className="comment-author">
                          {comment.data.author}
                        </span>
                        <span className="comment-time">
                          {formatTimestamp(comment.data.createdAt)}
                        </span>
                        {comment.data.isResolved && (
                          <span className="comment-resolved">✅ Resolved</span>
                        )}
                      </div>
                      <div className="comment-content">
                        {comment.data.content}
                      </div>
                      {comment.data.filePath && (
                        <div className="comment-location">
                          📍 {comment.data.filePath}
                          {comment.data.lineNumber &&
                            `:${comment.data.lineNumber}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="tasks-tab">
              {tasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✅</div>
                  <p>No tasks assigned</p>
                </div>
              ) : (
                <div className="tasks-list">
                  {tasks.map((task: any) => {
                    const isCompleted = task.data.status === "completed";
                    const isInProgress = task.data.status === "in_progress";

                    return (
                      <div
                        key={task.id}
                        className={`task-item ${task.data.status}`}
                      >
                        <div className="task-header">
                          <span className="task-icon">
                            {isCompleted ? "✅" : isInProgress ? "🔄" : "⏳"}
                          </span>
                          <span className="task-title">{task.data.title}</span>
                          <span
                            className={`priority-badge priority-${task.data.priority}`}
                          >
                            {task.data.priority}
                          </span>
                        </div>
                        {task.data.description && (
                          <div className="task-description">
                            {task.data.description}
                          </div>
                        )}
                        <div className="task-meta">
                          <span>Assigned to: {task.data.assignee}</span>
                          <span>
                            Created: {formatTimestamp(task.data.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
