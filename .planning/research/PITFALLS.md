# Domain Pitfalls: v7.0 Algorithm & Architecture Rewrite

**Domain:** GraphRAG community detection, adaptive query routing, bi-temporal tracking, extended visibility, multi-model benchmarking
**Project:** EverySkill v7.0
**Researched:** 2026-02-16
**Overall confidence:** HIGH (all critical pitfalls verified against actual codebase files with line-number references; integration risks mapped to specific code paths; external patterns verified from official documentation)

---

## Critical Pitfalls

Mistakes that cause data corruption, production outages, or require architectural rewrites.

---

### Pitfall 1: Visibility Enum Migration Breaking 15+ Query Locations (Two Distinct Patterns)

**What goes wrong:** The `visibility` column on `skills` is `TEXT NOT NULL DEFAULT 'tenant'` with two values (`"tenant"`, `"personal"`). Extending to 4 values (adding `"community"` and `"discoverable"`) breaks code in **two distinct patterns** that exist for deliberately different reasons:

**Pattern A -- Centralized Helper (8 import sites, 11+ call sites):**
`buildVisibilityFilter(userId)` and `visibilitySQL(userId)` from `packages/db/src/lib/visibility.ts` are used in:
- `packages/db/src/services/hybrid-search.ts:33,107` (visibilitySQL in both CTEs)
- `packages/db/src/services/search-skills.ts:92` (buildVisibilityFilter)
- `packages/db/src/services/semantic-search.ts:50` (buildVisibilityFilter)
- `packages/db/src/services/skill-forks.ts:29,50` (buildVisibilityFilter, 2 call sites)
- `apps/web/lib/search-skills.ts:70,105` (visibilitySQL + buildVisibilityFilter)
- `apps/web/lib/similar-skills.ts:71,86,134,199,265` (visibilitySQL x3, buildVisibilityFilter x2)
- `apps/mcp/src/tools/list.ts:34` (buildVisibilityFilter)

**Pattern B -- Inline Hardcoded (8+ locations, INTENTIONALLY different):**
These use `visibility = 'tenant'` directly in raw SQL to exclude personal skills from org-level aggregations:
- `apps/web/lib/trending.ts:55` -- `AND s.visibility = 'tenant'`
- `apps/web/lib/leaderboard.ts:59` -- `AND s.visibility = 'tenant'`
- `apps/web/lib/portfolio-queries.ts:80` -- `FILTER (WHERE visibility = 'personal')`
- `apps/web/lib/portfolio-queries.ts:82` -- `FILTER (WHERE visibility = 'tenant')`
- `apps/web/lib/portfolio-queries.ts:197` -- `AND s.visibility = 'tenant'`
- `apps/web/lib/portfolio-queries.ts:230` -- `AND visibility = 'tenant'`
- `apps/web/lib/resume-queries.ts:71` -- `AND s.visibility = 'personal'`
- `apps/web/lib/search-skills.ts:302` -- `AND visibility = 'tenant'` (tags query)

The inline sites are **deliberately** different from the helper. Phase 40 design intentionally uses `= 'tenant'` for org-level aggregations (trending, leaderboard, platform stats) because personal skills should never inflate org metrics. Adding new visibility values means deciding for EACH inline location: Does `"community"` count as org-visible? Does `"discoverable"` appear in trending?

**Why it happens:** The Phase 40 design correctly split visibility logic into two patterns. This was right for 2 values but creates shotgun surgery when extending. The Phase 40 verification doc (`.planning/phases/40-visibility-scoping/40-VERIFICATION.md`) even documents this dual-pattern design explicitly.

**Consequences:**
- If `buildVisibilityFilter()` is updated but inline sites missed: community-visible skills silently excluded from trending/leaderboard
- If inline sites updated inconsistently: skills appear in trending but not leaderboard
- If migration runs before code changes deploy: new visibility values exist in DB but queries don't handle them -- skills "disappear"

**Prevention:**
1. Create complete audit checklist BEFORE writing code. Run: `grep -rn "visibility.*=.*'tenant'\|visibility.*=.*'personal'\|buildVisibilityFilter\|visibilitySQL" --include='*.ts' apps/ packages/`
2. Create `VISIBILITY_VALUES` constant and `isOrgVisible(visibility: string): boolean` helper. Replace ALL inline `= 'tenant'` checks with `IN (${orgVisibleValues})` pattern
3. Deploy code changes BEFORE running migration. New code treats unknown visibility values conservatively
4. Add CHECK constraint: `ALTER TABLE skills ADD CONSTRAINT skills_visibility_check CHECK (visibility IN ('tenant', 'personal', 'community', 'discoverable'))`
5. Existing indexes (`skills_visibility_idx`, `skills_visibility_author_idx` from migration 0019) work with new values but test query plans

