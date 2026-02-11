"use client";

import { useActionState, useState, useEffect, useRef, useMemo, startTransition } from "react";
import { diffLines } from "diff";
import {
  requestAiReview,
  toggleAiReviewVisibility,
  improveSkill,
  acceptImprovedSkill,
  refineImprovedSkill,
} from "@/app/actions/ai-review";
import type {
  ImproveSkillState,
  AcceptImproveState,
  RefineSkillState,
} from "@/app/actions/ai-review";
import { AiReviewDisplay } from "./ai-review-display";
import type { ReviewCategories } from "@everyskill/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExistingReview {
  categories: ReviewCategories;
  summary: string;
  suggestedTitle?: string;
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
  autoImprove?: boolean;
  forkedFromId?: string;
  parentContent?: string;
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
  autoImprove,
  forkedFromId,
  parentContent,
}: AiReviewTabProps) {
  const [reviewState, reviewAction, isReviewPending] = useActionState(requestAiReview, {});
  const [toggleState, toggleAction, isTogglePending] = useActionState(toggleAiReviewVisibility, {});
  const [improveState, improveAction, _isImprovePending] = useActionState<
    ImproveSkillState,
    FormData
  >(improveSkill, {});
  const [acceptState, acceptAction, isAcceptPending] = useActionState<AcceptImproveState, FormData>(
    acceptImprovedSkill,
    {}
  );
  const [refineState, refineAction, _isRefinePending] = useActionState<RefineSkillState, FormData>(
    refineImprovedSkill,
    {}
  );

  // Track preview state locally (reset when accept succeeds)
  const [showPreview, setShowPreview] = useState(false);

  // Track improve pending locally — useActionState's isPending doesn't fire
  // reliably for programmatic dispatch (only native <form action=...> works)
  const [isImproving, setIsImproving] = useState(false);

  // Track current improved content (can be updated by refinements)
  const [currentImprovedContent, setCurrentImprovedContent] = useState<string | null>(null);

  // Track refinement count
  const [refinementCount, setRefinementCount] = useState(0);

  // Track refine pending locally
  const [isRefining, setIsRefining] = useState(false);

  const reviewTimer = useElapsedTimer(isReviewPending);
  const improveTimer = useElapsedTimer(isImproving);
  const refineTimer = useElapsedTimer(isRefining);

  const contentChanged =
    !existingReview || existingReview.reviewedContentHash !== currentContentHash;

  // Determine if review should display (either visible to all, or author can always see)
  const showReview = existingReview && (existingReview.isVisible || isAuthor);

  // Auto-trigger review when autoImprove=true and no review exists
  const autoTriggered = useRef(false);
  useEffect(() => {
    if (autoImprove && !existingReview && isAuthor && !autoTriggered.current) {
      autoTriggered.current = true;
      const formData = new FormData();
      formData.set("skillId", skillId);
      startTransition(() => {
        reviewAction(formData);
      });
    }
  }, [autoImprove, existingReview, isAuthor, skillId, reviewAction]);

  // Show preview when improve action returns content (also clears local pending)
  useEffect(() => {
    if (improveState.improvedContent || improveState.error) {
      setIsImproving(false);
    }
    if (improveState.improvedContent) {
      setShowPreview(true);
      setCurrentImprovedContent(improveState.improvedContent);
      setRefinementCount(0);
    }
  }, [improveState.improvedContent, improveState.error]);

  // Update content when refinement returns
  useEffect(() => {
    if (refineState.refinedContent || refineState.error) {
      setIsRefining(false);
    }
    if (refineState.refinedContent) {
      setCurrentImprovedContent(refineState.refinedContent);
      setRefinementCount((c) => c + 1);
    }
  }, [refineState.refinedContent, refineState.error]);

  // Hide preview when accept succeeds
  useEffect(() => {
    if (acceptState.success) {
      setShowPreview(false);
      setCurrentImprovedContent(null);
      setRefinementCount(0);
    }
  }, [acceptState.success]);

  // Handle improve button from AiReviewDisplay
  const handleImprove = (
    selectedSuggestions: string[],
    useSuggestedDescription: boolean,
    useSuggestedTitle: boolean
  ) => {
    setIsImproving(true);
    const formData = new FormData();
    formData.set("skillId", skillId);
    formData.set("suggestions", JSON.stringify(selectedSuggestions));
    formData.set("useSuggestedDescription", useSuggestedDescription ? "true" : "false");
    formData.set("useSuggestedTitle", useSuggestedTitle ? "true" : "false");
    if (existingReview?.suggestedDescription) {
      formData.set("suggestedDescription", existingReview.suggestedDescription);
    }
    if (existingReview?.suggestedTitle) {
      formData.set("suggestedTitle", existingReview.suggestedTitle);
    }
    startTransition(() => {
      improveAction(formData);
    });
  };

  // Handle refinement
  const handleRefine = (feedback: string) => {
    if (!currentImprovedContent) return;
    setIsRefining(true);
    const formData = new FormData();
    formData.set("skillId", skillId);
    formData.set("currentContent", currentImprovedContent);
    formData.set("refinementFeedback", feedback);
    startTransition(() => {
      refineAction(formData);
    });
  };

  return (
    <div className="space-y-6">
      {/* Error display */}
      {(reviewState.error ||
        toggleState.error ||
        improveState.error ||
        acceptState.error ||
        refineState.error) && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-600">
          {reviewState.error ||
            toggleState.error ||
            improveState.error ||
            acceptState.error ||
            refineState.error}
        </div>
      )}

      {/* Improvement preview (before/after) */}
      {showPreview && currentImprovedContent && (
        <ImprovementPreview
          originalContent={improveState.originalContent ?? ""}
          improvedContent={currentImprovedContent}
          skillId={skillId}
          suggestedTitle={improveState.suggestedTitle}
          suggestedDescription={improveState.suggestedDescription}
          forkedFromId={forkedFromId}
          parentContent={parentContent}
          onDiscard={() => {
            setShowPreview(false);
            setCurrentImprovedContent(null);
            setRefinementCount(0);
          }}
          acceptAction={acceptAction}
          isAcceptPending={isAcceptPending}
          elapsedSeconds={improveTimer.final}
          onRefine={handleRefine}
          isRefinePending={isRefining}
          refineElapsed={refineTimer.elapsed}
          refineElapsedFinal={refineTimer.final}
          refinementCount={refinementCount}
        />
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
            suggestedTitle={existingReview.suggestedTitle}
            suggestedDescription={existingReview.suggestedDescription}
            reviewedAt={existingReview.createdAt}
            modelName={existingReview.modelName}
            isAuthor={isAuthor}
            onImprove={isAuthor ? handleImprove : undefined}
            isImprovePending={isImproving}
            improveElapsed={improveTimer.elapsed}
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
                {autoImprove
                  ? "Starting AI review of your forked skill..."
                  : "Get an AI-powered review of your skill with scores and improvement suggestions."}
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
  suggestedTitle,
  suggestedDescription,
  forkedFromId,
  parentContent,
  onDiscard,
  acceptAction,
  isAcceptPending,
  elapsedSeconds,
  onRefine,
  isRefinePending,
  refineElapsed,
  refineElapsedFinal,
  refinementCount,
}: {
  originalContent: string;
  improvedContent: string;
  skillId: string;
  suggestedTitle?: string;
  suggestedDescription?: string;
  forkedFromId?: string;
  parentContent?: string;
  onDiscard: () => void;
  acceptAction: (formData: FormData) => void;
  isAcceptPending: boolean;
  elapsedSeconds: number | null;
  onRefine: (feedback: string) => void;
  isRefinePending: boolean;
  refineElapsed: number;
  refineElapsedFinal: number | null;
  refinementCount: number;
}) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("diff");
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState("");

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

  const handleSubmitRefine = () => {
    if (!refineFeedback.trim()) return;
    onRefine(refineFeedback.trim());
    setRefineFeedback("");
    setShowRefineInput(false);
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-800">Review Changes</h3>
          {elapsedSeconds !== null && refinementCount === 0 && (
            <span className="text-xs text-gray-400">Generated in {elapsedSeconds}s</span>
          )}
          {refinementCount > 0 && (
            <span className="text-xs text-blue-500 font-medium">
              {refinementCount} refinement{refinementCount !== 1 ? "s" : ""} applied
              {refineElapsedFinal !== null && ` (${refineElapsedFinal}s)`}
            </span>
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
        <SideBySideDiff diffParts={diffParts} />
      )}

      {/* Refine input area */}
      {showRefineInput && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-2">
          <label className="text-sm font-medium text-gray-700">
            How would you like to refine these changes?
          </label>
          <textarea
            value={refineFeedback}
            onChange={(e) => setRefineFeedback(e.target.value)}
            placeholder="e.g., Add more examples, make the tone more conversational, expand the error handling section..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            disabled={isRefinePending}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmitRefine}
              disabled={isRefinePending || !refineFeedback.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isRefinePending && <Spinner />}
              {isRefinePending ? `Refining... ${refineElapsed}s` : "Apply Refinement"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRefineInput(false);
                setRefineFeedback("");
              }}
              disabled={isRefinePending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <form action={acceptAction}>
          <input type="hidden" name="skillId" value={skillId} />
          <input type="hidden" name="improvedContent" value={improvedContent} />
          {suggestedTitle && <input type="hidden" name="suggestedTitle" value={suggestedTitle} />}
          {suggestedDescription && (
            <input type="hidden" name="suggestedDescription" value={suggestedDescription} />
          )}
          {forkedFromId && <input type="hidden" name="forkedFromId" value={forkedFromId} />}
          {parentContent && <input type="hidden" name="parentContent" value={parentContent} />}
          <button
            type="submit"
            disabled={isAcceptPending || isRefinePending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isAcceptPending && <Spinner />}
            {isAcceptPending ? "Saving..." : "Accept & Save"}
          </button>
        </form>
        {!showRefineInput && (
          <button
            type="button"
            onClick={() => setShowRefineInput(true)}
            disabled={isAcceptPending || isRefinePending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
              />
            </svg>
            Refine
          </button>
        )}
        <button
          type="button"
          onClick={onDiscard}
          disabled={isAcceptPending || isRefinePending}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side-by-Side Diff with sync scrolling
// ---------------------------------------------------------------------------

function SideBySideDiff({ diffParts }: { diffParts: ReturnType<typeof diffLines> }) {
  const leftRef = useRef<HTMLPreElement>(null);
  const rightRef = useRef<HTMLPreElement>(null);
  const syncing = useRef(false);

  const handleScroll = (source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
    }
    syncing.current = false;
  };

  // Build left (original) and right (improved) line arrays with highlighting
  const leftLines: { text: string; type: "removed" | "context" | "spacer" }[] = [];
  const rightLines: { text: string; type: "added" | "context" | "spacer" }[] = [];

  for (const part of diffParts) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    if (part.added) {
      // Added lines appear on right, spacers on left
      for (const line of lines) {
        leftLines.push({ text: "", type: "spacer" });
        rightLines.push({ text: line, type: "added" });
      }
    } else if (part.removed) {
      // Removed lines appear on left, spacers on right
      for (const line of lines) {
        leftLines.push({ text: line, type: "removed" });
        rightLines.push({ text: "", type: "spacer" });
      }
    } else {
      // Unchanged lines appear on both sides
      for (const line of lines) {
        leftLines.push({ text: line, type: "context" });
        rightLines.push({ text: line, type: "context" });
      }
    }
  }

  const lineClass = (type: string) => {
    switch (type) {
      case "added":
        return "bg-emerald-50 text-emerald-800";
      case "removed":
        return "bg-red-50 text-red-700 line-through decoration-red-300";
      case "spacer":
        return "bg-gray-100 text-transparent select-none";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-lg border border-gray-200 overflow-hidden">
      <div>
        <div className="px-3 py-1.5 bg-gray-100 border-b border-r border-gray-200">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Original
          </span>
        </div>
        <pre
          ref={leftRef}
          onScroll={() => handleScroll("left")}
          className="max-h-96 overflow-auto p-3 text-xs leading-5 whitespace-pre-wrap break-words border-r border-gray-200"
        >
          {leftLines.map((line, i) => (
            <span key={i} className={`block px-1 ${lineClass(line.type)}`}>
              {line.type === "spacer" ? "\u00A0" : line.text || "\u00A0"}
            </span>
          ))}
        </pre>
      </div>
      <div>
        <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200">
          <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
            Improved
          </span>
        </div>
        <pre
          ref={rightRef}
          onScroll={() => handleScroll("right")}
          className="max-h-96 overflow-auto p-3 text-xs leading-5 whitespace-pre-wrap break-words"
        >
          {rightLines.map((line, i) => (
            <span key={i} className={`block px-1 ${lineClass(line.type)}`}>
              {line.type === "spacer" ? "\u00A0" : line.text || "\u00A0"}
            </span>
          ))}
        </pre>
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
