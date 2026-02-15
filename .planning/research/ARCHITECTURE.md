# Architecture Patterns: Feedback Loop, Training Data & Benchmarking

**Domain:** AI skill feedback collection, training data storage, token measurement, and cross-LLM benchmarking
**Researched:** 2026-02-15
**Confidence:** HIGH (architecture derived from direct codebase analysis of existing schema, API endpoints, MCP hooks, and service patterns; no external dependencies requiring verification)

---

## Existing System Overview (Verified via Codebase)

### Current Architecture Summary

- **Monorepo:** `packages/db` (Drizzle ORM 0.42.0, PostgreSQL 15 + pgvector) + `apps/web` (Next.js 16.1.6) + `apps/mcp` (MCP server via stdio + Streamable HTTP)
- **Schema:** 17+ tables, all with `tenant_id` NOT NULL FK to `tenants`, RLS policies via `app.current_tenant_id`
- **Tracking pipeline:** MCP PostToolUse bash hooks -> curl to `/api/track` -> `insertTrackingEvent()` -> `usage_events` table
- **Existing tracking payload:** `{ skill_id, tool_name, ts, hook_event, tool_input_snippet, tool_output_snippet }` (Zod-validated)
- **Fork system:** `skills.forkedFromId`, `skills.forkedAtContentHash`, `skill_versions` table with immutable version records
- **Rating system:** `ratings` table with 1-5 stars, optional comment, hours_saved_estimate
- **AI review:** `skill_reviews` table with quality/clarity/completeness scores (1-10), `review_decisions` for admin audit trail
- **Analytics:** `usage_events` queried via raw SQL in `analytics-queries.ts` and `my-leverage.ts`, rendered via Recharts
- **MCP tool:** Single unified `everyskill` tool with action discriminator pattern (search, list, recommend, describe, install, guide, create, update, review, submit_review, check_review, check_status)

### Current Data Flow

```
User installs skill via MCP
    |
    v
deploy.ts writes skill file with PostToolUse frontmatter hooks
    |
    v
User uses skill -> PostToolUse bash hook fires
    |
    v
curl POST /api/track (Bearer auth with EVERYSKILL_API_KEY)
    |
    v
validateApiKey() -> checkRateLimit() -> Zod parse -> HMAC verify (optional)
    |
    v
insertTrackingEvent() -> usage_events row (metadata JSONB)
    |
    v
incrementSkillUses() -> skills.totalUses += 1
    |
    v
Leverage dashboard queries usage_events for analytics
```

### Key Tables for Integration

| Table | Relevant Fields | Integration Point |
|-------|----------------|-------------------|
| `usage_events` | skillId, userId, toolName, metadata (JSONB), createdAt | Extend metadata for token counts, quality signals |
| `skills` | id, content, forkedFromId, forkedAtContentHash, totalUses, averageRating | Target of feedback and training data |
| `skill_versions` | skillId, version, contentUrl, contentHash, metadata (JSONB) | Version-pinned training examples |
| `ratings` | skillId, userId, rating (1-5), comment, hoursSavedEstimate | Existing quality signal, extend with structured feedback |
| `skill_reviews` | skillId, categories (JSONB), modelName | AI review scores per model |

---

## Recommended Architecture

### High-Level Data Flow (New Components in Bold)

```
User uses skill -> PostToolUse hook fires
    |
    v
curl POST /api/track (EXTENDED payload: token_count, response_quality)
    |
    v
/api/track route (extended Zod schema)
    |
    +--> insertTrackingEvent()           [existing: usage_events]
    +--> insertTokenMeasurement()        [NEW: token_measurements table]
    |
    v
User provides feedback via MCP or Web UI
    |
    +--> [MCP] everyskill action:"feedback" -> POST /api/feedback
    +--> [Web] Rating form with structured fields -> server action
    |
    v
insertFeedback()                         [NEW: skill_feedback table]
    |
    +--> if suggestion: create suggestion record
    +--> if training_example: store input/output pair
    |
    v
Author reviews suggestions on skill detail page
    |
    +--> Approve: fork or merge suggestion -> existing fork system
    +--> Reject: mark as rejected with reason
    |
    v
Admin runs benchmark from dashboard
    |
    v
benchmarkSkill()                         [NEW: benchmark_runs + benchmark_results]
    |
    +--> For each LLM model: execute skill, measure tokens, score output
    +--> Store results with model, version, cost, quality scores
    |
    v
Benchmark dashboard shows cross-LLM comparison
```

