# Phase 38: Conversational MCP Discovery - Research

**Researched:** 2026-02-08
**Domain:** MCP tool implementation, pgvector semantic search, Ollama embeddings
**Confidence:** HIGH

## Summary

Phase 38 adds three new MCP tools (`recommend_skills`, `describe_skill`, `guide_skill`) and enhances the existing `search_skills` tool. The codebase already has all foundational infrastructure in place: pgvector extension is enabled, HNSW index exists on `skill_embeddings`, Ollama embedding generation works (`nomic-embed-text`, 768 dimensions, ~130ms latency per call), and Drizzle ORM 0.42.0 provides built-in `cosineDistance()` for vector similarity queries.

The key architectural challenge is that the MCP server (`apps/mcp`) currently does NOT have direct access to the Ollama client or the embedding generation utilities -- those live in `apps/web/lib/ollama.ts`. The MCP server will need either a copied/adapted Ollama client or the existing one needs to be extracted into a shared package. Given the codebase pattern of duplicating small utilities in the MCP app (see `review-skill.ts` duplicating content hashing), copying the minimal `generateEmbedding()` function into the MCP app is the established pattern.

Additionally, there are currently 0 embeddings stored despite 91 published skills. The `recommend_skills` semantic search needs the ILIKE fallback (DISC-05) to work from day one. A one-time backfill of existing published skill embeddings should be planned.

**Primary recommendation:** Add three new tool files following the established pattern (`apps/mcp/src/tools/{recommend,describe,guide}.ts`), create a semantic search service in `packages/db/src/services/`, copy the minimal Ollama embedding function into the MCP app, and enhance search results with richer metadata.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.25.3 | MCP tool registration via `server.registerTool()` | Already used; `McpServer` class |
| `drizzle-orm` | 0.42.0 | Database queries including vector operations | Already used; has `cosineDistance()` built-in |
| `zod` | 3.25.0 | Input schema validation for MCP tools | Already used in all tool registrations |
| `postgres` | 3.4.8 | PostgreSQL driver | Already used via `@everyskill/db` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgvector | (DB extension) | Vector similarity search | Already enabled (`CREATE EXTENSION IF NOT EXISTS vector`) |
| Ollama | nomic-embed-text | 768-dim embeddings | Semantic search query embedding |

### No New Dependencies Required
All libraries are already installed. No new npm packages needed.

## Architecture Patterns

### Recommended Project Structure (Changes Only)
```
apps/mcp/src/
├── tools/
│   ├── recommend.ts       # NEW: recommend_skills tool
│   ├── describe.ts        # NEW: describe_skill tool
│   ├── guide.ts           # NEW: guide_skill tool
│   ├── search.ts          # MODIFIED: enhanced metadata
│   └── index.ts           # MODIFIED: register new tools
├── lib/
│   └── ollama.ts          # NEW: minimal embedding client (copied from apps/web/lib/ollama.ts)
packages/db/src/services/
├── semantic-search.ts     # NEW: vector similarity query service
└── index.ts               # MODIFIED: export new service
```

### Pattern 1: MCP Tool Registration (Established Pattern)
**What:** Each tool gets its own file, exports a handler function (for testability), and registers via `server.registerTool()`.
**When to use:** Every new MCP tool.
**Example:**
```typescript
// Source: apps/mcp/src/tools/search.ts (existing pattern)
import { z } from "zod";
import { server } from "../server.js";

export async function handleRecommendSkills({ query, limit, userId }: {...}) {
  // Business logic here
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

server.registerTool(
  "recommend_skills",
  {
    description: "...",
    inputSchema: {
      query: z.string().min(1).describe("Natural language description of what you need"),
      category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional(),
      limit: z.number().min(1).max(20).default(5),
    },
  },
  async ({ query, category, limit }) =>
    handleRecommendSkills({ query, category, limit, userId: getUserId() ?? undefined })
);
```

