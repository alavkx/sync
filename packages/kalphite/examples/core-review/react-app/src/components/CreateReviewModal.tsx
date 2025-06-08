import React, { useState } from "react";

interface CreateReviewModalProps {
  onClose: () => void;
  onCreated: (reviewId: string) => void;
}

export function CreateReviewModal({
  onClose,
  onCreated,
}: CreateReviewModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    branch: "",
    baseBranch: "main",
    priority: "medium",
    assignedReviewers: "",
    labels: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create a new review ID
    const reviewId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // In a real app, you would create the review using Kalphite store
    // For this demo, we'll just simulate it
    console.log("Creating review:", formData);

    onCreated(reviewId);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Review</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-review-form">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Brief description of the changes"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Detailed description of what was changed and why"
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="branch">Branch *</label>
              <input
                id="branch"
                type="text"
                value={formData.branch}
                onChange={(e) => handleChange("branch", e.target.value)}
                placeholder="feature/my-awesome-feature"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="baseBranch">Base Branch</label>
              <select
                id="baseBranch"
                value={formData.baseBranch}
                onChange={(e) => handleChange("baseBranch", e.target.value)}
              >
                <option value="main">main</option>
                <option value="develop">develop</option>
                <option value="staging">staging</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="assignedReviewers">Reviewers</label>
              <input
                id="assignedReviewers"
                type="text"
                value={formData.assignedReviewers}
                onChange={(e) =>
                  handleChange("assignedReviewers", e.target.value)
                }
                placeholder="alice, bob, charlie"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="labels">Labels</label>
            <input
              id="labels"
              type="text"
              value={formData.labels}
              onChange={(e) => handleChange("labels", e.target.value)}
              placeholder="frontend, bug-fix, enhancement"
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
