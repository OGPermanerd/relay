# Phase 75: RAGAS Benchmarking - Research

**Researched:** 2026-02-16
**Domain:** LLM-as-judge multi-dimension evaluation, RAGAS metric adaptation for skill benchmarking, radar chart visualization
**Confidence:** MEDIUM-HIGH

## Summary

Phase 75 extends the existing benchmark system to produce per-dimension quality scores (faithfulness, relevancy, precision, recall) alongside the existing overall quality score. The existing system uses a single Anthropic AI judge that returns a 0-100 `qualityScore`. The upgrade expands this to 4 RAGAS-inspired dimension scores, adds 4 nullable INTEGER columns to `benchmark_results`, extends the judge prompt, and builds UI components (radar chart, dimension comparison table, aggregate view).

The approach is a **TypeScript judge prompt adaptation** of RAGAS methodology -- NOT the Python RAGAS library. This was a locked decision from v7.0 research. The existing benchmark runner (`apps/web/lib/benchmark-runner.ts`) already uses Anthropic's `output_config` with `json_schema` for structured judge output, so extending the schema to include 4 additional numeric fields is straightforward. The main risk is judge reliability when scoring 4 dimensions simultaneously vs. a single score.

**Primary recommendation:** Extend the existing judge call to return 4 additional dimension scores (0-100 each) via an expanded JSON schema. Add 4 nullable INTEGER columns to `benchmark_results`. Build a Recharts RadarChart component for visualization. Keep the existing `qualityScore` as-is for backward compatibility.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.7.0 | Radar chart for dimension visualization | Already installed, used by 10+ chart components in the project |
| @anthropic-ai/sdk | (existing) | Judge LLM calls with structured output | Already used in benchmark-runner.ts |
| drizzle-orm | 0.42.0 | Schema definition, queries, migrations | Project ORM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts RadarChart | 3.7.0 | Multi-model dimension comparison overlay | BENCH-02: radar chart comparing models |
| Recharts PolarGrid/PolarAngleAxis/PolarRadiusAxis | 3.7.0 | Radar chart axes | Required sub-components of RadarChart |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts RadarChart | D3.js raw SVG | More control but much more code; recharts already in bundle |
| Single multi-dimension judge call | Separate judge call per dimension | More reliable per-dimension but 4x API cost and latency |
| Nullable columns | JSONB column for dimension scores | JSONB loses type safety and makes aggregation queries harder |

**Installation:**
```bash
# No new packages needed -- recharts 3.7.0 and @anthropic-ai/sdk already installed
```

## Architecture Patterns

### Existing Benchmark Architecture (What We Extend)

```
apps/web/
  lib/benchmark-runner.ts        # Core runner: model execution + judge
  app/actions/benchmark.ts       # Server action: auth, validation, trigger
  components/benchmark-tab.tsx   # UI: stats, comparison table, trigger button
  components/cost-trend-chart.tsx # Recharts AreaChart pattern

packages/db/
  src/schema/benchmark-runs.ts    # benchmarkRuns + benchmarkResults tables
  src/services/benchmark.ts       # CRUD + aggregation queries
  src/relations/index.ts          # benchmarkRuns <-> benchmarkResults relations
  src/migrations/                 # Next: 0043_*.sql
```

### Recommended Changes by Layer

```
LAYER 1: Schema (migration 0043)
  benchmark_results + 4 columns: faithfulness_score, relevancy_score,
  precision_score, recall_score (all INTEGER, all NULLABLE for backward compat)

LAYER 2: Judge (benchmark-runner.ts)
  Extended JUDGE_JSON_SCHEMA with 4 dimension fields
  Extended judge prompt with per-dimension scoring rubric
  Extended JudgeOutput interface
  Store dimension scores via insertBenchmarkResult()

LAYER 3: Queries (packages/db/src/services/benchmark.ts)
  Extended ModelComparisonRow with avg dimension scores
  New: getDimensionAggregatesBySkill() for BENCH-04
  Extended getModelComparisonStats() to include dimension averages

LAYER 4: UI (apps/web/components/)
  New: RadarDimensionChart component (Recharts RadarChart)
  Extended: BenchmarkTab with radar chart + dimension comparison columns
  Extended: BenchmarkTabProps with dimension data
  Updated: Skill page server component to pass dimension data
```