---

## New Database Tables

### 1. `skill_feedback` - User Feedback Collection

Captures structured feedback from both MCP and web UI. Replaces the need for a separate "suggestions" table by using `feedback_type` discriminator.

```typescript
// packages/db/src/schema/skill-feedback.ts
export const skillFeedback = pgTable(
  "skill_feedback",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    skillVersionId: text("skill_version_id").references(() => skillVersions.id), // pin to version
    userId: text("user_id").references(() => users.id), // nullable for anonymous MCP feedback
    usageEventId: text("usage_event_id"), // FK to usage_events.id - links feedback to specific use

    // Feedback type discriminator
    feedbackType: text("feedback_type").notNull(),
    // "thumbs_up" | "thumbs_down" | "suggestion" | "training_example" | "bug_report"

    // Core feedback
    sentiment: integer("sentiment"), // -1 (bad), 0 (neutral), 1 (good) -- simple signal
    comment: text("comment"), // free-text feedback

    // Suggestion-specific (when feedbackType = "suggestion")
    suggestedContent: text("suggested_content"), // proposed skill content change
    suggestedDiff: text("suggested_diff"), // diff format for review UI

    // Training example (when feedbackType = "training_example")
    exampleInput: text("example_input"), // what was provided to the skill
    exampleOutput: text("example_output"), // what the skill produced (actual)
    expectedOutput: text("expected_output"), // what the user expected (desired)

    // Quality scoring for the specific usage
    qualityScore: integer("quality_score"), // 1-10, more granular than thumbs

    // Moderation
    status: text("status").notNull().default("pending"),
    // "pending" | "approved" | "rejected" | "merged"
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),

    // Source tracking
    source: text("source").notNull().default("web"), // "web" | "mcp" | "api"

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("skill_feedback_skill_id_idx").on(table.skillId),
    index("skill_feedback_user_id_idx").on(table.userId),
    index("skill_feedback_tenant_id_idx").on(table.tenantId),
    index("skill_feedback_type_idx").on(table.feedbackType),
    index("skill_feedback_status_idx").on(table.status),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

**Design rationale:** Single table with discriminator rather than 3 separate tables because:
- All feedback shares the same lifecycle (pending -> reviewed -> approved/rejected)
- All feedback is linked to the same entities (skill, user, version, usage_event)
- Query patterns are similar ("show me all feedback for skill X")
- The discriminator fields (suggestedContent, exampleInput, etc.) are nullable TEXT columns -- cheap in PostgreSQL

### 2. `token_measurements` - Token Usage Tracking

Separated from `usage_events` because token data has different write patterns (may arrive asynchronously, may be updated) and different query patterns (aggregation by model, cost calculation).

```typescript
// packages/db/src/schema/token-measurements.ts
export const tokenMeasurements = pgTable(
  "token_measurements",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    usageEventId: text("usage_event_id"), // links to usage_events.id
    userId: text("user_id").references(() => users.id),

    // Token counts
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),

    // Model identification
    modelName: text("model_name").notNull(), // e.g., "claude-opus-4-6"
    modelProvider: text("model_provider").notNull().default("anthropic"), // "anthropic" | "openai" | "google" | "meta"

    // Cost estimation (stored as microcents for precision: $0.01 = 1000 microcents)
    estimatedCostMicrocents: integer("estimated_cost_microcents"),

    // Timing
    latencyMs: integer("latency_ms"), // round-trip latency in milliseconds

    // Source
    source: text("source").notNull().default("hook"), // "hook" | "benchmark" | "manual"

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("token_measurements_skill_id_idx").on(table.skillId),
    index("token_measurements_model_idx").on(table.modelName),
    index("token_measurements_tenant_id_idx").on(table.tenantId),
    index("token_measurements_created_at_idx").on(table.createdAt),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

