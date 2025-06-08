#!/usr/bin/env node

import {
  canMergeReview,
  createReview,
  getReviewProgress,
  type Review,
} from "./schema";
import {
  clearStore,
  createDemoData,
  getStoreStats,
  reviewStore,
} from "./store";

// CLI Colors and formatting
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatStatus(status: string): string {
  const statusColors: Record<string, keyof typeof colors> = {
    draft: "gray",
    open: "blue",
    in_review: "yellow",
    approved: "green",
    changes_requested: "red",
    merged: "green",
    closed: "gray",
  };
  return colorize(status.toUpperCase(), statusColors[status] || "reset");
}

function formatPriority(priority: string): string {
  const priorityColors: Record<string, keyof typeof colors> = {
    low: "gray",
    medium: "yellow",
    high: "red",
    critical: "magenta",
  };
  return colorize(priority.toUpperCase(), priorityColors[priority] || "reset");
}

// Core Review Management Commands
function listReviews(statusFilter?: string) {
  console.log(colorize("\n📋 Code Reviews", "bright"));
  console.log("─".repeat(80));

  const allReviews = reviewStore.review.filter(
    (entity): entity is Review => entity.type === "review"
  );
  let filteredReviews = allReviews;

  if (statusFilter) {
    filteredReviews = allReviews.filter(
      (r: Review) => r.data.status === statusFilter
    );
  }

  if (filteredReviews.length === 0) {
    console.log(colorize("No reviews found", "gray"));
    return;
  }

  filteredReviews.forEach((review, index) => {
    const progress = getReviewProgress(review);
    const canMerge = canMergeReview(review);

    console.log(`\n${index + 1}. ${colorize(review.data.title, "bright")}`);
    console.log(`   ${colorize("ID:", "gray")} ${review.id}`);
    console.log(`   ${colorize("Author:", "gray")} ${review.data.author}`);
    console.log(
      `   ${colorize("Branch:", "gray")} ${review.data.branch} → ${
        review.data.baseBranch
      }`
    );
    console.log(
      `   ${colorize("Status:", "gray")} ${formatStatus(
        review.data.status
      )} ${colorize("Priority:", "gray")} ${formatPriority(
        review.data.priority
      )}`
    );
    console.log(
      `   ${colorize("Files:", "gray")} ${review.data.filesChanged} ${colorize(
        "Lines:",
        "gray"
      )} +${review.data.linesAdded}/-${review.data.linesDeleted}`
    );
    console.log(
      `   ${colorize(
        "Reviewers:",
        "gray"
      )} ${review.data.assignedReviewers.join(", ")}`
    );
    console.log(
      `   ${colorize(
        "Progress:",
        "gray"
      )} ${progress.approvalPercentage.toFixed(0)}% approved ${
        canMerge ? colorize("✅ Ready to merge", "green") : ""
      }`
    );
    console.log(
      `   ${colorize("Created:", "gray")} ${formatTimestamp(
        review.data.createdAt
      )}`
    );

    if (review.data.labels.length > 0) {
      console.log(
        `   ${colorize("Labels:", "gray")} ${review.data.labels
          .map((l) => colorize(l, "cyan"))
          .join(", ")}`
      );
    }
  });
}

function createNewReview() {
  console.log(colorize("\n🔄 Create New Review", "bright"));

  // Simulate creating a review (in a real CLI you'd use prompts)
  const title = "Fix performance issue in search component";
  const description =
    "Optimizes search queries and adds proper indexing for better performance";
  const author = "developer";
  const branch = "fix/search-performance";

  const review = createReview(title, description, author, branch, {
    status: "open",
    priority: "medium",
    assignedReviewers: ["alice", "bob"],
    labels: ["performance", "frontend"],
    filesChanged: 3,
    linesAdded: 45,
    linesDeleted: 12,
  });

  reviewStore.review.push(review);

  console.log(colorize("✅ Review created successfully!", "green"));
  console.log(`   ID: ${review.id}`);
  console.log(`   Title: ${review.data.title}`);
  console.log(`   Branch: ${review.data.branch}`);
}