**Detection:**
- Grep audit before and after changes
- Unit test every visibility value in both `buildVisibilityFilter()` and `isOrgVisible()`
- E2E test: create skill with each visibility value, verify appearance on trending, leaderboard, search, portfolio

**Which phase:** Visibility Extension -- must be FIRST feature phase. All other features depend on it.

**Testing strategy:**
- Unit: `buildVisibilityFilter()` with 4 visibility values x 2 userId states = 8 test cases
- Unit: `isOrgVisible()` returns correct boolean for each of 4 values
- Integration: insert skills with each visibility, run each query path, assert correct inclusion/exclusion
- Regression: existing `"tenant"` and `"personal"` behavior byte-for-byte unchanged

**Confidence:** HIGH -- every file path and line number verified from codebase.

---

### Pitfall 2: Similarity Graph CROSS JOIN Blows Up Quadratically

**What goes wrong:** Building the skill similarity graph requires pairwise cosine distances between all skill embeddings. The naive approach:

```sql
SELECT a.skill_id, b.skill_id, 1 - (a.embedding <=> b.embedding) AS similarity
FROM skill_embeddings a
CROSS JOIN skill_embeddings b
WHERE a.skill_id < b.skill_id AND a.tenant_id = b.tenant_id
```

For N skills: N*(N-1)/2 pairs. At 100 skills: 4,950 (fast). At 1,000: 499,500 (slow). At 5,000: 12.5M (crashes). Each pair involves a 768-dimensional vector distance computation.

**Why it happens:** Developers prototype with 50-100 skills where CROSS JOIN completes in <1 second. In production with 1,000+ skills per tenant, the query runs for minutes, exhausting the connection pool.

**Consequences:**
- Connection pool exhausted during graph build -- all queries fail
- Server OOM if 12.5M rows with 768-dim vectors loaded into memory
- The 8-core/32GB VPS cannot handle both graph building and serving requests

**Prevention:**
1. **Use KNN via pgvector's HNSW index.** For each skill, find K=20 nearest neighbors using `ORDER BY embedding <=> query_vector LIMIT 20`. This is O(N*K) not O(N^2)
2. **Apply the existing distance threshold.** Only create edges for cosine distance < 0.35 (same threshold in `similar-skills.ts:56`), dramatically reducing edge count
3. **Build incrementally.** When a skill is created/updated, compute its K nearest neighbors. Delete edges for removed skills
4. **Use a dedicated connection.** Don't use the main pool in `packages/db/src/client.ts`. Create a separate `postgres()` connection with `max: 1` for graph operations

```sql
-- KNN approach: O(N*K) instead of O(N^2)
SELECT a.skill_id, b.skill_id AS nearest_id, 1 - (a.embedding <=> b.embedding) AS similarity
FROM skill_embeddings a
CROSS JOIN LATERAL (
  SELECT skill_id, embedding
  FROM skill_embeddings
  WHERE skill_id != a.skill_id AND tenant_id = a.tenant_id
  ORDER BY embedding <=> a.embedding
  LIMIT 20
) b
WHERE (a.embedding <=> b.embedding) < 0.35;
```

**Detection:** Monitor graph build query time. If > 10 seconds, approach needs optimization.

**Which phase:** Community Detection -- foundational. Graph storage approach determines everything.

**Testing strategy:**
- Unit: KNN query returns correct results for small test set
- Performance: graph build with 500 skills completes in < 30 seconds
- Boundary: graph build with 0 skills doesn't crash

**Confidence:** HIGH -- quadratic growth is mathematical certainty; pgvector HNSW capabilities verified.

---

### Pitfall 3: Community Detection Cold Start with Sparse Graph

**What goes wrong:** Community detection algorithms (Louvain, Label Propagation) require meaningful graph density. EverySkill's graph is built from:
- Same category (5 values: productivity, wiring, doc-production, data-viz, code)
- Semantic similarity (embedding distance < 0.35)

With < 50 skills per tenant, the graph is likely too sparse. Louvain modularity optimization on a sparse graph produces:
- One giant community (everything together -- useless)
- N communities of size 1 (each skill alone -- also useless)

The resolution limit of modularity-based methods means communities smaller than `sqrt(2m)` edges cannot be reliably detected. Additionally, Louvain can produce disconnected communities (a known flaw that Leiden was designed to fix). At small scale, this manifests as "Data Visualization" communities containing unrelated skills connected through weak bridge nodes.

**Why it happens:** Community detection literature focuses on 10K+ node networks. At EverySkill's scale (tens to hundreds of skills), algorithm assumptions break down.

**Consequences:**
- Meaningless community labels undermine user trust
- AI-generated summaries hallucinated from unrelated skills grouped together
- Community-boosted search degrades rather than improves relevance
- Resources wasted on graph analysis that produces garbage output

