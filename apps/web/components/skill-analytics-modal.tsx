"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTimeRange } from "./time-range-selector";
import { fetchSkillTrend, type SkillTrendPoint } from "@/app/actions/get-skill-trend";

interface EmployeeBreakdown {
  userId: string;
  userName: string | null;
  usageCount: number;
}

interface SkillRow {
  skillId: string;
  name: string;
  category: string;
  authorName: string | null;
  usageCount: number;
  uniqueUsers: number;
  hoursSaved: number;
  employeeBreakdown: EmployeeBreakdown[];
}

interface SkillAnalyticsModalProps {
  skill: SkillRow;
  onClose: () => void;
}

export function SkillAnalyticsModal({ skill, onClose }: SkillAnalyticsModalProps) {
  const range = useTimeRange();
  const [trendData, setTrendData] = useState<SkillTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sort employees by usage count descending
  const sortedEmployees = [...skill.employeeBreakdown].sort((a, b) => b.usageCount - a.usageCount);

  useEffect(() => {
    setIsLoading(true);
    fetchSkillTrend(skill.skillId, range)
      .then(setTrendData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [skill.skillId, range]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{skill.name}</h2>
            <p className="text-sm text-gray-500">{skill.category}</p>
            {skill.authorName && <p className="text-xs text-gray-400">by {skill.authorName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-gray-50">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{skill.usageCount}</p>
            <p className="text-sm text-gray-500">Total Uses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{skill.uniqueUsers}</p>
            <p className="text-sm text-gray-500">Unique Users</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{skill.hoursSaved.toFixed(1)}</p>
            <p className="text-sm text-gray-500">Hours Saved</p>
          </div>
        </div>

        {/* Usage Over Time Chart */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Usage Over Time</h3>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : trendData.length === 0 ? (
            <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <p className="text-sm text-gray-500">No usage data for this period</p>
            </div>
          ) : (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(date: string) =>
                      new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                    formatter={(value) => [Number(value), "Uses"]}
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid #e5e7eb",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="usageCount"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Employee Breakdown */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Who Uses This Skill</h3>
          {sortedEmployees.length === 0 ? (
            <p className="text-sm text-gray-400">No usage data available</p>
          ) : (
            <div className="space-y-2">
              {sortedEmployees.map((emp, index) => (
                <div
                  key={emp.userId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center text-sm font-medium ${
                        index < 3 ? "text-blue-600" : "text-gray-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <Link
                      href={`/users/${emp.userId}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {emp.userName || "Unknown User"}
                    </Link>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{emp.usageCount}</span>
                    <span className="text-xs text-gray-500 ml-1">uses</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Close
          </button>
          <Link
            href={`/skills/${skill.skillId}`}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            View Skill
          </Link>
        </div>
      </div>
    </div>
  );
}
