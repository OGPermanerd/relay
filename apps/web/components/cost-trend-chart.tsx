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
import { formatCostMicrocents } from "@/lib/pricing-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CostTrendPoint {
  date: string;
  avgCost: number; // microcents
}

interface CostTrendChartProps {
  data: CostTrendPoint[];
  height?: number;
}

// ---------------------------------------------------------------------------
// UTC date formatter (hydration-safe -- no toLocaleDateString)
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateShort(date: string): string {
  const d = new Date(date);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostTrendChart({ data, height = 300 }: CostTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No cost data for this period</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatDateShort} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => formatCostMicrocents(value)}
          />
          <Tooltip
            labelFormatter={(label) => formatDateShort(String(label))}
            formatter={(value) => [formatCostMicrocents(Number(value)), "Avg Cost"]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Area
            type="monotone"
            dataKey="avgCost"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