function reviewDetails(reviewId: string) {
  const review = reviewStore.review.find(
    (entity): entity is Review =>
      entity.type === "review" && entity.id === reviewId
  );

  if (!review) {
    console.log(colorize("❌ Review not found", "red"));
    return;
  }

  console.log(colorize(`\n📄 Review Details: ${review.data.title}`, "bright"));
  console.log("─".repeat(80));

  // Review info
  console.log(`${colorize("ID:", "gray")} ${review.id}`);
  console.log(`${colorize("Author:", "gray")} ${review.data.author}`);
  console.log(
    `${colorize("Branch:", "gray")} ${review.data.branch} → ${
      review.data.baseBranch
    }`
  );
  console.log(
    `${colorize("Status:", "gray")} ${formatStatus(review.data.status)}`
  );
  console.log(
    `${colorize("Priority:", "gray")} ${formatPriority(review.data.priority)}`
  );
  console.log(
    `${colorize("Created:", "gray")} ${formatTimestamp(review.data.createdAt)}`
  );

  if (review.data.description) {
    console.log(`\n${colorize("Description:", "gray")}`);
    console.log(`  ${review.data.description}`);
  }

  // Files
  const reviewFiles = reviewStore.file.filter(
    (entity: any) =>
      entity.type === "file" && entity.data.reviewId === review.id
  );

  if (reviewFiles.length > 0) {
    console.log(`\n${colorize("Files Changed:", "bright")}`);
    reviewFiles.forEach((file: any) => {
      const statusIcon =
        file.data.status === "added"
          ? "+"
          : file.data.status === "deleted"
          ? "-"
          : file.data.status === "modified"
          ? "~"
          : "📝";
      console.log(
        `  ${statusIcon} ${file.data.path} ${colorize(
          `+${file.data.linesAdded}/-${file.data.linesDeleted}`,
          "gray"
        )}`
      );
    });
  }

  // Comments
  const reviewComments = reviewStore.comment.filter(
    (entity: any) =>
      entity.type === "comment" && entity.data.reviewId === review.id
  );

  if (reviewComments.length > 0) {
    console.log(`\n${colorize("Comments:", "bright")}`);
    reviewComments.forEach((comment: any) => {
      const location = comment.data.filePath
        ? `${comment.data.filePath}:${comment.data.lineNumber}`
        : "General";
      console.log(
        `\n  ${colorize(comment.data.author, "cyan")} ${colorize(
          `(${location})`,
          "gray"
        )}`
      );
      console.log(`  ${comment.data.content}`);
      if (comment.data.isResolved) {
        console.log(`  ${colorize("✅ Resolved", "green")}`);
      }
    });
  }

  // Tasks
  const reviewTasks = reviewStore.task.filter(
    (entity: any) =>
      entity.type === "task" && entity.data.reviewId === review.id
  );

  if (reviewTasks.length > 0) {
    console.log(`\n${colorize("Tasks:", "bright")}`);
    reviewTasks.forEach((task: any) => {
      const statusIcon =
        task.data.status === "completed"
          ? "✅"
          : task.data.status === "in_progress"
          ? "🔄"
          : "⏳";
      console.log(
        `  ${statusIcon} ${task.data.title} ${colorize(
          `(${task.data.assignee})`,
          "gray"
        )}`
      );
      if (task.data.description) {
        console.log(`     ${colorize(task.data.description, "gray")}`);
      }
    });
  }

  // Review progress
  const progress = getReviewProgress(review);
  console.log(`\n${colorize("Review Progress:", "bright")}`);
  console.log(`  Approval: ${progress.approvalPercentage.toFixed(0)}%`);
  console.log(`  Approved by: ${review.data.approvedBy.join(", ") || "None"}`);
  console.log(`  Pending: ${progress.pendingReviewers.join(", ") || "None"}`);

  if (canMergeReview(review)) {
    console.log(`  ${colorize("✅ Ready to merge!", "green")}`);
  }
}

function approveReview(reviewId: string, reviewer: string) {
  const review = reviewStore.review.find(
    (entity): entity is Review =>
      entity.type === "review" && entity.id === reviewId
  );

  if (!review) {
    console.log(colorize("❌ Review not found", "red"));
    return;
  }

  if (!review.data.assignedReviewers.includes(reviewer)) {
    console.log(colorize("❌ You are not assigned to this review", "red"));
    return;
  }

  if (review.data.approvedBy.includes(reviewer)) {
    console.log(colorize("ℹ️ You have already approved this review", "yellow"));
    return;
  }

  // Update the review
  review.data.approvedBy.push(reviewer);
  review.data.changesRequestedBy = review.data.changesRequestedBy.filter(
    (r) => r !== reviewer
  );
  review.updatedAt = Date.now();

  // Check if fully approved
  const progress = getReviewProgress(review);
  if (progress.isFullyApproved) {
    review.data.status = "approved";
  }

  reviewStore.upsert(review.id, review);

  console.log(colorize("✅ Review approved!", "green"));
  console.log(`Progress: ${progress.approvalPercentage.toFixed(0)}% approved`);

  if (canMergeReview(review)) {
    console.log(colorize("🎉 Review is ready to merge!", "green"));
  }
}

