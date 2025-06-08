import { useState } from "react";
import "./App.css";
import { CreateReviewModal } from "./components/CreateReviewModal";
import { ReviewDetails } from "./components/ReviewDetails";
import { ReviewList } from "./components/ReviewList";
import { Statistics } from "./components/Statistics";
import { TeamOverview } from "./components/TeamOverview";
import { loadDemoData, useCollection, useKalphiteStore } from "./lib/hooks";

type View = "reviews" | "team" | "stats";

export default function App() {
  // Use Kalphite React hooks for reactive data
  const store = useKalphiteStore(null);
  const reviews = useCollection("review");

  const [currentView, setCurrentView] = useState<View>("reviews");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Get the selected review
  const selectedReview = selectedReviewId
    ? reviews.find((r) => r.id === selectedReviewId)
    : null;

  // Filter reviews by status
  const filteredReviews =
    statusFilter === "all"
      ? reviews
      : reviews.filter((r) => r.data.status === statusFilter);

  // Initialize with demo data if empty
  const initializeDemoData = () => {
    loadDemoData();
  };

  const stats = {
    total: reviews.length,
    open: reviews.filter((r) => r.data.status === "open").length,
    inReview: reviews.filter((r) => r.data.status === "in_review").length,
    approved: reviews.filter((r) => r.data.status === "approved").length,
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">
              🔍 Core Review
              <span className="subtitle">Powered by Kalphite</span>
            </h1>
          </div>

          <nav className="header-nav">
            <button
              className={`nav-btn ${currentView === "reviews" ? "active" : ""}`}
              onClick={() => setCurrentView("reviews")}
            >
              📋 Reviews ({stats.total})
            </button>
            <button
              className={`nav-btn ${currentView === "team" ? "active" : ""}`}
              onClick={() => setCurrentView("team")}
            >
              👥 Team
            </button>
            <button
              className={`nav-btn ${currentView === "stats" ? "active" : ""}`}
              onClick={() => setCurrentView("stats")}
            >
              📊 Stats
            </button>
          </nav>

          <div className="header-actions">
            {reviews.length === 0 && (
              <button
                className="btn btn-secondary"
                onClick={initializeDemoData}
              >
                🚀 Load Demo Data
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              ➕ New Review
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {currentView === "reviews" && (
          <div className="reviews-layout">
            {/* Reviews Sidebar */}
            <div className="reviews-sidebar">
              <div className="sidebar-header">
                <h2>Reviews</h2>
                <div className="status-filters">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="status-filter"
                  >
                    <option value="all">All Reviews</option>
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="in_review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="merged">Merged</option>
                  </select>
                </div>
              </div>

              <ReviewList
                reviews={filteredReviews}
                selectedReviewId={selectedReviewId}
                onSelectReview={setSelectedReviewId}
              />
            </div>

            {/* Review Details */}
            <div className="reviews-main">
              {selectedReview ? (
                <ReviewDetails
                  review={selectedReview}
                  onClose={() => setSelectedReviewId(null)}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>Select a review to get started</h3>
                  <p>
                    Choose a review from the sidebar to see details, comments,
                    and files.
                  </p>
                  {filteredReviews.length === 0 && reviews.length > 0 && (
                    <p className="filter-note">
                      No reviews match the current filter. Try selecting "All
                      Reviews".
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === "team" && <TeamOverview />}
        {currentView === "stats" && <Statistics />}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateReviewModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(reviewId: string) => {
            setSelectedReviewId(reviewId);
            setShowCreateModal(false);
            setCurrentView("reviews");
          }}
        />
      )}

      {/* Real-time Stats Footer */}
      <footer className="app-footer">
        <div className="footer-stats">
          <span className="stat">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </span>
          <span className="stat">
            <span className="stat-value stat-open">{stats.open}</span>
            <span className="stat-label">Open</span>
          </span>
          <span className="stat">
            <span className="stat-value stat-review">{stats.inReview}</span>
            <span className="stat-label">In Review</span>
          </span>
          <span className="stat">
            <span className="stat-value stat-approved">{stats.approved}</span>
            <span className="stat-label">Approved</span>
          </span>
        </div>
        <div className="footer-info">
          Real-time updates powered by Kalphite ⚡
        </div>
      </footer>
    </div>
  );
}
