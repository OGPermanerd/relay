# Phase 45: Hybrid Search & Discovery - Research

**Researched:** 2026-02-13
**Domain:** Hybrid retrieval (pgvector semantic + tsvector full-text), RRF merging, search UX
**Confidence:** HIGH

## Summary

This phase adds natural-language skill discovery by combining the two search systems that **already exist** in the codebase: PostgreSQL tsvector full-text search (used by `searchSkills()`) and pgvector semantic similarity search (used by `semanticSearchSkills()`). The core technical challenge is merging results from both retrieval methods via Reciprocal Rank Fusion (RRF), displaying top-3 ranked results with match rationale, and integrating user preference boosts.

The codebase is well-positioned for this work. The `skills` table already has a `search_vector tsvector` generated column with a GIN index (`skills_search_idx`). The `skill_embeddings` table has an HNSW index on cosine distance (`skill_embeddings_hnsw_idx`). The missing piece is that **zero embeddings exist** in the database (0 rows in `skill_embeddings` despite 145 published skills). The Ollama server is running with `nomic-embed-text` available, and a `VOYAGE_API_KEY` is configured but unused. Before hybrid search can work, embeddings must be backfilled for all existing skills.

**Primary recommendation:** Implement RRF as a SQL function combining two CTEs (full-text + semantic), backfill embeddings via a one-time script using the existing Ollama infrastructure, and build a new `/api/discover` route that returns top-3 results with match rationale. Use the existing `SearchWithDropdown` component pattern as the base, enhanced with a dedicated discovery UI for results with rationale cards.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| drizzle-orm | 0.42.0 | SQL query builder with pgvector support | Installed, used throughout |
| pgvector | (PostgreSQL extension) | Vector similarity search | Installed, HNSW index exists |
| PostgreSQL tsvector | (built-in) | Full-text search | Active, GIN index exists |
| @anthropic-ai/sdk | ^0.72.1 | AI API calls (Claude) | Installed, used for AI reviews |
| nuqs | (installed) | URL state management for search params | Used in SearchWithDropdown |

### Supporting (Already Available)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| Ollama (nomic-embed-text) | Local embedding generation (768 dims) | Query embedding at search time + backfill |
| voyageai (NOT installed) | Voyage AI embeddings (512/1024 dims) | Only if switching from Ollama — DO NOT switch |

### No New Dependencies Needed
The hybrid search implementation requires zero new npm packages. Everything needed is already in the stack:
- `drizzle-orm` for SQL queries (including raw SQL via `db.execute(sql\`...\`)`)
- Existing Ollama client (`apps/web/lib/ollama.ts`) for embedding generation
- Existing visibility filters (`packages/db/src/lib/visibility.ts`)
- Existing user preferences service (`packages/db/src/services/user-preferences.ts`)

## Current Search Architecture

### What Exists

**1. Full-Text Search** (`apps/web/lib/search-skills.ts`)
- `skills.search_vector` is a `tsvector` GENERATED ALWAYS column: `setweight(to_tsvector('english', name), 'A') || setweight(to_tsvector('english', description), 'B')`
- GIN index: `skills_search_idx` on `search_vector`
- Current search uses `websearch_to_tsquery` + ILIKE fallbacks for name, description, author, tags
- Ranked by `ts_rank()` when query is present
- Supports category, tag, quality tier, and sort filters
- Visibility filtering via `buildVisibilityFilter(userId)`

**2. Semantic Search** (`packages/db/src/services/semantic-search.ts`)
- `skill_embeddings` table with 768-dimension vectors (nomic-embed-text)
- HNSW index: `skill_embeddings_hnsw_idx` using `vector_cosine_ops`
- Uses `cosineDistance()` from drizzle-orm for ordering
- Returns similarity as `1 - cosineDistance`
- Visibility filtering included

**3. Similar Skills** (`apps/web/lib/similar-skills.ts`)
- Uses stored embeddings + Ollama for runtime embedding generation
- Falls back to ILIKE when semantic search unavailable
- Pattern: try semantic first, fall back to keyword