// Stats and management commands
function showStats() {
  const stats = getStoreStats();

  console.log(colorize("\n📊 Review System Stats", "bright"));
  console.log("─".repeat(40));
  console.log(`Reviews: ${colorize(stats.reviews.toString(), "green")}`);
  console.log(`Comments: ${colorize(stats.comments.toString(), "cyan")}`);
  console.log(`Files: ${colorize(stats.files.toString(), "blue")}`);
  console.log(`Reviewers: ${colorize(stats.reviewers.toString(), "magenta")}`);
  console.log(`Tasks: ${colorize(stats.tasks.toString(), "yellow")}`);
  console.log(`Total entities: ${colorize(stats.total.toString(), "bright")}`);

  // Review status breakdown
  const allReviews = reviewStore.review.filter(
    (entity): entity is Review => entity.type === "review"
  );
  const statusCounts = allReviews.reduce((acc, review) => {
    acc[review.data.status] = (acc[review.data.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (Object.keys(statusCounts).length > 0) {
    console.log(`\n${colorize("Review Status Breakdown:", "bright")}`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${formatStatus(status)}: ${count}`);
    });
  }
}

function listReviewers() {
  console.log(colorize("\n👥 Reviewers", "bright"));
  console.log("─".repeat(60));

  const allReviewers = reviewStore.reviewer.filter(
    (entity: any) => entity.type === "reviewer"
  );
  if (allReviewers.length === 0) {
    console.log(colorize("No reviewers found", "gray"));
    return;
  }

  allReviewers.forEach((reviewer: any, index: number) => {
    const roleIcon =
      reviewer.data.role === "maintainer"
        ? "👑"
        : reviewer.data.role === "reviewer"
        ? "👤"
        : reviewer.data.role === "author"
        ? "✏️"
        : "👥";

    console.log(
      `\n${index + 1}. ${roleIcon} ${colorize(
        reviewer.data.name,
        "bright"
      )} (@${reviewer.data.username})`
    );
    console.log(`   ${colorize("Email:", "gray")} ${reviewer.data.email}`);
    console.log(`   ${colorize("Role:", "gray")} ${reviewer.data.role}`);
    console.log(
      `   ${colorize("Reviews:", "gray")} ${reviewer.data.reviewCount}`
    );

    if (reviewer.data.expertise.length > 0) {
      console.log(
        `   ${colorize("Expertise:", "gray")} ${reviewer.data.expertise.join(
          ", "
        )}`
      );
    }
  });
}

// Main CLI handler
export function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log(colorize("🔍 Core Review Tool - Powered by Kalphite", "bright"));

  switch (command) {
    case "list":
      listReviews(args[1]); // Optional status filter
      break;

    case "create":
      createNewReview();
      break;

    case "show":
      if (!args[1]) {
        console.log(colorize("❌ Please provide a review ID", "red"));
        break;
      }
      reviewDetails(args[1]);
      break;

    case "approve":
      if (!args[1] || !args[2]) {
        console.log(colorize("❌ Usage: approve <reviewId> <reviewer>", "red"));
        break;
      }
      approveReview(args[1], args[2]);
      break;

    case "reviewers":
      listReviewers();
      break;

    case "stats":
      showStats();
      break;

    case "demo":
      createDemoData();
      console.log(
        colorize(
          "✅ Demo data created! Try 'node cli.js list' to see reviews",
          "green"
        )
      );
      break;

    case "clear":
      clearStore();
      console.log(colorize("🗑️ All data cleared", "yellow"));
      break;

    default:
      console.log(colorize("\n📖 Available Commands:", "bright"));
      console.log(
        "  list [status]           - List all reviews (optionally filter by status)"
      );
      console.log("  create                  - Create a new review");
      console.log(
        "  show <id>              - Show detailed review information"
      );
      console.log("  approve <id> <reviewer> - Approve a review");
      console.log("  reviewers              - List all reviewers");
      console.log("  stats                  - Show system statistics");
      console.log("  demo                   - Create demo data");
      console.log("  clear                  - Clear all data");
      console.log("\nExample:");
      console.log("  node cli.js demo       # Create demo data");
      console.log("  node cli.js list       # List all reviews");
      console.log("  node cli.js show <id>  # Show review details");
  }
}

// Run the CLI
if (require.main === module) {
  main();
}