### Pattern 2: Semantic Search with ILIKE Fallback (DISC-05)
**What:** Try Ollama embedding first; if unavailable, fall back to existing ILIKE text search.
**When to use:** `recommend_skills` tool (and potentially enhanced `search_skills`).
**Example:**
```typescript
// In packages/db/src/services/semantic-search.ts
import { sql, eq, and } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions";
import { db } from "../client";
import { skills } from "../schema/skills";
import { skillEmbeddings } from "../schema/skill-embeddings";

export async function semanticSearchSkills(params: {
  queryEmbedding: number[];
  limit: number;
  category?: string;
  tenantId?: string;
}): Promise<SemanticSearchResult[]> {
  const { queryEmbedding, limit, category, tenantId } = params;

  // Convert number[] to pgvector string format
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const distance = cosineDistance(skillEmbeddings.embedding, vectorStr);

  const conditions = [eq(skills.status, "published")];
  if (category) conditions.push(eq(skills.category, category));
  if (tenantId) conditions.push(eq(skills.tenantId, tenantId));

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      category: skills.category,
      totalUses: skills.totalUses,
      averageRating: skills.averageRating,
      distance,
    })
    .from(skillEmbeddings)
    .innerJoin(skills, eq(skillEmbeddings.skillId, skills.id))
    .where(and(...conditions))
    .orderBy(distance) // cosineDistance: lower = more similar
    .limit(limit);

  return results;
}
```

### Pattern 3: Rich Skill Detail Query (describe_skill)
**What:** Single query joining skills, skill_reviews, ratings, and computing similar skills.
**When to use:** `describe_skill` tool.
**Example approach:**
```typescript
// Fetch skill with all metadata in a few targeted queries:
// 1. Skill + author + review (one query with JOINs)
// 2. Rating count + distribution (aggregate query)
// 3. Similar skills (vector query on embedding, limited to 3)
// 4. Fork count (existing service: getForkCount)
```

### Pattern 4: Console Output Safety
**What:** MCP server uses stdio transport -- all logging MUST use `console.error`, never `console.log`.
**When to use:** Every file in `apps/mcp/`.
**Existing convention:** Documented in `index.ts` and `auth.ts`.

### Anti-Patterns to Avoid
- **Importing from `apps/web/`:** MCP app must be self-contained. Do NOT import `apps/web/lib/ollama.ts`. Copy the minimal `generateEmbedding()` function.
- **Blocking on Ollama:** Embedding generation must be non-blocking with timeout. The existing Ollama client uses 5s timeout with `AbortController` -- keep this pattern.
- **Fetching all skills to filter in memory:** Some existing tools (`list.ts`, `deploy.ts`) do `db.query.skills.findMany()` then filter in memory. For new tools, prefer SQL-level filtering. The `search-skills.ts` service is the correct pattern.
- **Returning unpublished skills:** DISC-06 requires all queries filter by `status='published'`. Every query MUST include this filter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cosine similarity | Custom SQL operator | `cosineDistance()` from `drizzle-orm/sql/functions` | Built into Drizzle 0.42.0, correct operator mapping |
| Vector type serialization | Manual `[1,2,3]` formatting | Existing `customType` in `skill-embeddings.ts` schema | Already handles toDriver/fromDriver conversion |
| ILIKE text search | New search function | Existing `searchSkillsByQuery()` from `packages/db/src/services/search-skills.ts` | Already handles escaping, scoring, published filter |
| Embedding generation | New Ollama client | Copy minimal `generateEmbedding()` from `apps/web/lib/ollama.ts` | 15 lines, battle-tested, handles timeouts |
| Usage tracking | Custom analytics | Existing `trackUsage()` from `apps/mcp/src/tracking/events.ts` | Already handles tenantId, increments, error swallowing |
| Fork count | Custom query | `getForkCount()` from `packages/db/src/services/skill-forks.ts` | Already exists with published filter |
| Rating formatting | Manual math | `formatRating()` from `packages/db/src/services/skill-metrics.ts` | Converts stored int (450) to "4.5" |
| Auth/nudge pattern | Custom auth check | `getUserId()`, `shouldNudge()`, `incrementAnonymousCount()` from `apps/mcp/src/auth.ts` | Established pattern in all tools |

## Common Pitfalls

### Pitfall 1: No Embeddings Exist Yet
**What goes wrong:** `recommend_skills` returns 0 results because `skill_embeddings` table is empty (confirmed: 0 rows, 91 published skills).
**Why it happens:** Embeddings are only generated on skill creation via `generateSkillEmbedding()`, and the feature requires `semanticSimilarityEnabled: true` in site settings (currently no settings row exists).
**How to avoid:** Plan includes: (1) insert a site_settings row with `semanticSimilarityEnabled: true`, (2) backfill embeddings for all 91 published skills, (3) ILIKE fallback (DISC-05) ensures tool works even with 0 embeddings.
**Warning signs:** Empty results from semantic search while ILIKE search returns matches.

