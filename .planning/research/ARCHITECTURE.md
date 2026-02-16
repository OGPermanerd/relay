# Architecture Patterns: v7.0 Algorithm & Architecture Rewrite

**Domain:** GraphRAG community detection, adaptive query routing, temporal version tracking, extended visibility, multi-model benchmarking
**Researched:** 2026-02-16
**Confidence:** HIGH (architecture derived from direct codebase analysis of 25+ schema files, 30+ service files, 15+ visibility query sites, and existing benchmark/search infrastructure; external research verified via official docs)

---

## Existing System Overview (Verified via Codebase)

### Current Architecture Summary

```
apps/web (Next.js 16.1.6)           apps/mcp (MCP server)
  |-- app/actions/ (server actions)    |-- tools/everyskill.ts (unified tool)
  |-- lib/ (search, benchmark, etc.)   |-- tools/search.ts, list.ts, etc.
  |-- app/api/cron/ (3 cron routes)    |-- auth.ts (API key resolver)
  |                                    |
  +------------- both import ----------+
                    |
            packages/db (Drizzle ORM 0.42.0)
              |-- schema/ (25+ tables, all with tenant_id + RLS)
              |-- services/ (30+ service files)
              |-- lib/visibility.ts (buildVisibilityFilter + visibilitySQL)
              |-- client.ts (postgres-js, DEFAULT_TENANT_ID)
              |-- migrations/ (37 migrations, custom runner)
                    |
            PostgreSQL 16 + pgvector
              |-- HNSW index on skill_embeddings.embedding
              |-- GIN index on skills.search_vector (tsvector)
              |-- RLS policies on all tables
```

### Current Search Pipeline

```
User query
    |
    v
apps/web/app/actions/discover.ts
    |-- auth() session check
    |-- generateEmbedding() via Ollama (nomic-embed-text, 768 dims)
    |-- hybridSearchSkills() [packages/db/src/services/hybrid-search.ts]
    |     |-- CTE: full_text (tsvector + websearch_to_tsquery)
    |     |-- CTE: semantic (pgvector cosine distance)
    |     |-- FULL OUTER JOIN + RRF (k=60)
    |     |-- visibilitySQL(userId) in both CTEs
    |-- applyPreferenceBoost() (category preference * 1.3)
    |-- logSearchQuery() (fire-and-forget)
    v
DiscoveryResult[] (top N with matchRationale)
```

### Current Benchmark Pipeline

```
Server action: triggerBenchmark()
    |-- auth + admin/author check
    |-- fetch skill content + training examples
    |-- runBenchmark() [apps/web/lib/benchmark-runner.ts]
    |     |-- createBenchmarkRun() in DB
    |     |-- for each test case (sequential):
    |     |     for each model (parallel):
    |     |       Anthropic API call -> measure tokens/latency/cost
    |     |       judgeQuality() via Claude Sonnet 4.5 (blinded)
    |     |       insertBenchmarkResult()
    |     |-- completeBenchmarkRun() with summary stats
    v
Synchronous — blocks server action until complete
Only Anthropic models (BENCHMARK_MODELS = [sonnet-4.5, haiku-4.5])
```

### Current Visibility Model

```
skills.visibility: text, values = "tenant" | "personal"

buildVisibilityFilter(userId?):  Drizzle SQL for query-builder queries
visibilitySQL(userId?):          Raw SQL template for template-string queries

Used in 15+ locations:
  packages/db/src/services/: hybrid-search, semantic-search, search-skills, skill-forks
  apps/web/lib/: search-skills, similar-skills, trending, leaderboard, portfolio-queries
  apps/mcp/src/tools/: list.ts
  + raw SQL queries with hardcoded visibility = 'tenant' in trending, leaderboard, getAvailableTags
```

### Cron Infrastructure

```
apps/web/app/api/cron/
  |-- integrity-check/route.ts (CRON_SECRET bearer auth)
  |-- daily-digest/route.ts
  |-- weekly-digest/route.ts

Pattern: GET handler, Bearer token auth via CRON_SECRET env var
Triggered by: external cron (systemd timer or similar)
```

---

## Priority 1: Community Detection (GraphRAG)

### Decision: PostgreSQL Adjacency List, NOT a Graph DB

**Rationale:** The skill graph is small (hundreds to low thousands of nodes per tenant, not millions). PostgreSQL with adjacency tables handles this scale trivially. Neo4j adds operational complexity (separate service, separate connection pool, separate backup strategy) for zero benefit at this scale. Research confirms PostgreSQL outperforms Neo4j for small graphs.

**Confidence:** HIGH -- peer-reviewed research and community consensus support PostgreSQL for graphs under 100K nodes.

### New Schema: skill_graph_edges + skill_communities

