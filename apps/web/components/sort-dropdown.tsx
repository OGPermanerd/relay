"use client";

import { useQueryState, parseAsStringEnum } from "nuqs";
import { useTransition } from "react";

// Sort option values
const SORT_OPTIONS = ["uses", "quality", "rating"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const SORT_LABELS: Record<SortOption, string> = {
  uses: "Most Used",
  quality: "Quality Score",
  rating: "Highest Rated",
};

/**
 * Sort dropdown with URL synchronization
 *
 * Shows sorting options for skills list.
 * Uses nuqs to sync to URL 'sortBy' parameter.
 * Default is "uses" (Most Used).
 */
export function SortDropdown() {
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsStringEnum(SORT_OPTIONS as unknown as string[]).withDefault("uses" as SortOption)
  );
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    startTransition(() => {
      if (value === "uses") {
        setSortBy(null); // Clear from URL when default
      } else {
        setSortBy(value as SortOption);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-dropdown" className="text-sm text-gray-600">
        Sort by:
      </label>
      <select
        id="sort-dropdown"
        value={sortBy || "uses"}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        disabled={isPending}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
