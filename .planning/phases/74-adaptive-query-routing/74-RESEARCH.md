# Phase 74: Adaptive Query Routing - Research

**Researched:** 2026-02-16
**Domain:** Search query classification and retrieval strategy routing
**Confidence:** HIGH

## Summary

This phase adds a query classification layer that inspects each search query before execution and routes it to the optimal retrieval strategy: keyword-only (fast, skips embedding), semantic-only, hybrid (RRF fusion), or browse (no query, category/filter browsing). The current codebase already has all three retrieval backends implemented (`keywordSearchSkills`, `hybridSearchSkills`, `semanticSearchSkills`) plus the main `searchSkills` function which always runs full-text search and then supplements with semantic results. The gap is that there is no classification step -- every query with text triggers the full pipeline including embedding generation.

The `search_queries` table already has a `searchType` column (text, NOT NULL) that stores the *entry point* ("discover", "quick", "browse"). This is separate from the *route* concept. A new `routeType` column should be added to track which retrieval strategy was actually used, keeping `searchType` for entry-point tracking.

**Primary recommendation:** Build a pure-function `classifyQuery()` that returns a route type based on heuristics (word count, character patterns, question markers), then modify the three search entry points (skills page, quick search, discover) to call the classifier and dispatch to the appropriate retrieval function, logging the route type alongside the existing search type.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Database queries, schema, migrations | Already in use project-wide |
| Next.js | 16.1.6 | Server actions, page rendering | Already in use |
| PostgreSQL | 16+ | Full-text search (tsvector), pgvector | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nuqs | (installed) | URL query state for search params | Already used in search components |
| Ollama | local | Embedding generation | Only for semantic/hybrid routes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rule-based classifier | ML/LLM classifier | Rule-based is instant (0ms), handles 90%+ correctly, no API cost. LLM adds latency per query. |
| New `routeType` column | Overload existing `searchType` | Separate columns preserve entry-point analytics while adding route analytics |

**Installation:** No new packages needed. All infrastructure exists.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/lib/
  query-classifier.ts        # Pure function: classifyQuery(query) => RouteType
  search-router.ts           # Dispatcher: routeSearch(query, params) => results
  search-skills.ts           # MODIFIED: delegate to search-router instead of inline logic
packages/db/src/
  schema/search-queries.ts   # MODIFIED: add routeType column
  services/search-analytics.ts # MODIFIED: accept routeType, add route breakdown queries
  services/hybrid-search.ts  # UNCHANGED
  services/semantic-search.ts # UNCHANGED
  services/search-skills.ts  # UNCHANGED (MCP path)
  migrations/0042_add_route_type.sql  # New migration
```

### Pattern 1: Query Classifier (Pure Function)
**What:** A synchronous function that analyzes query text and returns a route type.
**When to use:** Before every search execution.
**Example:**
```typescript
// apps/web/lib/query-classifier.ts

export type RouteType = "keyword" | "semantic" | "hybrid" | "browse";

export interface ClassificationResult {
  routeType: RouteType;
  confidence: number; // 0-1, for analytics/debugging
  reason: string;     // Human-readable explanation
}

/**
 * Classify a search query into a retrieval route.
 *
 * Rules (applied in order):
 * 1. Empty/whitespace-only query => "browse"
 * 2. Single word matching common skill name patterns => "keyword"
 * 3. 1-2 words, all alphanumeric (no question words) => "keyword"
 * 4. Contains question words (how, what, why, etc.) => "semantic"
 * 5. Natural language (3+ words with prepositions/articles) => "hybrid"
 * 6. Default => "hybrid"
 */