```
skill_graph_edges
  |-- id: text PK
  |-- tenant_id: text FK -> tenants (NOT NULL)
  |-- source_skill_id: text FK -> skills
  |-- target_skill_id: text FK -> skills
  |-- edge_type: text ("similar", "co_used", "forked_from", "same_author")
  |-- weight: numeric (0.0 - 1.0)
  |-- created_at: timestamp
  |-- updated_at: timestamp
  Indexes: (tenant_id), (source_skill_id), (target_skill_id)
  Unique: (tenant_id, source_skill_id, target_skill_id, edge_type)
  RLS: tenant_id = current_setting('app.current_tenant_id')

skill_communities
  |-- id: text PK
  |-- tenant_id: text FK -> tenants
  |-- community_id: integer (Leiden cluster assignment)
  |-- level: integer (0 = leaf, 1+ = hierarchy)
  |-- label: text (AI-generated community label)
  |-- summary: text (AI-generated community summary)
  |-- skill_ids: text[] (denormalized for fast lookup)
  |-- member_count: integer
  |-- computed_at: timestamp
  |-- metadata: jsonb (modularity score, algorithm params)
  Indexes: (tenant_id), (community_id, level)
  RLS: standard tenant isolation

skill_community_memberships
  |-- skill_id: text FK -> skills
  |-- tenant_id: text FK -> tenants
  |-- community_id: text FK -> skill_communities
  |-- level: integer
  Unique: (skill_id, level)
  RLS: standard tenant isolation
```

### Decision: Leiden Algorithm via Node.js Native Implementation

**Rationale:** A Python sidecar adds deployment complexity (separate process, IPC, health monitoring). WASM adds build complexity. The Leiden algorithm is mathematically straightforward — a TypeScript implementation exists on GitHub (esclear/louvain-leiden). For the expected graph size (<10K nodes), a pure JS implementation runs in milliseconds. If performance becomes a problem later, a WASM Leiden binary can be dropped in without architecture changes.

**Implementation approach:**
1. Vendor or npm-install a Leiden implementation (e.g., `louvain-leiden` package or similar)
2. Build the graph adjacency matrix from `skill_graph_edges` in memory
3. Run Leiden to get community assignments
4. Write results to `skill_communities` + `skill_community_memberships`
5. Generate community labels/summaries via Anthropic API (one call per community)

**Confidence:** MEDIUM -- the `louvain-leiden` npm package exists but needs version/API verification at implementation time.

### Edge Construction Logic (New Service)

```typescript
// packages/db/src/services/graph-edges.ts

// Edge types and their weight derivation:
// 1. "similar" — cosine similarity from skill_embeddings > 0.7 threshold
//    Weight = similarity score (0.7-1.0)
// 2. "co_used" — users who used skill A also used skill B (within 7 days)
//    Weight = co-occurrence count / max(uses_A, uses_B)
// 3. "forked_from" — direct fork relationship
//    Weight = 1.0 (strongest signal)
// 4. "same_author" — shared authorship
//    Weight = 0.3 (weak signal)

async function rebuildGraphEdges(tenantId: string): Promise<void>
```

### Cron Job Location

```
apps/web/app/api/cron/community-detection/route.ts

Pattern: follows existing cron convention (GET handler, Bearer token auth)
Frequency: daily (communities change slowly, no need for real-time)
Process:
  1. rebuildGraphEdges(tenantId) — query DB for similarity/co-use/fork/author edges
  2. Build in-memory adjacency list from edges
  3. Run Leiden algorithm
  4. Write community assignments to skill_communities
  5. Generate AI summaries for new/changed communities
  6. Log to audit table
```

### Integration Points

| Existing Component | Change | Scope |
|---|---|---|
| `apps/web/app/actions/discover.ts` | Add community context to search results | MODIFY |
| `packages/db/src/services/hybrid-search.ts` | Add optional community boost to RRF scoring | MODIFY |
| `apps/web/lib/similar-skills.ts` | Use community membership for "related skills" | MODIFY |
| `apps/mcp/src/tools/recommend.ts` | Include community context in recommendations | MODIFY |
| `packages/db/src/schema/index.ts` | Export new schema tables | MODIFY |
| `packages/db/src/services/index.ts` | Export new services | MODIFY |

### New Components

| Component | Location | Purpose |
|---|---|---|
| `packages/db/src/schema/skill-graph-edges.ts` | Schema | Edge table definition |
| `packages/db/src/schema/skill-communities.ts` | Schema | Community table definition |
| `packages/db/src/services/graph-edges.ts` | Service | Edge construction and CRUD |
| `packages/db/src/services/community-detection.ts` | Service | Leiden wrapper + community CRUD |
| `apps/web/app/api/cron/community-detection/route.ts` | API | Cron endpoint |
| `apps/web/lib/leiden.ts` | Library | Leiden algorithm implementation/wrapper |

### Data Flow: Community Detection

