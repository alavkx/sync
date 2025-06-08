#!/usr/bin/env node

import { canMergeReview, getReviewProgress, type Review } from "./schema";
import { createDemoData, getStoreStats, reviewStore } from "./store";

// CLI Colors
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

console.log(colorize("🔍 Core Review Tool - Interactive Demo", "bright"));
console.log("─".repeat(60));

// Step 1: Create demo data
console.log(colorize("\n📝 Step 1: Creating demo data...", "bright"));
createDemoData();

// Step 2: Show stats
console.log(colorize("\n📊 Step 2: System overview", "bright"));
const stats = getStoreStats();
console.log(`Reviews: ${colorize(stats.reviews.toString(), "green")}`);
console.log(`Comments: ${colorize(stats.comments.toString(), "cyan")}`);
console.log(`Files: ${colorize(stats.files.toString(), "blue")}`);
console.log(`Reviewers: ${colorize(stats.reviewers.toString(), "magenta")}`);
console.log(`Tasks: ${colorize(stats.tasks.toString(), "yellow")}`);

// Step 3: List reviews
console.log(colorize("\n📋 Step 3: Active reviews", "bright"));
const allReviews = reviewStore.review.filter(
  (entity): entity is Review => entity.type === "review"
);
allReviews.forEach((review, index) => {
  const progress = getReviewProgress(review);
  const canMerge = canMergeReview(review);

  console.log(`\n${index + 1}. ${colorize(review.data.title, "bright")}`);
  console.log(`   Status: ${formatStatus(review.data.status)}`);
  console.log(`   Author: ${review.data.author}`);
  console.log(`   Branch: ${review.data.branch}`);
  console.log(
    `   Progress: ${progress.approvalPercentage.toFixed(0)}% approved`
  );
  console.log(`   Reviewers: ${review.data.assignedReviewers.join(", ")}`);
  if (canMerge) {
    console.log(`   ${colorize("✅ Ready to merge!", "green")}`);
  }
});

// Step 4: Show review details
if (allReviews.length > 0) {
  const review = allReviews[0];
  console.log(
    colorize(`\n📄 Step 4: Review details for "${review.data.title}"`, "bright")
  );

  // Files
  const reviewFiles = reviewStore.file.filter(
    (entity: any) =>
      entity.type === "file" && entity.data.reviewId === review.id
  );

  if (reviewFiles.length > 0) {
    console.log(colorize("\nFiles changed:", "cyan"));
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
        `  ${statusIcon} ${file.data.path} (+${file.data.linesAdded}/-${file.data.linesDeleted})`
      );
    });
  }

  // Comments
  const reviewComments = reviewStore.comment.filter(
    (entity: any) =>
      entity.type === "comment" && entity.data.reviewId === review.id
  );

  if (reviewComments.length > 0) {
    console.log(colorize("\nComments:", "cyan"));
    reviewComments.forEach((comment: any) => {
      const location = comment.data.filePath
        ? `${comment.data.filePath}:${comment.data.lineNumber}`
        : "General";
      console.log(
        `  ${colorize(comment.data.author, "yellow")}: ${comment.data.content}`
      );
      console.log(`    ${colorize(`(${location})`, "gray")}`);
    });
  }

  // Tasks
  const reviewTasks = reviewStore.task.filter(
    (entity: any) =>
      entity.type === "task" && entity.data.reviewId === review.id
  );

  if (reviewTasks.length > 0) {
    console.log(colorize("\nTasks:", "cyan"));
    reviewTasks.forEach((task: any) => {
      const statusIcon =
        task.data.status === "completed"
          ? "✅"
          : task.data.status === "in_progress"
          ? "🔄"
          : "⏳";
      console.log(`  ${statusIcon} ${task.data.title} (${task.data.assignee})`);
      if (task.data.description) {
        console.log(`     ${colorize(task.data.description, "gray")}`);
      }
    });
  }
}

// Step 5: Simulate approval workflow
if (allReviews.length > 0) {
  const review = allReviews[0];
  console.log(colorize("\n🎯 Step 5: Approval workflow simulation", "bright"));

  console.log(`Initial status: ${formatStatus(review.data.status)}`);
  console.log(
    `Assigned reviewers: ${review.data.assignedReviewers.join(", ")}`
  );

  // Simulate Alice approving
  if (review.data.assignedReviewers.includes("alice")) {
    review.data.approvedBy.push("alice");
    review.updatedAt = Date.now();
    console.log(colorize("✅ Alice approved the review", "green"));
  }

  // Simulate Bob approving
  if (review.data.assignedReviewers.includes("bob")) {
    review.data.approvedBy.push("bob");
    review.updatedAt = Date.now();
    console.log(colorize("✅ Bob approved the review", "green"));
  }

  // Check if fully approved
  const finalProgress = getReviewProgress(review);
  if (finalProgress.isFullyApproved) {
    review.data.status = "approved";
    console.log(colorize("🎉 Review is fully approved!", "green"));
  }

  if (canMergeReview(review)) {
    console.log(colorize("🚀 Review is ready to merge!", "green"));
  }

  console.log(
    `Final approval: ${finalProgress.approvalPercentage.toFixed(0)}%`
  );
  console.log(`Final status: ${formatStatus(review.data.status)}`);
}

// Step 6: Performance demonstration
console.log(colorize("\n⚡ Step 6: Performance demonstration", "bright"));

const startTime = performance.now();

// Create 100 additional reviews
for (let i = 0; i < 100; i++) {
  const review = {
    id: `perf-${Date.now()}-${i}`,
    type: "review" as const,
    data: {
      title: `Performance test review ${i}`,
      description: `Auto-generated review for performance testing`,
      author: "perf-tester",
      branch: `feature/perf-${i}`,
      baseBranch: "main",
      status: "open" as const,
      priority: "medium" as const,
      isDraft: false,
      createdAt: Date.now(),
      assignedReviewers: ["alice"],
      approvedBy: [],
      changesRequestedBy: [],
      labels: ["performance"],
      filesChanged: Math.floor(Math.random() * 10) + 1,
      linesAdded: Math.floor(Math.random() * 100) + 10,
      linesDeleted: Math.floor(Math.random() * 50) + 1,
    },
    updatedAt: Date.now(),
  };

  reviewStore.review.push(review);
}

const endTime = performance.now();
const duration = endTime - startTime;

console.log(`✅ Created 100 reviews in ${duration.toFixed(2)}ms`);
console.log(`⚡ Average: ${(duration / 100).toFixed(3)}ms per review`);

// Query performance test
const queryStart = performance.now();
const openReviews = reviewStore.review.filter(
  (entity): entity is Review =>
    entity.type === "review" && entity.data.status === "open"
);
const queryTime = performance.now() - queryStart;

console.log(
  `🔍 Found ${openReviews.length} open reviews in ${queryTime.toFixed(2)}ms`
);

// Final stats
const finalStats = getStoreStats();
console.log(colorize("\n📈 Final system stats:", "bright"));
console.log(
  `Total reviews: ${colorize(finalStats.reviews.toString(), "green")}`
);
console.log(
  `Total entities: ${colorize(finalStats.total.toString(), "bright")}`
);

console.log(colorize("\n🎯 Demo completed successfully!", "bright"));
console.log("This demonstrates Kalphite's memory-first approach with:");
console.log("• Instant data operations");
console.log("• Type-safe entity management");
console.log("• Reactive data updates");
console.log("• High-performance querying");
console.log("• Zero async complexity");