**Prevention:**
1. **Minimum thresholds.** Don't run detection if tenant has < 20 published skills with embeddings, or graph has < 30 edges, or average node degree < 2
2. **Use category as seed.** Use existing `category` field as prior knowledge. Skills in same category start in same proto-community; similarity edges refine grouping
3. **Post-process with connected component analysis.** After Louvain, check each community for disconnected components. Split disconnected communities into separate ones using graphology-components
4. **Validate community quality before displaying:**
   - Average intra-community similarity > 0.5
   - Average inter-community similarity < intra * 0.6
   - No community > 50% of total skills
   - No community < 3 skills
   If validation fails, fall back to category-based grouping
5. **Use pre-computed embeddings from `skill_embeddings` table.** Do NOT generate new embeddings during detection. Existing embedding pipeline populates `skill_embeddings`. This eliminates Ollama as a runtime dependency for the cron
6. **Monitor community stability.** Track how communities change between runs. If > 30% of skills change communities between consecutive runs, the graph is too unstable

```typescript
// Post-process: split disconnected communities
import { connectedComponents } from 'graphology-components';

function refineCommunities(graph: Graph, communities: Record<string, number>) {
  const refined: Record<string, number> = {};
  let nextId = Math.max(...Object.values(communities)) + 1;
  const byComm: Record<number, string[]> = {};
  for (const [node, comm] of Object.entries(communities)) {
    (byComm[comm] ??= []).push(node);
  }
  for (const [commId, nodes] of Object.entries(byComm)) {
    const subgraph = graph.copy();
    // Remove nodes not in this community
    graph.forEachNode(n => { if (!nodes.includes(n)) subgraph.dropNode(n); });
    const components = connectedComponents(subgraph);
    if (components.length === 1) {
      nodes.forEach(n => refined[n] = Number(commId));
    } else {
      components.forEach((comp, i) => {
        const id = i === 0 ? Number(commId) : nextId++;
        comp.forEach(n => refined[n] = id);
      });
    }
  }
  return refined;
}
```

**Detection:**
- Log quality metrics after each run: `{ communities, avgIntraSim, avgInterSim, singletons, giantPct }`
- Alert if any community > 50% of skills or > 30% are singletons
- Dashboard: last run time, quality score, coverage

**Which phase:** Community Detection. Quality validation MUST be built alongside detection, not deferred.

**Testing strategy:**
- Unit: graph with < 20 nodes returns `{ status: "insufficient_data" }`
- Unit: quality validator rejects single-giant-community and all-singletons
- Unit: connected-component post-processing splits disconnected communities correctly
- Unit: category-seeded detection produces category communities when similarity is sparse
- Integration: 30 skills in 3 categories with realistic embeddings -> 3+ communities detected
- Edge: all identical embeddings -> 1 community. Empty embeddings table -> category fallback

**Confidence:** HIGH -- Louvain disconnected community problem verified from Traag et al. 2019; graphology-communities-louvain uses standard Louvain without Leiden refinement.

---

### Pitfall 4: Community Routing Degrading Existing Hybrid Search Quality

**What goes wrong:** Current `hybridSearchSkills()` in `packages/db/src/services/hybrid-search.ts` uses RRF merge (k=60) across full-text and semantic search in a single SQL query (lines 36-78, FULL OUTER JOIN). Adding community routing introduces a pre-filter or re-ranking step that silently degrades quality:

- **Pre-filter:** Narrowing scope to a community before RRF excludes good matches outside that community
- **Third RRF signal:** Community affinity dilutes text/semantic weights. The formula `1/(k+rank)` was balanced for 2 signals
- **Latency:** Current query is a single SQL round-trip. Community lookup adds either a pre-query or a JOIN to community tables

The hardcoded similarity threshold of 0.35 in `similar-skills.ts:56` was tuned for 2-signal search, not community-boosted.

**Why it happens:** Query classification is harder than document classification -- queries have 2-5 words vs 50-200 for documents. Short queries like "charts" are ambiguous.

**Consequences:**
- Users search for "data visualization" and get "community management" skills from the same community
- Search latency increases from ~50ms to ~200ms
- No A/B testing infrastructure exists to detect degradation

**Prevention:**
1. **Additive, not replacing.** Community boost is optional. Fallback path (current hybrid search) is always available and is the DEFAULT
2. **Add `communityBoost` parameter** (default 0.0) to `hybridSearchSkills()`. When 0.0: byte-for-byte identical to current behavior
3. **Store community assignments as pre-computed data** (table or column), not computed at query time
4. **Search quality regression test:** maintain golden set of 20+ `(query, expected_top_3)` pairs from current production. Run before and after any search change
5. **Classification confidence threshold:** Only apply routing when query-to-centroid similarity > 0.6. Below that, standard search only
6. **Never filter results.** Routing adds boost scores to RRF, never removes results
7. **Add latency instrumentation.** Log `search_latency_ms`, alert if p95 > 200ms