```
Cron trigger (daily)
    |
    v
community-detection/route.ts
    |-- Auth: CRON_SECRET bearer token
    |
    v
rebuildGraphEdges(tenantId)
    |-- Query skill_embeddings for all pairs > 0.7 similarity
    |-- Query usage_events for co-usage patterns (7-day window)
    |-- Query skills.forkedFromId for fork edges
    |-- Query skills.authorId for same-author edges
    |-- UPSERT into skill_graph_edges
    |
    v
runCommunityDetection(tenantId)
    |-- SELECT all edges from skill_graph_edges
    |-- Build adjacency list in memory
    |-- Run Leiden algorithm (resolution parameter from site_settings or default)
    |-- Diff with existing communities
    |-- UPSERT skill_communities + skill_community_memberships
    |-- For new/changed communities:
    |     Generate label + summary via Anthropic API
    |
    v
Log to audit_logs (community_detection.completed)
```

---

## Priority 2: Adaptive Query Routing

### Decision: Rule-Based Classifier in the Hybrid Search Service

**Rationale:** ML classifiers require training data that doesn't exist yet. Rule-based routing is deterministic, testable, and sufficient for the query patterns in this domain. The classifier should live in `packages/db/src/services/` (not middleware, not server action) because it's a pure function that transforms a query into a search strategy, and both the web app and MCP server need it.

**Why not middleware:** Middleware runs before auth, before the request body is parsed. Query routing needs the query text and user context.

**Why not server action:** Server actions are Next.js-specific. The MCP server needs the same routing logic.

**Confidence:** HIGH -- rule-based classification is standard practice for search systems with <10 query archetypes.

### Query Classification Taxonomy

```typescript
// packages/db/src/services/query-router.ts

type QueryIntent =
  | "keyword_exact"     // "email-parser" — exact slug/name match
  | "keyword_broad"     // "email" — broad keyword
  | "semantic_question" // "how do I process invoices?" — natural language
  | "category_browse"   // "show me productivity skills" — category filter
  | "similar_to"        // "skills like X" — similarity search
  | "community_explore" // "what clusters of skills exist?" — community query

interface QueryRoute {
  intent: QueryIntent;
  strategy: "keyword_only" | "semantic_only" | "hybrid" | "community";
  weights: { keyword: number; semantic: number; community: number };
  confidence: number;
}
```

### Routing Rules

```
1. Contains quoted string → keyword_exact, strategy: keyword_only
2. Starts with "like " or "similar to " → similar_to, strategy: semantic_only
3. Word count >= 5 or contains "?" → semantic_question, strategy: hybrid (semantic heavy)
4. Matches category name → category_browse, strategy: keyword_only with category filter
5. Contains "cluster", "community", "group" → community_explore, strategy: community
6. Default (1-4 words, no question mark) → keyword_broad, strategy: hybrid (balanced)
```

### Integration: Replacing Fixed Search Strategy

Currently, `discover.ts` always tries hybrid search, falls back to keyword. The new flow:

```
User query
    |
    v
classifyQuery(query) → QueryRoute
    |
    v
switch (route.strategy):
  "keyword_only"  → keywordSearchSkills()
  "semantic_only"  → semanticSearchSkills()
  "hybrid"         → hybridSearchSkills() with weighted RRF
  "community"      → communitySearch() [NEW]
    |
    v
Apply preference boost (unchanged)
    |
    v
Log search with route metadata (enhanced searchQueries row)
```

### Schema Change: searchQueries Enhancement

```sql
ALTER TABLE search_queries
  ADD COLUMN query_intent text,         -- classified intent
  ADD COLUMN search_strategy text,      -- strategy used
  ADD COLUMN route_confidence numeric;  -- classifier confidence
```

### Modified Components

| Component | Change |
|---|---|
| `packages/db/src/services/hybrid-search.ts` | Accept weight parameters for RRF tuning |
| `apps/web/app/actions/discover.ts` | Use query router instead of fixed strategy |
| `apps/mcp/src/tools/search.ts` | Use query router for MCP search |
| `apps/mcp/src/tools/recommend.ts` | Use query router for MCP recommend |
| `packages/db/src/schema/search-queries.ts` | Add intent/strategy/confidence columns |

### New Components

| Component | Location | Purpose |
|---|---|---|
| `packages/db/src/services/query-router.ts` | Service | Query classification + strategy selection |
| `packages/db/src/services/community-search.ts` | Service | Community-aware search |

---

## Priority 3: Temporal Version Tracking

### Decision: Application-Time Columns on skillVersions, NOT Bi-Temporal

**Rationale:** Full bi-temporal (4 columns: valid_from, valid_to, transaction_from, transaction_to) is overkill. The existing `skillVersions` table already tracks system time via `createdAt`. What's needed is *application time* — when a version was the "active" published version. This requires 2 new columns, not 4.

The `skillVersions` table is already immutable (wiki-style), so transaction time is inherently captured by the append-only pattern + `createdAt`.