export function classifyQuery(query: string): ClassificationResult {
  const trimmed = query.trim();

  // Rule 1: No query = browse
  if (!trimmed) {
    return { routeType: "browse", confidence: 1.0, reason: "empty query" };
  }

  const words = trimmed.split(/\s+/);
  const wordCount = words.length;
  const lower = trimmed.toLowerCase();

  // Rule 2: Single word — almost always a keyword lookup
  if (wordCount === 1) {
    return { routeType: "keyword", confidence: 0.95, reason: "single word" };
  }

  // Rule 3: Two words, no question markers — likely a name/category search
  const questionWords = new Set(["how", "what", "why", "when", "where", "which", "can", "does", "is", "are", "should"]);
  const hasQuestionWord = words.some(w => questionWords.has(w.toLowerCase()));

  if (wordCount === 2 && !hasQuestionWord) {
    return { routeType: "keyword", confidence: 0.85, reason: "two-word keyword" };
  }

  // Rule 4: Question pattern — semantic search excels here
  if (hasQuestionWord || lower.endsWith("?")) {
    return { routeType: "semantic", confidence: 0.8, reason: "question pattern" };
  }

  // Rule 5: Natural language (3+ words) — hybrid for best coverage
  const nlMarkers = new Set(["for", "to", "with", "in", "a", "the", "that", "and", "or", "of"]);
  const hasNLMarker = words.some(w => nlMarkers.has(w.toLowerCase()));

  if (wordCount >= 3 && hasNLMarker) {
    return { routeType: "hybrid", confidence: 0.8, reason: "natural language phrase" };
  }

  // Rule 6: 3+ words but no NL markers — could be multi-word skill name
  if (wordCount <= 3) {
    return { routeType: "keyword", confidence: 0.7, reason: "short multi-word, no NL markers" };
  }

  // Default: hybrid (safest for unknown patterns)
  return { routeType: "hybrid", confidence: 0.6, reason: "default fallback" };
}
```

### Pattern 2: Search Router (Dispatcher with Fallback)
**What:** A function that takes the classified route and dispatches to the appropriate search backend, with automatic fallback.
**When to use:** Replaces the inline logic in `searchSkills()` and `discoverSkills()`.
**Example:**
```typescript
// apps/web/lib/search-router.ts

import { classifyQuery, type RouteType } from "./query-classifier";

export interface RouteResult<T> {
  results: T[];
  routeType: RouteType;
  fellBack: boolean;     // true if keyword returned 0 and we fell back to hybrid
  classificationReason: string;
}