**Design rationale:** Separate table (not extending usage_events.metadata JSONB) because:
- Token data is structured and queryable (AVG, SUM, GROUP BY model)
- JSONB queries for aggregation are slow compared to indexed integer columns
- Cost estimation requires arithmetic on typed columns
- Different retention policy possible (keep token data longer than raw events)

### 3. `benchmark_runs` + `benchmark_results` - Cross-LLM Benchmarking

Two tables: `benchmark_runs` for the run metadata, `benchmark_results` for per-test-case results within a run.

```typescript
// packages/db/src/schema/benchmark-runs.ts
export const benchmarkRuns = pgTable(
  "benchmark_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    skillVersionId: text("skill_version_id").references(() => skillVersions.id), // pin to version

    // Run metadata
    triggeredBy: text("triggered_by").notNull().references(() => users.id),
    status: text("status").notNull().default("pending"),
    // "pending" | "running" | "completed" | "failed"

    // Models tested in this run
    models: text("models").array().notNull(), // ["claude-opus-4-6", "gpt-4o", "gemini-2.0-flash"]

    // Aggregate results (denormalized for dashboard performance)
    bestModel: text("best_model"), // model with highest quality score
    bestQualityScore: integer("best_quality_score"), // 0-100
    cheapestModel: text("cheapest_model"), // model with lowest cost
    cheapestCostMicrocents: integer("cheapest_cost_microcents"),

    // Timing
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

export const benchmarkResults = pgTable(
  "benchmark_results",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    benchmarkRunId: text("benchmark_run_id")
      .notNull()
      .references(() => benchmarkRuns.id, { onDelete: "cascade" }),

    // What was tested
    modelName: text("model_name").notNull(),
    modelProvider: text("model_provider").notNull(),
    testCaseIndex: integer("test_case_index").notNull(), // 0-based index within the run

    // Input/Output
    inputUsed: text("input_used"), // the test input that was provided
    outputProduced: text("output_produced"), // what the model returned
    expectedOutput: text("expected_output"), // from training_example if available

    // Measurements
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    latencyMs: integer("latency_ms"),
    estimatedCostMicrocents: integer("estimated_cost_microcents"),

    // Quality assessment
    qualityScore: integer("quality_score"), // 0-100, AI-judged or computed
    qualityNotes: text("quality_notes"), // AI explanation of score
    matchesExpected: boolean("matches_expected"), // if expected_output exists, does it match?

    // Error handling
    errorMessage: text("error_message"), // if model call failed

    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("benchmark_results_run_id_idx").on(table.benchmarkRunId),
    index("benchmark_results_model_idx").on(table.modelName),
    index("benchmark_results_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

**Design rationale:** Two tables (run + results) rather than one because:
- A single benchmark run tests multiple models against multiple test cases = N*M results
- Run-level metadata (who triggered, aggregate winner) is separate from per-result data
- Cascade delete: deleting a run deletes all its results
- Dashboard queries aggregate at run level (latest run per skill), drill-down at result level

---

## Modified Existing Components

### 1. Extend `/api/track` Payload (Backward Compatible)

The tracking endpoint accepts new optional fields without breaking existing PostToolUse hooks.

```typescript
// apps/web/app/api/track/route.ts — EXTENDED schema
const trackingPayloadSchema = z.object({
  // Existing (required)
  skill_id: z.string().min(1, "skill_id required"),
  tool_name: z.string().min(1).max(200),
  ts: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid timestamp"),

  // Existing (optional)
  hook_event: z.string().optional(),
  tool_input_snippet: z.string().max(1000).optional(),
  tool_output_snippet: z.string().max(1000).optional(),

  // NEW optional fields (backward compatible — old hooks omit these)
  token_count: z.object({
    input: z.number().int().nonnegative().optional(),
    output: z.number().int().nonnegative().optional(),
    total: z.number().int().nonnegative().optional(),
  }).optional(),
  model_name: z.string().max(100).optional(),
  model_provider: z.string().max(50).optional(),
  latency_ms: z.number().int().nonnegative().optional(),
  response_quality: z.number().int().min(-1).max(1).optional(), // -1, 0, 1
});
```

**Critical constraint:** Existing deployed PostToolUse hooks in user skill files are bash scripts that send a fixed payload. They cannot be updated remotely. New fields are only populated by:
1. Updated hooks deployed via new skill installs
2. The web UI feedback form
3. The MCP `feedback` action
4. The benchmarking system

### 2. Extend MCP `everyskill` Tool with `feedback` Action

Add a new action to the existing unified tool pattern:

```typescript
// Add to ACTIONS array in apps/mcp/src/tools/everyskill.ts
const ACTIONS = [
  // ... existing actions
  "feedback",    // NEW: submit feedback for a skill
] as const;