**Confidence:** HIGH -- this aligns with the SQL:2011 application-time pattern on PostgreSQL 17.

### Schema Change

```sql
-- Add to skill_versions table
ALTER TABLE skill_versions
  ADD COLUMN valid_from timestamptz,     -- when this version became published
  ADD COLUMN valid_to   timestamptz;     -- when it was superseded (NULL = current)

-- Index for temporal range queries
CREATE INDEX skill_versions_temporal_idx
  ON skill_versions (skill_id, valid_from, valid_to);

-- Backfill existing data:
-- For each skill, order versions by `version` number.
-- Set valid_from = created_at of this version
-- Set valid_to = created_at of the NEXT version (NULL for latest)
```

### Migration Strategy for Existing Data

```sql
-- Migration: 0038_add_temporal_columns.sql

-- Step 1: Add nullable columns
ALTER TABLE skill_versions
  ADD COLUMN valid_from timestamptz,
  ADD COLUMN valid_to   timestamptz;

-- Step 2: Backfill using window function
WITH ordered AS (
  SELECT
    id,
    skill_id,
    created_at,
    LEAD(created_at) OVER (PARTITION BY skill_id ORDER BY version) AS next_created_at
  FROM skill_versions
)
UPDATE skill_versions sv
SET
  valid_from = o.created_at,
  valid_to   = o.next_created_at
FROM ordered o
WHERE sv.id = o.id;

-- Step 3: Create index
CREATE INDEX skill_versions_temporal_idx
  ON skill_versions (skill_id, valid_from, valid_to);
```

**Why NOT make valid_from NOT NULL immediately:** The backfill runs in the same migration, so all rows will have values. But keeping it nullable initially allows the migration to succeed on any edge cases. A follow-up migration can add NOT NULL after verification.

### Impact on Existing Queries

The existing `skillVersions` queries in the codebase are minimal:
- `benchmarkRuns.skillVersionId` (optional FK, no temporal query)
- Version creation in skill publish flow
- No existing code queries skillVersions by time range

**Breaking change risk: NONE.** The new columns are nullable, existing queries don't reference them, and the backfill is additive.

### New Service Functions

```typescript
// packages/db/src/services/skill-versions.ts (new or extend existing)

// Get the version that was active at a specific point in time
async function getVersionAt(skillId: string, timestamp: Date): Promise<SkillVersion | null>

// Get version history with temporal ranges
async function getVersionTimeline(skillId: string): Promise<VersionTimelineEntry[]>

// Called when a new version is published — sets valid_to on previous, valid_from on new
async function activateVersion(skillId: string, newVersionId: string): Promise<void>

// Diff between two temporal points
async function diffVersionsAt(skillId: string, t1: Date, t2: Date): Promise<VersionDiff>
```

### Modified Components

| Component | Change |
|---|---|
| `packages/db/src/schema/skill-versions.ts` | Add valid_from, valid_to columns |
| Skill publish flow (server action) | Call activateVersion() when publishing |

### New Components

| Component | Location | Purpose |
|---|---|---|
| `packages/db/src/services/skill-versions.ts` | Service | Temporal query functions |
| `0038_add_temporal_columns.sql` | Migration | Schema + backfill |

---

## Priority 4: Extended Visibility

### Decision: Add "public" and "unlisted" to the Existing Text Column

**Rationale:** The current visibility column is `text` (not an enum), so adding new values requires zero DDL changes to the column type. The challenge is updating the 15+ query locations that filter on visibility.

New visibility levels:
- **"public"** — visible to all tenants (cross-tenant discovery). For a future marketplace.
- **"unlisted"** — accessible via direct URL/slug, but excluded from search results and listings.
- **"tenant"** — visible to all users in the same tenant (existing, unchanged).
- **"personal"** — visible only to the author (existing, unchanged).

**Confidence:** HIGH -- no schema DDL needed, purely application-level change.

### Visibility Hierarchy

```
public > tenant > unlisted > personal

public:    anyone can search and find it
tenant:    only users in the same tenant can search and find it
unlisted:  anyone with the slug can view it, but it doesn't appear in search/browse
personal:  only the author can see it
```

### Centralized Filter Update Strategy

The key insight: `buildVisibilityFilter()` and `visibilitySQL()` in `packages/db/src/lib/visibility.ts` are the centralized choke point for 10+ of the 15 query locations. Updating these two functions handles the majority of cases.

**However,** 5+ locations use hardcoded `visibility = 'tenant'` in raw SQL (trending, leaderboard, getAvailableTags, portfolio ranking, contribution ranking). These must be updated individually.

### Updated visibility.ts