### Pitfall 2: MCP Stdio Protocol Corruption
**What goes wrong:** `console.log()` in MCP tool code corrupts the stdio transport, causing Claude to receive malformed JSON.
**Why it happens:** MCP SDK uses stdout for protocol messages. Any `console.log()` writes to stdout and intermixes with protocol data.
**How to avoid:** Use `console.error()` exclusively. The entire codebase follows this pattern. Add ESLint rule or code review check.
**Warning signs:** "Unexpected token" errors in Claude when using MCP tools.

### Pitfall 3: Drizzle `cosineDistance` Needs String Vector Format
**What goes wrong:** Passing `number[]` directly to `cosineDistance()` may fail depending on the custom type's driver serialization.
**Why it happens:** pgvector expects `[1,2,3]` string format, not a raw array. The `cosineDistance()` function may not auto-convert via the custom type.
**How to avoid:** Pass the query embedding as a formatted string: `[${embedding.join(",")}]`. The schema's `customType` handles column values, but function parameters need manual formatting.
**Warning signs:** SQL errors about invalid vector format.

### Pitfall 4: Site Settings Not Initialized
**What goes wrong:** `getSiteSettings()` returns `null` because no row exists in `site_settings` table (confirmed: 0 rows).
**Why it happens:** Site settings are lazily created only when explicitly set via the admin panel.
**How to avoid:** The MCP `recommend_skills` tool should handle `null` settings gracefully -- either use hardcoded defaults (`http://localhost:11434`, `nomic-embed-text`) or fall back to ILIKE.
**Warning signs:** Semantic search never activates even when Ollama is running.

### Pitfall 5: Embedding Latency Budget
**What goes wrong:** Ollama first-call latency can be ~587ms (cold) vs ~130ms (warm), potentially exceeding the 200ms target mentioned in prior decisions.
**Why it happens:** Model loading on first call, memory allocation.
**How to avoid:** Measure actual latency. Cold start is one-time per session. Warm calls are ~130ms which is within budget. If latency is critical, pre-warm the model on MCP server startup.
**Warning signs:** First `recommend_skills` call takes >500ms but subsequent calls are fast.

### Pitfall 6: Custom Type vs Drizzle Built-in Vector
**What goes wrong:** The codebase uses a custom `vector` type definition in `skill-embeddings.ts`, but Drizzle 0.42.0 has a built-in `vector` column type.
**Why it happens:** The custom type was created before Drizzle added native pgvector support.
**How to avoid:** Do NOT refactor the custom type now -- it works, and the HNSW index depends on it. The `cosineDistance()` function works with both custom and built-in vector types since it operates on SQL-level expressions.
**Warning signs:** Type errors when mixing custom type with Drizzle vector functions.

## Code Examples

### Semantic Search Service
```typescript
// packages/db/src/services/semantic-search.ts
import { sql, eq, and } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions";
import { db } from "../client";
import { skills } from "../schema/skills";
import { skillEmbeddings } from "../schema/skill-embeddings";
import { users } from "../schema/users";

export interface SemanticSearchResult {
  id: string;
  name: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  similarity: number; // 1 - cosineDistance (0-1, higher = more similar)
}

export async function semanticSearchSkills(params: {
  queryEmbedding: number[];
  limit?: number;
  category?: string;
  tenantId?: string;
}): Promise<SemanticSearchResult[]> {
  if (!db) return [];

  const { queryEmbedding, limit = 10, category, tenantId } = params;
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const distance = cosineDistance(skillEmbeddings.embedding, vectorStr);

  const conditions = [eq(skills.status, "published")];
  if (category) conditions.push(eq(skills.category, category));
  if (tenantId) conditions.push(eq(skills.tenantId, tenantId));

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      category: skills.category,
      totalUses: skills.totalUses,
      averageRating: skills.averageRating,
      distance,
    })
    .from(skillEmbeddings)
    .innerJoin(skills, eq(skillEmbeddings.skillId, skills.id))
    .where(and(...conditions))
    .orderBy(distance)
    .limit(limit);

  return results.map(r => ({
    ...r,
    similarity: 1 - Number(r.distance),
    distance: undefined,
  })) as unknown as SemanticSearchResult[];
}
```

