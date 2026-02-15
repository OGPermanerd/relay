# Phase 61: Benchmarking Dashboard - Research

**Researched:** 2026-02-15
**Domain:** Skill benchmarking UI, cross-model evaluation, async execution patterns
**Confidence:** HIGH

## Summary

This phase adds a "Benchmark" tab to the skill detail page, displaying cost/token/quality/feedback metrics, a cost trend chart, model comparison table, and the ability to trigger benchmark runs. The infrastructure is largely in place: `benchmark_runs` and `benchmark_results` tables exist with schema, relations, and RLS policies (migration 0032). Recharts 3.7.0 is installed and used extensively. The Anthropic SDK 0.72.1 is installed and used for AI review. The codebase has established patterns for tabs (SkillDetailTabs), stat cards, area charts, and server actions with useActionState-based async flows.

The main new work is: (1) a benchmark service layer for CRUD operations on benchmark_runs/results, (2) a benchmark execution library that calls models and judges quality, (3) a polling-based UI for async benchmark status, and (4) the Benchmark tab UI with stats, comparison table, and cost chart.

**Primary recommendation:** Follow the existing AI review pattern -- server action triggers execution, useActionState manages pending state, timer shows elapsed time. No need for true background jobs; the server action can run synchronously (benchmark runs are short, 30-60s for 3-5 test cases across 2-3 models). Use `skill_feedback` rows with `feedbackType='training_example'` as golden test cases for benchmarks.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.7.0 | Cost trend AreaChart, model comparison visualization | Already installed and used in 5+ components |
| @anthropic-ai/sdk | 0.72.1 | Claude API calls for benchmark execution + quality judging | Already installed and used for AI review |
| drizzle-orm | 0.42.0 | DB queries for benchmark_runs + benchmark_results | Project ORM, all services use it |
| next (server actions) | 16.1.6 | Async benchmark trigger + status polling | Project framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | (installed) | Validate benchmark result shapes from AI judge | Already used in ai-review.ts for structured output validation |

### Already Available (no install needed)
- `AreaChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Area` from recharts
- `StatCard` component for quick stats display
- `Sparkline` component for trend lines
- `formatCostMicrocents()` from `@/lib/pricing-table` for cost display
- `ANTHROPIC_PRICING` from `@everyskill/db/services/pricing` for cost estimation
- `estimateCostMicrocents()` from pricing service

**Installation:**
```bash
# No new packages needed -- all dependencies are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/services/
  benchmark.ts              # CRUD: create/get/update benchmark runs + results

apps/web/
  lib/
    benchmark-runner.ts     # Execution engine: run skill across models, judge quality
  app/actions/
    benchmark.ts            # Server actions: triggerBenchmark, getBenchmarkStatus
  components/
    benchmark-tab.tsx        # Main tab component (client)
    benchmark-stats.tsx      # Quick stats cards
    benchmark-comparison.tsx  # Model comparison table
    cost-trend-chart.tsx     # Recharts AreaChart for cost over time
    benchmark-staleness.tsx  # 90-day warning + re-benchmark button
```

### Pattern 1: Tab Extension
**What:** Add "Benchmark" tab to existing SkillDetailTabs component
**When to use:** This is the primary UI entry point
**How it works:**

The current `SkillDetailTabs` component supports 3 tabs: details, ai-review, suggestions. It uses a `TabKey` union type and renders content via props. To add a 4th tab:

1. Add `"benchmark"` to the `TabKey` union type
2. Add a `benchmarkContent` prop (ReactNode)
3. Add the tab button and panel

```typescript
// In skill-detail-tabs.tsx
type TabKey = "details" | "ai-review" | "suggestions" | "benchmark";

interface SkillDetailTabsProps {
  children: ReactNode;
  aiReviewContent: ReactNode;
  suggestionsContent?: ReactNode;
  suggestionCount?: number;
  benchmarkContent?: ReactNode;  // NEW
}
```