```typescript
// packages/db/src/lib/visibility.ts

// Context determines what "visible" means:
// - "search" context: public + tenant + own personal (excludes unlisted)
// - "access" context: public + tenant + unlisted + own personal (direct URL access)

type VisibilityContext = "search" | "access";

export function buildVisibilityFilter(userId?: string, context: VisibilityContext = "search"): SQL {
  if (context === "access") {
    // Direct access: everything except other users' personal skills
    if (!userId) {
      return or(
        eq(skills.visibility, "public"),
        eq(skills.visibility, "tenant"),
        eq(skills.visibility, "unlisted")
      )!;
    }
    return or(
      eq(skills.visibility, "public"),
      eq(skills.visibility, "tenant"),
      eq(skills.visibility, "unlisted"),
      and(eq(skills.visibility, "personal"), eq(skills.authorId, userId))
    )!;
  }

  // Search context: excludes unlisted
  if (!userId) {
    return or(
      eq(skills.visibility, "public"),
      eq(skills.visibility, "tenant")
    )!;
  }
  return or(
    eq(skills.visibility, "public"),
    eq(skills.visibility, "tenant"),
    and(eq(skills.visibility, "personal"), eq(skills.authorId, userId))
  )!;
}

export function visibilitySQL(userId?: string, context: VisibilityContext = "search"): SQL {
  if (context === "access") {
    if (!userId) {
      return sql`visibility IN ('public', 'tenant', 'unlisted')`;
    }
    return sql`(visibility IN ('public', 'tenant', 'unlisted') OR (visibility = 'personal' AND author_id = ${userId}))`;
  }

  if (!userId) {
    return sql`visibility IN ('public', 'tenant')`;
  }
  return sql`(visibility IN ('public', 'tenant') OR (visibility = 'personal' AND author_id = ${userId}))`;
}
```

### Audit of All 15+ Visibility Query Locations

| File | Current Filter | Change Required |
|---|---|---|
| `packages/db/src/lib/visibility.ts` | Central functions | UPDATE (add public + unlisted support) |
| `packages/db/src/services/hybrid-search.ts` | `visibilitySQL(userId)` | NONE (uses centralized function) |
| `packages/db/src/services/semantic-search.ts` | `buildVisibilityFilter(userId)` | NONE |
| `packages/db/src/services/search-skills.ts` | `buildVisibilityFilter(userId)` | NONE |
| `packages/db/src/services/skill-forks.ts` | `buildVisibilityFilter(userId)` | NONE |
| `apps/web/lib/search-skills.ts` | `buildVisibilityFilter` + `visibilitySQL` | NONE |
| `apps/web/lib/similar-skills.ts` | `buildVisibilityFilter` + `visibilitySQL` | NONE |
| `apps/mcp/src/tools/list.ts` | `buildVisibilityFilter(userId)` | NONE |
| `apps/web/lib/trending.ts` | HARDCODED `visibility = 'tenant'` | UPDATE to `visibility IN ('public', 'tenant')` |
| `apps/web/lib/leaderboard.ts` | HARDCODED `visibility = 'tenant'` | UPDATE to `visibility IN ('public', 'tenant')` |
| `apps/web/lib/search-skills.ts` (getAvailableTags) | HARDCODED `visibility = 'tenant'` | UPDATE |
| `apps/web/lib/portfolio-queries.ts` (ranking) | HARDCODED `visibility = 'tenant'` | UPDATE |
| `apps/web/lib/portfolio-queries.ts` (stats) | Filter `WHERE visibility = 'personal'` and `= 'tenant'` | UPDATE to include public |
| `apps/mcp/src/tools/everyskill.ts` | `visibility: z.enum(["tenant", "personal"])` | UPDATE enum to include "public", "unlisted" |
| Skill detail page (direct access) | Must allow unlisted access | UPDATE to use "access" context |

### Schema Changes

```sql
-- No DDL change needed for the column (it's already text type)
-- But we need a CHECK constraint for data integrity:

ALTER TABLE skills
  ADD CONSTRAINT skills_visibility_check
  CHECK (visibility IN ('public', 'tenant', 'unlisted', 'personal'));
```

### Migration Strategy

```sql
-- Migration: 0039_extend_visibility.sql

-- Step 1: Add CHECK constraint
ALTER TABLE skills
  ADD CONSTRAINT skills_visibility_check
  CHECK (visibility IN ('public', 'tenant', 'unlisted', 'personal'));

-- No data backfill needed — existing rows are all 'tenant' or 'personal'
```

### Modified Components

| Component | Change |
|---|---|
| `packages/db/src/lib/visibility.ts` | Add context parameter, public/unlisted support |
| `apps/web/lib/trending.ts` | Update hardcoded filter |
| `apps/web/lib/leaderboard.ts` | Update hardcoded filter |
| `apps/web/lib/search-skills.ts` | Update getAvailableTags hardcoded filter |
| `apps/web/lib/portfolio-queries.ts` | Update hardcoded filters (2 locations) |
| `apps/mcp/src/tools/everyskill.ts` | Update Zod enum for visibility |
| Skill detail page server component | Use "access" context for direct view |

### New Components

None. This is entirely modifications to existing code.

---

