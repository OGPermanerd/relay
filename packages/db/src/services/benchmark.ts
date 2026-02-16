import { db } from "../client";
import { benchmarkRuns, benchmarkResults } from "../schema/benchmark-runs";
import { tokenMeasurements } from "../schema/token-measurements";
import { skillFeedback } from "../schema/skill-feedback";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { BenchmarkRun, NewBenchmarkResult, BenchmarkResult } from "../schema/benchmark-runs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BenchmarkRunWithResults = BenchmarkRun & {
  results: BenchmarkResult[];
};

export interface ModelComparisonRow {
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
}

export interface SkillDimensionAggregates {
  avgFaithfulness: number;
  avgRelevancy: number;
  avgPrecision: number;
  avgRecall: number;
  runsWithDimensions: number;
}

export interface CostTrendPoint {
  date: string;
  avgCost: number;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new benchmark run for a skill.
 */
export async function createBenchmarkRun(params: {
  tenantId: string;
  skillId: string;
  triggeredBy: string;
  models: string[];
}): Promise<BenchmarkRun> {
  if (!db) throw new Error("Database not configured");

  const [run] = await db
    .insert(benchmarkRuns)
    .values({
      tenantId: params.tenantId,
      skillId: params.skillId,
      triggeredBy: params.triggeredBy,
      models: params.models,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  return run;
}

/**
 * Complete (or fail) a benchmark run with summary stats.
 */
export async function completeBenchmarkRun(
  runId: string,
  params: {
    status: "completed" | "failed";
    bestModel?: string;
    bestQualityScore?: number;
    cheapestModel?: string;
    cheapestCostMicrocents?: number;
  }
): Promise<void> {
  if (!db) return;

  await db
    .update(benchmarkRuns)
    .set({
      status: params.status,
      completedAt: new Date(),
      bestModel: params.bestModel ?? null,
      bestQualityScore: params.bestQualityScore ?? null,
      cheapestModel: params.cheapestModel ?? null,
      cheapestCostMicrocents: params.cheapestCostMicrocents ?? null,
    })
    .where(eq(benchmarkRuns.id, runId));
}

/**
 * Insert a single benchmark result row.
 */
export async function insertBenchmarkResult(params: NewBenchmarkResult): Promise<BenchmarkResult> {
  if (!db) throw new Error("Database not configured");

  const [result] = await db.insert(benchmarkResults).values(params).returning();

  return result;
}

/**
 * Get the latest benchmark run for a skill, including results.
 */
export async function getLatestBenchmarkRun(
  skillId: string
): Promise<BenchmarkRunWithResults | null> {
  if (!db) return null;

  const run = await db.query.benchmarkRuns.findFirst({
    where: eq(benchmarkRuns.skillId, skillId),
    orderBy: desc(benchmarkRuns.createdAt),
    with: { results: true },
  });

  return (run as BenchmarkRunWithResults) ?? null;
}

/**
 * Get all benchmark results for a specific run, ordered by model then test case.
 */
export async function getBenchmarkResultsByRun(runId: string): Promise<BenchmarkResult[]> {
  if (!db) return [];

  return db
    .select()
    .from(benchmarkResults)
    .where(eq(benchmarkResults.benchmarkRunId, runId))
    .orderBy(benchmarkResults.modelName, benchmarkResults.testCaseIndex);
}

// ---------------------------------------------------------------------------
// Aggregation Queries
// ---------------------------------------------------------------------------

/**
 * Aggregate benchmark results by model for a run.
 * Returns average quality, cost, tokens, latency, and test case count per model.
 */
export async function getModelComparisonStats(runId: string): Promise<ModelComparisonRow[]> {
  if (!db) return [];

  const rows = await db
    .select({
      modelName: benchmarkResults.modelName,
      avgQuality: sql<number>`COALESCE(AVG(${benchmarkResults.qualityScore}), 0)::int`,
      avgFaithfulness: sql<number>`COALESCE(AVG(${benchmarkResults.faithfulnessScore}), 0)::int`,
      avgRelevancy: sql<number>`COALESCE(AVG(${benchmarkResults.relevancyScore}), 0)::int`,
      avgPrecision: sql<number>`COALESCE(AVG(${benchmarkResults.precisionScore}), 0)::int`,
      avgRecall: sql<number>`COALESCE(AVG(${benchmarkResults.recallScore}), 0)::int`,
      avgCost: sql<number>`COALESCE(AVG(${benchmarkResults.estimatedCostMicrocents}), 0)::int`,
      avgTokens: sql<number>`COALESCE(AVG(${benchmarkResults.totalTokens}), 0)::int`,
      avgLatency: sql<number>`COALESCE(AVG(${benchmarkResults.latencyMs}), 0)::int`,
      testCases: sql<number>`COUNT(*)::int`,
    })
    .from(benchmarkResults)
    .where(eq(benchmarkResults.benchmarkRunId, runId))
    .groupBy(benchmarkResults.modelName);

  return rows;
}

/**
 * Get cost trend data for a skill over the last N days.
 * Groups token_measurements by day and returns average cost per day.
 */
export async function getCostTrendData(
  skillId: string,
  days: number = 90
): Promise<CostTrendPoint[]> {
  if (!db) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', ${tokenMeasurements.createdAt})::date::text`,
      avgCost: sql<number>`COALESCE(AVG(${tokenMeasurements.estimatedCostMicrocents}), 0)::int`,
    })
    .from(tokenMeasurements)
    .where(and(eq(tokenMeasurements.skillId, skillId), gte(tokenMeasurements.createdAt, cutoff)))
    .groupBy(sql`date_trunc('day', ${tokenMeasurements.createdAt})`)
    .orderBy(sql`date_trunc('day', ${tokenMeasurements.createdAt})`);

  return rows;
}

/**
 * Aggregate dimension scores across ALL benchmark runs for a skill.
 * Only includes results where dimension data exists (faithfulness_score IS NOT NULL).
 * Returns null if no dimension data is available.
 */
export async function getSkillDimensionAggregates(
  skillId: string
): Promise<SkillDimensionAggregates | null> {
  if (!db) return null;

  const rows = await db
    .select({
      avgFaithfulness: sql<number>`AVG(${benchmarkResults.faithfulnessScore})::int`,
      avgRelevancy: sql<number>`AVG(${benchmarkResults.relevancyScore})::int`,
      avgPrecision: sql<number>`AVG(${benchmarkResults.precisionScore})::int`,
      avgRecall: sql<number>`AVG(${benchmarkResults.recallScore})::int`,
      runsWithDimensions: sql<number>`COUNT(DISTINCT ${benchmarkResults.benchmarkRunId})::int`,
    })
    .from(benchmarkResults)
    .innerJoin(benchmarkRuns, eq(benchmarkResults.benchmarkRunId, benchmarkRuns.id))
    .where(
      and(
        eq(benchmarkRuns.skillId, skillId),
        sql`${benchmarkResults.faithfulnessScore} IS NOT NULL`
      )
    );

  const result = rows[0];
  return result && result.runsWithDimensions > 0 ? result : null;
}

/**
 * Get accepted training examples for a skill.
 * Returns input/output pairs from skill_feedback where feedbackType='training_example' and status='accepted'.
 */
export async function getTrainingExamples(
  skillId: string
): Promise<{ exampleInput: string; expectedOutput: string }[]> {
  if (!db) return [];

  const rows = await db
    .select({
      exampleInput: skillFeedback.exampleInput,
      expectedOutput: skillFeedback.expectedOutput,
    })
    .from(skillFeedback)
    .where(
      and(
        eq(skillFeedback.skillId, skillId),
        eq(skillFeedback.feedbackType, "training_example"),
        eq(skillFeedback.status, "accepted")
      )
    );

  // Filter out rows missing input or output and assert types
  return rows
    .filter((r) => r.exampleInput != null && r.expectedOutput != null)
    .map((r) => ({
      exampleInput: r.exampleInput!,
      expectedOutput: r.expectedOutput!,
    }));
}