### Pattern 1: Extending the Judge JSON Schema
**What:** Add 4 dimension fields to the existing structured output schema
**When to use:** Judge evaluation call
**Example:**
```typescript
// Source: Existing pattern in apps/web/lib/benchmark-runner.ts:69-78
const JUDGE_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    qualityScore: { type: "number" as const },          // existing
    qualityNotes: { type: "string" as const },           // existing
    matchesExpected: { type: "boolean" as const },       // existing
    faithfulnessScore: { type: "number" as const },      // NEW: 0-100
    relevancyScore: { type: "number" as const },         // NEW: 0-100
    precisionScore: { type: "number" as const },         // NEW: 0-100
    recallScore: { type: "number" as const },            // NEW: 0-100
  },
  required: [
    "qualityScore", "qualityNotes", "matchesExpected",
    "faithfulnessScore", "relevancyScore", "precisionScore", "recallScore"
  ],
  additionalProperties: false,
};
```

### Pattern 2: Recharts RadarChart for Model Comparison
**What:** Overlay multiple models' dimension scores on a single radar chart
**When to use:** BENCH-02 visualization
**Example:**
```typescript
// Source: Recharts docs + existing project patterns (cost-trend-chart.tsx)
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Legend, ResponsiveContainer, Tooltip,
} from "recharts";

// Data format: one entry per dimension, with a key per model
const data = [
  { dimension: "Faithfulness", "sonnet-4-5": 92, "haiku-4-5": 78 },
  { dimension: "Relevancy",    "sonnet-4-5": 88, "haiku-4-5": 75 },
  { dimension: "Precision",    "sonnet-4-5": 85, "haiku-4-5": 70 },
  { dimension: "Recall",       "sonnet-4-5": 83, "haiku-4-5": 65 },
];

<ResponsiveContainer width="100%" height={300}>
  <RadarChart data={data}>
    <PolarGrid />
    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
    <Tooltip />
    <Legend />
    <Radar name="Sonnet 4.5" dataKey="sonnet-4-5"
           stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
    <Radar name="Haiku 4.5" dataKey="haiku-4-5"
           stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
  </RadarChart>
</ResponsiveContainer>
```

### Pattern 3: Nullable Column Migration for Backward Compatibility
**What:** Add nullable dimension columns so existing rows remain valid
**When to use:** Schema migration
**Example:**
```sql
-- Migration 0043: Add RAGAS dimension scores to benchmark_results
-- All columns NULLABLE so existing results (pre-RAGAS) are untouched (BENCH-05)
ALTER TABLE benchmark_results ADD COLUMN faithfulness_score INTEGER;
ALTER TABLE benchmark_results ADD COLUMN relevancy_score INTEGER;
ALTER TABLE benchmark_results ADD COLUMN precision_score INTEGER;
ALTER TABLE benchmark_results ADD COLUMN recall_score INTEGER;
```

### Pattern 4: Aggregation Query with Dimension Averages
**What:** Extend model comparison to include per-dimension averages
**When to use:** BENCH-03 dimension comparison table and BENCH-04 skill aggregates
**Example:**
```typescript
// Source: Existing pattern in packages/db/src/services/benchmark.ts:137-153
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
```

