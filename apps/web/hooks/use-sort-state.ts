"use client";

import { useQueryState, parseAsStringEnum, parseAsStringLiteral } from "nuqs";
import { useTransition } from "react";

export const SORT_COLUMNS = ["name", "days_saved", "installs", "date", "author", "rating"] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];

const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * Sort state hook with URL synchronization via nuqs
 *
 * Manages column sorting with URL persistence for shareable sorted views.
 * Default: days_saved descending (most impactful first)
 *
 * @returns sortBy - current sort column
 * @returns sortDir - current sort direction
 * @returns isPending - transition pending state
 * @returns toggleSort - toggle sort on column
 */
export function useSortState() {
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsStringEnum(SORT_COLUMNS as unknown as string[]).withDefault("days_saved" as SortColumn)
  );
  const [sortDir, setSortDir] = useQueryState(
    "sortDir",
    parseAsStringLiteral(SORT_DIRECTIONS).withDefault("desc" as SortDirection)
  );
  const [isPending, startTransition] = useTransition();

  const toggleSort = (column: SortColumn) => {
    startTransition(() => {
      if (sortBy === column) {
        // Same column: toggle direction
        setSortDir(sortDir === "desc" ? "asc" : "desc");
      } else {
        // New column: set to desc
        setSortBy(column);
        setSortDir("desc");
      }
    });
  };

  return {
    sortBy: sortBy as SortColumn,
    sortDir: sortDir as SortDirection,
    isPending,
    toggleSort,
  };
}