## Priority 5: Multi-Model Benchmarking

### Decision: Provider Abstraction Layer + Background Execution

**Two problems to solve:**
1. Adding OpenAI/Google SDKs without bloating the main bundle
2. Making benchmark execution non-blocking

### SDK Architecture: Provider Abstraction in packages/db

**Why NOT Vercel AI SDK:** The project already has a direct `@anthropic-ai/sdk` dependency and custom pricing logic. Vercel AI SDK is opinionated about streaming UI patterns and adds ~200KB+ of framework code. A thin provider abstraction is simpler and keeps the existing pricing/measurement infrastructure intact.

**Why NOT direct SDKs in apps/web:** The benchmark runner imports from `@anthropic-ai/sdk` which is server-only. Adding `openai` and `@google/genai` packages to apps/web bloats the dependency tree. Instead, place the provider abstraction in a new package or in `packages/db/src/services/`.

**Confidence:** HIGH for the abstraction pattern. MEDIUM for specific SDK APIs (verify at implementation time).

### Provider Abstraction Design

```typescript
// packages/db/src/services/llm-providers.ts (or new packages/llm/)

interface LLMProvider {
  name: string; // "anthropic" | "openai" | "google"
  chat(params: {
    model: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    maxTokens: number;
  }): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
  }>;
}

// Factory function — only imports the SDK that's needed
function getProvider(name: "anthropic" | "openai" | "google"): LLMProvider {
  switch (name) {
    case "anthropic": return new AnthropicProvider();
    case "openai":    return new OpenAIProvider();
    case "google":    return new GoogleProvider();
  }
}
```

### Dynamic Import for Tree-Shaking

```typescript
// Each provider uses dynamic import to avoid loading all SDKs at startup

class OpenAIProvider implements LLMProvider {
  name = "openai";
  async chat(params) {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // ... implementation
  }
}

class GoogleProvider implements LLMProvider {
  name = "google";
  async chat(params) {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
    // ... implementation
  }
}
```

### Extended Pricing Table

```typescript
// packages/db/src/services/pricing.ts — extend existing

export const MODEL_PRICING: Record<string, ModelPricing & { provider: string }> = {
  // Existing Anthropic models (keep all existing entries)
  ...ANTHROPIC_PRICING_ENTRIES,

  // OpenAI models
  "gpt-4o":       { provider: "openai", input: 0.25, output: 1.0 },
  "gpt-4o-mini":  { provider: "openai", input: 0.015, output: 0.06 },
  "gpt-4.1":      { provider: "openai", input: 0.2, output: 0.8 },
  "gpt-4.1-mini": { provider: "openai", input: 0.04, output: 0.16 },

  // Google models
  "gemini-2.5-flash": { provider: "google", input: 0.015, output: 0.06 },
  "gemini-2.5-pro":   { provider: "google", input: 0.125, output: 0.5 },
};
```

### Background Execution: Cron Polling Pattern

**Why NOT Inngest/Trigger.dev:** The project is self-hosted on a Hetzner VPS, not Vercel. Adding a third-party job queue service adds cost, external dependency, and deployment complexity. The existing cron pattern works.

**Why NOT Bull/Redis:** No Redis instance in the current stack. Adding one for a single use case is overhead.

**Pattern: Fire-and-forget with DB-based status tracking.** The existing `benchmarkRuns` table already has a `status` column ("pending" | "running" | "completed" | "failed"). This is already a job status tracker.

```
Trigger:
  Server action sets benchmarkRuns.status = "pending"
  Returns immediately with runId

Execution:
  New cron endpoint: /api/cron/benchmark-runner
  Polls for benchmarkRuns WHERE status = "pending"
  Picks up one at a time, sets to "running", executes, sets to "completed"/"failed"

Monitoring:
  Client polls GET /api/benchmark/[runId]/status for progress
  (or use existing revalidation on skill detail page)
```

### Modified benchmark-runner.ts

```typescript
// apps/web/lib/benchmark-runner.ts — refactored

// Change 1: Use provider abstraction instead of direct Anthropic import
// Change 2: Accept model list with provider metadata
// Change 3: Keep judge as Anthropic-only (quality consistent with known model)

const DEFAULT_BENCHMARK_MODELS = [
  { model: "claude-sonnet-4-5", provider: "anthropic" },
  { model: "claude-haiku-4-5", provider: "anthropic" },
  { model: "gpt-4o-mini", provider: "openai" },
  { model: "gemini-2.5-flash", provider: "google" },
];
```

### New Dependencies

```json
// apps/web/package.json — add:
"openai": "^5.x",
"@google/genai": "^1.x"

// NOTE: Dynamic imports ensure these are only loaded when
// a benchmark actually uses that provider. They won't
// affect page load or client bundle size.
```

### Integration Points