### Ollama Client for MCP App
```typescript
// apps/mcp/src/lib/ollama.ts
// Minimal copy from apps/web/lib/ollama.ts -- MCP app must be self-contained

export interface OllamaEmbedConfig {
  url: string;
  model: string;
}

/**
 * Generate an embedding vector via Ollama /api/embed endpoint.
 * Returns null on any failure. Uses 5s timeout.
 * IMPORTANT: Use console.error only (stdio protocol safety).
 */
export async function generateEmbedding(
  text: string,
  config: OllamaEmbedConfig
): Promise<number[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.url}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input: text }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const data = await response.json();
    const embeddings = data?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length === 0) return null;
    return embeddings[0];
  } catch {
    return null;
  }
}
```

### Recommend Skills Tool Pattern
```typescript
// apps/mcp/src/tools/recommend.ts
export async function handleRecommendSkills({
  query, category, limit, userId, skipNudge,
}: { query: string; category?: string; limit: number; userId?: string; skipNudge?: boolean }) {
  const tenantId = getTenantId();

  // 1. Try semantic search
  let results: SearchResult[] = [];
  let searchMethod = "semantic";

  const embedding = await generateEmbedding(query, {
    url: ollamaUrl,  // from site settings or default
    model: ollamaModel,
  });

  if (embedding) {
    results = await semanticSearchSkills({
      queryEmbedding: embedding,
      limit,
      category,
      tenantId: tenantId ?? undefined,
    });
  }

  // 2. Fallback to ILIKE if no embedding or no results
  if (results.length === 0) {
    searchMethod = "text";
    const textResults = await searchSkillsByQuery({
      query, category, limit,
      tenantId: tenantId ?? undefined,
    });
    results = textResults;
  }

  // 3. Return with metadata
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        query,
        searchMethod,
        count: results.length,
        skills: results,
      }, null, 2),
    }],
  };
}
```

### Describe Skill Tool Pattern
```typescript
// apps/mcp/src/tools/describe.ts
// Fetches: skill details + author + review scores + rating stats + similar skills + fork count
// No auth required (public discovery tool)
// MUST filter by status='published'

export async function handleDescribeSkill({ skillId }: { skillId: string }) {
  // 1. Fetch skill with author
  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.status, "published")),
    with: { author: { columns: { id: true, name: true } } },
  });

  // 2. Fetch review if exists
  const review = await getSkillReview(skillId);

  // 3. Fetch rating stats (count + distribution)
  // 4. Get fork count
  const forkCount = await getForkCount(skillId);

  // 5. Find similar skills via embedding (optional)
  // 6. Build comprehensive response
}
```