export async function routeSearch(
  query: string,
  params: SearchParams
): Promise<RouteResult<SearchSkillResult>> {
  const classification = classifyQuery(query);
  let results: SearchSkillResult[];
  let fellBack = false;

  switch (classification.routeType) {
    case "browse":
      results = await browseSkills(params);
      break;

    case "keyword":
      results = await keywordSearch(query, params);
      // ROUTE-04: Fallback if keyword returns nothing
      if (results.length === 0) {
        results = await hybridSearch(query, params);
        fellBack = true;
      }
      break;

    case "semantic":
      results = await semanticSearch(query, params);
      // Fallback to hybrid if semantic returns nothing
      if (results.length === 0) {
        results = await hybridSearch(query, params);
        fellBack = true;
      }
      break;

    case "hybrid":
    default:
      results = await hybridSearch(query, params);
      break;
  }

  return {
    results,
    routeType: fellBack ? "hybrid" : classification.routeType,
    fellBack,
    classificationReason: classification.reason,
  };
}
```

### Pattern 3: Schema Migration for Route Tracking
**What:** Add a `route_type` column to `search_queries` table.
**Example:**
```sql
-- 0042_add_route_type.sql
ALTER TABLE search_queries ADD COLUMN route_type text;
-- Backfill existing rows (all were hybrid by default)
UPDATE search_queries SET route_type = 'hybrid' WHERE route_type IS NULL;
-- Make NOT NULL after backfill
ALTER TABLE search_queries ALTER COLUMN route_type SET NOT NULL;
ALTER TABLE search_queries ALTER COLUMN route_type SET DEFAULT 'hybrid';
-- Index for analytics queries
CREATE INDEX search_queries_route_type_idx ON search_queries (route_type);
```

### Anti-Patterns to Avoid
- **Over-engineering the classifier:** Do NOT use ML models, LLMs, or external APIs for classification. A simple rule-based function handles 90%+ of cases instantly. Accuracy improvement from ML does not justify the latency and complexity cost.
- **Modifying retrieval backends:** The existing `hybridSearchSkills()`, `keywordSearchSkills()`, and `semanticSearchSkills()` are proven and correct. The router should *compose* them, not modify them.
- **Removing the existing searchSkills():** Multiple callers depend on `apps/web/lib/search-skills.ts`. Refactor it to use the router internally rather than replacing it.
- **Logging route_type without search_type:** Both dimensions are useful for analytics. Entry point (how the user searched) and route (how we fulfilled it) are orthogonal concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | Custom text matching | PostgreSQL `tsvector` + `websearch_to_tsquery` | Already implemented, handles stemming, ranking, stop words |
| Vector similarity | Custom distance functions | pgvector `<=>` operator with HNSW index | Already indexed, hardware-accelerated |
| RRF fusion | Custom score merging | Existing `hybridSearchSkills()` RRF implementation | k=60 industry standard, already tested |
| Embedding generation | Custom API client | Existing `generateEmbedding()` via Ollama | Handles timeouts, error cases |

**Key insight:** All retrieval backends already exist and are battle-tested. This phase is purely about the classification/routing layer on top of them, plus analytics.

## Common Pitfalls

### Pitfall 1: Breaking the Skills Page Sort Order
**What goes wrong:** The skills page supports `sortBy` parameter (uses, quality, rating, days_saved). Routing a query to keyword-only search might lose the sort behavior.
**Why it happens:** `keywordSearchSkills()` in `hybrid-search.ts` sorts by ts_rank, not by the user's selected sort. The main `searchSkills()` has explicit sort handling.
**How to avoid:** When `sortBy` is specified, use the existing `searchSkills()` path which handles all sort modes. Only apply routing optimization when no explicit sort is specified (ts_rank is the natural sort for keyword).
**Warning signs:** Sort dropdown on skills page has no effect after routing change.

### Pitfall 2: Double Embedding Generation
**What goes wrong:** If the router calls `hybridSearch` as a fallback after keyword returns 0 results, and the hybrid path generates an embedding, this is fine. But if the original route was "semantic" and falls back to "hybrid", the embedding is generated twice.
**Why it happens:** `hybridSearchSkills()` requires `queryEmbedding` as a parameter, and `semanticSearchSkills()` also requires it. If semantic fails and we fall back, we already have the embedding.
**How to avoid:** Generate the embedding once at the router level and pass it down. The router should handle embedding generation for any route that needs it, then pass the pre-computed embedding to the retrieval function.
**Warning signs:** Doubled Ollama API calls in logs for single searches.

### Pitfall 3: MCP Search Bypass
**What goes wrong:** The MCP search tool (`apps/mcp/src/tools/search.ts`) uses `searchSkillsByQuery()` directly from `packages/db`, completely bypassing the web app's search flow. Adding routing only to the web app means MCP searches are never classified.
**Why it happens:** MCP is a separate app with its own search path.
**How to avoid:** Either: (a) accept that MCP always uses keyword search (it's already ILIKE-based), or (b) move the classifier to `packages/db` so both apps can use it. Recommendation: (a) for this phase -- MCP's ILIKE search is already effectively keyword-only and appropriate for its use case.
**Warning signs:** MCP search performance not improved after routing change.

### Pitfall 4: Semantic Search Requires Site Settings Check
**What goes wrong:** Semantic search depends on `getSiteSettings()?.semanticSimilarityEnabled`. If disabled, semantic and hybrid routes silently degrade. The classifier doesn't know about this.
**Why it happens:** The classifier is a pure function that doesn't check external state.
**How to avoid:** The router (not the classifier) should check whether semantic search is available. If disabled, downgrade "semantic" and "hybrid" routes to "keyword". Log the actual route used, not the classified route.
**Warning signs:** Route logged as "semantic" but results are empty because Ollama is down.

### Pitfall 5: Losing ILIKE Fallback in Keyword Route
**What goes wrong:** The current `searchSkills()` in `search-skills.ts` uses both `tsvector @@ websearch_to_tsquery` AND ILIKE matching on name, description, author, and tags. The `keywordSearchSkills()` in `hybrid-search.ts` also includes ILIKE fallback. But `searchSkillsByQuery()` in `search-skills.ts` (the MCP version) uses only ILIKE. Different code paths have different matching behavior.
**Why it happens:** Three different "keyword search" implementations exist with different matching strategies.
**How to avoid:** For the keyword route, use the `keywordSearchSkills()` from `hybrid-search.ts` which combines tsvector + ILIKE. This is the most robust keyword implementation.
**Warning signs:** Keyword route misses results that the old combined search would have found.

### Pitfall 6: Migration Numbering Collision
**What goes wrong:** Migration files are sequentially numbered (0000-0041). Adding 0042 could collide with another concurrent phase.
**Why it happens:** Multiple phases developed in parallel.
**How to avoid:** Check the latest migration number at implementation time. Currently 0041 is the latest.
**Warning signs:** `pnpm db:migrate` fails with duplicate or out-of-order migration error.

## Code Examples

### Current Search Flow (Skills Page)
```typescript
// apps/web/app/(protected)/skills/page.tsx
// Currently: searchSkills() always runs full-text + semantic supplement
const skills = await searchSkills({ query, sortBy, authorId, categories, userId });
// Then logs with searchType: "browse"
logSearchQuery({ ...entry, searchType: "browse" });
```

### Current Search Flow (Quick Search)
```typescript
// apps/web/app/actions/search.ts
// Currently: searchSkills() always runs full pipeline
const results = await searchSkills({ query: query.trim(), userId });
// Then logs with searchType: "quick"
logSearchQuery({ ...entry, searchType: "quick" });
```

### Current Search Flow (Discover)
```typescript
// apps/web/app/actions/discover.ts
// Currently: tries hybrid first, falls back to keyword if Ollama unavailable
if (queryEmbedding) {
  rawResults = await hybridSearchSkills({ query, queryEmbedding, userId, limit });
  if (rawResults.length === 0) {
    rawResults = await keywordSearchSkills({ query, userId, limit });
  }
} else {
  rawResults = await keywordSearchSkills({ query, userId, limit });
}
logSearchQuery({ ...entry, searchType: "discover" });
```

### Target Search Flow (After Routing)
```typescript
// apps/web/lib/search-router.ts (NEW)
// Route based on query classification
const classification = classifyQuery(query);
let routeType = classification.routeType;

