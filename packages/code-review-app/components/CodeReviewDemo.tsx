import { useEffect, useState } from "react";
import type { ReviewStatus } from "../code-review/types";
import { useCodeReview } from "../code-review/use-code-review";

export function CodeReviewDemo() {
  const [selectedLine, setSelectedLine] = useState<{
    filePath: string;
    lineNumber: number;
    side: "base" | "head";
  } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);

  const {
    state,
    error,
    comments,
    reviews,
    addComment,
    createReview,
    updateReviewStatus,
    getCommentsForLine,
    getReview,
  } = useCodeReview("user-123");

  // Initialize a review when component mounts
  useEffect(() => {
    if (!currentReviewId && reviews.length === 0) {
      createReview({
        id: "review-abc",
        baseCommit: "abc123",
        headCommit: "def456",
      }).then((reviewId) => {
        setCurrentReviewId(reviewId);
      });
    } else if (reviews.length > 0) {
      setCurrentReviewId(reviews[0].id);
    }
  }, [reviews, currentReviewId, createReview]);

  const handleAddComment = async () => {
    if (!selectedLine || !commentText.trim() || !currentReviewId) return;

    await addComment({
      reviewId: currentReviewId,
      filePath: selectedLine.filePath,
      lineNumber: selectedLine.lineNumber,
      side: selectedLine.side,
      message: commentText.trim(),
    });

    setCommentText("");
    setSelectedLine(null);
  };

  const handleLineClick = (
    filePath: string,
    lineNumber: number,
    side: "base" | "head"
  ) => {
    setSelectedLine({ filePath, lineNumber, side });
  };

  const handleStatusChange = async (status: ReviewStatus) => {
    if (!currentReviewId) return;
    await updateReviewStatus(currentReviewId, status);
  };

  const currentReview = currentReviewId ? getReview(currentReviewId) : null;

  // Mock diff data
  const mockDiff = {
    filePath: "src/components/Button.tsx",
    lines: [
      {
        number: 1,
        side: "base" as const,
        content: 'import React from "react";',
      },
      { number: 2, side: "base" as const, content: "" },
      {
        number: 3,
        side: "base" as const,
        content: "export function Button() {",
      },
      {
        number: 4,
        side: "base" as const,
        content: "  return <button>Click me</button>;",
      },
      { number: 5, side: "base" as const, content: "}" },
      {
        number: 3,
        side: "head" as const,
        content:
          "export function Button({ onClick }: { onClick: () => void }) {",
      },
      {
        number: 4,
        side: "head" as const,
        content: "  return <button onClick={onClick}>Click me</button>;",
      },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        Code Review Demo
      </h2>

      {/* Review Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          Review Status:{" "}
          <span className="text-blue-600">
            {currentReview?.status || "Loading..."}
          </span>
        </h3>
        {currentReview && (
          <div className="flex gap-3">
            <button
              onClick={() => handleStatusChange("commented")}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Comment
            </button>
            <button
              onClick={() => handleStatusChange("approved")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleStatusChange("changes_requested")}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Request Changes
            </button>
          </div>
        )}
      </div>

      {/* Mock Diff Viewer */}
      <div className="mb-6 border border-gray-300 rounded-lg overflow-hidden">
        <h3 className="m-0 px-4 py-3 bg-gray-50 border-b border-gray-300 font-mono text-gray-700">
          {mockDiff.filePath}
        </h3>
        <div className="divide-y divide-gray-200">
          {mockDiff.lines.map((line, index) => {
            const lineComments = getCommentsForLine(
              mockDiff.filePath,
              line.number,
              line.side
            );
            const isSelected =
              selectedLine?.filePath === mockDiff.filePath &&
              selectedLine?.lineNumber === line.number &&
              selectedLine?.side === line.side;

            return (
              <div key={`${line.side}-${line.number}-${index}`}>
                <div
                  className={`flex items-center px-2 py-1 cursor-pointer font-mono text-sm transition-colors ${
                    line.side === "base"
                      ? "bg-red-50 hover:bg-red-100"
                      : "bg-green-50 hover:bg-green-100"
                  } ${
                    isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  }`}
                  onClick={() =>
                    handleLineClick(mockDiff.filePath, line.number, line.side)
                  }
                >
                  <span className="w-10 text-right text-gray-500 mr-4 select-none">
                    {line.number}
                  </span>
                  <span className="flex-1">{line.content}</span>
                  {lineComments.length > 0 && (
                    <span className="ml-auto text-blue-500 text-xs">
                      💬 {lineComments.length}
                    </span>
                  )}
                </div>

                {/* Show comments for this line */}
                {lineComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="px-4 py-2 bg-yellow-50 border-l-4 border-yellow-400 ml-14 text-sm"
                  >
                    <strong className="text-gray-800">
                      {comment.authorId}:
                    </strong>{" "}
                    {comment.message}
                    <small className="text-gray-600 ml-2">
                      - {comment.createdAt.toLocaleTimeString()}
                    </small>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Comment Composer */}
      {selectedLine && (
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
          <h4 className="m-0 mb-3 text-gray-800 font-medium">
            Add comment to {selectedLine.filePath}:{selectedLine.lineNumber} (
            {selectedLine.side})
          </h4>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write your comment..."
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md resize-y mb-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex gap-3">
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Add Comment
            </button>
            <button
              onClick={() => setSelectedLine(null)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sync Status Debug */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg border-l-4 border-green-500">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Sync Engine State
        </h3>
        <div className="space-y-1">
          <p className="font-mono text-sm text-gray-700">
            Version: {state?.version}
          </p>
          <p className="font-mono text-sm text-gray-700">
            Last Synced: {state?.lastSyncedVersion}
          </p>
          <p className="font-mono text-sm text-gray-700">
            Pending Changes: {state?.pendingChanges.length || 0}
          </p>
          <p className="font-mono text-sm text-gray-700">
            Total Comments: {comments.length}
          </p>
          <p className="font-mono text-sm text-gray-700">
            Total Reviews: {reviews.length}
          </p>
        </div>
        {error && (
          <div className="mt-3 text-red-600 font-semibold">
            Error: {error.message}
          </div>
        )}
      </div>
    </div>
  );
}
