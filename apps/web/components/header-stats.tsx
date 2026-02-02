"use client";

import { Sparkline } from "./sparkline";

interface HeaderStatsProps {
  totalDaysSaved: number;
  trendData: number[];
}

/**
 * Header stats component showing total days saved with sparkline
 */
export function HeaderStats({ totalDaysSaved, trendData }: HeaderStatsProps) {
  return (
    <div className="flex items-center gap-3">
      <Sparkline data={trendData} width={50} height={16} />
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold text-blue-600">
          {totalDaysSaved.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500">days saved</span>
      </div>
    </div>
  );
}
