"use client";

import { Sparkline } from "./sparkline";
import { FTE_DAYS_PER_YEAR } from "@/lib/constants";

interface HeaderStatsProps {
  totalDaysSaved: number;
  trendData: number[];
}

/**
 * Header stats component showing total days saved with sparkline
 */
export function HeaderStats({ totalDaysSaved, trendData }: HeaderStatsProps) {
  const yearsSaved = (totalDaysSaved / FTE_DAYS_PER_YEAR).toFixed(1);

  return (
    <div className="flex items-center gap-3">
      <Sparkline data={trendData} width={50} height={16} />
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold text-blue-600">{yearsSaved}</span>
        <span className="text-xs text-gray-500">years saved</span>
      </div>
    </div>
  );
}
