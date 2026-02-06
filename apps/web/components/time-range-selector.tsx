"use client";

import { useQueryState, parseAsStringLiteral } from "nuqs";

const RANGES = ["7d", "30d", "90d", "1y"] as const;
export type TimeRange = (typeof RANGES)[number];

const RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "1y": "1 year",
};

interface TimeRangeSelectorProps {
  className?: string;
}

export function TimeRangeSelector({ className = "" }: TimeRangeSelectorProps) {
  const [range, setRange] = useQueryState("range", parseAsStringLiteral(RANGES).withDefault("30d"));

  return (
    <div className={`inline-flex rounded-md shadow-sm ${className}`} role="group">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          className={`px-4 py-2 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md
            ${
              range === r
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
            }
            ${range !== r ? "border-l-0 first:border-l" : ""}
          `}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

/**
 * Hook to get current time range from URL state
 * For use in Server Components that need to read the range
 */
export function useTimeRange() {
  const [range] = useQueryState("range", parseAsStringLiteral(RANGES).withDefault("30d"));
  return range as TimeRange;
}
