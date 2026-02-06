"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface UsageDataPoint {
  date: string; // ISO date string
  hoursSaved: number;
}

interface UsageAreaChartProps {
  data: UsageDataPoint[];
  height?: number;
}

export function UsageAreaChart({ data, height = 300 }: UsageAreaChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No usage data for this period</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(date: string) =>
              new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
          />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => value.toFixed(0)} />
          <Tooltip
            labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
            formatter={(value) => [Number(value).toFixed(1) + " hours", "Hours Saved"]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Area
            type="monotone"
            dataKey="hoursSaved"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