### Enhanced Search Results (DISC-04)
```typescript
// Enhanced SearchSkillResult interface
export interface EnhancedSearchResult extends SearchSkillResult {
  averageRating: number | null;   // from skills.averageRating (int * 100)
  totalUses: number;               // from skills.totalUses
  qualityTier: string | null;      // derived: "gold" | "silver" | "bronze" | null
}
// Quality tier logic:
// gold: averageRating >= 400 (4.0 stars) AND totalUses >= 10
// silver: averageRating >= 300 (3.0 stars) AND totalUses >= 5
// bronze: averageRating >= 200 (2.0 stars)
// null: insufficient data
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom `vector` column type | Drizzle built-in `vector()` + `cosineDistance()` | Drizzle 0.42.0 | Can use built-in functions, but existing custom type still works |
| Manual pgvector SQL | `cosineDistance()`, `l2Distance()` functions | Drizzle 0.38+ | Clean TypeScript API for vector queries |
| No semantic search in MCP | ILIKE only via `search_skills` | Current state | Phase 38 adds semantic layer |

## Existing Infrastructure Summary

### What Already Exists (No Need to Build)
1. **pgvector extension** - enabled via migration `0001_enable_pgvector.sql`
2. **skill_embeddings table** - schema with 768-dim vector, HNSW index for cosine similarity
3. **Embedding generation** - `apps/web/lib/ollama.ts` with `generateEmbedding()`
4. **Embedding storage** - `upsertSkillEmbedding()` service with upsert on (tenantId, skillId)
5. **ILIKE text search** - `searchSkillsByQuery()` with field-weighted scoring
6. **Skill reviews** - `skill_reviews` table with quality/clarity/completeness JSONB scores
7. **Ratings** - `ratings` table, `averageRating` denormalized on skills
8. **Fork tracking** - `forkedFromId`, `getForkCount()`, `getTopForks()`
9. **Usage tracking** - `trackUsage()` with automatic `totalUses` increment
10. **Ollama** - Running on localhost:11434 with `nomic-embed-text` model loaded
11. **MCP SDK** - v1.25.3 with `server.registerTool()` API
12. **Auth/nudge system** - `getUserId()`, `shouldNudge()`, `getFirstAuthMessage()`

### What Needs to Be Built
1. **Semantic search service** - `packages/db/src/services/semantic-search.ts`
2. **Ollama client copy** - `apps/mcp/src/lib/ollama.ts` (15 lines from web app)
3. **recommend_skills tool** - `apps/mcp/src/tools/recommend.ts`
4. **describe_skill tool** - `apps/mcp/src/tools/describe.ts`
5. **guide_skill tool** - `apps/mcp/src/tools/guide.ts`
6. **Enhanced search_skills** - modify `apps/mcp/src/tools/search.ts` and `searchSkillsByQuery`
7. **Embedding backfill** - one-time script to embed all 91 published skills
8. **Site settings initialization** - ensure `semanticSimilarityEnabled: true` row exists

## Key Technical Decisions

### Ollama Defaults (No Site Settings Row)
The MCP server should use hardcoded defaults when `getSiteSettings()` returns null:
- `ollamaUrl`: `"http://localhost:11434"`
- `ollamaModel`: `"nomic-embed-text"`
- `embeddingDimensions`: `768`

This avoids requiring admin setup for discovery features to work.

### Published-Only Filter (DISC-06)
Every query in every tool MUST include `eq(skills.status, "published")`. This is already done in `search-skills.ts` (line 69) and should be replicated in all new services.

### Authentication Requirements
- `recommend_skills`: No auth required (discovery is public, like `search_skills`)
- `describe_skill`: No auth required (public info about published skills)
- `guide_skill`: No auth required (guidance for installed skills)
- `search_skills` (enhanced): No auth change (already public)

This matches the existing pattern: `search_skills`, `list_skills`, and `deploy_skill` work without auth.

### Embedding Backfill Strategy
Given 91 published skills and ~130ms per embedding call, backfill takes ~12 seconds. This can be:
- A simple script using existing `generateSkillEmbedding()` from `apps/web/lib/embedding-generator.ts`
- Or a DB service that iterates published skills without embeddings

## Open Questions

1. **Quality tier thresholds for DISC-04**
   - What we know: Requirements mention "quality tier" in enhanced search results
   - What's unclear: Exact thresholds for gold/silver/bronze tiers
   - Recommendation: Use reasonable defaults (gold: 4.0+ stars with 10+ uses, silver: 3.0+ with 5+ uses, bronze: 2.0+). These can be tuned later.

2. **guide_skill content source**
   - What we know: DISC-03 says "returns usage guidance and contextual instructions after skill installation"
   - What's unclear: Where does the guidance content come from? The skill's markdown content? A generated summary?
   - Recommendation: Return the skill's `content` (markdown body) plus category-specific generic guidance (e.g., "To use this prompt skill, copy it into your conversation..." for prompt category). No AI generation needed -- keep it deterministic and fast.

3. **Similar skills in describe_skill**
   - What we know: DISC-02 mentions "similar skills" in the response
   - What's unclear: Whether to use embedding similarity or just same-category skills
   - Recommendation: If the skill has an embedding, find 3 nearest neighbors via cosine distance. If no embedding, fall back to same-category skills sorted by rating.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/db/src/schema/skill-embeddings.ts` - custom vector type, HNSW index, 768 dimensions
- Codebase inspection: `apps/web/lib/ollama.ts` - embedding generation, 5s timeout, /api/embed endpoint
- Codebase inspection: `apps/mcp/src/tools/search.ts` - established MCP tool pattern
- Codebase inspection: `packages/db/src/services/search-skills.ts` - ILIKE search with scoring
- Drizzle ORM 0.42.0 source: `drizzle-orm/sql/functions/vector.d.ts` - `cosineDistance()` API confirmed
- Database queries: 0 embeddings, 91 published skills, 0 site_settings rows
- Ollama test: `nomic-embed-text` loaded, ~130ms warm latency, 768 dimensions confirmed

### Secondary (MEDIUM confidence)
- MCP SDK v1.25.3: `server.registerTool()` API with zod schema validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, versions confirmed from package.json
- Architecture: HIGH - following established patterns visible in 9+ existing tool files
- Pitfalls: HIGH - identified through direct codebase inspection and database state verification
- Semantic search: HIGH - Drizzle `cosineDistance()` confirmed in installed 0.42.0 source, HNSW index exists

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable infrastructure, no fast-moving dependencies)
