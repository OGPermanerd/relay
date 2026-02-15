"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { QualityTrendPoint } from "@/lib/ip-dashboard-queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QualityTrendChartProps {
  data: QualityTrendPoint[];
  height?: number;
}

// ---------------------------------------------------------------------------
// UTC-safe month formatter (operates on YYYY-MM string, no Date hydration issues)
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  return MONTHS[parseInt(month, 10) - 1] + " " + year;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QualityTrendChart({ data, height = 300 }: QualityTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No quality data for this period</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatMonth} />
          <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            labelFormatter={(label) => formatMonth(String(label))}
            formatter={(value, name) => [
              value != null ? `${Number(value).toFixed(1)}%` : "N/A",
              String(name),
            ]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="avgRating"
            stroke="#3b82f6"
            name="Avg Rating"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="sentimentPct"
            stroke="#10b981"
            name="Positive Sentiment"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="benchmarkScore"
            stroke="#8b5cf6"
            name="Benchmark Score"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