The parent page (`skills/[slug]/page.tsx`) already fetches `costStats` and `feedbackStats` in parallel. Benchmark data loading follows the same pattern.

### Pattern 2: Server Action with useActionState (Async Trigger)
**What:** Trigger benchmark execution via server action, show progress with timer
**When to use:** For the "Run Benchmark" button
**How it works:**

The AI review tab already demonstrates this exact pattern:
- `useActionState(requestAiReview, {})` manages the form submission lifecycle
- `useElapsedTimer(isPending)` shows elapsed seconds during execution
- The server action is synchronous from the client's perspective (Next.js server action timeout is 60s by default, configurable)

For benchmarks: the action creates a `benchmark_runs` row, executes the skill across models, records `benchmark_results`, then returns the completed run. The client shows a spinner + timer during execution.

```typescript
// Server action pattern (from ai-review.ts)
export async function triggerBenchmark(
  prevState: BenchmarkState,
  formData: FormData
): Promise<BenchmarkState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  // ... create run, execute, return results
}
```

### Pattern 3: Model Comparison Table
**What:** Side-by-side metrics per model when multi-model data exists
**When to use:** After a benchmark run with 2+ models
**Design:** Simple HTML table with columns: Model, Quality Score, Avg Cost, Avg Tokens, Latency, Pass Rate

### Pattern 4: Staleness Detection
**What:** Compare `completedAt` of latest benchmark run against 90-day threshold
**When to use:** Always check on page load
**How it works:** Server-side query gets latest benchmark run for the skill. If `completedAt` is older than 90 days (or no run exists), show warning banner with "Re-benchmark" button.

```typescript
function isStale(completedAt: Date | null): boolean {
  if (!completedAt) return true; // never benchmarked
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return completedAt < ninetyDaysAgo;
}
```

### Anti-Patterns to Avoid
- **Don't use polling/setInterval for benchmark status:** The server action pattern used by AI review is synchronous -- the action runs to completion and returns. No need for separate polling endpoints.
- **Don't use `toLocaleDateString()` in client components:** Project has a known hydration issue with this. Use manual UTC formatting or the `RelativeTime` component.
- **Don't create a separate API route for benchmark execution:** Server actions are the established pattern for mutations in this codebase.
- **Don't re-export types from "use server" files:** Causes runtime bundler errors per MEMORY.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cost formatting | Custom dollar formatter | `formatCostMicrocents()` from `@/lib/pricing-table` | Already handles all microcent-to-dollar edge cases |
| Cost estimation | Custom pricing lookup | `estimateCostMicrocents()` from `@everyskill/db/services/pricing` | Static pricing table with all Claude models |
| Area charts | Custom SVG/canvas chart | Recharts `AreaChart` + `ResponsiveContainer` | Already installed and used in 5+ components |
| Stat display cards | Custom card components | `StatCard` from `@/components/stat-card` | Established pattern with sparkline support |
| Elapsed timer | Custom timer | `useElapsedTimer` hook from `ai-review-tab.tsx` | Extract and reuse; already battle-tested |
| Anthropic API client | Custom fetch wrapper | `@anthropic-ai/sdk` with `getClient()` pattern from `ai-review.ts` | Already configured with env var handling |
| Date display | `toLocaleDateString()` | `RelativeTime` component or manual UTC formatting | Prevents hydration mismatches |

**Key insight:** This phase is primarily a UI + service layer phase. Nearly all the infrastructure primitives (SDK, charts, stat cards, action patterns, pricing) already exist. The work is composing them into the benchmark feature.

## Common Pitfalls

### Pitfall 1: Server Action Timeout
**What goes wrong:** Benchmarking 3 models x 5 test cases could take 60-90 seconds, exceeding Next.js default server action timeout
**Why it happens:** Each model call takes 5-15 seconds; sequential execution across models adds up
**How to avoid:** (a) Limit initial release to 2-3 test cases and 2-3 models, (b) run model calls in parallel with `Promise.allSettled()`, (c) consider splitting into create-run + poll-status if execution exceeds 60s
**Warning signs:** Server action returns empty/error after exactly 60 seconds