**4. Quick Search** (`apps/web/app/actions/search.ts`)
- Server action calling `searchSkills()`, returns top 10 results
- Powers the `SearchWithDropdown` component on homepage and skills page

**5. Homepage Search** (`apps/web/app/(protected)/page.tsx`)
- `SearchWithDropdown` component in "navigate" mode (submits to `/skills?q=...`)
- Positioned below welcome message, above stats

### What's Missing

| Gap | Impact | Resolution |
|-----|--------|------------|
| Zero embeddings in database | Semantic search returns nothing | Backfill script for all 145 skills |
| No RRF merging logic | Can't combine full-text + semantic | New SQL function/query |
| No query embedding at search time | Can't do semantic search on user queries | Generate embedding from query text via Ollama |
| No match rationale generation | Can't show WHY a result matched | Compute and return match type + score |
| No preference boost integration | PREF-03 not satisfied | Weight RRF scores by user preferred categories |
| No dedicated discovery UI | Only dropdown exists, no rich result cards | New discovery results component |

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
  app/
    actions/
      discover.ts              # NEW: Server action for hybrid search
    (protected)/
      page.tsx                  # MODIFY: Enhanced search bar or discovery section
  components/
    discovery-results.tsx       # NEW: Top-3 result cards with rationale
    discovery-search.tsx        # NEW: Discovery search bar (or enhance SearchWithDropdown)
  lib/
    hybrid-search.ts            # NEW: RRF merging logic + orchestration

packages/db/
  src/
    services/
      hybrid-search.ts          # NEW: SQL-level hybrid search with RRF
    scripts/
      backfill-embeddings.ts    # NEW: One-time script to embed all skills
```

### Pattern 1: Reciprocal Rank Fusion via SQL CTEs

**What:** Two CTEs (full-text + semantic) joined with RRF scoring
**When to use:** Every hybrid search query
**Example:**

```sql
-- Source: Supabase hybrid search docs + Jonathan Katz pgvector article
WITH full_text AS (
  SELECT
    s.id,
    s.name,
    s.slug,
    s.description,
    s.category,
    s.total_uses,
    s.average_rating,
    s.author_id,
    row_number() OVER (
      ORDER BY ts_rank(s.search_vector, websearch_to_tsquery('english', $1)) DESC
    ) AS rank_ix
  FROM skills s
  WHERE s.search_vector @@ websearch_to_tsquery('english', $1)
    AND s.status = 'published'
    AND (visibility = 'tenant' OR (visibility = 'personal' AND author_id = $2))
  LIMIT 20
),
semantic AS (
  SELECT
    s.id,
    s.name,
    s.slug,
    s.description,
    s.category,
    s.total_uses,
    s.average_rating,
    s.author_id,
    row_number() OVER (
      ORDER BY se.embedding <=> $3::vector
    ) AS rank_ix
  FROM skill_embeddings se
  JOIN skills s ON s.id = se.skill_id
  WHERE s.status = 'published'
    AND (s.visibility = 'tenant' OR (s.visibility = 'personal' AND s.author_id = $2))
  LIMIT 20
)
SELECT
  COALESCE(ft.id, sm.id) AS id,
  COALESCE(ft.name, sm.name) AS name,
  COALESCE(ft.slug, sm.slug) AS slug,
  COALESCE(ft.description, sm.description) AS description,
  COALESCE(ft.category, sm.category) AS category,
  COALESCE(ft.total_uses, sm.total_uses) AS total_uses,
  COALESCE(ft.average_rating, sm.average_rating) AS average_rating,
  ft.rank_ix AS ft_rank,
  sm.rank_ix AS sm_rank,
  COALESCE(1.0 / (60 + ft.rank_ix), 0.0) * 1.0 +
  COALESCE(1.0 / (60 + sm.rank_ix), 0.0) * 1.0 AS rrf_score