// New input fields for the everyskill tool schema
feedbackType: z.enum(["thumbs_up", "thumbs_down", "suggestion", "training_example", "bug_report"])
  .optional()
  .describe("Feedback type (required for: feedback)"),
feedbackComment: z.string().max(2000).optional()
  .describe("Feedback comment or suggestion text (optional for: feedback)"),
exampleInput: z.string().max(5000).optional()
  .describe("Training example: what was provided to the skill (optional for: feedback)"),
exampleOutput: z.string().max(5000).optional()
  .describe("Training example: what the skill produced (optional for: feedback)"),
expectedOutput: z.string().max(5000).optional()
  .describe("Training example: what was expected (optional for: feedback)"),
```

**Design rationale:** Adding to the existing unified tool rather than a separate `everyskill_feedback` tool because:
- Consistent with the STRAP action router pattern already in use
- Users/agents already know to invoke `everyskill` for all operations
- Reduces tool proliferation in the MCP client

### 3. Denormalized Fields on `skills` Table

Add to the existing skills table for dashboard performance:

```sql
-- Migration: add feedback and benchmark aggregate columns to skills
ALTER TABLE skills ADD COLUMN total_feedback integer NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN positive_feedback_pct integer; -- 0-100
ALTER TABLE skills ADD COLUMN training_example_count integer NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN latest_benchmark_run_id text;
ALTER TABLE skills ADD COLUMN avg_token_cost_microcents integer;
```

These follow the existing pattern of `totalUses` and `averageRating` as denormalized aggregates.

---

## Component Boundaries

### New Service Layer

| Service | File | Responsibility | Dependencies |
|---------|------|---------------|--------------|
| `feedback.ts` | `packages/db/src/services/feedback.ts` | Insert/query feedback, approve/reject, merge suggestions | `skill_feedback` table, fork system |
| `token-tracking.ts` | `packages/db/src/services/token-tracking.ts` | Insert token measurements, aggregate by model | `token_measurements` table |
| `benchmarking.ts` | `packages/db/src/services/benchmarking.ts` | Create/run/complete benchmark runs, score results | `benchmark_runs`, `benchmark_results`, AI SDKs |
| `benchmark-queries.ts` | `apps/web/lib/benchmark-queries.ts` | Dashboard queries for benchmark comparison | `benchmark_runs`, `benchmark_results` |
| `feedback-queries.ts` | `apps/web/lib/feedback-queries.ts` | Dashboard queries for feedback analytics | `skill_feedback` |

### New Server Actions

| Action | File | Purpose |
|--------|------|---------|
| `submit-feedback.ts` | `apps/web/app/actions/submit-feedback.ts` | Web UI feedback submission |
| `review-feedback.ts` | `apps/web/app/actions/review-feedback.ts` | Author reviews pending feedback |
| `merge-suggestion.ts` | `apps/web/app/actions/merge-suggestion.ts` | Author merges a suggestion into skill |
| `run-benchmark.ts` | `apps/web/app/actions/run-benchmark.ts` | Trigger benchmark run |
| `get-benchmark-results.ts` | `apps/web/app/actions/get-benchmark-results.ts` | Fetch benchmark data for dashboard |

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/feedback` | POST | MCP feedback submission (Bearer auth, same as /api/track) |