### Pitfall 2: Quality Score Bias in AI Judging
**What goes wrong:** If the same model generates AND judges output, it may prefer its own style
**Why it happens:** LLMs have recognizable patterns and tend to rate similar patterns higher
**How to avoid:** Use cross-model evaluation (Model A judges Model B's output, and vice versa) or use a single judge model (e.g., Claude Sonnet) to evaluate all outputs including its own, with explicit anti-bias instructions
**Warning signs:** The judge model consistently rates its own output highest

### Pitfall 3: Empty Training Examples
**What goes wrong:** Trying to run a benchmark with no test cases
**Why it happens:** `skill_feedback` table has `feedbackType='training_example'` support but currently 0 rows in dev DB
**How to avoid:** Check for training examples before allowing benchmark trigger. Show "Add training examples first" guidance when none exist. Consider allowing admin to provide ad-hoc test inputs during benchmark setup.
**Warning signs:** Benchmark runs but produces no results

### Pitfall 4: Hydration Mismatch with Dates
**What goes wrong:** Server/client render different date strings
**Why it happens:** Project uses `toISOString()` for serialization but rendering with locale-dependent formatters causes mismatches
**How to avoid:** Pass dates as ISO strings, render with `RelativeTime` component or manual UTC formatting
**Warning signs:** React hydration warning in console

### Pitfall 5: Missing Benchmark Service Exports
**What goes wrong:** New benchmark service functions not accessible from web app
**Why it happens:** Services must be exported from `packages/db/src/services/index.ts` barrel file
**How to avoid:** Add exports to `packages/db/src/services/index.ts` for all new benchmark functions
**Warning signs:** Import errors at build time

## Code Examples

### Existing AreaChart Pattern (from usage-area-chart.tsx)
```typescript
// Source: apps/web/components/usage-area-chart.tsx
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export function CostTrendChart({ data }: { data: CostDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Area type="monotone" dataKey="cost" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Existing Anthropic SDK Pattern (from ai-review.ts)
```typescript
// Source: apps/web/lib/ai-review.ts
import Anthropic from "@anthropic-ai/sdk";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

// Structured output with JSON schema
const response = await client.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: userPrompt }],
  output_config: {
    format: { type: "json_schema", schema: MY_JSON_SCHEMA },
  },
});
```

### Server Action Pattern (from ai-review actions)
```typescript
// Source: apps/web/app/actions/ai-review.ts
"use server";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function requestAiReview(
  prevState: AiReviewState,
  formData: FormData
): Promise<AiReviewState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  // ... perform work, return result
  revalidatePath(`/skills/${skillSlug}`);
  return { success: true };
}
```

### useActionState + Timer Pattern (from ai-review-tab.tsx)
```typescript
// Source: apps/web/components/ai-review-tab.tsx
const [state, action, isPending] = useActionState(serverAction, {});
const timer = useElapsedTimer(isPending);

// In JSX:
<form action={action}>
  <input type="hidden" name="skillId" value={skillId} />
  <button type="submit" disabled={isPending}>
    {isPending ? `Running... ${timer.elapsed}s` : "Run Benchmark"}
  </button>
</form>
```

### Benchmark Service CRUD Pattern
```typescript
// Pattern for packages/db/src/services/benchmark.ts
import { db } from "../client";
import { benchmarkRuns, benchmarkResults } from "../schema/benchmark-runs";
import { eq, desc } from "drizzle-orm";

export async function createBenchmarkRun(params: {
  tenantId: string; skillId: string; triggeredBy: string; models: string[];
}) {
  const [run] = await db.insert(benchmarkRuns).values({
    tenantId: params.tenantId,
    skillId: params.skillId,
    triggeredBy: params.triggeredBy,
    models: params.models,
    status: "running",
    startedAt: new Date(),
  }).returning();
  return run;
}

