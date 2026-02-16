"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { triggerBenchmark } from "@/app/actions/benchmark";
import { StatCard } from "@/components/stat-card";
import { CostTrendChart } from "./cost-trend-chart";
import { RadarDimensionChart } from "./radar-dimension-chart";
import { formatCostMicrocents } from "@/lib/pricing-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenchmarkTabProps {
  skillId: string;
  skillSlug: string;
  isAdmin: boolean;
  isAuthor: boolean;
  // Data from server (serialized)
  latestRun: {
    id: string;
    status: string;
    models: string[];
    bestModel: string | null;
    bestQualityScore: number | null;
    cheapestModel: string | null;
    cheapestCostMicrocents: number | null;
    completedAt: string | null; // ISO string
    createdAt: string;
  } | null;
  modelComparison: {
    modelName: string;
    avgQuality: number;
    avgFaithfulness: number;
    avgRelevancy: number;
    avgPrecision: number;
    avgRecall: number;
    avgCost: number;
    avgTokens: number;
    avgLatency: number;
    testCases: number;
  }[];
  dimensionAggregates: {
    avgFaithfulness: number;
    avgRelevancy: number;
    avgPrecision: number;
    avgRecall: number;
    runsWithDimensions: number;
  } | null;
  costTrendData: { date: string; avgCost: number }[];
  costStats: {
    totalCostMicrocents: number;
    avgCostPerUseMicrocents: number;
    measurementCount: number;
    predominantModel: string | null;
  };
  feedbackStats: {
    totalFeedback: number;
    positivePct: number | null;
  };
  hasTrainingExamples: boolean;
}

// ---------------------------------------------------------------------------
// Elapsed Timer Hook (copied from ai-review-tab.tsx -- local, not exported)
// ---------------------------------------------------------------------------

