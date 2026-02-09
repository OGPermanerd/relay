"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import {
  requestAiReview,
  toggleAiReviewVisibility,
  improveSkill,
  acceptImprovedSkill,
} from "@/app/actions/ai-review";
import type { ImproveSkillState, AcceptImproveState } from "@/app/actions/ai-review";
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
// Elapsed Timer Hook
// ---------------------------------------------------------------------------

function useElapsedTimer(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  return elapsed;
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
  const [improveState, improveAction, isImprovePending] = useActionState<
    ImproveSkillState,
    FormData
  >(improveSkill, {});
  const [acceptState, acceptAction, isAcceptPending] = useActionState<AcceptImproveState, FormData>(
    acceptImprovedSkill,
    {}
  );

  // Track preview state locally (reset when accept succeeds)
  const [showPreview, setShowPreview] = useState(false);

  const reviewElapsed = useElapsedTimer(isReviewPending);
  const improveElapsed = useElapsedTimer(isImprovePending);

  const contentChanged =
    !existingReview || existingReview.reviewedContentHash !== currentContentHash;

  // Determine if review should display (either visible to all, or author can always see)
  const showReview = existingReview && (existingReview.isVisible || isAuthor);

  // Show preview when improve action returns content
  useEffect(() => {
    if (improveState.improvedContent) {
      setShowPreview(true);
    }
  }, [improveState.improvedContent]);

  // Hide preview when accept succeeds
  useEffect(() => {
    if (acceptState.success) {
      setShowPreview(false);
    }
  }, [acceptState.success]);

  // Handle improve button from AiReviewDisplay
  const handleImprove = (selectedSuggestions: string[], useSuggestedDescription: boolean) => {
    const formData = new FormData();
    formData.set("skillId", skillId);
    formData.set("suggestions", JSON.stringify(selectedSuggestions));
    formData.set("useSuggestedDescription", useSuggestedDescription ? "true" : "false");
    if (existingReview?.suggestedDescription) {
      formData.set("suggestedDescription", existingReview.suggestedDescription);
    }
    improveAction(formData);
  };

  return (
    <div className="space-y-6">
      {/* Error display */}
      {(reviewState.error || toggleState.error || improveState.error || acceptState.error) && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-600">
          {reviewState.error || toggleState.error || improveState.error || acceptState.error}
        </div>
      )}

      {/* Improvement preview (before/after) */}
      {showPreview && improveState.improvedContent && (
        <ImprovementPreview
          originalContent={improveState.originalContent ?? ""}
          improvedContent={improveState.improvedContent}
          skillId={skillId}
          onDiscard={() => setShowPreview(false)}
          acceptAction={acceptAction}
          isAcceptPending={isAcceptPending}
        />
      )}

      {/* Improvement loading state */}
      {isImprovePending && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-blue-700">
            <Spinner />
            Improving skill... {improveElapsed}s
          </div>
        </div>
      )}

      {/* Accept success message */}
      {acceptState.success && !showPreview && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          Content updated successfully. Get a fresh review to see how the improvements scored.
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
            isAuthor={isAuthor}
            onImprove={isAuthor ? handleImprove : undefined}
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
                  {isReviewPending ? `Analyzing skill... ${reviewElapsed}s` : "Get New Review"}
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
                  {isReviewPending ? `Analyzing skill... ${reviewElapsed}s` : "Get AI Review"}
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
// Improvement Preview
// ---------------------------------------------------------------------------

function ImprovementPreview({
  originalContent,
  improvedContent,
  skillId,
  onDiscard,
  acceptAction,
  isAcceptPending,
}: {
  originalContent: string;
  improvedContent: string;
  skillId: string;
  onDiscard: () => void;
  acceptAction: (formData: FormData) => void;
  isAcceptPending: boolean;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Review Changes</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Original
          </span>
          <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 whitespace-pre-wrap break-words">
            {originalContent}
          </pre>
        </div>
        <div>
          <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
            Improved
          </span>
          <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-gray-700 whitespace-pre-wrap break-words">
            {improvedContent}
          </pre>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <form action={acceptAction}>
          <input type="hidden" name="skillId" value={skillId} />
          <input type="hidden" name="improvedContent" value={improvedContent} />
          <button
            type="submit"
            disabled={isAcceptPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isAcceptPending && <Spinner />}
            {isAcceptPending ? "Saving..." : "Accept & Save"}
          </button>
        </form>
        <button
          type="button"
          onClick={onDiscard}
          disabled={isAcceptPending}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Discard
        </button>
      </div>
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