FROM full_text ft
FULL OUTER JOIN semantic sm ON ft.id = sm.id
ORDER BY rrf_score DESC
LIMIT 3;
```

**Key parameters:**
- `k = 60` is the standard RRF constant (industry standard, used by Elasticsearch, OpenSearch, Azure)
- `LIMIT 20` on each CTE to avoid scanning entire tables
- `FULL OUTER JOIN` ensures results from either method are included
- Weights (both 1.0 here) can be adjusted for preference boosts

### Pattern 2: Match Rationale Generation

**What:** Return WHY each result matched (keyword match, semantic similarity, or both)
**When to use:** Every discovery result

```typescript
interface DiscoveryResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  matchRationale: string;        // Human-readable explanation
  matchTypes: ('keyword' | 'semantic' | 'both')[];
  rrfScore: number;
  ftRank: number | null;         // null = not in full-text results
  smRank: number | null;         // null = not in semantic results
}

function generateRationale(result: {
  ftRank: number | null;
  smRank: number | null;
  query: string;
  category: string;
}): string {
  if (result.ftRank && result.smRank) {
    return `Matches your search terms and is semantically related to "${result.query}"`;
  }
  if (result.ftRank) {
    return `Contains keywords matching "${result.query}"`;
  }
  return `Semantically similar to what you're looking for`;
}
```

### Pattern 3: Preference Boost via Category Weighting

**What:** Multiply RRF score by a boost factor for user's preferred categories
**When to use:** When user has preferredCategories set in their preferences

```typescript
// After RRF scoring, apply preference boost
const PREFERENCE_BOOST = 1.3; // 30% boost for preferred categories