function useElapsedTimer(active: boolean): { elapsed: number; final: number | null } {
  const [elapsed, setElapsed] = useState(0);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (active) {
      setElapsed(0);
      setFinalTime(null);
      elapsedRef.current = 0;
      intervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (elapsedRef.current > 0) {
          setFinalTime(elapsedRef.current);
        }
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  return { elapsed, final: finalTime };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateUTC(iso: string): string {
  const d = new Date(iso);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

function shortModel(name: string): string {
  return name.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenchmarkTab({
  skillId,
  skillSlug: _skillSlug,
  isAdmin,
  isAuthor,
  latestRun,
  modelComparison,
  dimensionAggregates,
  costTrendData,
  costStats,
  feedbackStats,
  hasTrainingExamples,
}: BenchmarkTabProps) {
  const [state, formAction, isPending] = useActionState(triggerBenchmark, {});
  const timer = useElapsedTimer(isPending);

  // Ad-hoc inputs state (for when no training examples exist)
  const [adHocText, setAdHocText] = useState("");

  // Determine staleness
  const isStale =
    !latestRun?.completedAt ||
    Date.now() - new Date(latestRun.completedAt).getTime() > NINETY_DAYS_MS;

  // Find avg tokens from best model's comparison row
  const bestModelRow = latestRun?.bestModel
    ? modelComparison.find((r) => r.modelName === latestRun.bestModel)
    : null;

  // Parse ad-hoc inputs for form submission
  const adHocInputsJson = adHocText.trim()
    ? JSON.stringify(
        adHocText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
      )
    : "";

  const canTrigger = isAdmin || isAuthor;

  // Detect if any model in the current run has dimension scores
  const hasDimensionData = modelComparison.some(
    (row) =>
      row.avgFaithfulness > 0 || row.avgRelevancy > 0 || row.avgPrecision > 0 || row.avgRecall > 0
  );

  return (
    <div className="space-y-6">
      {/* 1. Quick Stats Row (BENCH-02) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Avg Cost / Use"
          value={
            costStats.measurementCount > 0
              ? formatCostMicrocents(costStats.avgCostPerUseMicrocents)
              : "N/A"
          }
        />
        <StatCard
          label="Avg Tokens"
          value={bestModelRow ? bestModelRow.avgTokens.toFixed(0) : "N/A"}
        />
        <StatCard
          label="Best Quality Score"
          value={latestRun?.bestQualityScore != null ? latestRun.bestQualityScore : "N/A"}
          suffix={latestRun?.bestQualityScore != null ? "/100" : undefined}
        />
        <StatCard
          label="Positive Feedback"
          value={feedbackStats.positivePct != null ? feedbackStats.positivePct + "%" : "N/A"}
        />
      </div>

      {/* 2. Staleness Detection Banner (BENCH-08) */}
      {isStale && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {!latestRun
                  ? "This skill has never been benchmarked."
                  : "Last benchmark was over 90 days ago. Results may be outdated."}
              </p>
              {canTrigger && (
                <form action={formAction} className="mt-2">
                  <input type="hidden" name="skillId" value={skillId} />
                  {adHocInputsJson && (
                    <input type="hidden" name="adHocInputs" value={adHocInputsJson} />
                  )}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isPending && <Spinner />}
                    {isPending ? `Running... ${timer.elapsed}s` : "Re-benchmark"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Run Benchmark Section (BENCH-05) */}
      {canTrigger && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Run Benchmark</h3>

          {!hasTrainingExamples && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                No training examples found. Enter test inputs below (one per line):
              </p>
              <textarea
                value={adHocText}
                onChange={(e) => setAdHocText(e.target.value)}
                placeholder={
                  "Summarize this report for stakeholders\nDraft a follow-up email to the client\nCreate a meeting agenda for the project kickoff"
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={4}
                disabled={isPending}
              />
            </div>
          )}

          <form action={formAction}>
            <input type="hidden" name="skillId" value={skillId} />
            {adHocInputsJson && <input type="hidden" name="adHocInputs" value={adHocInputsJson} />}
            <button
              type="submit"
              disabled={isPending || (!hasTrainingExamples && !adHocText.trim())}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isPending && <Spinner />}
              {isPending ? `Running... ${timer.elapsed}s` : "Run Benchmark"}
            </button>
          </form>

          {/* Error / Success messages */}
          {state.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {state.error}
            </div>
          )}
          {state.success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              Benchmark completed successfully.
              {timer.final !== null && ` (${timer.final}s)`}
            </div>
          )}
        </div>
      )}

      {/* 4. Model Comparison Table (BENCH-03) */}
      {modelComparison.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Model Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4">Quality</th>
                  {hasDimensionData && (
                    <>
                      <th className="pb-2 pr-4">Faith</th>
                      <th className="pb-2 pr-4">Rel</th>
                      <th className="pb-2 pr-4">Prec</th>
                      <th className="pb-2 pr-4">Rec</th>
                    </>
                  )}
                  <th className="pb-2 pr-4">Avg Cost</th>
                  <th className="pb-2 pr-4">Avg Tokens</th>
                  <th className="pb-2 pr-4">Latency</th>
                  <th className="pb-2">Test Cases</th>
                </tr>
              </thead>
              <tbody>
                {modelComparison.map((row) => {
                  const isBestQuality = latestRun?.bestModel === row.modelName;
                  const isCheapest = latestRun?.cheapestModel === row.modelName;

                  return (
                    <tr
                      key={row.modelName}
                      className={`border-b border-gray-100 last:border-0 ${
                        isBestQuality ? "bg-emerald-50/50" : isCheapest ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {shortModel(row.modelName)}
                        {isBestQuality && (
                          <span className="ml-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase">
                            Best
                          </span>
                        )}
                        {isCheapest && !isBestQuality && (
                          <span className="ml-1.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 uppercase">
                            Cheapest
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`font-medium ${
                            row.avgQuality >= 70
                              ? "text-emerald-600"
                              : row.avgQuality >= 40
                                ? "text-amber-600"
                                : "text-red-600"
                          }`}
                        >
                          {row.avgQuality.toFixed(0)}
                        </span>
                        <span className="text-gray-400">/100</span>
                      </td>
                      {hasDimensionData && (
                        <>
                          <td className="py-2 pr-4 text-gray-600">
                            {row.avgFaithfulness || "\u2014"}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {row.avgRelevancy || "\u2014"}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {row.avgPrecision || "\u2014"}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {row.avgRecall || "\u2014"}
                          </td>
                        </>
                      )}
                      <td className="py-2 pr-4 text-gray-600">
                        {formatCostMicrocents(row.avgCost)}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{row.avgTokens.toFixed(0)}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {(row.avgLatency / 1000).toFixed(1)}s
                      </td>
                      <td className="py-2 text-gray-600">{row.testCases}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4b. Dimension Radar Chart (BENCH-02) */}
      {hasDimensionData && modelComparison.length >= 2 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Quality Dimensions</h3>
          <p className="text-xs text-gray-500">
            Per-dimension comparison across models (0-100 scale)
          </p>
          <RadarDimensionChart models={modelComparison} />
        </div>
      )}

      {/* 4c. Skill Dimension Aggregates (BENCH-04) */}
      {dimensionAggregates && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Aggregate Dimension Scores</h3>
          <p className="text-xs text-gray-500">
            Averaged across {dimensionAggregates.runsWithDimensions} benchmark run
            {dimensionAggregates.runsWithDimensions !== 1 ? "s" : ""} with dimension scoring
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Faithfulness"
              value={dimensionAggregates.avgFaithfulness}
              suffix="/100"
            />
            <StatCard label="Relevancy" value={dimensionAggregates.avgRelevancy} suffix="/100" />
            <StatCard label="Precision" value={dimensionAggregates.avgPrecision} suffix="/100" />
            <StatCard label="Recall" value={dimensionAggregates.avgRecall} suffix="/100" />
          </div>
        </div>
      )}

      {/* 5. Cost Trend Chart (BENCH-04) */}
      {costTrendData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Cost Trend (Last 90 Days)</h3>
          <CostTrendChart data={costTrendData} />
        </div>
      )}

      {/* 6. Latest Run Summary */}
      {latestRun && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          {latestRun.completedAt && (
            <span>
              Last benchmarked: {relativeTime(latestRun.completedAt)} (
              {formatDateUTC(latestRun.completedAt)})
            </span>
          )}
          <span>Models tested: {latestRun.models.map(shortModel).join(", ")}</span>
          <span>Status: {latestRun.status}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
