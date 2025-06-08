export function TeamOverview() {
  // Mock team data - in real app would use useCollection('reviewer')
  const teamMembers = [
    {
      id: "1",
      name: "Alice Johnson",
      username: "alice",
      email: "alice@company.com",
      role: "Senior Developer",
      expertise: ["React", "TypeScript", "Node.js"],
      reviewsAssigned: 5,
      reviewsCompleted: 12,
    },
    {
      id: "2",
      name: "Bob Smith",
      username: "bob",
      email: "bob@company.com",
      role: "Lead Developer",
      expertise: ["Python", "Django", "PostgreSQL"],
      reviewsAssigned: 3,
      reviewsCompleted: 8,
    },
    {
      id: "3",
      name: "Carol Williams",
      username: "carol",
      email: "carol@company.com",
      role: "Frontend Specialist",
      expertise: ["React", "CSS", "UI/UX"],
      reviewsAssigned: 4,
      reviewsCompleted: 15,
    },
  ];

  return (
    <div className="team-overview">
      <div className="team-header">
        <h2>Team Overview</h2>
        <p>Review team members, their expertise, and current workload</p>
      </div>

      <div className="team-grid">
        {teamMembers.map((member) => (
          <div key={member.id} className="team-member-card">
            <div className="member-header">
              <div className="member-avatar">
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div className="member-info">
                <h3 className="member-name">{member.name}</h3>
                <p className="member-role">{member.role}</p>
                <p className="member-email">{member.email}</p>
              </div>
            </div>

            <div className="member-expertise">
              <h4>Expertise</h4>
              <div className="expertise-tags">
                {member.expertise.map((skill) => (
                  <span key={skill} className="expertise-tag">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="member-stats">
              <div className="stat">
                <span className="stat-number">{member.reviewsAssigned}</span>
                <span className="stat-label">Active Reviews</span>
              </div>
              <div className="stat">
                <span className="stat-number">{member.reviewsCompleted}</span>
                <span className="stat-label">Completed</span>
              </div>
            </div>

            <div className="member-actions">
              <button className="btn btn-secondary btn-small">
                View Profile
              </button>
              <button className="btn btn-primary btn-small">
                Assign Review
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
