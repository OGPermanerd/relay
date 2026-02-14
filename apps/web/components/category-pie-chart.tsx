"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategoryBreakdownItem } from "@everyskill/db/services/email-diagnostics";

interface CategoryPieChartProps {
  data: CategoryBreakdownItem[];
}

const CATEGORY_COLORS: Record<string, string> = {
  newsletter: "#3b82f6", // blue
  "automated-notification": "#10b981", // green
  "meeting-invite": "#f59e0b", // amber
  "direct-message": "#8b5cf6", // purple
  "internal-thread": "#ef4444", // red
  "vendor-external": "#06b6d4", // cyan
  "support-ticket": "#ec4899", // pink
};

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No category data</p>
      </div>
    );
  }

  // Transform data for pie chart with labels
  const chartData = data.map((item) => ({
    name: item.category.replace(/-/g, " "),
    value: item.count,
    percentage: item.percentage,
    category: item.category,
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(entry) => {
              const item = entry as unknown as (typeof chartData)[0];
              return `${item.name}: ${item.percentage.toFixed(1)}%`;
            }}
            labelLine={true}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || "#6b7280"} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-sm">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
