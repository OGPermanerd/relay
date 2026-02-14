"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CategoryBreakdownItem } from "@everyskill/db/services/email-diagnostics";

interface TimeBarChartProps {
  data: CategoryBreakdownItem[];
}

export function TimeBarChart({ data }: TimeBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No time data</p>
      </div>
    );
  }

  // Transform data: convert minutes to hours per week, sort descending
  const chartData = data
    .map((item) => ({
      category: item.category.replace(/-/g, " "), // kebab-case to space-separated
      hoursPerWeek: Number(((item.estimatedMinutes / 60) * 7).toFixed(1)), // convert minutes to hours per week
    }))
    .sort((a, b) => b.hoursPerWeek - a.hoursPerWeek); // sort descending

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="horizontal"
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => value.toFixed(1)}
          />
          <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={120} />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} hrs/week`, "Time per Week"]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="hoursPerWeek" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