### Anti-Patterns to Avoid
- **Separate judge calls per dimension:** 4x API cost and 4x latency for marginal reliability improvement. The judge can score all 4 dimensions in a single structured output call.
- **Replacing qualityScore with computed average:** Keep the judge's holistic `qualityScore` as-is. Do NOT compute it as `(f + r + p + r) / 4`. The overall score may legitimately differ from the arithmetic mean of dimensions.
- **Non-nullable dimension columns:** Would break INSERT for all existing code paths until every caller is updated. Use nullable columns and let COALESCE handle aggregation.
- **Storing dimension scores in JSONB:** Loses SQL aggregation efficiency and type safety in Drizzle schema.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radar chart rendering | Custom SVG radar | Recharts RadarChart | Already in bundle, handles responsiveness, tooltips, legends |
| Structured LLM output | Manual JSON parsing with regex | Anthropic `output_config` with `json_schema` | Existing pattern, guaranteed valid JSON |
| Score aggregation | App-level averaging in TypeScript | SQL AVG() with COALESCE | Database handles NULLs correctly, single query |
| Multi-model chart overlay | Multiple separate charts | Single RadarChart with multiple `<Radar>` children | Standard recharts pattern, visual comparison |

**Key insight:** Every building block already exists in this codebase. The judge structured output pattern, recharts chart components, Drizzle schema + migration pattern, and benchmark service aggregation queries all have established patterns. This phase is pure extension, not invention.

## Common Pitfalls

### Pitfall 1: Judge Dimension Score Inflation
**What goes wrong:** When an LLM scores multiple dimensions simultaneously, it tends to cluster all scores near the same value (e.g., overall=85, faith=84, rel=86, prec=83, rec=82). This defeats the purpose of multi-dimensional scoring.
**Why it happens:** LLMs anchor on their first score and adjust minimally for subsequent dimensions. Without explicit differentiation guidance, the judge treats dimensions as synonymous.
**How to avoid:** The judge prompt must include concrete examples showing that dimensions CAN diverge significantly. Include a rubric scenario: "An output that perfectly follows instructions (faithfulness=95) but misses half the input requirements (recall=50) is a valid evaluation." Also include an instruction: "Each dimension score should be evaluated independently. It is expected and correct for dimension scores to differ by 20+ points."
**Warning signs:** If all 4 dimensions are consistently within 5 points of each other across multiple benchmark runs, the prompt needs tuning.

### Pitfall 2: COALESCE(AVG(NULL), 0) Distorting Aggregates
**What goes wrong:** For BENCH-04 (aggregate dimension scores across all runs), old benchmark results have NULL dimension scores. `COALESCE(AVG(faithfulness_score), 0)` returns 0 for runs with no dimension data, which is misleading -- 0 means "terrible" not "unmeasured."
**Why it happens:** NULL semantics: AVG ignores NULLs, but if ALL values are NULL, AVG returns NULL, and COALESCE converts that to 0.
**How to avoid:** For aggregation queries spanning old+new results, filter to only rows where dimension scores are not null: `WHERE faithfulness_score IS NOT NULL`. Or return null from the query (not 0) and display "N/A" in the UI.
**Warning signs:** Skills with only pre-RAGAS benchmark runs showing dimension scores of 0.

### Pitfall 3: Radar Chart with Single Model (Degenerate Case)
**What goes wrong:** If only 1 model was benchmarked (or only 1 model has dimension data), the radar chart shows a single polygon with no comparison. This looks broken or useless.
**Why it happens:** The "Run Benchmark" feature defaults to 2 models (Sonnet + Haiku), but one might fail, leaving only 1 model's results.
**How to avoid:** When there's only 1 model with dimension data, show a simple bar chart or score cards instead of a radar chart. Radar charts are only valuable for comparison (2+ models).
**Warning signs:** Radar chart rendering with a single filled polygon.

### Pitfall 4: Hydration Mismatch in Chart Component
**What goes wrong:** Recharts components with floating-point data can render differently on server vs client due to number formatting differences.
**Why it happens:** The project has documented hydration issues with date formatting (see MEMORY.md). Chart data with decimals could trigger similar issues.
**How to avoid:** All dimension scores are integers (0-100), which avoids float formatting issues. Ensure the data transformation (model name shortening, dimension labeling) happens on the server and passes serialized props. Follow the pattern in `benchmark-tab.tsx` where all data is pre-computed server-side.
**Warning signs:** React hydration warnings in console on benchmark tab.