**Detection:**
- Golden result set comparison: assert >= 80% overlap in top-5 before/after
- Monitor click-through rate
- `?debug=1` returns per-signal RRF scores

**Which phase:** Adaptive Routing, AFTER Community Detection is validated. These MUST be separate phases.

**Testing strategy:**
- Golden test set: 20+ queries from production, results compared before/after
- Latency: p95 < 150ms with routing enabled
- Edge: 0 communities -> identical to current. Low confidence classification -> standard search only

**Confidence:** HIGH -- RRF formula behavior verified; current implementation analyzed at line level.

---

### Pitfall 5: Bi-Temporal Migration Corrupting Existing Version History

**What goes wrong:** The existing `skill_versions` table (`packages/db/src/schema/skill-versions.ts`) uses sequential versioning (1, 2, 3...) with only `createdAt`. Adding bi-temporal tracking requires `valid_from`/`valid_to` (application time) and `recorded_at` (system time). Retrofitting onto existing rows is dangerous:

- Existing rows lack `valid_from`/`valid_to` -- must be backfilled
- Setting `valid_from = createdAt` creates temporal gaps between versions (version 1 created Jan 1, version 2 created Jan 15 -- what's valid Jan 1-15?)
- The chain must be correct: `valid_to` of version N must equal `valid_from` of version N+1 for the same skill
- Adding `NOT NULL` temporal columns requires either defaults (which default?) or NULLs (defeating the model)
- `getLatestBenchmarkRun()` in `packages/db/src/services/benchmark.ts:107` queries by `desc(benchmarkRuns.createdAt)`. Temporal columns must not interfere

The custom migration runner (`packages/db/src/migrate.ts`) wraps everything in `sql.begin()` (line 56). Complex temporal migrations may conflict with this transaction wrapping:
- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction
- Large backfill UPDATEs may lock tables for extended periods inside the transaction

**Why it happens:** Bi-temporal models are designed for greenfield. Retrofitting onto 37 existing migrations with production data requires careful "pre-temporal era" handling.

**Consequences:**
- Existing version queries break or return wrong results
- `valid_to IS NULL` assumption breaks if backfill sets incorrect values
- Temporal range queries without GiST indexes do sequential scans
- Migration runner fails if migration uses `CONCURRENTLY`

**Prevention:**
1. **Use a separate history table** (`skill_version_history`) rather than adding columns to `skill_versions`. Existing table continues unchanged. History captures changes via PostgreSQL triggers (temporal_tables pattern)
2. **Chain-correct backfill:** For each skill, order versions by `version` number. Set `valid_from = created_at`. Set `valid_to` = next version's `created_at` for superseded versions. Latest version gets `valid_to = NULL`
3. **Add btree_gist extension** (like pgvector in migration 0001). Required for exclusion constraints on temporal ranges. Install via superuser before migration
4. **Split migration into multiple files:**
   - `0038_create_btree_gist.sql`: Extension creation
   - `0039_create_version_history.sql`: DDL (table, indexes, constraints)
   - `0040_backfill_version_history.sql`: DML (chain-correct backfill)
5. **Use `CREATE INDEX` (not `CONCURRENTLY`)** inside the transaction. Table lock acceptable at current scale
6. **Add GiST index** on `tstzrange(valid_from, COALESCE(valid_to, 'infinity'::timestamptz))` for temporal range queries
7. **Keep ALL existing query paths untouched.** Temporal queries are new functions, not modifications
8. **Write raw SQL migrations,** not drizzle-kit generated. Drizzle 0.42.0 doesn't support `tstzrange`, exclusion constraints, or range operators. Mark temporal tables with comment: `// TEMPORAL: Use raw SQL for mutations and range queries`

**Detection:**
- Before/after migration: same version count per skill, same ordering
- `SELECT * FROM skill_version_history WHERE valid_from IS NULL` returns 0 rows
- Chain integrity: for each skill, `valid_to` of version N = `valid_from` of version N+1
- Existing E2E tests pass unchanged
- `getLatestBenchmarkRun()` latency unchanged

**Which phase:** Temporal Tracking. Must NOT modify existing version query paths.

**Testing strategy:**
- Migration: create test data, run migration, verify chain consistency
- Roundtrip: "what was version at time T?" returns correct result
- Performance: temporal range query on 1000+ versions < 50ms
- Regression: all existing version tests pass
- Boundary: exact match on valid_from, valid_to edges
- Migration runner: second run skips applied migrations (idempotent)

**Confidence:** HIGH -- migration runner analyzed; bi-temporal patterns verified from PostgreSQL documentation and temporal_tables extension.

---

### Pitfall 6: Multi-Model SDK Bloat and Provider Coupling

**What goes wrong:** The benchmark runner (`apps/web/lib/benchmark-runner.ts`) is tightly coupled to Anthropic:
- `import Anthropic from "@anthropic-ai/sdk"` (line 1)
- `getClient(): Anthropic` returns single provider (line 48)
- `modelProvider: "anthropic"` hardcoded (lines 218, 251)
- `JUDGE_MODEL = "claude-sonnet-4-5-20250929"` hardcoded (line 16)
- `BENCHMARK_MODELS` array is Claude-only (line 13)

Adding OpenAI and Google creates three problems:

1. **Bundle bloat:** `openai` ~7.3 MB, `@google/genai` ~11.6 MB (the old `@google/generative-ai` hit EOL August 2025). Adding ~19 MB to node_modules
2. **API key sprawl:** 3 env vars x 3 environments (dev, staging, prod). `apps/web/.env.local` overrides root `.env.local` (per MEMORY.md), adding confusion. PM2 requires `reload --update-env` after changes
3. **Pricing drift:** `packages/db/src/services/pricing.ts` has a static `ANTHROPIC_PRICING` record (14 model entries, lines 19-62). `estimateCostMicrocents()` returns `null` for unknown models (line 74), silently dropping cost data. Adding 2 more providers triples maintenance

**Consequences:**
- Server bundle grows, slowing cold starts
- Missing API key fails at benchmark time (runtime), not build time
- Cross-provider cost comparisons meaningless if pricing stale
- Claude-as-judge scores Claude output differently than GPT output (judge bias)
- Different providers count tokens differently -- cost estimates incomparable

**Prevention:**
1. **Use Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`). Unified `generateText()`, smaller adapters than full SDKs. Alternatively, use Google's OpenAI compatibility mode (same SDK, different baseURL) to avoid `@google/genai` entirely
2. **Lazy-load via dynamic `import()`.** Only load provider SDK when benchmark uses that provider
3. **Provider registry interface:**
   ```typescript
   interface ModelProvider {
     name: string;
     isConfigured(): boolean;
     generateText(model: string, prompt: string, maxTokens: number): Promise<ProviderResult>;
     estimateCost(model: string, inputTokens: number, outputTokens: number): number | null;
   }
   ```
4. **Validate keys at startup** via health check, not at benchmark time. Gray out unconfigured models in UI
5. **Split pricing by provider:** `pricing/anthropic.ts`, `pricing/openai.ts`, `pricing/google.ts` with `lastVerified` dates. Warn if > 30 days stale
6. **Use provider-reported token counts** for cost estimation, not re-tokenized counts
7. **Judge bias:** For cross-provider benchmarks, use judges from 2+ providers and average, OR use deterministic rubrics (regex, structure checks) alongside LLM judge. At minimum, label cross-provider scores as "not directly comparable"

**Detection:**
- `pnpm build` output: check server bundle size
- Health check: `/api/health` logs provider availability
- Unit test: `estimateCostMicrocents()` non-null for every model in benchmark list
- Integration test: unconfigured provider -> clear error, not crash

**Which phase:** Multi-Model. Provider interface designed BEFORE implementation.

**Testing strategy:**
- Unit: each provider adapter in isolation (mock SDK)
- Unit: pricing for every model in every provider table
- Integration: 1 test case x 2 providers produces valid results
- Mock: provider throws -> `error_message` set, run doesn't crash
- Config: missing key -> `isConfigured()` false, model disabled

**Confidence:** HIGH -- bundle sizes verified from npm; existing benchmark analyzed at line level.

---

## Moderate Pitfalls

Mistakes that cause significant rework or user-facing bugs.

---

### Pitfall 7: Tenant Isolation Missing on New Tables

**What goes wrong:** Every existing table (25 tables) follows the exact same pattern in schema files:
- `tenantId: text("tenant_id").notNull().references(() => tenants.id)`
- `index("..._tenant_id_idx").on(table.tenantId)`
- `pgPolicy("tenant_isolation", { as: "restrictive", for: "all", using: sql\`tenant_id = current_setting('app.current_tenant_id', true)\`, withCheck: ... })`

The connection-level `app.current_tenant_id` in `packages/db/src/client.ts:41` makes RLS automatic. New tables for community detection (`skill_communities`, `community_edges`), temporal tracking (`skill_version_history`), and community summaries MUST follow this pattern. Missing `tenant_id` means:
- RLS doesn't apply, leaking data across tenants
- JOINs with tenant-scoped tables fail or return wrong results
- The connection-level setting doesn't protect the new table

**Why it happens:** Community/graph tables feel "internal" -- computed data, not user content. But community membership IS tenant-specific.

**Prevention:**
1. **Table creation checklist** (enforce in code review):
   - [ ] `tenantId` column with FK to tenants
   - [ ] `tenant_id_idx` index
   - [ ] `pgPolicy("tenant_isolation", ...)` with standard check
   - [ ] Relations in `packages/db/src/relations/index.ts`
   - [ ] Migration in `packages/db/src/migrations/` (custom runner)
2. **Add SQL check to integrity cron** (`/api/cron/integrity-check/route.ts`): verify all non-system tables have RLS policies
3. **TypeScript enforcement:** if `NewCommunity` type lacks `tenantId`, insert fails at compile time

**Detection:**
- `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT DISTINCT tablename FROM pg_policies)` -- only `_applied_migrations` and `tenants` should appear
- After creating any table: `\d+ table_name` shows RLS policies

**Which phase:** EVERY phase creating tables.

**Testing strategy:**
- Unit: insert without tenant_id -> NOT NULL violation
- Integration: data in tenant A, switch to tenant B, verify zero results
- CI: automated schema check comparing `pg_tables` vs `pg_policies`

**Confidence:** HIGH -- pattern verified across all 25 existing tables.

---

### Pitfall 8: Benchmark Result Comparability Across Providers

**What goes wrong:** Current benchmark uses single Anthropic SDK with `claude-sonnet-4-5-20250929` as judge (line 16). Cross-provider introduces:

- **Latency incomparability:** Different API endpoints have 20-50ms network latency difference, dwarfing model speed differences
- **Token counting divergence:** Each provider uses different tokenizer. Same prompt = different token counts. Cost estimates misleading
- **Judge bias:** Claude-as-judge may systematically favor or penalize Claude output (same-family bias). This is measured and documented in LLM evaluation literature
- **Output format variance:** Different markdown/code block styles. Judge may score formatting differences as quality differences

**Prevention:**
1. **Separate same-provider and cross-provider modes.** Same-provider: current methodology. Cross-provider: additional controls, labeled "results may vary"
2. **Provider-reported token counts** for cost estimation
3. **Multi-judge for cross-provider:** 2+ provider judges, averaged scores. Or deterministic rubrics alongside LLM judge
4. **Confidence intervals:** With 3-5 test cases, show "72 +/- 12" not "72"
5. **Store raw responses** in `benchmark_results.output_produced` for re-scoring

**Detection:**
- If one provider systematically scores higher across all benchmarks, investigate judge bias
- Same output evaluated by different judges should be within 10 points

**Which phase:** Multi-Model.

**Testing strategy:**
- Mock: identical output from 2 providers -> judge scores within 5 points
- Unit: cost uses provider-reported tokens
- Integration: 1 test case x 2 providers -> valid results with all fields

**Confidence:** MEDIUM -- judge bias documented in evaluation literature; specific magnitude not empirically tested.

---

### Pitfall 9: Adaptive Routing Misclassification Without Fallback

**What goes wrong:** Routing classifies query into community, then biases results. With short/ambiguous queries (2-5 words), classification is unreliable. "Charts" could mean data-viz, org charts, or chart.js.

**Prevention:**
1. **Always run standard search in parallel.** Blending ratio (70% standard, 30% community) tunable via `site_settings`
2. **Confidence threshold 0.6.** Below that, standard search only
3. **Never filter.** Routing adds boosts, never removes results
4. **Log decisions:** `(query, classified_community, confidence, clicked_result_community)` in `search_queries` table

**Detection:**
- A/B: 50% routed, 50% standard. Compare click-through after 2 weeks
- Zero-result rate must not increase with routing

**Which phase:** Adaptive Routing, after Community Detection validated.

**Testing strategy:**
- Unit: ambiguous query + low confidence -> no boost
- Unit: 0 communities -> identical to standard search
- Golden set: same queries, no degradation

**Confidence:** HIGH -- classification difficulty for short queries is well-established.

---

### Pitfall 10: Community Detection Cron Competing with Ollama

**What goes wrong:** If community detection generates new embeddings via Ollama (`generateEmbedding()` in `apps/web/lib/ollama.ts`, which has a 5-second timeout at line 23), it competes with the existing embedding pipeline for user-facing similarity search. The VPS runs Ollama locally with limited GPU/CPU resources.

**Prevention:**
1. **Do NOT generate embeddings in community detection.** Read from `skill_embeddings` table only
2. Skills without embeddings: exclude from detection, don't embed inline
3. Schedule cron during off-peak hours. Follow `CRON_SECRET` bearer token pattern from existing crons
4. Health check at cron start: verify `skill_embeddings` has >= 20 rows

**Detection:**
- Ollama p95 > 3 seconds during community detection -> saturating
- `generateEmbedding()` null-return rate > 10% -> under pressure

**Which phase:** Community Detection.

**Testing strategy:**
- Unit: detection service reads `skill_embeddings`, never calls `generateEmbedding()`
- Integration: detection succeeds with Ollama completely stopped

**Confidence:** HIGH -- Ollama infrastructure verified from codebase.

---

### Pitfall 11: RAGAS Evaluation Cost Explosion

**What goes wrong:** RAGAS faithfulness metric requires 2 LLM calls per evaluation (claim extraction + verification). For 5 test cases x 8 models x 5 metrics = 200 evaluations. At 2 calls each: 400+ API calls per benchmark run. At ~500 tokens each: ~250K tokens for evaluation alone (~$0.75 at Sonnet pricing).

**Prevention:**
1. **RAGAS metrics optional.** Basic benchmarks (quality, tokens, latency) by default. RAGAS as "advanced evaluation" toggle
2. **Batch claims.** Single prompt verifies all claims instead of one per claim
3. **Cache evaluations.** Same content + same output = reuse result
4. **Cheaper judge model.** Haiku for extraction/verification, Sonnet for final judgment (5x cost reduction)
5. **Show estimated cost before running.** "Estimated cost: $0.85. Proceed?"

**Which phase:** Multi-Model benchmark phase. Cost controls designed upfront.

**Testing strategy:**
- Unit: metric batching reduces API calls by > 50%
- Unit: cache hit skips API call
- Integration: cost estimate within 20% of actual

**Confidence:** MEDIUM -- RAGAS call counts inferred from metric definitions, not empirically measured.

---

## Minor Pitfalls

---

### Pitfall 12: Test Infrastructure Gaps

**What goes wrong:** Current test infrastructure is thin:
- 3 unit tests in `apps/web/lib/__tests__/` (quality-score, relative-time, sanitize-payload)
- 2 MCP tests in `apps/mcp/test/` with manual mock chains
- `packages/db` has NO vitest: test script is `echo 'No unit tests yet' && exit 0` (package.json line 22)
- No database test fixtures or seeding utilities
- Vitest config for apps/web only includes `lib/__tests__/**/*.test.ts`

The "comprehensive unit tests per phase" requirement demands infrastructure that doesn't exist.

**Prevention:**
1. Add vitest to `packages/db`: create `packages/db/vitest.config.ts`
2. Create test fixtures: `packages/db/src/__tests__/fixtures.ts` with factory functions
3. Graph algorithm tests: pure functions on in-memory adjacency lists (no DB needed)
4. Temporal query tests: mock DB helpers or typed mock chains
5. Visibility tests: run SQL against test database for correctness

**Which phase:** First phase (test infrastructure), before any feature work.

**Confidence:** HIGH -- verified from package.json and vitest configs.

---

### Pitfall 13: Community Summaries Becoming Stale

**What goes wrong:** AI summaries don't match community members after skills added/removed.

**Prevention:**
- Hash of member skill IDs alongside summary. Membership change -> mark stale
- Regenerate only changed communities, not all
- Stale indicator in UI, not silent staleness

**Which phase:** Community Detection.

---

### Pitfall 14: Environment Variable Proliferation

**What goes wrong:** 3 new API keys x 3 environments = 9 env var updates. `apps/web/.env.local` overrides root. PM2 requires `--update-env` after changes.

**Prevention:**
- Add to `.env.example` files first
- `validateProviderConfig()` at startup
- All provider keys optional
- Update `memory/environments.md`

**Which phase:** Multi-Model.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|---|---|---|---|
| Test Infrastructure | No vitest in packages/db, no fixtures | Moderate | Add vitest config + fixtures before feature work |
| Visibility Extension | 15+ files with visibility logic in 2 patterns | **Critical** | Grep audit, `isOrgVisible()` helper, deploy code before migration |
| Visibility Extension | CHECK constraint on TEXT column | Moderate | Verify DEFAULT compatibility, test on staging |
| Community Detection | Quadratic CROSS JOIN for graph build | **Critical** | KNN via HNSW index, O(N*K) not O(N^2) |
| Community Detection | Sparse graph -> meaningless communities | **Critical** | Min threshold 20 skills, quality validator, category seeds |
| Community Detection | Disconnected communities from Louvain | Moderate | Post-process with connected-component split |
| Community Detection | Cron saturates Ollama | Moderate | Use pre-computed embeddings only |
| Community Detection | New tables missing tenant isolation | Moderate | Table creation checklist, integrity check |
| Community Detection | Stale community summaries | Minor | Hash-based staleness tracking |
| Adaptive Routing | Search quality regression from routing | **Critical** | Additive boost, golden test set, confidence threshold |
| Adaptive Routing | Short query misclassification | Moderate | Confidence threshold 0.6, parallel standard search |
| Temporal Tracking | Migration corrupts version history | **Critical** | Separate history table, chain-correct backfill, staging first |
| Temporal Tracking | btree_gist extension missing | Moderate | Pre-migration ops task (pgvector pattern) |
| Temporal Tracking | Drizzle ORM can't handle tstzrange | Moderate | Raw SQL migrations and queries, Drizzle schema for SELECT only |
| Temporal Tracking | Migration runner vs CONCURRENTLY | Moderate | Use non-concurrent indexes, split migrations |
| Multi-Model | SDK bundle bloat (~19 MB) | Moderate | Vercel AI SDK or lazy-loading, provider registry |
| Multi-Model | Cross-provider benchmark comparability | Moderate | Multi-judge, provider-reported tokens, confidence intervals |
| Multi-Model | API key management across 3 envs | Minor | `validateProviderConfig()`, optional keys |
| Multi-Model | RAGAS evaluation cost | Moderate | Optional metrics, batching, cheaper judge |
| All phases | Comprehensive tests required, infrastructure missing | Moderate | Test infrastructure first |
| All phases | New tables missing RLS/tenant_id | Moderate | Checklist + automated integrity check |

---

## Recommended Phase Ordering Based on Risk

1. **Test Infrastructure** (prerequisite, low risk) -- Vitest for packages/db, fixtures, patterns. Required by all phases.
2. **Visibility Extension** (highest touch count, 15+ files) -- Most files affected, must be first. Others depend on new values.
3. **Community Detection** (foundational for routing, high algorithmic risk) -- Graph build, detection, quality validation. Must validate before routing.
4. **Adaptive Routing** (depends on #3, search regression risk) -- Search integration with fallback, golden test set.
5. **Temporal Tracking** (independent, complex migration) -- Schema, history table, temporal queries. Parallel-safe with #4.
6. **Multi-Model Support** (independent, moderate risk) -- Provider abstraction, SDK, benchmarks. Parallel-safe with #5.

---

## Sources

### Codebase Analysis (HIGH confidence)
- `packages/db/src/lib/visibility.ts` -- 34 lines, buildVisibilityFilter + visibilitySQL
- `packages/db/src/services/hybrid-search.ts` -- RRF k=60, FULL OUTER JOIN, lines 36-78
- `apps/web/lib/similar-skills.ts` -- threshold 0.35 at line 56, 6 visibility call sites
- `apps/web/lib/benchmark-runner.ts` -- Anthropic-only, 316 lines, hardcoded provider at 218/251
- `packages/db/src/services/pricing.ts` -- ANTHROPIC_PRICING, 14 models, null for unknown at line 74
- `packages/db/src/migrate.ts` -- sql.begin() transaction at line 56, _applied_migrations tracking
- `packages/db/src/client.ts` -- DEFAULT_TENANT_ID, connection-level tenant at line 41
- `packages/db/src/schema/skill-versions.ts` -- sequential versioning, createdAt only
- `apps/web/lib/ollama.ts` -- 5-second timeout at line 23
- `apps/web/lib/trending.ts:55`, `leaderboard.ts:59`, `portfolio-queries.ts:80,82,197,230`, `resume-queries.ts:71` -- inline visibility
- `packages/db/package.json:22` -- `test: "echo 'No unit tests yet' && exit 0"`
- `.planning/phases/40-visibility-scoping/40-VERIFICATION.md` -- Phase 40 visibility audit

### External (MEDIUM-HIGH confidence)
- [Graphology communities-louvain](https://graphology.github.io/standard-library/communities-louvain.html) -- API, resolution parameter
- [From Louvain to Leiden (Traag et al., 2019)](https://www.nature.com/articles/s41598-019-41695-z) -- disconnected community problem
- [PostgreSQL 16 Range Types](https://www.postgresql.org/docs/16/rangetypes.html) -- tstzrange, GiST indexing
- [PostgreSQL btree_gist](https://www.postgresql.org/docs/current/btree-gist.html) -- exclusion constraint requirements
- [NearForm temporal_tables](https://github.com/nearform/temporal_tables) -- trigger-based history tables
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) -- unified provider abstraction
- [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai) -- same SDK, different baseURL
- [OpenAI npm (7.3 MB)](https://www.npmjs.com/package/openai), [@google/genai npm (11.6 MB)](https://www.npmjs.com/package/@google/genai) -- bundle sizes
- [Drizzle ORM enum migration issues](https://github.com/drizzle-team/drizzle-orm/issues/4295) -- DEFAULT value conflicts
- [Community detection survey (arXiv 2309.11798)](https://arxiv.org/html/2309.11798v4) -- sparsity, resolution limit
- [Louvain algorithm (Neo4j)](https://neo4j.com/docs/graph-data-science/current/algorithms/louvain/) -- small graph behavior
