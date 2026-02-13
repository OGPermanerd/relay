import type { PlatformStats } from "@/lib/platform-stats";
import { FTE_DAYS_PER_YEAR } from "@/lib/constants";

interface CompactStatsBarProps {
  stats: PlatformStats;
}

export function CompactStatsBar({ stats }: CompactStatsBarProps) {
  const fteYears = (stats.totalFteDaysSaved / FTE_DAYS_PER_YEAR).toFixed(1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-6 py-3 text-sm text-gray-600">
      <span>
        <span className="font-semibold text-gray-900">{stats.totalContributors}</span> contributors
      </span>
      <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
        |
      </span>
      <span>
        <span className="font-semibold text-gray-900">{stats.totalUses.toLocaleString()}</span> uses
      </span>
      <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
        |
      </span>
      <span>
        <span className="font-semibold text-gray-900">{fteYears}</span> FTE years saved
      </span>
      {stats.averageRating > 0 && (
        <>
          <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
            |
          </span>
          <span>
            <span className="font-semibold text-gray-900">{stats.averageRating.toFixed(1)}</span>{" "}
            avg rating
          </span>
        </>
      )}
    </div>
  );
}
