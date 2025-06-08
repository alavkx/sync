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

// Colors for output
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

function pause(message: string = "Press Enter to continue...") {
  console.log(colorize(`\n${message}`, "gray"));
}

console.log(
  colorize("🔍 Core Review Tool - Interactive Workflow Demo", "bright")
);
console.log("=".repeat(60));

// Step 1: Start with clean slate
console.log(colorize("\n🗑️  Step 1: Starting with clean state", "bright"));
clearStore();
let stats = getStoreStats();
console.log(`Current state: ${stats.total} entities`);

pause();

// Step 2: Create demo data
console.log(colorize("\n📝 Step 2: Setting up demo environment", "bright"));
createDemoData();
stats = getStoreStats();
console.log(
  `✅ Created: ${stats.reviews} reviews, ${stats.reviewers} reviewers, ${stats.comments} comments, ${stats.files} files, ${stats.tasks} tasks`
);

pause();

// Step 3: List all reviews
console.log(
  colorize(
    "\n📋 Step 3: Viewing all reviews (CLI equivalent: npx tsx cli.ts list)",
    "bright"
  )
);
const allReviews = reviewStore.review.filter(
  (entity): entity is Review => entity.type === "review"
);
console.log(`Found ${allReviews.length} review(s):`);

allReviews.forEach((review, index) => {
  const progress = getReviewProgress(review);
  console.log(`\n${index + 1}. ${colorize(review.data.title, "bright")}`);
  console.log(`   ID: ${review.id}`);
  console.log(
    `   Status: ${colorize(review.data.status.toUpperCase(), "yellow")}`
  );
  console.log(`   Author: ${review.data.author}`);
  console.log(`   Progress: ${progress.approvalPercentage}% approved`);
  console.log(`   Assigned to: ${review.data.assignedReviewers.join(", ")}`);
});

pause();

// Step 4: Show review details
if (allReviews.length > 0) {
  const review = allReviews[0];
  console.log(
    colorize(
      `\n📄 Step 4: Review details (CLI equivalent: npx tsx cli.ts show ${review.id})`,
      "bright"
    )
  );
  console.log(`Review: ${colorize(review.data.title, "bright")}`);
  console.log(`Branch: ${review.data.branch} → ${review.data.baseBranch}`);
  console.log(`Description: ${review.data.description}`);

  // Show related files
  const files = reviewStore.file.filter(
    (entity: any) =>
      entity.type === "file" && entity.data.reviewId === review.id
  );
  console.log(colorize("\nFiles changed:", "cyan"));
  files.forEach((file: any) => {
    const icon =
      file.data.status === "added"
        ? "+"
        : file.data.status === "modified"
        ? "~"
        : "-";
    console.log(
      `  ${icon} ${file.data.path} (+${file.data.linesAdded}/-${file.data.linesDeleted})`
    );
  });

  // Show comments
  const comments = reviewStore.comment.filter(
    (entity: any) =>
      entity.type === "comment" && entity.data.reviewId === review.id
  );
  console.log(colorize("\nComments:", "cyan"));
  comments.forEach((comment: any, index: number) => {
    const location = comment.data.filePath || "General";
    console.log(
      `  ${index + 1}. ${colorize(comment.data.author, "yellow")}: ${
        comment.data.content
      }`
    );
    console.log(`     Location: ${location}`);
  });

  pause();

  // Step 5: Simulate approval process
  console.log(
    colorize(
      `\n🎯 Step 5: Approval workflow (CLI equivalent: npx tsx cli.ts approve ${review.id} alice)`,
      "bright"
    )
  );
  console.log(`Initial status: ${review.data.status}`);
  console.log(
    `Assigned reviewers: ${review.data.assignedReviewers.join(", ")}`
  );

  // Alice approves
  if (
    review.data.assignedReviewers.includes("alice") &&
    !review.data.approvedBy.includes("alice")
  ) {
    review.data.approvedBy.push("alice");
    console.log(colorize("✅ Alice approved the review", "green"));

    let progress = getReviewProgress(review);
    console.log(`Progress: ${progress.approvalPercentage}% approved`);
  }

  pause();

  // Bob approves
  console.log(
    colorize(
      `\n🎯 Step 6: Second approval (CLI equivalent: npx tsx cli.ts approve ${review.id} bob)`,
      "bright"
    )
  );
  if (
    review.data.assignedReviewers.includes("bob") &&
    !review.data.approvedBy.includes("bob")
  ) {
    review.data.approvedBy.push("bob");
    console.log(colorize("✅ Bob approved the review", "green"));

    let progress = getReviewProgress(review);
    console.log(`Progress: ${progress.approvalPercentage}% approved`);

    if (progress.isFullyApproved) {
      review.data.status = "approved";
      console.log(colorize("🎉 Review is fully approved!", "green"));

      if (canMergeReview(review)) {
        console.log(colorize("🚀 Review is ready to merge!", "green"));
      }
    }
  }

  pause();
}

