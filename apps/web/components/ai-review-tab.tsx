"use client";

import { useActionState, useState, useEffect, useRef, useMemo } from "react";
import { diffLines } from "diff";
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

function useElapsedTimer(active: boolean): { elapsed: number; final: number | null } {
  const [elapsed, setElapsed] = useState(0);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (active) {
      setElapsed(0);
      setFinalTime(null);
      elapsedRef.current = 0;
      intervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (elapsedRef.current > 0) {
          setFinalTime(elapsedRef.current);
        }
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  return { elapsed, final: finalTime };
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

  const reviewTimer = useElapsedTimer(isReviewPending);
  const improveTimer = useElapsedTimer(isImprovePending);

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
          elapsedSeconds={improveTimer.final}
        />
      )}

      {/* Improvement loading state */}
      {isImprovePending && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-blue-700">
            <Spinner />
            Improving skill... {improveTimer.elapsed}s
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
                  {isReviewPending
                    ? `Analyzing skill... ${reviewTimer.elapsed}s`
                    : "Get New Review"}
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
                  {isReviewPending ? `Analyzing skill... ${reviewTimer.elapsed}s` : "Get AI Review"}
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

type DiffViewMode = "diff" | "side-by-side";

function ImprovementPreview({
  originalContent,
  improvedContent,
  skillId,
  onDiscard,
  acceptAction,
  isAcceptPending,
  elapsedSeconds,
}: {
  originalContent: string;
  improvedContent: string;
  skillId: string;
  onDiscard: () => void;
  acceptAction: (formData: FormData) => void;
  isAcceptPending: boolean;
  elapsedSeconds: number | null;
}) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("diff");

  const diffParts = useMemo(
    () => diffLines(originalContent, improvedContent),
    [originalContent, improvedContent]
  );

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const part of diffParts) {
      const lines = part.value.split("\n").filter((l) => l !== "").length;
      if (part.added) added += lines;
      else if (part.removed) removed += lines;
    }
    return { added, removed };
  }, [diffParts]);

  return (
    <div className="rounded-lg border border-blue-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-800">Review Changes</h3>
          {elapsedSeconds !== null && (
            <span className="text-xs text-gray-400">Generated in {elapsedSeconds}s</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600 font-medium">+{stats.added}</span>
          <span className="text-xs text-red-500 font-medium">-{stats.removed}</span>
          <div className="flex rounded-md border border-gray-200 overflow-hidden ml-2">
            <button
              type="button"
              onClick={() => setViewMode("diff")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "diff"
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Diff
            </button>
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              className={`px-2.5 py-1 text-xs font-medium border-l border-gray-200 transition-colors ${
                viewMode === "side-by-side"
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Side by Side
            </button>
          </div>
        </div>
      </div>

      {viewMode === "diff" ? (
        <pre className="max-h-96 overflow-auto rounded-lg border border-gray-200 text-xs leading-5 whitespace-pre-wrap break-words">
          {diffParts.map((part, i) => {
            if (part.added) {
              return (
                <span
                  key={i}
                  className="block bg-emerald-50 text-emerald-800 border-l-2 border-emerald-400 pl-2"
                >
                  {part.value
                    .replace(/\n$/, "")
                    .split("\n")
                    .map((line, j) => (
                      <span key={j} className="block">
                        <span className="select-none text-emerald-400 mr-2">+</span>
                        {line}
                      </span>
                    ))}
                </span>
              );
            }
            if (part.removed) {
              return (
                <span
                  key={i}
                  className="block bg-red-50 text-red-700 border-l-2 border-red-300 pl-2"
                >
                  {part.value
                    .replace(/\n$/, "")
                    .split("\n")
                    .map((line, j) => (
                      <span key={j} className="block">
                        <span className="select-none text-red-300 mr-2">-</span>
                        {line}
                      </span>
                    ))}
                </span>
              );
            }
            return (
              <span key={i} className="block pl-2 text-gray-600">
                {part.value
                  .replace(/\n$/, "")
                  .split("\n")
                  .map((line, j) => (
                    <span key={j} className="block">
                      <span className="select-none text-gray-300 mr-2">&nbsp;</span>
                      {line}
                    </span>
                  ))}
              </span>
            );
          })}
        </pre>
      ) : (
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
      )}

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