function applyPreferenceBoost(
  results: DiscoveryResult[],
  preferredCategories: string[]
): DiscoveryResult[] {
  if (preferredCategories.length === 0) return results;

  return results
    .map(r => ({
      ...r,
      rrfScore: preferredCategories.includes(r.category)
        ? r.rrfScore * PREFERENCE_BOOST
        : r.rrfScore,
    }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}
```

### Pattern 4: Graceful Fallback (DISC-04)

**What:** When semantic search fails or returns nothing, fall back to full-text only
**When to use:** When Ollama is down, embeddings don't exist, or query is too short

```typescript
async function hybridSearch(query: string, userId?: string): Promise<DiscoveryResult[]> {
  // 1. Try to generate query embedding
  const queryEmbedding = await generateEmbedding(query, {
    url: settings.ollamaUrl,
    model: settings.ollamaModel,
  });

  // 2. If embedding generation fails, fall back to keyword-only
  if (!queryEmbedding) {
    return keywordOnlySearch(query, userId);
  }

  // 3. Run hybrid RRF query
  const results = await hybridRRFQuery(query, queryEmbedding, userId);

  // 4. If hybrid returns nothing, try keyword-only
  if (results.length === 0) {
    return keywordOnlySearch(query, userId);
  }

  return results;
}
```

### Anti-Patterns to Avoid

- **Score normalization instead of RRF:** Do NOT try to normalize ts_rank and cosine similarity to the same scale. RRF exists precisely because score normalization is fragile and breaks across different query types.
- **Generating embeddings on every keystroke:** The query embedding should only be generated on form submit (discovery search), NOT on every character typed. The existing quick-search dropdown should remain keyword-only for speed.
- **Blocking on embedding generation:** If Ollama is slow or down, search must still work. Always wrap embedding generation in a try/catch with fallback.
- **Using Voyage AI for query-time embeddings:** The stored embeddings use nomic-embed-text (768 dims). Query embeddings MUST use the same model. Mixing models produces meaningless cosine distances.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector similarity | Custom distance functions | pgvector `<=>` operator + HNSW index | Optimized C implementation, index-accelerated |
| Full-text search | Custom tokenizer/stemmer | PostgreSQL tsvector + websearch_to_tsquery | Handles stemming, stop words, phrase matching |
| Result merging | Custom score normalization | RRF formula `1/(k+rank)` | Scale-independent, well-studied, industry standard |
| Embedding generation | Custom model hosting | Ollama with nomic-embed-text (already running) | Zero-config, already integrated |
| Visibility filtering | Custom ACL system | Existing `buildVisibilityFilter()` / `visibilitySQL()` | Already battle-tested in both query-builder and raw SQL |

**Key insight:** Both search backends already exist with proper indexes. The only new code is the merging layer (RRF) and the UI.

## Common Pitfalls

### Pitfall 1: Empty Embeddings Table
**What goes wrong:** Semantic search returns nothing because `skill_embeddings` has 0 rows.
**Why it happens:** The embedding generation is fire-and-forget and gated behind `semanticSimilarityEnabled` site setting, which has no row in `site_settings`.
**How to avoid:** Run a one-time backfill script that: (1) creates a site_settings row with semanticSimilarityEnabled=true, (2) generates embeddings for all 145 published skills via Ollama.
**Warning signs:** Hybrid search only ever returns keyword results.

### Pitfall 2: Dimension Mismatch
**What goes wrong:** `ERROR: different vector dimensions 1024 and 768`
**Why it happens:** Schema defines `vector(768)` for nomic-embed-text. If someone switches to Voyage AI (512 or 1024 dims) without migrating the schema, inserts fail.
**How to avoid:** Keep using nomic-embed-text (768 dims) which matches the existing schema. Do NOT switch embedding models without a migration.
**Warning signs:** Embedding upserts throwing dimension mismatch errors.

### Pitfall 3: Ollama Timeout on Query Embedding
**What goes wrong:** Search takes 5+ seconds because Ollama model needs to load into memory (cold start).
**Why it happens:** Ollama evicts models from memory after inactivity. First query after idle period triggers model load (~2-3s for nomic-embed-text).
**How to avoid:** Set reasonable timeout (current 5s is OK), always have keyword fallback. Consider a warm-up ping on server start.
**Warning signs:** First search of the day is slow, subsequent searches are fast.

### Pitfall 4: RRF Constant Too Small
**What goes wrong:** Top-1 result dominates so heavily that position-2+ results get negligible scores.
**Why it happens:** With k=1, the score for rank 1 is 0.5, rank 2 is 0.33 (33% drop). With k=60, rank 1 is 0.0164, rank 2 is 0.0161 (2% drop).
**How to avoid:** Use k=60 (industry standard). This smooths the distribution so that multiple sources contribute meaningfully.
**Warning signs:** Results are identical to just one of the two search methods.

### Pitfall 5: Streaming Overengineering
**What goes wrong:** Building complex streaming infrastructure (Vercel AI SDK, SSE, etc.) for what is essentially a database query.
**Why it happens:** DISC-06 says "loading state with streaming feedback" but the actual search takes <500ms.
**How to avoid:** Use a simple server action with React `useTransition` for the loading state. Show a skeleton/spinner during the search. "Streaming feedback" means showing partial UI (e.g., "Searching keywords..." then "Analyzing meaning..."), not actual token streaming.
**Warning signs:** Installing `ai` package or building SSE endpoints for a database query.

### Pitfall 6: N+1 Embedding Generation
**What goes wrong:** Backfill script sends 145 concurrent requests to Ollama, overwhelming it.
**Why it happens:** Naive `Promise.all(skills.map(skill => generateEmbedding(...)))`.
**How to avoid:** Process skills sequentially or in small batches (5-10 at a time). Ollama is single-threaded for inference.
**Warning signs:** Ollama OOM or timeout errors during backfill.

## Code Examples

### Existing: Generating an Embedding (Ollama)
```typescript
// Source: apps/web/lib/ollama.ts
import { generateEmbedding } from "./ollama";

const embedding = await generateEmbedding("search query text", {
  url: "http://localhost:11434",   // from site_settings.ollamaUrl
  model: "nomic-embed-text",       // from site_settings.ollamaModel
});
// Returns number[] (768 dimensions) or null on failure
```

### Existing: Visibility Filter (Raw SQL)
```typescript
// Source: packages/db/src/lib/visibility.ts
import { visibilitySQL } from "@everyskill/db/lib/visibility";

// In raw SQL template:
sql`... AND ${visibilitySQL(userId)} ...`
// Expands to: (visibility = 'tenant' OR (visibility = 'personal' AND author_id = $userId))
```

### Existing: Full-Text Search Ranking
```typescript
// Source: apps/web/lib/search-skills.ts (line 186-190)
filteredQuery.orderBy(
  sql`ts_rank(${skills.searchVector}, websearch_to_tsquery('english', ${params.query})) DESC`
);
```

### Existing: Cosine Distance (Semantic)
```typescript
// Source: packages/db/src/services/semantic-search.ts
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
const distance = cosineDistance(skillEmbeddings.embedding, vectorStr);
// Results ordered by distance (ascending = most similar)
// Similarity = 1 - distance
```

### New: Hybrid Search SQL (RRF)
```sql
-- Recommended implementation for packages/db/src/services/hybrid-search.ts
-- Uses CTE approach from Supabase docs + Jonathan Katz pgvector article
WITH full_text AS (
  SELECT s.id, s.name, s.slug, s.description, s.category,
         s.total_uses, s.average_rating, s.author_id,
         row_number() OVER (
           ORDER BY ts_rank(s.search_vector, websearch_to_tsquery('english', ${query})) DESC
         ) AS rank_ix
  FROM skills s
  WHERE s.search_vector @@ websearch_to_tsquery('english', ${query})
    AND s.status = 'published'
    AND ${visibilitySQL(userId)}
  ORDER BY rank_ix
  LIMIT 20
),
semantic AS (
  SELECT s.id, s.name, s.slug, s.description, s.category,
         s.total_uses, s.average_rating, s.author_id,
         row_number() OVER (
           ORDER BY se.embedding <=> ${vectorStr}::vector
         ) AS rank_ix
  FROM skill_embeddings se
  JOIN skills s ON s.id = se.skill_id
  WHERE s.status = 'published'
    AND ${visibilitySQL(userId)}
  ORDER BY rank_ix
  LIMIT 20
)
SELECT
  COALESCE(ft.id, sm.id) AS id,
  COALESCE(ft.name, sm.name) AS name,
  COALESCE(ft.slug, sm.slug) AS slug,
  COALESCE(ft.description, sm.description) AS description,
  COALESCE(ft.category, sm.category) AS category,
  COALESCE(ft.total_uses, sm.total_uses) AS total_uses,
  COALESCE(ft.average_rating, sm.average_rating) AS average_rating,
  COALESCE(ft.author_id, sm.author_id) AS author_id,
  ft.rank_ix AS ft_rank,
  sm.rank_ix AS sm_rank,
  COALESCE(1.0 / (60 + ft.rank_ix), 0.0) +
  COALESCE(1.0 / (60 + sm.rank_ix), 0.0) AS rrf_score
FROM full_text ft
FULL OUTER JOIN semantic sm ON ft.id = sm.id
ORDER BY rrf_score DESC
LIMIT 10;
```

### New: Backfill Script Pattern
```typescript
// packages/db/src/scripts/backfill-embeddings.ts
import { db, skills } from "../index";
import { eq } from "drizzle-orm";

const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";
const OLLAMA_URL = "http://localhost:11434";
const MODEL = "nomic-embed-text";
const BATCH_SIZE = 5;

async function backfill() {
  const allSkills = await db
    .select({ id: skills.id, name: skills.name, description: skills.description })
    .from(skills)
    .where(eq(skills.status, "published"));

  console.log(`Backfilling ${allSkills.length} skills...`);

  for (let i = 0; i < allSkills.length; i += BATCH_SIZE) {
    const batch = allSkills.slice(i, i + BATCH_SIZE);
    for (const skill of batch) {
      const text = `${skill.name} ${skill.description}`;
      // Generate embedding via Ollama
      // Upsert into skill_embeddings
    }
    console.log(`Processed ${Math.min(i + BATCH_SIZE, allSkills.length)}/${allSkills.length}`);
  }
}
```

## Schema Changes Needed

### No DDL Changes Required
The existing schema already has everything needed:
- `skills.search_vector tsvector` with GIN index -- DONE
- `skill_embeddings.embedding vector(768)` with HNSW index -- DONE
- Both tables have tenant_id and RLS policies -- DONE

### Data Changes Required
1. **Insert site_settings row** with `semantic_similarity_enabled = true`
2. **Backfill all 145 skill embeddings** via Ollama nomic-embed-text

## Streaming / Loading UI Approach

**Do NOT use Vercel AI SDK or SSE.** The project has no `ai` package installed, and adding it for a database query is over-engineering.

**Recommended approach:**

1. **Server Action** (`apps/web/app/actions/discover.ts`) — standard async server action
2. **Client-side useTransition** — for loading state management
3. **Progressive UI feedback** — skeleton cards that fill in when results arrive:
   - Immediately show 3 skeleton result cards
   - When server action returns, swap skeletons for real results
   - If search takes >500ms (Ollama cold start), show a "Searching..." message
4. **No actual streaming** — the entire search (embedding generation + SQL query) completes in one round-trip, typically <500ms

```typescript
// Client component pattern
const [isPending, startTransition] = useTransition();
const [results, setResults] = useState<DiscoveryResult[]>([]);

function handleSearch(query: string) {
  startTransition(async () => {
    const data = await discoverSkills(query);
    setResults(data);
  });
}

// In JSX: isPending ? <SkeletonCards /> : <ResultCards results={results} />
```

## Preference Boost Integration

User preferences are stored in `user_preferences.preferences` JSONB with `preferredCategories: string[]`.

**Integration point:** After RRF scoring, apply a multiplicative boost to results matching preferred categories:

```typescript
const prefs = await getOrCreateUserPreferences(userId, tenantId);
const preferred = prefs?.preferredCategories || [];

// Post-RRF boost: preferred categories get 1.3x score multiplier
const boosted = results.map(r => ({
  ...r,
  rrfScore: preferred.includes(r.category) ? r.rrfScore * 1.3 : r.rrfScore,
  isBoosted: preferred.includes(r.category),
}));
boosted.sort((a, b) => b.rrfScore - a.rrfScore);
```

This keeps the SQL query clean and makes the boost logic testable in TypeScript.

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `packages/db/src/services/hybrid-search.ts` | SQL-level hybrid RRF query |
| `apps/web/lib/hybrid-search.ts` | Orchestration: embedding + RRF + preference boost + rationale |
| `apps/web/app/actions/discover.ts` | Server action for discovery search |
| `apps/web/components/discovery-results.tsx` | Top-3 result cards with match rationale |
| `packages/db/src/scripts/backfill-embeddings.ts` | One-time embedding backfill script |

### Modified Files
| File | Change |
|------|--------|
| `apps/web/app/(protected)/page.tsx` | Add discovery search section or enhance existing search |
| `apps/web/components/search-with-dropdown.tsx` | Possibly add "discover" mode alongside "navigate" and "filter" |
| `packages/db/src/services/index.ts` | Export new hybrid-search service |

## Plan Structure Recommendation

### Plan 01: Embedding Backfill (prerequisite)
- Create site_settings row enabling semantic similarity
- Write backfill script for 145 skills
- Run backfill, verify embeddings exist
- **Must complete before Plans 02-03 can test properly**

### Plan 02: Hybrid Search Backend
- Create `packages/db/src/services/hybrid-search.ts` with RRF SQL query
- Create `apps/web/lib/hybrid-search.ts` orchestration layer (embedding + RRF + fallback + preference boost)
- Create `apps/web/app/actions/discover.ts` server action
- Test: verify hybrid results merge correctly, fallback works when Ollama is down

### Plan 03: Discovery UI
- Create `apps/web/components/discovery-results.tsx` with result cards + rationale
- Enhance homepage search experience (prominent search bar, result display area)
- Add loading states (skeleton cards during search)
- Wire up preference boosts with visual indicator
- Test: verify end-to-end flow with Playwright

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Score normalization (min-max) | RRF rank fusion | 2023-2024 | Eliminates scale mismatch between retrieval methods |
| Separate keyword + vector endpoints | Single hybrid query | 2024-2025 | One round-trip, simpler client code |
| External rerankers (Cohere, Voyage) | RRF in SQL | 2024-2025 | No external API dependency, lower latency |
| Client-side result merging | Server-side SQL merge | Always better | Avoids sending N results to client for merging |

## Open Questions

1. **Discovery vs. Enhanced Search**
   - What we know: DISC-01 says "prominent search bar on the homepage". A search bar already exists.
   - What's unclear: Should this REPLACE the existing search bar, or be a second "discovery" search that shows rich result cards? The existing search navigates to `/skills?q=...`.
   - Recommendation: Enhance the existing homepage search to show inline top-3 discovery results below the search bar BEFORE navigating. On Enter/submit, navigate to full results. This gives both quick discovery and full search.

2. **Embedding Backfill Durability**
   - What we know: 145 skills need embeddings. Ollama processes ~2-3 per second.
   - What's unclear: Should new skills auto-generate embeddings (requires enabling `semanticSimilarityEnabled`)?
   - Recommendation: Yes. Enable the setting and the existing `generateSkillEmbedding()` fire-and-forget in skill creation will handle new skills automatically.

3. **Match Rationale Depth**
   - What we know: DISC-02 says "match rationale for each" result.
   - What's unclear: Simple labels ("keyword match", "semantic match") vs. AI-generated explanations (calling Claude for rationale).
   - Recommendation: Use computed rationale based on which CTE contributed the result (no AI call). AI-generated rationale would add ~2s latency per search and cost money. The match type + score is sufficient rationale.

## Sources

### Primary (HIGH confidence)
- `apps/web/lib/search-skills.ts` — Current full-text search implementation (read directly)
- `packages/db/src/services/semantic-search.ts` — Current semantic search implementation (read directly)
- `packages/db/src/schema/skills.ts` — tsvector generated column + GIN index (read directly)
- `packages/db/src/schema/skill-embeddings.ts` — vector(768) + HNSW index (read directly)
- `apps/web/lib/ollama.ts` — Ollama embedding client (read directly)
- `apps/web/lib/similar-skills.ts` — Existing hybrid fallback pattern (read directly)
- Database inspection — 145 published skills, 0 embeddings, no site_settings row (queried directly)
- Ollama API — nomic-embed-text model available, service active (verified directly)

### Secondary (MEDIUM confidence)
- Supabase hybrid search docs — RRF SQL function pattern (https://supabase.com/docs/guides/ai/hybrid-search)
- Jonathan Katz pgvector hybrid search — CTE + UNION ALL approach (https://jkatz05.com/post/postgres/hybrid-search-postgres-pgvector/)
- OpenSearch RRF blog — k=60 industry standard (https://opensearch.org/blog/introducing-reciprocal-rank-fusion-hybrid-search/)
- Microsoft Azure hybrid search docs — RRF formula verification (https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking)

### Tertiary (LOW confidence)
- None — all findings verified against codebase or authoritative sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in codebase
- Architecture: HIGH — RRF pattern well-documented, both search backends verified working
- Pitfalls: HIGH — identified from direct codebase inspection (empty embeddings, dimension constraints)
- Streaming approach: HIGH — verified no AI SDK installed, confirmed simple server action is appropriate

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable — core PostgreSQL + pgvector patterns, no fast-moving dependencies)
