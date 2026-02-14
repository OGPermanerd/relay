"use client";

import { useState } from "react";
import type { CategoryBreakdownItem, PatternInsights } from "@/lib/diagnostic-aggregator";
import { CategoryPieChart } from "@/components/category-pie-chart";
import { TimeBarChart } from "@/components/time-bar-chart";
import { runEmailDiagnostic } from "@/app/actions/email-diagnostic";

interface DiagnosticData {
  id: string;
  userId: string;
  tenantId: string;
  scanDate: Date | string;
  scanPeriodDays: number;
  totalMessages: number;
  categoryBreakdown: unknown;
  estimatedHoursPerWeek: number;
  patternInsights: unknown;
}

interface DiagnosticDashboardProps {
  diagnostic: DiagnosticData;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DiagnosticDashboard({ diagnostic }: DiagnosticDashboardProps) {
  const [rerunning, setRerunning] = useState(false);

  // Convert tenths to actual hours (125 -> 12.5)
  const hoursPerWeek = (diagnostic.estimatedHoursPerWeek / 10).toFixed(1);

  // Safe date formatting (no toLocaleDateString — causes hydration errors)
  const d = new Date(diagnostic.scanDate);
  const scanDateFormatted = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

  // Cast JSONB fields
  const categoryBreakdown = diagnostic.categoryBreakdown as CategoryBreakdownItem[];
  const patternInsights = diagnostic.patternInsights as PatternInsights | null;

  async function handleRerun() {
    setRerunning(true);
    try {
      await runEmailDiagnostic();
      window.location.reload();
    } catch {
      setRerunning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Hero KPI */}
      <div className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-blue-100">Estimated Weekly Email Time</p>
        <p className="mt-2 text-5xl font-bold">{hoursPerWeek} hours</p>
        <p className="mt-1 text-sm text-blue-200">per week spent on email</p>
      </div>

      {/* 2. Category Pie Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Email Category Distribution</h2>
        <CategoryPieChart data={categoryBreakdown} />
      </div>

      {/* 3. Time Bar Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Time Per Category</h2>
        <TimeBarChart data={categoryBreakdown} />
      </div>

      {/* 4. Pattern Insights */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Busiest Time</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {patternInsights
              ? `${patternInsights.busiestDayOfWeek}s at ${
                  patternInsights.busiestHour === 0
                    ? "12am"
                    : patternInsights.busiestHour < 12
                      ? `${patternInsights.busiestHour}am`
                      : patternInsights.busiestHour === 12
                        ? "12pm"
                        : `${patternInsights.busiestHour - 12}pm`
                }`
              : "N/A"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Last Scanned</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{scanDateFormatted}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Messages Analyzed
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {String(diagnostic.totalMessages).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          </p>
        </div>
      </div>

      {/* 5. Re-run button */}
      <div className="flex justify-center">
        <button
          onClick={handleRerun}
          disabled={rerunning}
          className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rerunning ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              Re-running Diagnostic...
            </span>
          ) : (
            "Re-run Diagnostic"
          )}
        </button>
      </div>
    </div>
  );
}
