"use client";

import { Sparkline } from "./sparkline";

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  trendData?: number[];
  trendColor?: string;
}

export function StatCard({
  label,
  value,
  suffix,
  icon,
  trendData,
  trendColor = "#3b82f6",
}: StatCardProps) {
  const hasSparkline = trendData && trendData.length > 0 && trendData.some((v) => v > 0);

  return (
    <div className="relative overflow-hidden rounded-lg bg-white p-6 shadow-sm">
      {/* Sparkline underlay */}
      {hasSparkline && (
        <div className="absolute inset-0 flex items-end opacity-50">
          <Sparkline data={trendData} width={200} height={60} color={trendColor} />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex items-center gap-3">
        {icon && <div className="text-blue-600">{icon}</div>}
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {value}
            {suffix && <span className="ml-1 text-sm font-normal text-gray-400">{suffix}</span>}
          </p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
