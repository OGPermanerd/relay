"use client";

import { useActionState } from "react";
import { requestAiReview, toggleAiReviewVisibility } from "@/app/actions/ai-review";
import { AiReviewDisplay } from "./ai-review-display";
import type { ReviewCategories } from "@everyskill/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExistingReview {
  categories: ReviewCategories;
  summary: string;
  suggestedDescription?: string;
  createdAt: string;
  modelName: string;
  isVisible: boolean;
  reviewedContentHash: string;
}

interface AiReviewTabProps {
  skillId: string;
  isAuthor: boolean;
  existingReview: ExistingReview | null;
  currentContentHash: string;
  skillSlug: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiReviewTab({
  skillId,
  isAuthor,
  existingReview,
  currentContentHash,
  skillSlug: _skillSlug,
}: AiReviewTabProps) {
  const [reviewState, reviewAction, isReviewPending] = useActionState(requestAiReview, {});
  const [toggleState, toggleAction, isTogglePending] = useActionState(toggleAiReviewVisibility, {});

  const contentChanged =
    !existingReview || existingReview.reviewedContentHash !== currentContentHash;

  // Determine if review should display (either visible to all, or author can always see)
  const showReview = existingReview && (existingReview.isVisible || isAuthor);

  return (
    <div className="space-y-6">
      {/* Error display */}
      {(reviewState.error || toggleState.error) && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-600">
          {reviewState.error || toggleState.error}
        </div>
      )}

      {/* Review display */}
      {showReview && (
        <div>
          <AiReviewDisplay
            categories={existingReview.categories}
            summary={existingReview.summary}
            suggestedDescription={existingReview.suggestedDescription}
            reviewedAt={existingReview.createdAt}
            modelName={existingReview.modelName}
          />

          {/* Visibility toggle (author only) */}
          {isAuthor && (
            <form action={toggleAction} className="mt-4">
              <input type="hidden" name="skillId" value={skillId} />
              <input
                type="hidden"
                name="isVisible"
                value={existingReview.isVisible ? "false" : "true"}
              />
              <button
                type="submit"
                disabled={isTogglePending}
                className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 disabled:opacity-50"
              >
                {isTogglePending
                  ? "Updating..."
                  : existingReview.isVisible
                    ? "Hide Review"
                    : "Show Review"}
              </button>
            </form>
          )}

          {/* Re-review prompt (author only, content changed) */}
          {isAuthor && contentChanged && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-blue-700 mb-3">
                Content has changed since the last review. Get an updated review?
              </p>
              <form action={reviewAction}>
                <input type="hidden" name="skillId" value={skillId} />
                <button
                  type="submit"
                  disabled={isReviewPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isReviewPending && <Spinner />}
                  {isReviewPending ? "Generating review..." : "Get New Review"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* No review exists */}
      {!existingReview && (
        <div>
          {isAuthor ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                Get an AI-powered review of your skill with scores and improvement suggestions.
              </p>
              <form action={reviewAction}>
                <input type="hidden" name="skillId" value={skillId} />
                <button
                  type="submit"
                  disabled={isReviewPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isReviewPending && <Spinner />}
                  {isReviewPending ? "Generating review..." : "Get AI Review"}
                </button>
              </form>
            </div>
          ) : (
            <p className="text-center py-8 text-gray-400">No AI review available yet.</p>
          )}
        </div>
      )}

      {/* Review hidden from non-author */}
      {existingReview && !existingReview.isVisible && !isAuthor && (
        <p className="text-center py-8 text-gray-400">AI review has been hidden by the author.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