export async function getLatestBenchmarkRun(skillId: string) {
  return db.query.benchmarkRuns.findFirst({
    where: eq(benchmarkRuns.skillId, skillId),
    orderBy: desc(benchmarkRuns.createdAt),
    with: { results: true },
  });
}
```

### Training Example Query Pattern
```typescript
// Query golden test cases from skill_feedback table
import { skillFeedback } from "../schema/skill-feedback";
import { eq, and } from "drizzle-orm";

export async function getTrainingExamples(skillId: string) {
  return db.select({
    exampleInput: skillFeedback.exampleInput,
    expectedOutput: skillFeedback.expectedOutput,
  })
  .from(skillFeedback)
  .where(and(
    eq(skillFeedback.skillId, skillId),
    eq(skillFeedback.feedbackType, "training_example"),
    eq(skillFeedback.status, "accepted"), // only approved examples
  ));
}
```

## Key Data Structures

### benchmark_runs table
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID auto-generated |
| tenantId | TEXT NOT NULL | FK to tenants, RLS policy |
| skillId | TEXT NOT NULL | FK to skills (CASCADE) |
| skillVersionId | TEXT | FK to skill_versions (nullable) |
| triggeredBy | TEXT NOT NULL | FK to users |
| status | TEXT | "pending" / "running" / "completed" / "failed" |
| models | TEXT[] | Array of model names tested |
| bestModel | TEXT | Determined after completion |
| bestQualityScore | INTEGER | 0-100 scale |
| cheapestModel | TEXT | Lowest cost model |
| cheapestCostMicrocents | INTEGER | Cost in microcents |
| startedAt / completedAt | TIMESTAMPTZ | Timing |
| createdAt | TIMESTAMPTZ(3) | Record creation |

### benchmark_results table
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID auto-generated |
| tenantId | TEXT NOT NULL | FK to tenants, RLS policy |
| benchmarkRunId | TEXT NOT NULL | FK to benchmark_runs (CASCADE) |
| modelName | TEXT NOT NULL | e.g., "claude-sonnet-4-5" |
| modelProvider | TEXT NOT NULL | e.g., "anthropic" |
| testCaseIndex | INTEGER NOT NULL | Which test case (0-based) |
| inputUsed / outputProduced / expectedOutput | TEXT | Test data |
| inputTokens / outputTokens / totalTokens | INTEGER | Token counts |
| latencyMs | INTEGER | Response time |
| estimatedCostMicrocents | INTEGER | Cost using pricing table |
| qualityScore | INTEGER | 0-100 from AI judge |
| qualityNotes | TEXT | Judge's explanation |
| matchesExpected | BOOLEAN | Exact/semantic match |
| errorMessage | TEXT | If model call failed |
| createdAt | TIMESTAMPTZ(3) | Record creation |

### skill_feedback (training_example rows)
The `skill_feedback` table supports `feedbackType='training_example'` with these relevant columns:
- `exampleInput` TEXT -- the input to feed the skill
- `exampleOutput` TEXT -- the model's output (for reference)
- `expectedOutput` TEXT -- the expected/golden output
- `qualityScore` INTEGER -- 1-10 human quality rating
- `status` TEXT -- "pending" / "accepted" / etc.

### SkillCostStats (from token-measurements service)
```typescript
interface SkillCostStats {
  totalCostMicrocents: number;
  avgCostPerUseMicrocents: number;
  measurementCount: number;
  predominantModel: string | null;
}
```

### SkillFeedbackStats (from skill-feedback-stats lib)
```typescript
interface SkillFeedbackStats {
  totalFeedback: number;
  positivePct: number | null;
  last30DaysTotal: number;
  last30DaysPositivePct: number | null;
  feedbackTrend: number[]; // 14-day daily counts
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual polling with setInterval | useActionState with synchronous server actions | Next.js 15+ / React 19 | No need for polling endpoints |
| Recharts v2 (class-based) | Recharts v3.7.0 (hooks-based) | 2025 | Same JSX API, better tree-shaking |
| Custom fetch for Anthropic API | @anthropic-ai/sdk with output_config | SDK 0.70+ | Native JSON schema validation |

**Current approach notes:**
- The codebase uses `output_config.format.type = "json_schema"` for structured outputs (not the older `tool_use` hack)
- Server actions with `useActionState` are the standard async mutation pattern
- All new tables use RLS with `tenant_id = current_setting('app.current_tenant_id', true)` policy

## Open Questions

1. **Training example availability**
   - What we know: The `skill_feedback` table supports `feedbackType='training_example'` with `exampleInput`, `expectedOutput` columns. Currently 0 rows exist.
   - What's unclear: Phase 58 (Training Examples) may not have shipped the UI to create training examples yet.
   - Recommendation: Allow admin to provide ad-hoc test inputs when triggering a benchmark (textarea for 1-3 test cases). Also support using training_example rows when they exist. This makes the feature usable even without pre-existing training data.

2. **Server action timeout for large benchmarks**
   - What we know: Next.js default server action timeout is 60 seconds. AI review takes ~5-15s for a single model call.
   - What's unclear: Whether 3 models x 3 test cases = 9 calls can complete in 60s when parallelized
   - Recommendation: Parallelize model calls within each test case using `Promise.allSettled()`. With 3 parallel model calls and 3 sequential test cases, expect ~15-45s total. If this exceeds limits, create the run first, return immediately, and use a polling endpoint.

3. **Cross-model evaluation judging strategy**
   - What we know: BENCH-07 requires anti-bias measures for quality scoring
   - What's unclear: Exact implementation -- pairwise comparison or independent scoring
   - Recommendation: Use independent scoring with a single judge model (Claude Sonnet). The judge evaluates each output against the expected output without seeing which model produced it. Include "Do not factor in writing style preferences" in the judge prompt. Pairwise comparison is more complex and can be added later.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/benchmark-runs.ts` -- Full schema for benchmark_runs and benchmark_results tables
- `packages/db/src/schema/skill-feedback.ts` -- training_example feedbackType with exampleInput/expectedOutput columns
- `packages/db/src/services/token-measurements.ts` -- getSkillCostStats query shape
- `apps/web/lib/skill-feedback-stats.ts` -- getSkillFeedbackStats return shape
- `apps/web/components/skill-detail-tabs.tsx` -- Current tab structure (3 tabs, TabKey union)
- `apps/web/components/usage-area-chart.tsx` -- Recharts AreaChart pattern
- `apps/web/lib/ai-review.ts` -- Anthropic SDK usage with JSON schema output
- `apps/web/app/actions/ai-review.ts` -- Server action pattern with useActionState
- `apps/web/components/ai-review-tab.tsx` -- useElapsedTimer hook, full async UI pattern
- `packages/db/src/services/pricing.ts` -- ANTHROPIC_PRICING table and estimateCostMicrocents
- `apps/web/lib/pricing-table.ts` -- formatCostMicrocents display helper
- `apps/web/components/stat-card.tsx` -- StatCard component with sparkline support
- `packages/db/src/migrations/0032_create_benchmark_tables.sql` -- Migration confirmed tables exist
- `packages/db/src/relations/index.ts` -- benchmarkRuns/benchmarkResults relations defined

### Verified via database (HIGH confidence)
- benchmark_runs table exists, 0 rows
- benchmark_results table exists, 0 rows (implied)
- skill_feedback training_example rows: 0 rows
- token_measurements: 0 rows

### Package versions (HIGH confidence)
- recharts 3.7.0 installed
- @anthropic-ai/sdk 0.72.1 installed
- No OpenAI SDK installed (only @googleapis/gmail for email features)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in codebase
- Architecture: HIGH -- follows exact patterns from existing AI review feature
- Pitfalls: HIGH -- identified from direct codebase analysis and MEMORY.md project notes
- Data model: HIGH -- read schema, migration, relations, and verified tables exist
- Training examples: MEDIUM -- schema supports them but no data exists yet; need fallback strategy

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable -- all dependencies pinned, schema frozen)