**Design decision:** Feedback from MCP goes through a separate `/api/feedback` endpoint rather than extending `/api/track` because:
- `/api/track` is fire-and-forget, 200-only — feedback needs structured validation and response
- Feedback has different rate limiting needs (lower limit per skill per user)
- The payload structure is fundamentally different (not a tracking event)

### New Web Pages

| Route | Purpose | Auth |
|-------|---------|------|
| `/skills/[slug]/feedback` | View/submit feedback for a skill | User |
| `/skills/[slug]/benchmark` | View benchmark results for a skill | User |
| `/admin/benchmarks` | Run benchmarks, view cross-skill comparison | Admin |
| `/leverage/benchmarks` | Org-wide benchmark dashboard | Admin |

---

## Suggestion-to-Fork Pipeline

This is the critical integration between the new feedback system and the existing fork system.

### Flow

```
1. User submits feedback with feedbackType = "suggestion"
   and suggestedContent (proposed modified skill content)
       |
       v
2. skill_feedback row created with status = "pending"
       |
       v
3. Skill author sees pending suggestions on skill detail page
   (new tab/section alongside existing ratings, similar skills)
       |
       v
4a. Author APPROVES suggestion:
    |
    +-- If author is skill owner:
    |   - Create new skill_version with suggested content
    |   - Update skills.publishedVersionId
    |   - Update skills.content (still denormalized)
    |   - Mark feedback status = "merged"
    |   - Credit the suggester (notification)
    |
    +-- If suggestion requires review (large diff):
        - Create fork from suggestion via existing forkSkill()
        - Set fork.forkedFromId = original skill
        - Mark feedback status = "merged" with link to fork
        |
        v
4b. Author REJECTS suggestion:
    - Mark feedback status = "rejected"
    - Add reviewNotes with reason
    - Notify suggester (optional)
```

### Integration with Existing Fork System

The existing `forkSkill()` server action (in `apps/web/app/actions/fork-skill.ts`) already:
- Creates a new skill with `forkedFromId` pointing to parent
- Computes `forkedAtContentHash` for drift detection
- Creates a `skill_versions` record
- Generates embeddings for the fork
- Redirects to the new fork