| Component | Change |
|---|---|
| `apps/web/lib/benchmark-runner.ts` | Refactor to use provider abstraction |
| `packages/db/src/services/pricing.ts` | Add multi-provider pricing table |
| `packages/db/src/schema/benchmark-runs.ts` | Already has `models: text[]` — no change |
| `packages/db/src/schema/benchmark-results.ts` | Already has `modelProvider: text` — no change |
| `apps/web/app/actions/benchmark.ts` | Return immediately, don't await runBenchmark |
| Benchmark UI component | Add model selection + progress indicator |

### New Components

| Component | Location | Purpose |
|---|---|---|
| `packages/db/src/services/llm-providers.ts` | Service | Provider abstraction layer |
| `apps/web/app/api/cron/benchmark-runner/route.ts` | API | Background benchmark execution |
| `apps/web/app/api/benchmark/[runId]/status/route.ts` | API | Benchmark progress polling |

---

## Suggested Build Order

The priorities have clear dependency relationships:

```
                    +--> [P4: Visibility] (independent)
                    |
[P3: Temporal] -----+
(no deps)           |
                    +--> [P1: Communities] (needs graph infra)
                              |
                              v
                    [P2: Query Routing] (needs communities for community_explore intent)
                              |
                              v
                    [P5: Multi-Model] (independent, but benefits from routing)
```

### Recommended Phase Structure

**Phase 1: Temporal + Visibility (parallel, no dependencies)**

These two can be built simultaneously because they touch different parts of the codebase.

- **P3 Temporal:** Schema migration + backfill + service functions + publish flow integration. Low risk, additive change, no breaking queries.
- **P4 Visibility:** Update visibility.ts central functions + audit all 15 hardcoded locations + MCP enum update + CHECK constraint. Medium risk due to breadth of changes, but each change is small.

**Phase 2: Community Detection**

Depends on: nothing technically, but benefits from temporal being done first (community detection can use version timeline data for edge weighting).

- Schema: skill_graph_edges + skill_communities + skill_community_memberships
- Services: graph-edges.ts + community-detection.ts + leiden.ts
- Cron: community-detection route
- Integration: similar-skills community boost

**Phase 3: Query Routing**

Depends on: Community detection (for the "community_explore" intent).

- Service: query-router.ts
- Integration: discover.ts + MCP search/recommend
- Schema: searchQueries enhancement
- Analytics: route effectiveness tracking

**Phase 4: Multi-Model Benchmarking**

Technically independent but benefits from query routing being done (can measure search quality improvement).

- Provider abstraction: llm-providers.ts
- Pricing extension
- Background execution: cron runner + status API
- UI: model selection + progress
- New dependencies: openai, @google/genai

### Phase Ordering Rationale

1. **Temporal + Visibility first** because they are schema-level foundations that other features build on. Temporal tracking informs community edge weighting (version history = usage patterns). Extended visibility is used by community detection queries.

2. **Community Detection second** because query routing depends on communities existing to route to.

3. **Query Routing third** because it's the integration layer that ties communities into the search pipeline.

4. **Multi-Model last** because it's the most self-contained feature and has the most external dependencies (API keys, new npm packages). Testing requires real API calls to OpenAI and Google, which makes it the most expensive to iterate on.

---

## Cross-Cutting Concerns

### Migration Sequencing

```
0038_add_temporal_columns.sql     (Phase 1)
0039_extend_visibility.sql        (Phase 1)
0040_create_graph_tables.sql      (Phase 2)
0041_add_community_tables.sql     (Phase 2)
0042_add_search_query_routing.sql (Phase 3)
```

All migrations are additive (ADD COLUMN, CREATE TABLE, ADD CONSTRAINT). None modify existing column types or drop columns. This means they can be applied to production without downtime.

### RLS Policy Template

All new tables follow the existing pattern:

```typescript
pgPolicy("tenant_isolation", {
  as: "restrictive",
  for: "all",
  using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
  withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
})
```

### Multi-Tenant Considerations