// Step 7: Create a new review
console.log(
  colorize(
    "\n🔄 Step 7: Creating a new review (CLI equivalent: npx tsx cli.ts create)",
    "bright"
  )
);
const newReview = createReview(
  "Add dark mode support",
  "Implements dark theme with user preference persistence and system theme detection",
  "alice",
  "feature/dark-mode",
  {
    status: "open",
    priority: "medium",
    assignedReviewers: ["bob", "charlie"],
    labels: ["frontend", "ux"],
    filesChanged: 5,
    linesAdded: 156,
    linesDeleted: 23,
  }
);

reviewStore.review.push(newReview);
console.log(
  `✅ Created new review: ${colorize(newReview.data.title, "bright")}`
);
console.log(`   ID: ${newReview.id}`);
console.log(`   Branch: ${newReview.data.branch}`);
console.log(`   Assigned to: ${newReview.data.assignedReviewers.join(", ")}`);

pause();

// Step 8: List reviews by status
console.log(
  colorize(
    "\n📊 Step 8: Filter by status (CLI equivalent: npx tsx cli.ts list open)",
    "bright"
  )
);
const openReviews = reviewStore.review.filter(
  (entity): entity is Review =>
    entity.type === "review" && entity.data.status === "open"
);
console.log(`Found ${openReviews.length} open review(s):`);
openReviews.forEach((review, index) => {
  console.log(`  ${index + 1}. ${review.data.title} (${review.data.author})`);
});

const approvedReviews = reviewStore.review.filter(
  (entity): entity is Review =>
    entity.type === "review" && entity.data.status === "approved"
);
console.log(`Found ${approvedReviews.length} approved review(s):`);
approvedReviews.forEach((review, index) => {
  console.log(`  ${index + 1}. ${review.data.title} (${review.data.author})`);
});

pause();

// Step 9: Show team members
console.log(
  colorize(
    "\n👥 Step 9: Team overview (CLI equivalent: npx tsx cli.ts reviewers)",
    "bright"
  )
);
const reviewers = reviewStore.reviewer.filter(
  (entity: any) => entity.type === "reviewer"
);
console.log(`Team members (${reviewers.length}):`);
reviewers.forEach((reviewer: any, index: number) => {
  const roleIcon =
    reviewer.data.role === "maintainer"
      ? "👑"
      : reviewer.data.role === "reviewer"
      ? "👤"
      : "✏️";
  console.log(
    `\n${index + 1}. ${roleIcon} ${colorize(reviewer.data.name, "bright")} (@${
      reviewer.data.username
    })`
  );
  console.log(`   Role: ${reviewer.data.role}`);
  console.log(`   Reviews completed: ${reviewer.data.reviewCount}`);
  if (reviewer.data.expertise.length > 0) {
    console.log(`   Expertise: ${reviewer.data.expertise.join(", ")}`);
  }
});

pause();

// Step 10: Final statistics
console.log(
  colorize(
    "\n📈 Step 10: System statistics (CLI equivalent: npx tsx cli.ts stats)",
    "bright"
  )
);
const finalStats = getStoreStats();
console.log("Current system state:");
console.log(`  Reviews: ${colorize(finalStats.reviews.toString(), "green")}`);
console.log(`  Comments: ${colorize(finalStats.comments.toString(), "cyan")}`);
console.log(`  Files: ${colorize(finalStats.files.toString(), "blue")}`);
console.log(
  `  Reviewers: ${colorize(finalStats.reviewers.toString(), "magenta")}`
);
console.log(`  Tasks: ${colorize(finalStats.tasks.toString(), "yellow")}`);
console.log(
  `  Total entities: ${colorize(finalStats.total.toString(), "bright")}`
);

// Status breakdown
const allCurrentReviews = reviewStore.review.filter(
  (entity): entity is Review => entity.type === "review"
);
const statusBreakdown = allCurrentReviews.reduce((acc, review) => {
  acc[review.data.status] = (acc[review.data.status] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

console.log(colorize("\nReview status breakdown:", "bright"));
Object.entries(statusBreakdown).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});

console.log(colorize("\n🎯 Demo completed!", "bright"));
console.log("This showcase demonstrates:");
console.log("• Complete review lifecycle management");
console.log("• Real-time collaboration features");
console.log("• Type-safe data operations");
console.log("• Instant performance with memory-first architecture");
console.log("• Rich CLI interface with colored output");
console.log("• Cross-entity relationships and queries");
console.log("\nAll operations were:");
console.log("✅ Synchronous (no async/await needed)");
console.log("✅ Type-safe (full TypeScript support)");
console.log("✅ Instant (no database round trips)");
console.log("✅ Reactive (automatic updates)");

console.log(colorize("\n📚 Try the CLI commands:", "yellow"));
console.log("  npx tsx cli.ts demo     # Create demo data");
console.log("  npx tsx cli.ts list     # List all reviews");
console.log("  npx tsx cli.ts create   # Create new review");
console.log("  npx tsx cli.ts stats    # Show statistics");
console.log("  npx tsx cli.ts help     # Show all commands");