### Pitfall 5: Extended Judge Prompt Exceeding max_tokens
**What goes wrong:** The current judge uses `max_tokens: 512`. Adding 4 dimension scores with explanations per dimension could exceed this limit, causing truncated JSON.
**Why it happens:** The `output_config` JSON schema ensures valid JSON, but the content may be cut short if max_tokens is too low.
**How to avoid:** Increase judge `max_tokens` to 1024. The additional fields are 4 numbers, but the `qualityNotes` field may need to explain per-dimension rationale. Test with actual benchmark data to verify output fits.
**Warning signs:** Judge returns default/fallback scores because JSON parsing failed.

### Pitfall 6: API Cost Increase from Extended Judge Prompt
**What goes wrong:** The extended judge prompt is ~2x longer (dimension rubrics + examples). With 3 test cases x 2 models = 6 judge calls per benchmark, the extra input tokens add up.
**Why it happens:** Each judge call now includes a longer system prompt with dimension definitions and scoring rubric.
**How to avoid:** Keep the dimension rubric concise (the prior research suggests ~200 extra tokens per call). At Sonnet pricing (~$3/M input), 6 calls x 200 extra tokens = ~$0.004 extra per benchmark run. Acceptable. Monitor via the existing `estimatedCostMicrocents` tracking.
**Warning signs:** Benchmark cost doubling compared to pre-RAGAS runs.

## Code Examples

### Extended Judge Prompt (Core RAGAS Adaptation)
```typescript
// Source: Adapted from existing apps/web/lib/benchmark-runner.ts:84-129
const userPrompt = `Evaluate the following output produced for the given input.

<skill_instructions>
${skillContent}
</skill_instructions>

<input>
${testInput}
</input>

<output>
${output}
</output>${expectedSection}

Score the output on FIVE dimensions (0-100 each). Each dimension MUST be scored independently -- it is normal and expected for scores to differ by 20+ points.

1. OVERALL QUALITY (qualityScore): Holistic assessment of correctness, completeness, and usefulness.

2. FAITHFULNESS (faithfulnessScore): Does the output follow the skill instructions without hallucinating, deviating, or adding unsupported claims? 100 = perfectly faithful to instructions. 0 = completely ignores or contradicts instructions.

3. RELEVANCY (relevancyScore): Is the output relevant to the specific input provided? 100 = directly and completely addresses the input. 0 = output has nothing to do with the input.

4. PRECISION (precisionScore): Did the model use the skill instructions effectively? 100 = every part of the skill was leveraged appropriately. 0 = skill instructions were completely ignored.

5. RECALL (recallScore): Does the output address ALL aspects of the input? 100 = every aspect of the input is covered. 0 = major aspects of the input were missed.

Example of valid divergent scoring:
- An output that perfectly follows instructions (faithfulness=95) but only addresses half the input (recall=50)
- An output that covers everything in the input (recall=90) but ignores the skill format requirements (precision=40)`;
```

### Dimension Aggregate Query for Skill Summary (BENCH-04)
```typescript
// Source: Pattern from packages/db/src/services/benchmark.ts
export async function getSkillDimensionAggregates(skillId: string): Promise<{
  avgFaithfulness: number | null;
  avgRelevancy: number | null;
  avgPrecision: number | null;
  avgRecall: number | null;
  runsWithDimensions: number;
} | null> {
  if (!db) return null;

  const [result] = await db
    .select({
      avgFaithfulness: sql<number | null>`AVG(${benchmarkResults.faithfulnessScore})::int`,
      avgRelevancy: sql<number | null>`AVG(${benchmarkResults.relevancyScore})::int`,
      avgPrecision: sql<number | null>`AVG(${benchmarkResults.precisionScore})::int`,
      avgRecall: sql<number | null>`AVG(${benchmarkResults.recallScore})::int`,
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

  return result?.runsWithDimensions > 0 ? result : null;
}
```