switch (routeType) {
  case "keyword":
    results = await keywordSearchSkills({ query, userId, limit });
    if (results.length === 0) {
      // ROUTE-04: automatic fallback
      results = await hybridSearchSkills({ query, queryEmbedding: await getEmbedding(query), userId, limit });
      routeType = "hybrid"; // log the actual route used
    }
    break;
  case "hybrid":
    results = await hybridSearchSkills({ query, queryEmbedding: await getEmbedding(query), userId, limit });
    break;
  // ...
}

// Log with BOTH searchType (entry point) and routeType (retrieval strategy)
logSearchQuery({ ...entry, searchType: "browse", routeType });
```

### SearchQueryEntry Interface Update
```typescript
// packages/db/src/services/search-analytics.ts
export interface SearchQueryEntry {
  tenantId: string;
  userId: string | null;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  searchType: string;    // EXISTING: "discover" | "quick" | "browse"
  routeType: string;     // NEW: "keyword" | "semantic" | "hybrid" | "browse"
}
```

### Admin Search Analytics Enhancement
```typescript
// packages/db/src/services/search-analytics.ts
// New query: route type breakdown
export async function getRouteTypeBreakdown(tenantId: string, since: Date) {
  return db
    .select({
      routeType: searchQueries.routeType,
      count: sql<number>`count(*)::int`,
      avgResults: sql<number>`round(avg(${searchQueries.resultCount}))::int`,
    })
    .from(searchQueries)
    .where(and(
      eq(searchQueries.tenantId, tenantId),
      gte(searchQueries.createdAt, since)
    ))
    .groupBy(searchQueries.routeType);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Always hybrid for every query | Route to appropriate strategy | This phase | Keyword queries skip embedding (50-200ms savings) |
| Only entry-point logging | Entry-point + route logging | This phase | Analytics can show which strategies are used |
| No fallback awareness | Explicit fallback with logging | This phase | Zero-result queries auto-recover |

**Current approach in codebase:**
- `searchSkills()` (skills page, quick search): Always runs full-text + semantic supplement. Every query generates an embedding via Ollama.
- `discoverSkills()`: Tries hybrid, falls back to keyword if Ollama unavailable. This is the closest to adaptive routing but the "adaptation" is based on Ollama availability, not query characteristics.
- `searchSkillsByQuery()` (MCP): Always ILIKE-only. Already effectively keyword-routed.

## Open Questions

1. **Should the classifier live in `packages/db` or `apps/web/lib`?**
   - What we know: The classifier is a pure function with no DB or API dependencies. MCP currently uses its own search path.
   - What's unclear: Whether MCP will ever need classification.
   - Recommendation: Put it in `apps/web/lib` for now. If MCP needs it later, move to `packages/db/src/lib`. Keep it dependency-free so moving is trivial.

2. **Should the `routeType` column be nullable or NOT NULL with backfill?**
   - What we know: Existing rows have no route_type. The migration needs to handle them.
   - What's unclear: Whether backfilling all existing rows as "hybrid" is misleading (the old search was actually full-text + semantic supplement, not true RRF hybrid).
   - Recommendation: Backfill as "hybrid" since the old behavior was closest to hybrid (text + semantic). Make NOT NULL after backfill.

3. **Should the skills page `searchSkills()` be refactored or wrapped?**
   - What we know: `searchSkills()` in `apps/web/lib/search-skills.ts` has complex sort logic, quality tier filtering, and semantic supplementing. It's called from the skills page and quick search.
   - What's unclear: Whether to refactor its internals or create a wrapper that routes first and delegates.
   - Recommendation: Create a `routedSearchSkills()` wrapper that handles classification and routing, then delegates to appropriate backend. Keep the original `searchSkills()` as-is for backward compatibility during transition. Once all callers are migrated, the original can be deprecated.

4. **Performance baseline -- how much time does embedding generation actually add?**
   - What we know: Ollama embedding has a 5-second timeout. Typical latency is 50-200ms on local GPU.
   - What's unclear: Exact p50/p95 latency without measuring.
   - Recommendation: Not critical for planning. The optimization is clearly directional -- skipping embedding for "excel" is obviously faster than generating one.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - direct reading of all search-related files:
  - `apps/web/lib/search-skills.ts` - main search function (skills page, quick search)
  - `apps/web/app/actions/discover.ts` - discover action with hybrid/keyword routing
  - `apps/web/app/actions/search.ts` - quick search action
  - `packages/db/src/services/hybrid-search.ts` - RRF hybrid + keyword-only backend
  - `packages/db/src/services/semantic-search.ts` - pure semantic backend
  - `packages/db/src/services/search-skills.ts` - MCP ILIKE backend
  - `packages/db/src/services/search-analytics.ts` - logging and analytics queries
  - `packages/db/src/schema/search-queries.ts` - search_queries table schema
  - `packages/db/src/schema/skills.ts` - skills table with tsvector
  - `packages/db/src/schema/skill-embeddings.ts` - pgvector embeddings
  - `apps/web/lib/ollama.ts` - embedding generation
  - `apps/web/app/(protected)/skills/page.tsx` - skills page (consumer)
  - `apps/web/app/(protected)/admin/search/page.tsx` - search analytics dashboard
  - `apps/web/components/admin-search-table.tsx` - analytics UI component
  - `apps/mcp/src/tools/search.ts` - MCP search handler

### Secondary (MEDIUM confidence)
- Query classification heuristics based on information retrieval research patterns (word count, question words, NL markers) -- well-established approach

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all infrastructure already exists in codebase, no new dependencies
- Architecture: HIGH - clear separation of classifier (pure function), router (dispatcher), backends (existing), and analytics (schema + queries)
- Pitfalls: HIGH - identified through direct code reading of all 4 search paths and their differences
- Classification rules: MEDIUM - heuristics are well-understood but thresholds need tuning with real query data

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no external dependencies changing)
