"use client";

import type { ImpactCalculatorStats } from "@/lib/portfolio-queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImpactCalculatorProps {
  stats: ImpactCalculatorStats;
}

// ---------------------------------------------------------------------------
// Formatting (inline — cannot import from ip-valuation.ts in "use client")
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return "$" + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactCalculator({ stats }: ImpactCalculatorProps) {
  const isEmpty =
    stats.totalHoursSaved +
      stats.skillsCreated +
      stats.skillsForked +
      stats.suggestionsImplemented ===
    0;

  if (isEmpty) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">
          No contributions yet. Create or fork skills to see your impact.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Impact Calculator</h2>

      {/* Top row: large stats */}
      <div className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-500">Total Hours Saved</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalHoursSaved.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Estimated Value Added</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(stats.estimatedCostSaved)}
          </p>
          <p className="text-xs text-gray-400">at $150/hr</p>
        </div>
      </div>

      {/* Bottom row: breakdown stats */}
      <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
        <div>
          <p className="text-sm text-gray-500">Skills Created</p>
          <p className="text-2xl font-bold text-gray-900">{stats.skillsCreated}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Skills Forked</p>
          <p className="text-2xl font-bold text-gray-900">{stats.skillsForked}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Suggestions Implemented</p>
          <p className="text-2xl font-bold text-gray-900">{stats.suggestionsImplemented}</p>
        </div>
      </div>
    </div>
  );
}