### Backward-Compatible UI Rendering (BENCH-05)
```typescript
// Source: Pattern from apps/web/components/benchmark-tab.tsx
// Only show radar chart when dimension data exists
const hasDimensionData = modelComparison.some(
  (row) => row.avgFaithfulness > 0 || row.avgRelevancy > 0
        || row.avgPrecision > 0 || row.avgRecall > 0
);

{hasDimensionData && modelComparison.length >= 2 && (
  <RadarDimensionChart models={modelComparison} />
)}

// Dimension columns in table -- only show header when data exists
{hasDimensionData && (
  <>
    <th>Faith</th>
    <th>Rel</th>
    <th>Prec</th>
    <th>Rec</th>
  </>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single 0-100 quality score | 4-dimension RAGAS-inspired scoring + overall | This phase | Richer quality insight per model |
| Text-only model comparison table | Radar chart + dimension table | This phase | Visual multi-model comparison |
| Per-run scores only | Per-skill aggregate dimension scores | This phase | Long-term quality tracking |

**RAGAS methodology evolution:**
- RAGAS v0.1.x: Python library for RAG evaluation with 4 core metrics (faithfulness, answer relevancy, context precision, context recall)
- RAGAS v0.2.x (stable): Expanded to include multimodal, agent, and SQL metrics
- EverySkill adaptation: We use RAGAS **concepts** (the 4 evaluation dimensions) but implement via LLM judge prompts, not the Python library. The skill-specific adaptations (skill instructions = "context", input = "query", output = "answer") are documented in the v7.0 research.

**Deprecated/outdated:**
- RAGAS Python library direct integration: Rejected per v7.0 research decision. TypeScript adaptation via judge prompt is the chosen approach.

## Open Questions

1. **Dimension score differentiation quality**
   - What we know: LLMs can score multiple dimensions in structured output. The RAGAS concept maps well to skill evaluation.
   - What's unclear: Will the judge produce meaningfully different scores across dimensions, or will they cluster? The v7.0 research flagged this as the primary risk.
   - Recommendation: Include divergent scoring examples in the judge prompt (covered in Pitfall 1). After first deployment, analyze score distributions. If standard deviation across dimensions per result < 5, refine the prompt.

2. **Aggregate dimension display for skills with mixed old/new results**
   - What we know: Old results have NULL dimension scores. New results will have scores. BENCH-04 requires aggregate view.
   - What's unclear: Should the aggregate show "Based on N of M runs" or exclude old runs entirely?
   - Recommendation: Show aggregate only from runs with dimension data. Display count: "Based on N benchmark runs with dimension scoring." If 0 runs have dimensions, show "Run a new benchmark to see dimension scores."

## RAGAS-to-EverySkill Metric Mapping

This is the core intellectual content of the phase. Each RAGAS metric is adapted from its RAG context to the skill benchmark context.

| RAGAS Metric | RAG Context | EverySkill Adaptation | Judge Prompt Focus |
|-------------|------------|----------------------|-------------------|
| **Faithfulness** | Is the response grounded in retrieved context (documents)? | Does the output follow the skill instructions without hallucinating or deviating? | "The skill instructions are the ground truth. Score how closely the output adheres to them." |
| **Answer Relevancy** | Is the response relevant to the user's query? | Is the output relevant to the specific input provided? | "Ignore the skill instructions for this dimension. Focus solely on whether the output addresses what the input asked for." |
| **Context Precision** | Were the right documents retrieved (ranking quality)? | Did the model use the skill content effectively (leverage the right parts)? | "Did the model use the skill's structure, format requirements, and specific techniques described in the instructions?" |
| **Context Recall** | Were all relevant documents retrieved (completeness)? | Does the output address all aspects of the input (nothing missed)? | "Did the output cover every part of the input? List what was addressed and what was missed." |

**Key adaptation insight:** In RAG, "context" means retrieved documents. In EverySkill, "context" is the skill content (the markdown prompt/template). The skill IS the context. This makes faithfulness and precision somewhat overlapping (both relate to the skill instructions), but they differ: faithfulness asks "did you follow the instructions?" while precision asks "did you use the instructions effectively?" An output could follow instructions partially (moderate faithfulness) while using those parts it followed very effectively (high precision).

## Files to Modify

### Schema Layer
| File | Change | Risk |
|------|--------|------|
| `packages/db/src/schema/benchmark-runs.ts` | Add 4 nullable INTEGER columns to benchmarkResults | LOW -- additive, nullable |
| `packages/db/src/migrations/0043_add_ragas_dimensions.sql` | ALTER TABLE migration | LOW -- nullable columns, no data migration |

### Service Layer
| File | Change | Risk |
|------|--------|------|
| `packages/db/src/services/benchmark.ts` | Extend ModelComparisonRow type, extend getModelComparisonStats query, add getSkillDimensionAggregates | LOW -- additive |
| `packages/db/src/services/index.ts` | Export new types and functions | LOW |

### Runner Layer
| File | Change | Risk |
|------|--------|------|
| `apps/web/lib/benchmark-runner.ts` | Extend JUDGE_JSON_SCHEMA, JudgeOutput, judge prompt, insertBenchmarkResult calls | MEDIUM -- core scoring logic |

### UI Layer
| File | Change | Risk |
|------|--------|------|
| `apps/web/components/benchmark-tab.tsx` | Add radar chart, dimension columns to comparison table, dimension stats | MEDIUM -- significant UI additions |
| `apps/web/components/radar-dimension-chart.tsx` | NEW: Recharts RadarChart component | LOW -- new file |
| `apps/web/app/(protected)/skills/[slug]/page.tsx` | Fetch dimension aggregates, pass to BenchmarkTab | LOW -- additive data fetching |

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** `apps/web/lib/benchmark-runner.ts` -- existing judge pattern, structured output, model execution flow
- **Codebase analysis:** `packages/db/src/schema/benchmark-runs.ts` -- existing schema (benchmarkRuns + benchmarkResults)
- **Codebase analysis:** `packages/db/src/services/benchmark.ts` -- existing CRUD + aggregation queries
- **Codebase analysis:** `apps/web/components/benchmark-tab.tsx` -- existing UI (402 lines, stats + table + trigger)
- **Codebase analysis:** `apps/web/components/cost-trend-chart.tsx` -- existing Recharts pattern (AreaChart with ResponsiveContainer)
- **Codebase analysis:** `packages/db/src/migrations/` -- 43 migrations, next is 0043
- **Recharts RadarChart API:** https://recharts.github.io/en-US/api/Radar/ -- Radar props, data format, multi-series overlay
- **Recharts GitHub demo:** https://github.com/recharts/recharts/blob/master/demo/component/RadarChart.tsx -- working multi-series example

### Secondary (MEDIUM confidence)
- **RAGAS Faithfulness metric:** https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/faithfulness/ -- claim extraction + verification steps
- **RAGAS Context Precision:** https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_precision/ -- ranking-based evaluation
- **RAGAS Context Recall:** https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/context_recall/ -- claim support ratio
- **RAGAS Answer Relevancy:** https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/answer_relevance/ -- reverse-engineering + cosine similarity
- **RAGAS Available Metrics overview:** https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ -- metric categories and inputs
- **v7.0 Feature Research:** `.planning/research/FEATURES.md` lines 492-631 -- RAGAS adaptation design, schema changes, anti-features
- **v7.0 Pitfalls Research:** `.planning/research/PITFALLS.md` lines 489-507 -- RAGAS evaluation cost pitfall

### Tertiary (LOW confidence)
- **Judge dimension differentiation quality:** No empirical data available. Risk flagged in v7.0 research as MEDIUM. Must validate post-deployment.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used; patterns established
- Architecture: HIGH -- every layer has existing code to extend; no new architectural concepts
- Schema migration: HIGH -- simple ALTER TABLE with nullable columns; proven pattern
- Judge prompt effectiveness: MEDIUM -- LLM scoring of 4 dimensions simultaneously is unvalidated for this domain
- UI visualization: HIGH -- Recharts RadarChart is well-documented with multi-series support
- Backward compatibility: HIGH -- nullable columns + conditional UI rendering is straightforward

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain; recharts and Anthropic SDK unlikely to change significantly)
