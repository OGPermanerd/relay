"use client";

import { useState } from "react";
import { SuggestionCard, type SuggestionCardData } from "@/components/suggestion-card";

// =============================================================================
// Types
// =============================================================================

interface SuggestionListProps {
  suggestions: SuggestionCardData[];
  isAuthor: boolean;
  currentUserId?: string;
  skillSlug: string;
}

// =============================================================================
// Constants
// =============================================================================

type FilterKey = "all" | "pending" | "accepted" | "dismissed" | "implemented";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Open" },
  { key: "accepted", label: "Accepted" },
  { key: "dismissed", label: "Dismissed" },
  { key: "implemented", label: "Implemented" },
];

/** Sort order for status groups (lower = first) */
const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  accepted: 1,
  implemented: 2,
  dismissed: 3,
};

// =============================================================================
// Component
// =============================================================================

export function SuggestionList({
  suggestions,
  isAuthor,
  currentUserId,
  skillSlug,
}: SuggestionListProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  // Determine which suggestions to show
  let visibleSuggestions: SuggestionCardData[];

  if (isAuthor) {
    // Author sees all suggestions
    visibleSuggestions = suggestions;
  } else if (currentUserId) {
    // Non-author sees only their own
    visibleSuggestions = suggestions.filter((s) => s.userId === currentUserId);
  } else {
    // Not logged in -- nothing to show (form handles this)
    return null;
  }

  // Apply status filter
  const filteredSuggestions =
    filter === "all" ? visibleSuggestions : visibleSuggestions.filter((s) => s.status === filter);

  // Sort: by status order first (pending first), then by createdAt desc within each group
  const sortedSuggestions = [...filteredSuggestions].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 99;
    const orderB = STATUS_ORDER[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Non-author with no suggestions
  if (!isAuthor && visibleSuggestions.length === 0) {
    return <p className="text-sm text-gray-500">You haven&apos;t submitted any suggestions yet.</p>;
  }

  return (
    <div>
      {/* Filter tabs (author only) */}
      {isAuthor && (
        <div className="flex flex-wrap gap-1 mb-4">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? visibleSuggestions.length
                : visibleSuggestions.filter((s) => s.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === tab.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Suggestion cards */}
      {sortedSuggestions.length === 0 ? (
        <p className="text-sm text-gray-500">
          {filter === "all" ? "No suggestions yet." : "No suggestions with this status."}
        </p>
      ) : (
        <div className="space-y-3">
          {sortedSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isAuthor={isAuthor}
              currentUserId={currentUserId}
              skillSlug={skillSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
