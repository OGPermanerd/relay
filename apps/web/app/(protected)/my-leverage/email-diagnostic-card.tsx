"use client";

import { useState } from "react";
import { runEmailDiagnostic } from "@/app/actions/email-diagnostic";
import type { AggregateResults } from "@/lib/diagnostic-aggregator";

export function EmailDiagnosticCard() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AggregateResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunDiagnostic() {
    setLoading(true);
    setError(null);

    try {
      const response = await runEmailDiagnostic();

      if (response.success && response.data) {
        setResults(response.data);
      } else {
        setError(response.error || "Failed to analyze emails. Please try again.");
      }
    } catch {
      setError("Failed to analyze emails. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              className="text-blue-600"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">Email Time Diagnostic</h3>
          <p className="text-xs text-gray-500">Analyze where your email time goes</p>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Analyzing your last 90 days of emails...
                </p>
                <p className="text-xs text-blue-700">This takes about 60-90 seconds.</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            {error.includes("not connected") && (
              <p className="text-xs text-gray-500">
                Connect your Gmail account in the{" "}
                <a
                  href="/settings/connections"
                  className="font-medium text-blue-600 hover:underline"
                >
                  Connections settings
                </a>{" "}
                to run diagnostics.
              </p>
            )}
            <button
              onClick={handleRunDiagnostic}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : results ? (
          <div className="space-y-4">
            {/* Hero stat */}
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-4">
              <p className="text-sm font-medium text-gray-700">Estimated Time Investment</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {results.estimatedHoursPerWeek} hours
              </p>
              <p className="text-xs text-gray-600">per week on email</p>
            </div>

            {/* Category breakdown preview */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700">Top Email Categories</h4>
              <div className="space-y-2">
                {results.categoryBreakdown.slice(0, 3).map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {cat.category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      <span className="text-xs text-gray-500">
                        {cat.count} {cat.count === 1 ? "email" : "emails"}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{cat.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pattern insights */}
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Busiest time:</span>{" "}
                {results.patternInsights.busiestDayOfWeek}s at{" "}
                {results.patternInsights.busiestHour === 0
                  ? "12am"
                  : results.patternInsights.busiestHour < 12
                    ? `${results.patternInsights.busiestHour}am`
                    : results.patternInsights.busiestHour === 12
                      ? "12pm"
                      : `${results.patternInsights.busiestHour - 12}pm`}
              </p>
            </div>

            {/* Action button */}
            <button
              onClick={handleRunDiagnostic}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Run New Diagnostic
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Run a diagnostic scan to see how much time you spend on email and what types of
              messages you receive most.
            </p>
            <button
              onClick={handleRunDiagnostic}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              Run Diagnostic
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