The suggestion merge can reuse this by:
1. Programmatically creating a fork with the suggested content (not the parent's content)
2. Setting the fork's `authorId` to the original author (not the suggester)
3. Attributing the suggester via the `skill_feedback` record linkage

**Alternative (simpler, recommended for v1):** For owner-approved suggestions, just create a new `skill_version` directly. No fork needed. The fork path is only for when the suggestion creates a substantially different skill variant.

---

## Data Flow: MCP Hook to Benchmarking Dashboard

### Complete Data Path

```
[MCP Client]
    |
    | PostToolUse hook fires (bash)
    v
[/api/track]  <-- extended payload with optional token_count, model_name
    |
    | 1. Insert usage_event (existing)
    | 2. If token_count present: insert token_measurement (new)
    | 3. incrementSkillUses() (existing)
    v
[usage_events + token_measurements in PostgreSQL]
    |
    v
[Leverage Dashboard]  <-- existing queries extended
    |
    +-- Skills tab: now shows avg tokens, avg cost per skill
    +-- New "Cost" column in skill leaderboard
    +-- New "Token Efficiency" metric
    |
    v
[Benchmark Dashboard]  <-- new pages
    |
    | Admin triggers benchmark run for a skill
    v
[run-benchmark server action]
    |
    | 1. Create benchmark_runs row (status: "pending")
    | 2. Fetch training examples from skill_feedback
    | 3. For each model in run.models:
    |    a. Call model API with skill prompt + test input
    |    b. Measure tokens, latency, cost
    |    c. Score quality (AI-judged against expected output)
    |    d. Insert benchmark_results row
    | 4. Update benchmark_runs (status: "completed", aggregate fields)
    | 5. Update skills.latest_benchmark_run_id
    v
[benchmark_runs + benchmark_results in PostgreSQL]
    |
    v
[Benchmark Dashboard renders via Recharts]
    +-- Bar chart: token count by model
    +-- Bar chart: cost by model
    +-- Bar chart: quality score by model
    +-- Table: detailed results per test case
    +-- Time series: benchmark history (quality/cost over time)
```

### Token Measurement Sources

| Source | How It Gets Data | Reliability |
|--------|-----------------|-------------|
| PostToolUse hook (enhanced) | Bash script extracts token info from Claude response metadata | LOW -- Claude CLI doesn't expose token counts in PostToolUse hook context |
| MCP tool direct | `everyskill` tool handler measures its own API calls | MEDIUM -- only for MCP-mediated calls |
| Benchmark runner | Direct API calls with response metadata | HIGH -- controlled environment |
| Web UI self-report | User enters estimated tokens | LOW -- manual |

**Important finding:** The PostToolUse bash hook does NOT have access to token counts from the Claude conversation. The `INPUT` variable in the hook receives the tool call result, not conversation-level metadata. Token measurement from hooks is therefore limited to what we can infer or estimate. The primary source of accurate token data will be the benchmark system and direct MCP API calls.

---

## Patterns to Follow

### Pattern 1: Discriminated Union Table (skill_feedback)

**What:** Single table with `feedbackType` discriminator instead of separate tables per feedback type.
**When:** Multiple entity types share the same lifecycle, relations, and query patterns.
**Why:** Matches the existing pattern of `usage_events.metadata` JSONB for flexible data, but with typed columns for the structured parts.

### Pattern 2: Denormalized Aggregates (skills table)

**What:** Store computed totals on the parent entity for O(1) dashboard reads.
**When:** Aggregation queries would otherwise require expensive JOINs on every page load.
**Why:** Matches existing `skills.totalUses` and `skills.averageRating` patterns. Update via service functions like `incrementSkillUses()`.

```typescript
// Example: update feedback aggregates
export async function updateFeedbackAggregates(skillId: string): Promise<void> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      ROUND(100.0 * COUNT(*) FILTER (WHERE sentiment = 1) / NULLIF(COUNT(*), 0))::int AS positive_pct,
      COUNT(*) FILTER (WHERE feedback_type = 'training_example')::int AS training_count
    FROM skill_feedback
    WHERE skill_id = ${skillId}
  `);
  // Update skills table with aggregates
}
```

### Pattern 3: Fire-and-Forget Tracking, Validated Feedback

**What:** Token measurements follow the fire-and-forget pattern of usage tracking (never fail the parent operation). Feedback submissions are validated and return structured responses.
**Why:** Matches the existing separation: `insertTrackingEvent()` wraps all errors in try/catch and logs, while server actions like `forkSkill()` return error states for the UI.

### Pattern 4: Cascade Delete with Audit Preservation

**What:** New tables use `onDelete: "cascade"` from `skills` (deleting a skill deletes its feedback, benchmarks). But benchmark data also lives in the immutable `review_decisions`-style audit pattern.
**Why:** Feedback is per-skill data that becomes meaningless without the skill. Benchmark runs are per-skill experiments. This matches `ratings`, `skill_versions`, `skill_reviews` which all cascade from skills.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Token Data in usage_events.metadata JSONB

**What:** Putting `{ inputTokens: 100, outputTokens: 200, modelName: "claude-opus-4-6" }` in the existing metadata column.
**Why bad:**
- Cannot index JSONB fields efficiently for aggregation queries
- `SELECT AVG((metadata->>'inputTokens')::int)` is slow on large datasets
- No schema validation on JSONB contents
- Mixes telemetry data with tracking metadata (different query patterns, retention needs)
**Instead:** Use the dedicated `token_measurements` table with indexed integer columns.

### Anti-Pattern 2: Blocking PostToolUse Hooks for Feedback

**What:** Making the bash hook wait for user feedback before returning.
**Why bad:** PostToolUse hooks must be fast and non-blocking. The hook runs after every tool call. Blocking it for user input would degrade the Claude experience.
**Instead:** Collect feedback asynchronously — either via a separate MCP action (`everyskill action:feedback`) invoked naturally in conversation, or via the web UI after the fact.

### Anti-Pattern 3: Separate Tables Per Feedback Type

**What:** `skill_suggestions`, `skill_bug_reports`, `skill_training_examples` as separate tables.
**Why bad:**
- All three share the same relations (skill, user, version, usage_event)
- All three follow the same lifecycle (pending -> reviewed -> merged/rejected)
- Dashboard queries need "all feedback for skill X" which requires UNION across tables
- More tables = more migrations, more relations, more service functions
**Instead:** Single `skill_feedback` table with `feedbackType` discriminator.

### Anti-Pattern 4: Running Benchmarks Synchronously in Request/Response

**What:** Starting a benchmark run and waiting for all model API calls to complete in a single server action.
**Why bad:** A benchmark with 3 models x 5 test cases = 15 API calls. At ~2-5 seconds each, that is 30-75 seconds. Server action timeout will kill it.
**Instead:** Create the benchmark run record, then process asynchronously. Options:
1. **Phase 1 (simple):** Run in background via `Promise` detached from the request, update status when complete. Use polling from the UI.
2. **Phase 2 (robust):** Use a job queue (pg-boss or BullMQ) for reliable processing with retries.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| `skill_feedback` volume | ~500 rows/month | ~50K rows/month | Partition by tenant_id |
| `token_measurements` volume | ~2K rows/month | ~200K rows/month | Partition by created_at (monthly) |
| `benchmark_runs` volume | ~50 runs/month | ~500 runs/month | Negligible |
| Benchmark execution time | Inline OK | Job queue needed | Distributed workers |
| Dashboard query perf | Raw SQL fine | Denormalized aggregates essential | Materialized views |

At current scale (single-tenant, <100 users), all new tables can use the same patterns as existing tables. No partitioning or materialized views needed yet.

---

## Migration Strategy

### New Migrations (Sequential)

```
0030_create_skill_feedback.sql
0031_create_token_measurements.sql
0032_create_benchmark_tables.sql
0033_add_feedback_aggregates_to_skills.sql
```

Each migration follows the existing pattern in `packages/db/src/migrations/`:
- Plain SQL file
- Tracked via custom runner in `packages/db/src/migrate.ts` (NOT drizzle-kit)
- Applied via `pnpm db:migrate`

### Schema Registration

Each new schema file must be:
1. Created in `packages/db/src/schema/`
2. Exported from `packages/db/src/schema/index.ts`
3. Relations defined in `packages/db/src/relations/index.ts`
4. Types exported for service layer use

---

## Sources

All findings derived from direct codebase analysis:
- `packages/db/src/schema/*.ts` — existing table definitions
- `apps/web/app/api/track/route.ts` — tracking endpoint
- `apps/mcp/src/tracking/events.ts` — MCP-side tracking
- `apps/mcp/src/tools/deploy.ts` — PostToolUse hook generation
- `apps/mcp/src/tools/everyskill.ts` — unified tool pattern
- `apps/web/app/actions/fork-skill.ts` — fork system
- `apps/web/lib/analytics-queries.ts` — dashboard query patterns
- `apps/web/lib/my-leverage.ts` — leverage metrics
- `packages/db/src/services/skill-metrics.ts` — denormalized aggregate pattern
- `packages/db/src/services/usage-tracking.ts` — tracking service pattern
- `research/v3_milestone_ideas.txt` — product requirements from stakeholder
