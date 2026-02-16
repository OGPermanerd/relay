import { pgTable, text, timestamp, integer, boolean, index, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { skillVersions } from "./skill-versions";
import { users } from "./users";
import { tenants } from "./tenants";

/**
 * Benchmark runs table - tracks benchmark execution sessions for skills
 * Each run tests a skill across multiple models to compare quality and cost
 */
export const benchmarkRuns = pgTable(
  "benchmark_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    skillVersionId: text("skill_version_id").references(() => skillVersions.id),
    triggeredBy: text("triggered_by")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"),
    models: text("models").array().notNull(),
    bestModel: text("best_model"),
    bestQualityScore: integer("best_quality_score"),
    cheapestModel: text("cheapest_model"),
    cheapestCostMicrocents: integer("cheapest_cost_microcents"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("benchmark_runs_skill_id_idx").on(table.skillId),
    index("benchmark_runs_tenant_id_idx").on(table.tenantId),
    index("benchmark_runs_status_idx").on(table.status),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type BenchmarkRun = typeof benchmarkRuns.$inferSelect;
export type NewBenchmarkRun = typeof benchmarkRuns.$inferInsert;

/**
 * Benchmark results table - individual test case results within a benchmark run
 * Each result represents one model's output for one test case
 */
export const benchmarkResults = pgTable(
  "benchmark_results",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    benchmarkRunId: text("benchmark_run_id")
      .notNull()
      .references(() => benchmarkRuns.id, { onDelete: "cascade" }),
    modelName: text("model_name").notNull(),
    modelProvider: text("model_provider").notNull(),
    testCaseIndex: integer("test_case_index").notNull(),
    inputUsed: text("input_used"),
    outputProduced: text("output_produced"),
    expectedOutput: text("expected_output"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    latencyMs: integer("latency_ms"),
    estimatedCostMicrocents: integer("estimated_cost_microcents"),
    qualityScore: integer("quality_score"), // 0-100
    qualityNotes: text("quality_notes"),
    faithfulnessScore: integer("faithfulness_score"), // 0-100, RAGAS faithfulness
    relevancyScore: integer("relevancy_score"), // 0-100, RAGAS answer relevancy
    precisionScore: integer("precision_score"), // 0-100, RAGAS context precision
    recallScore: integer("recall_score"), // 0-100, RAGAS context recall
    matchesExpected: boolean("matches_expected"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("benchmark_results_benchmark_run_id_idx").on(table.benchmarkRunId),
    index("benchmark_results_model_name_idx").on(table.modelName),
    index("benchmark_results_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type BenchmarkResult = typeof benchmarkResults.$inferSelect;
export type NewBenchmarkResult = typeof benchmarkResults.$inferInsert;
