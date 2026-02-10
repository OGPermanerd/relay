"use client";

import { useState } from "react";
import type { ReviewCategories } from "@everyskill/db/schema";
import { RelativeTime } from "@/components/relative-time";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600 bg-emerald-50";
  if (score >= 6) return "text-teal-600 bg-teal-50";
  if (score >= 4) return "text-cyan-600 bg-cyan-50";
  return "text-blue-600 bg-blue-50";
}

function getOverallScoreColor(score: number): string {
  if (score >= 8) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 6) return "text-teal-700 bg-teal-50 border-teal-200";
  if (score >= 4) return "text-cyan-700 bg-cyan-50 border-cyan-200";
  return "text-blue-700 bg-blue-50 border-blue-200";
}

const categoryLabels: Record<keyof ReviewCategories, string> = {
  quality: "Quality",
  clarity: "Clarity",
  completeness: "Completeness",
};

const categoryDescriptions: Record<keyof ReviewCategories, string> = {
  quality: "Does it work well and produce good results?",
  clarity: "Is it clear, well-written, and easy to reuse?",
  completeness: "Is it thorough and self-contained?",
};

function getCategoryLabel(key: keyof ReviewCategories): string {
  return categoryLabels[key];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AiReviewDisplayProps {
  categories: ReviewCategories;
  summary: string;
  suggestedDescription?: string;
  reviewedAt: string;
  modelName: string;
  isAuthor?: boolean;
  onImprove?: (selectedSuggestions: string[], useSuggestedDescription: boolean) => void;
  isImprovePending?: boolean;
  improveElapsed?: number;
}

export function AiReviewDisplay({
  categories,
  summary,
  suggestedDescription,
  reviewedAt,
  modelName,
  isAuthor,
  onImprove,
  isImprovePending,
  improveElapsed,
}: AiReviewDisplayProps) {
  const categoryKeys = Object.keys(categoryLabels) as (keyof ReviewCategories)[];
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [useDescription, setUseDescription] = useState(false);

  // Compute overall score as average of the 3 category scores
  const overallScore = Math.round(
    categoryKeys.reduce((sum, key) => sum + (categories[key]?.score ?? 0), 0) / categoryKeys.length
  );

  const overallColorClass = getOverallScoreColor(overallScore);

  const toggleSuggestion = (suggestion: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(suggestion)) {
        next.delete(suggestion);
      } else {
        next.add(suggestion);
      }
      return next;
    });
  };

  const totalSelected = selectedSuggestions.size + (useDescription ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Header with badge and overall score */}
      <div className="flex items-center justify-between">
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
          AI Review
        </span>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${overallColorClass}`}
        >
          <span className="text-sm font-medium">Overall</span>
          <span className="text-lg font-bold">{overallScore}/10</span>
        </div>
      </div>

      {/* Summary */}
      <div className="border-l-4 border-blue-200 bg-gray-50 rounded-r-lg px-4 py-3">
        <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
      </div>

      {/* Suggested description */}
      {suggestedDescription && (
        <div className="border border-emerald-200 bg-emerald-50 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {isAuthor && onImprove && (
                <input
                  type="checkbox"
                  checked={useDescription}
                  onChange={() => setUseDescription((prev) => !prev)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
              )}
              <span className="text-xs font-medium text-emerald-700">Suggested Description</span>
            </div>
            <CopyButton text={suggestedDescription} />
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{suggestedDescription}</p>
        </div>
      )}

      {/* Category score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {categoryKeys.map((key) => {
          const category = categories[key];
          if (!category) return null;
          const { score, suggestions } = category;
          const colorClass = getScoreColor(score);

          return (
            <div key={key} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{getCategoryLabel(key)}</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
                  {score}/10
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{categoryDescriptions[key]}</p>
              {suggestions.length > 0 && (
                <ul className="space-y-1.5">
                  {suggestions.map((suggestion, i) => (
                    <li
                      key={i}
                      className={`text-sm text-gray-600 flex items-start gap-2 rounded px-1 py-0.5 -mx-1 transition-colors ${
                        isAuthor && onImprove ? "hover:bg-gray-100 cursor-pointer" : ""
                      }`}
                      onClick={
                        isAuthor && onImprove ? () => toggleSuggestion(suggestion) : undefined
                      }
                    >
                      {isAuthor && onImprove ? (
                        <input
                          type="checkbox"
                          checked={selectedSuggestions.has(suggestion)}
                          onChange={() => toggleSuggestion(suggestion)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
                      )}
                      <span className={selectedSuggestions.has(suggestion) ? "text-blue-700" : ""}>
                        {suggestion}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Improve Skill button */}
      {isAuthor && onImprove && (totalSelected > 0 || isImprovePending) && (
        <div className="sticky bottom-4 z-10">
          <button
            type="button"
            onClick={() => onImprove(Array.from(selectedSuggestions), useDescription)}
            disabled={isImprovePending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isImprovePending && <ImproveSpinner />}
            {isImprovePending
              ? `Improving skill... ${improveElapsed ?? 0}s`
              : `Improve Skill (${totalSelected} selected)`}
          </button>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-400">
        Reviewed <RelativeTime date={reviewedAt} /> using {modelName}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

function ImproveSpinner() {
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-xs text-emerald-600 hover:text-emerald-800"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
