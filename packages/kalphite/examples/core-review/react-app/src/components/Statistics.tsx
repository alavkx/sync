export function Statistics() {
  // Mock statistics data - in real app would compute from store data
  const stats = {
    totalReviews: 156,
    openReviews: 23,
    avgReviewTime: 2.4,
    reviewsThisWeek: 18,
    mostActiveReviewer: "Alice Johnson",

    statusBreakdown: [
      { status: "Open", count: 23, percentage: 15 },
      { status: "In Review", count: 31, percentage: 20 },
      { status: "Approved", count: 45, percentage: 29 },
      { status: "Merged", count: 57, percentage: 36 },
    ],

    priorityBreakdown: [
      { priority: "Critical", count: 8, color: "#ef4444" },
      { priority: "High", count: 34, color: "#f97316" },
      { priority: "Medium", count: 78, color: "#eab308" },
      { priority: "Low", count: 36, color: "#22c55e" },
    ],

    recentActivity: [
      { action: "Review approved", user: "Alice", time: "2 hours ago" },
      { action: "New review created", user: "Bob", time: "4 hours ago" },
      { action: "Comments added", user: "Carol", time: "6 hours ago" },
      { action: "Review merged", user: "Dave", time: "8 hours ago" },
      { action: "Changes requested", user: "Eve", time: "1 day ago" },
    ],
  };

  return (
    <div className="statistics">
      <div className="stats-header">
        <h2>Review Statistics</h2>
        <p>Analytics and metrics for code review performance</p>
      </div>

      <div className="stats-overview">
        <div className="stat-card large">
          <div className="stat-number">{stats.totalReviews}</div>
          <div className="stat-label">Total Reviews</div>
          <div className="stat-trend positive">↗ 12% this month</div>
        </div>

        <div className="stat-card large">
          <div className="stat-number">{stats.avgReviewTime}d</div>
          <div className="stat-label">Avg Review Time</div>
          <div className="stat-trend negative">↗ 0.3d vs last month</div>
        </div>

        <div className="stat-card large">
          <div className="stat-number">{stats.reviewsThisWeek}</div>
          <div className="stat-label">Reviews This Week</div>
          <div className="stat-trend positive">↗ 15% vs last week</div>
        </div>

        <div className="stat-card large">
          <div className="stat-number">{stats.openReviews}</div>
          <div className="stat-label">Open Reviews</div>
          <div className="stat-trend neutral">→ Same as yesterday</div>
        </div>
      </div>

      <div className="stats-charts">
        <div className="chart-section">
          <h3>Review Status Distribution</h3>
          <div className="status-chart">
            {stats.statusBreakdown.map((item) => (
              <div key={item.status} className="status-bar">
                <div className="status-info">
                  <span className="status-name">{item.status}</span>
                  <span className="status-count">{item.count}</span>
                </div>
                <div className="status-progress">
                  <div
                    className={`status-fill status-${item.status
                      .toLowerCase()
                      .replace(" ", "-")}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <span className="status-percentage">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-section">
          <h3>Priority Distribution</h3>
          <div className="priority-chart">
            {stats.priorityBreakdown.map((item) => (
              <div key={item.priority} className="priority-item">
                <div
                  className="priority-indicator"
                  style={{ backgroundColor: item.color }}
                />
                <span className="priority-name">{item.priority}</span>
                <span className="priority-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stats-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {stats.recentActivity.map((activity, index) => (
            <div key={index} className="activity-item">
              <div className="activity-icon">
                {activity.action.includes("approved") && "✅"}
                {activity.action.includes("created") && "➕"}
                {activity.action.includes("comments") && "💬"}
                {activity.action.includes("merged") && "🎉"}
                {activity.action.includes("requested") && "🔄"}
              </div>
              <div className="activity-content">
                <div className="activity-text">
                  <strong>{activity.user}</strong>{" "}
                  {activity.action.toLowerCase()}
                </div>
                <div className="activity-time">{activity.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-insights">
        <h3>Insights & Recommendations</h3>
        <div className="insights-list">
          <div className="insight-item">
            <div className="insight-icon">📈</div>
            <div className="insight-content">
              <strong>Review velocity is improving</strong>
              <p>
                Average review time decreased by 0.8 days this month compared to
                last month.
              </p>
            </div>
          </div>

          <div className="insight-item">
            <div className="insight-icon">👑</div>
            <div className="insight-content">
              <strong>Most active reviewer: {stats.mostActiveReviewer}</strong>
              <p>
                Has completed 15 reviews this month with consistently high
                quality feedback.
              </p>
            </div>
          </div>

          <div className="insight-item">
            <div className="insight-icon">⚡</div>
            <div className="insight-content">
              <strong>Consider load balancing</strong>
              <p>
                Some reviewers have 5+ active reviews while others have fewer
                than 2.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
