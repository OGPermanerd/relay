"use client";

import type { SortColumn, SortDirection } from "../hooks/use-sort-state";

interface SortableColumnHeaderProps {
  column: SortColumn;
  label: string;
  currentSort: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right" | "center";
}

/**
 * Sortable column header with chevron indicator
 *
 * Renders a th element with clickable label and directional chevron.
 * Active sort column shows blue chevron, inactive shows muted gray.
 *
 * @param column - Column identifier for this header
 * @param label - Display text for the column
 * @param currentSort - Currently active sort column
 * @param direction - Current sort direction
 * @param onSort - Callback when header is clicked
 * @param align - Text alignment (default: left)
 */
export function SortableColumnHeader({
  column,
  label,
  currentSort,
  direction,
  onSort,
  align = "left",
}: SortableColumnHeaderProps) {
  const isActive = column === currentSort;

  // Determine text alignment class
  const alignmentClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  // Chevron color: blue when active, muted gray when inactive
  const chevronColor = isActive ? "text-blue-600" : "text-gray-300";

  // Show up chevron only when active and ascending
  const showUpChevron = isActive && direction === "asc";

  // Only set aria-sort on active sorted column (omit entirely for non-sorted per WCAG)
  const ariaSortValue = isActive ? (direction === "asc" ? "ascending" : "descending") : undefined;

  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${alignmentClass}`}
      aria-sort={ariaSortValue}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex cursor-pointer items-center gap-1 hover:text-gray-700"
      >
        <span>{label}</span>
        <svg
          className={`h-4 w-4 ${chevronColor}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          {showUpChevron ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          )}
        </svg>
      </button>
    </th>
  );
}