- All new tables include `tenant_id NOT NULL FK to tenants`
- Community detection runs per-tenant (each tenant gets its own graph)
- Query routing is tenant-agnostic (rules don't depend on tenant data)
- Visibility "public" crosses tenant boundaries — this is intentional for future marketplace, but requires careful handling in RLS (public skills bypass tenant isolation for reads)

### Public Visibility and RLS

**Critical design consideration:** Current RLS policies enforce `tenant_id = current_setting('app.current_tenant_id')`. Public skills need to be readable across tenants. Options:

1. **Separate RLS policy for public visibility** (recommended):
   ```sql
   CREATE POLICY public_read ON skills
     FOR SELECT
     USING (visibility = 'public' OR tenant_id = current_setting('app.current_tenant_id', true));
   ```

2. **Application-level bypass:** Query public skills without setting tenant context. Risky, breaks the security model.

**Recommendation:** Option 1. Add a permissive policy alongside the existing restrictive one. The restrictive policy remains for writes; the permissive policy allows cross-tenant reads of public skills only.

---

## Component Inventory Summary

### New Schema Files (5)

| File | Tables | Migration |
|---|---|---|
| `packages/db/src/schema/skill-graph-edges.ts` | skill_graph_edges | 0040 |
| `packages/db/src/schema/skill-communities.ts` | skill_communities | 0041 |
| `packages/db/src/schema/skill-community-memberships.ts` | skill_community_memberships | 0041 |
| skill-versions.ts (modify) | +valid_from, +valid_to | 0038 |
| search-queries.ts (modify) | +query_intent, +search_strategy, +route_confidence | 0042 |

### New Service Files (6)

| File | Purpose |
|---|---|
| `packages/db/src/services/graph-edges.ts` | Edge construction and CRUD |
| `packages/db/src/services/community-detection.ts` | Leiden wrapper + community CRUD |
| `packages/db/src/services/community-search.ts` | Community-aware search queries |
| `packages/db/src/services/query-router.ts` | Query classification + strategy |
| `packages/db/src/services/llm-providers.ts` | Multi-provider abstraction |
| `packages/db/src/services/skill-versions.ts` | Temporal query functions |

### New API Routes (3)

| Route | Purpose |
|---|---|
| `apps/web/app/api/cron/community-detection/route.ts` | Daily community rebuild |
| `apps/web/app/api/cron/benchmark-runner/route.ts` | Background benchmark execution |
| `apps/web/app/api/benchmark/[runId]/status/route.ts` | Benchmark progress polling |

### New Library Files (1)

| File | Purpose |
|---|---|
| `apps/web/lib/leiden.ts` | Leiden algorithm implementation/wrapper |

### Modified Files (15+)

| File | Change Scope |
|---|---|
| `packages/db/src/lib/visibility.ts` | Major: add context param + 2 new levels |
| `packages/db/src/services/hybrid-search.ts` | Minor: accept weight params |
| `packages/db/src/services/pricing.ts` | Medium: add multi-provider pricing |
| `packages/db/src/schema/skill-versions.ts` | Minor: add 2 columns |
| `packages/db/src/schema/search-queries.ts` | Minor: add 3 columns |
| `packages/db/src/schema/index.ts` | Minor: export new schemas |
| `packages/db/src/services/index.ts` | Minor: export new services |
| `apps/web/app/actions/discover.ts` | Medium: use query router |
| `apps/web/app/actions/benchmark.ts` | Medium: async execution |
| `apps/web/lib/benchmark-runner.ts` | Major: provider abstraction |
| `apps/web/lib/trending.ts` | Minor: update hardcoded visibility |
| `apps/web/lib/leaderboard.ts` | Minor: update hardcoded visibility |
| `apps/web/lib/search-skills.ts` | Minor: update hardcoded visibility |
| `apps/web/lib/similar-skills.ts` | Medium: add community context |
| `apps/web/lib/portfolio-queries.ts` | Minor: update hardcoded visibility |
| `apps/mcp/src/tools/everyskill.ts` | Minor: update visibility enum |
| `apps/mcp/src/tools/search.ts` | Minor: use query router |
| `apps/mcp/src/tools/recommend.ts` | Minor: use query router |

### New npm Dependencies (3)

| Package | Purpose | Phase |
|---|---|---|
| `louvain-leiden` (or vendor) | Community detection algorithm | Phase 2 |
| `openai` | OpenAI API client | Phase 4 |
| `@google/genai` | Google AI API client | Phase 4 |

---

## Sources

- [PostgreSQL vs Neo4j for small graphs](https://medium.com/self-study-notes/exploring-graph-database-capabilities-neo4j-vs-postgresql-105c9e85bb5d)
- [Leiden algorithm implementations on GitHub](https://github.com/topics/leiden-algorithm)
- [esclear/louvain-leiden TypeScript implementation](https://github.com/esclear/louvain-leiden)
- [GraphRAG and PostgreSQL integration](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/graphrag-and-postgresql-integration-in-docker-with-cypher-query-and-ai-agents/4420623)
- [Bi-temporal PostgreSQL patterns](https://hdombrovskaya.wordpress.com/2024/05/05/3937/)
- [PostgreSQL 17 temporal extensions](https://wiki.postgresql.org/wiki/Temporal_Extensions)
- [SQL:2011 temporal support in PostgreSQL](https://wiki.postgresql.org/wiki/SQL2011Temporal)
- [Vercel AI SDK provider model](https://ai-sdk.dev/docs/introduction)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [@google/genai migration from deprecated @google/generative-ai](https://ai.google.dev/gemini-api/docs/migrate)
- [Next.js background jobs patterns](https://github.com/vercel/next.js/discussions/33989)
- [Inngest background job pattern](https://www.inngest.com/blog/run-nextjs-functions-in-the-background)
- [Leiden algorithm paper (Traag et al.)](https://arxiv.org/abs/1810.08473)
