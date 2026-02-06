# Phase 24: Extended MCP Search - Research

**Researched:** 2026-02-06
**Domain:** PostgreSQL search (ILIKE, full-text, embedding fallback) across Drizzle ORM
**Confidence:** HIGH

## Summary

Phase 24 upgrades MCP search to match the same fields as web search: author names and tags in addition to skill title/description. The web search (`apps/web/lib/search-skills.ts`) already matches all four fields using SQL ILIKE + full-text search. The MCP search, however, exists in **two separate implementations** that both use in-memory filtering on only name and description.

The core work is creating a shared search service in `packages/db/src/services/` that uses SQL (ILIKE + JOINs) to match author names and tags, then replacing the in-memory filtering in both MCP search locations. The embedding fallback (when ILIKE returns fewer than 3 results) is optional since the MCP app currently has no Voyage AI dependency and `VOYAGE_API_KEY` may not be set in MCP environments.

**Primary recommendation:** Create a `searchSkills` service function in `packages/db/src/services/search-skills.ts` that performs the SQL-based search (matching name, description, author, tags with ILIKE and field-weighted scoring). Update all three search locations (MCP stdio, web remote MCP, web search) to use or align with this shared service.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.38.0 | SQL query builder | Already used across all db services |
| postgres | ^3.4.0 | PostgreSQL driver | Already the project's Postgres client |
| @relay/db | workspace:* | Shared DB package | Central place for schemas, services, and relations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| voyageai | ^0.1.0 | Embedding generation | Only for embedding fallback (devDep in db package) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared DB service | Inline SQL in each MCP tool | Duplicates logic across 3 locations; harder to maintain consistency |
| ILIKE matching | Full-text search only | Full-text search misses substring/prefix matches; ILIKE catches those |
| In-memory author/tag matching | SQL JOIN-based matching | In-memory requires fetching ALL skills + ALL users; SQL scales better |

**Installation:** No new packages needed. All dependencies already exist.

## Architecture Patterns

### Current State: Three Search Implementations

```
apps/
  mcp/src/tools/search.ts           # MCP stdio: in-memory name+desc only
  web/app/api/mcp/[transport]/route.ts  # Web remote MCP: in-memory name+desc only
  web/lib/search-skills.ts          # Web search: SQL ILIKE+FTS, matches ALL fields
```

### Target State: Shared Service + Thin Callers

```
packages/db/src/services/
  search-skills.ts                   # NEW: shared SQL search (ILIKE + JOIN)

apps/
  mcp/src/tools/search.ts           # Calls shared service
  web/app/api/mcp/[transport]/route.ts  # Calls shared service
  web/lib/search-skills.ts          # Refactored to call shared service (or aligned)
```

### Pattern 1: Shared DB Service Function
**What:** A service function in `packages/db/src/services/` that encapsulates the search SQL
**When to use:** When multiple apps need the same database query logic
**Why:** The MCP app already imports and calls DB services (e.g., `validateApiKey`, `incrementSkillUses`). This is the established pattern.

```typescript
// packages/db/src/services/search-skills.ts
import { db } from "../client";
import { skills } from "../schema";
import { users } from "../schema";
import { sql, eq, and } from "drizzle-orm";

export interface SearchSkillsParams {
  query: string;
  category?: string;
  limit?: number;
}

export interface SearchSkillResult {
  id: string;
  name: string;
  description: string;
  category: string;
  hoursSaved: number | null;
}

export async function searchSkillsByQuery(
  params: SearchSkillsParams
): Promise<SearchSkillResult[]> {
  if (!db) return [];

  const { query, category, limit = 50 } = params;
  const conditions = [];
  const likePattern = `%${query}%`;

  // Match against name, description, author name, and tags (ILIKE)
  conditions.push(
    sql`(
      ${skills.name} ILIKE ${likePattern}
      OR ${skills.description} ILIKE ${likePattern}
      OR ${users.name} ILIKE ${likePattern}
      OR array_to_string(${skills.tags}, ' ') ILIKE ${likePattern}
    )`
  );

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      category: skills.category,
      hoursSaved: skills.hoursSaved,
    })
    .from(skills)
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(and(...conditions))
    .limit(limit);

  return results;
}
```

### Pattern 2: Field-Weighted Scoring with SQL CASE
**What:** Use SQL CASE expressions to assign weights to different field matches
**When to use:** When results need relevance ranking beyond simple match/no-match
**Why:** Decisions specify title > description > author > tags priority with blended scoring

```typescript
// Scoring expression: title match = 4, description = 3, author = 2, tags = 1
const scoreSql = sql<number>`
  (CASE WHEN ${skills.name} ILIKE ${likePattern} THEN 4 ELSE 0 END) +
  (CASE WHEN ${skills.description} ILIKE ${likePattern} THEN 3 ELSE 0 END) +
  (CASE WHEN ${users.name} ILIKE ${likePattern} THEN 2 ELSE 0 END) +
  (CASE WHEN array_to_string(${skills.tags}, ' ') ILIKE ${likePattern} THEN 1 ELSE 0 END)
`;

// Order by score DESC for blended ranking
const results = await db
  .select({ id: skills.id, name: skills.name, /* ... */ score: scoreSql })
  .from(skills)
  .leftJoin(users, eq(skills.authorId, users.id))
  .where(and(...conditions))
  .orderBy(sql`${scoreSql} DESC`)
  .limit(limit);
```

### Pattern 3: Embedding Fallback (< 3 ILIKE Results)
**What:** When ILIKE returns fewer than 3 results, fall back to cosine similarity search
**When to use:** Only when `findSimilarSkills` is available and embeddings are populated
**Constraint:** Requires `generateEmbedding()` which needs `VOYAGE_API_KEY`. MCP stdio does NOT have this key.

**Recommendation:** Make embedding fallback opt-in. The shared service accepts an optional `queryEmbedding` parameter. Callers that have embedding capability (web) pass it; callers that don't (MCP stdio) skip it.

```typescript
export async function searchSkillsByQuery(
  params: SearchSkillsParams & { queryEmbedding?: number[] }
): Promise<SearchSkillResult[]> {
  // 1. Run ILIKE search
  const ilikeResults = await runIlikeSearch(params);

  // 2. If fewer than 3 results and embedding provided, try semantic search
  if (ilikeResults.length < 3 && params.queryEmbedding) {
    const semanticResults = await findSimilarSkills(params.queryEmbedding, {
      limit: params.limit ?? 50,
      threshold: 0.5,
    });
    // Merge and deduplicate
    return mergeResults(ilikeResults, semanticResults, params.limit ?? 50);
  }

  return ilikeResults;
}
```

### Anti-Patterns to Avoid
- **Fetching all skills to memory:** Current MCP approach (`db.query.skills.findMany()` then `.filter()`) fetches ALL skills every search. With 45+ skills and growing, this is wasteful and cannot scale. Use SQL WHERE clauses instead.
- **Duplicating search logic inline:** The web remote MCP route (`apps/web/app/api/mcp/[transport]/route.ts`) has an entirely separate copy of the search logic. Use the shared service.
- **Including drizzle-orm operators directly in MCP app code:** The original MCP tools avoided drizzle-orm imports due to "TypeScript module resolution issues." The correct fix is to put the SQL in `packages/db/src/services/` where drizzle-orm imports work fine, and call the service function from MCP tools.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL parameterization | String concatenation for LIKE patterns | Drizzle's `sql` template tag | SQL injection prevention, automatic escaping |
| Cosine similarity search | Manual vector math | `cosineDistance` from drizzle-orm + pgvector | Already implemented in `skill-embeddings.ts` |
| Result deduplication | Custom dedup logic | Simple `Map` by skill ID | Semantic results may overlap with ILIKE results |

**Key insight:** The web search (`search-skills.ts`) already has the correct SQL query. The task is extracting/sharing it, not inventing something new.

## Common Pitfalls

### Pitfall 1: TypeScript Module Resolution in MCP App
**What goes wrong:** Importing `sql`, `eq`, `and` from `drizzle-orm` in `apps/mcp/src/` fails or causes build issues
**Why it happens:** The MCP app uses `tsup` for building (`tsup src/index.ts --format cjs --dts`) and `moduleResolution: NodeNext`. Previous developers avoided drizzle-orm imports in MCP tool code for this reason.
**How to avoid:** Put ALL drizzle-orm SQL logic in `packages/db/src/services/` where it compiles fine. MCP tools call the service function via `@relay/db` (or `@relay/db/services/search-skills`). This matches the existing pattern (`validateApiKey`, `incrementSkillUses`).
**Warning signs:** If you see `import { sql } from "drizzle-orm"` in `apps/mcp/src/`, it will likely break the build.

### Pitfall 2: Three Search Locations, Not Two
**What goes wrong:** Updating MCP stdio search but forgetting the web remote MCP search
**Why it happens:** The web remote MCP route (`apps/web/app/api/mcp/[transport]/route.ts`) has its own inline copy of search_skills tool logic. It's easy to miss.
**How to avoid:** Update all THREE search locations:
1. `apps/mcp/src/tools/search.ts` (MCP stdio)
2. `apps/web/app/api/mcp/[transport]/route.ts` (web remote MCP, search_skills handler ~lines 161-229)
3. `apps/web/lib/search-skills.ts` (web search - may need alignment)
**Warning signs:** One search returns author matches, another doesn't.

### Pitfall 3: LEFT JOIN vs INNER JOIN for Author
**What goes wrong:** Using INNER JOIN causes skills without an author to disappear from results
**Why it happens:** `skills.authorId` can be null. Some skills may not have an author.
**How to avoid:** Use `LEFT JOIN` for the users table, as the web search already does.
**Warning signs:** Skills with `authorId = null` missing from search results.

### Pitfall 4: Array-to-String for Tags Matching
**What goes wrong:** Using `@>` (array contains) requires exact tag match. ILIKE on `array_to_string` allows partial tag matching.
**Why it happens:** Decisions specify partial matching: "auto" matches tag "automation"
**How to avoid:** Use `array_to_string(skills.tags, ' ') ILIKE ${likePattern}` as the web search already does.
**Warning signs:** Searching "auto" doesn't find skills tagged "automation".

### Pitfall 5: ILIKE SQL Injection via Special Characters
**What goes wrong:** User input containing `%` or `_` characters produces unexpected results
**Why it happens:** `%` and `_` are ILIKE wildcards. A query like "50%" would match everything.
**How to avoid:** Escape `%` and `_` in user input before wrapping with `%...%`. Use a helper:
```typescript
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}
const likePattern = `%${escapeLike(query)}%`;
```
**Warning signs:** The web search currently does NOT escape these characters either, so this is an existing issue. Fix it in the shared service.

### Pitfall 6: Embedding Fallback Unavailable in MCP Stdio
**What goes wrong:** Embedding fallback requires `VOYAGE_API_KEY` which the MCP stdio app doesn't have
**Why it happens:** The MCP stdio app runs locally, configured only with `RELAY_API_KEY` and `DATABASE_URL`. Voyage AI is a web app concern.
**How to avoid:** Make the embedding fallback opt-in. The service function works with ILIKE-only by default. Only callers with embedding access (web) pass the optional `queryEmbedding` parameter.
**Warning signs:** MCP search crashes trying to call Voyage AI without an API key.

### Pitfall 7: Test Mock Updates
**What goes wrong:** MCP tests break because the mock structure doesn't match the new service-based approach
**Why it happens:** Current tests mock `db.query.skills.findMany` for in-memory filtering. The new service uses `db.select().from().leftJoin().where()` which is a different mock shape.
**How to avoid:** Mock the service function itself rather than the raw db calls. Add the new service to `apps/mcp/test/setup.ts` mocks.
**Warning signs:** All MCP search tests fail after refactor.

## Code Examples

### Shared Search Service (Recommended Implementation)

```typescript
// packages/db/src/services/search-skills.ts
import { sql, eq, and } from "drizzle-orm";
import { db } from "../client";
import { skills } from "../schema/skills";
import { users } from "../schema/users";

export interface SearchSkillsParams {
  query: string;
  category?: string;
  limit?: number;
}

export interface SearchSkillResult {
  id: string;
  name: string;
  description: string;
  category: string;
  hoursSaved: number | null;
}

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Search skills by query, matching name, description, author name, and tags.
 * Uses ILIKE for case-insensitive partial matching.
 * Results ordered by field-weighted relevance score.
 */
export async function searchSkillsByQuery(
  params: SearchSkillsParams
): Promise<SearchSkillResult[]> {
  if (!db) return [];

  const { query, category, limit = 50 } = params;
  const likePattern = `%${escapeLike(query)}%`;

  const conditions = [
    sql`(
      ${skills.name} ILIKE ${likePattern}
      OR ${skills.description} ILIKE ${likePattern}
      OR ${users.name} ILIKE ${likePattern}
      OR array_to_string(${skills.tags}, ' ') ILIKE ${likePattern}
    )`,
  ];

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  // Field-weighted scoring: title(4) > description(3) > author(2) > tags(1)
  const scoreSql = sql`
    (CASE WHEN ${skills.name} ILIKE ${likePattern} THEN 4 ELSE 0 END) +
    (CASE WHEN ${skills.description} ILIKE ${likePattern} THEN 3 ELSE 0 END) +
    (CASE WHEN ${users.name} ILIKE ${likePattern} THEN 2 ELSE 0 END) +
    (CASE WHEN array_to_string(${skills.tags}, ' ') ILIKE ${likePattern} THEN 1 ELSE 0 END)
  `;

  return db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      category: skills.category,
      hoursSaved: skills.hoursSaved,
    })
    .from(skills)
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(and(...conditions))
    .orderBy(sql`${scoreSql} DESC`)
    .limit(limit);
}
```

### Updating MCP Stdio Search Tool

```typescript
// apps/mcp/src/tools/search.ts - AFTER refactor
import { searchSkillsByQuery } from "@relay/db/services/search-skills";

export async function handleSearchSkills({
  query, category, limit, userId, skipNudge,
}: { query: string; category?: string; limit: number; userId?: string; skipNudge?: boolean; }) {
  const results = await searchSkillsByQuery({ query, category, limit });

  // ... rest of nudge/tracking logic unchanged
  await trackUsage({
    toolName: "search_skills",
    userId,
    metadata: { query, category, resultCount: results.length },
  });

  return { content: [{ type: "text" as const, text: JSON.stringify({ query, count: results.length, skills: results }, null, 2) }] };
}
```

### Updating Web Remote MCP Search

```typescript
// apps/web/app/api/mcp/[transport]/route.ts - search_skills handler
// Replace the inline in-memory search with:
import { searchSkillsByQuery } from "@relay/db/services/search-skills";

// Inside the search_skills handler:
const results = await searchSkillsByQuery({ query, category, limit });
```

### Updating MCP Test Mocks

```typescript
// apps/mcp/test/setup.ts - add service mock
vi.mock("@relay/db/services/search-skills", () => ({
  searchSkillsByQuery: vi.fn(),
}));
```

### Updating Tool Description

```typescript
// Both MCP stdio and web remote MCP
description: "Search for skills in the Relay marketplace by query. Matches against name, description, author name, and tags.",
inputSchema: {
  query: z.string().min(1).describe("Search query (matches name, description, author, tags)"),
  // ...
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory fetch-all + filter | SQL ILIKE with JOINs | Phase 24 | Scales to large skill sets; matches more fields |
| Name+description only (MCP) | Name+description+author+tags | Phase 24 | Feature parity with web search |
| Duplicated search in 3 places | Shared service in packages/db | Phase 24 | Single source of truth for search logic |

**Deprecated/outdated:**
- `db.query.skills.findMany()` + in-memory `.filter()` for search: Replace with SQL-based service call

## Open Questions

1. **Embedding fallback for web remote MCP**
   - What we know: The web remote MCP route runs in Next.js where `VOYAGE_API_KEY` IS available. It could use embedding fallback.
   - What's unclear: Whether the added complexity of embedding fallback is worth it for this phase. The < 3 results threshold is low enough that most searches will just use ILIKE.
   - Recommendation: Implement embedding fallback as a separate, optional enhancement. The shared service should accept an optional `queryEmbedding` parameter. The web search can provide it; MCP stdio cannot. This can be deferred to a future phase if scope is a concern.

2. **Whether to refactor web search to use the shared service**
   - What we know: The web search (`apps/web/lib/search-skills.ts`) has richer features (quality scoring, full-text search, tag filtering, sorting options) beyond what MCP needs.
   - What's unclear: Whether to extract the ILIKE+author+tags part to the shared service and keep the web-specific features (quality, sorting) in the web layer.
   - Recommendation: Keep the web search as-is for now. The shared service serves MCP's simpler needs. Verify that both produce consistent results for author/tag searches. Document this as a future consolidation opportunity.

3. **Result limit: 50 hard cap**
   - What we know: Decisions specify cap at 50. MCP stdio currently allows max 25, web remote MCP has no explicit limit.
   - What's unclear: Whether to raise the MCP stdio max from 25 to 50 to match the hard cap.
   - Recommendation: Update both MCP search_skills tools to allow max 50 to match the decision. The Zod schema change is trivial.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - Direct reading of all source files:
  - `apps/mcp/src/tools/search.ts` - Current MCP stdio search (in-memory, name+desc only)
  - `apps/web/app/api/mcp/[transport]/route.ts` - Web remote MCP search (in-memory, name+desc only)
  - `apps/web/lib/search-skills.ts` - Web search (SQL ILIKE+FTS, matches name+desc+author+tags)
  - `packages/db/src/schema/skills.ts` - Skills schema with tags array, searchVector, authorId FK
  - `packages/db/src/schema/users.ts` - Users schema with name field
  - `packages/db/src/services/skill-embeddings.ts` - Existing embedding/similarity service
  - `packages/db/src/services/index.ts` - Service exports pattern
  - `packages/db/src/client.ts` - Drizzle client with schema+relations
  - `apps/mcp/test/setup.ts` - Test mock structure
  - `apps/mcp/test/tools.test.ts` - Existing MCP test patterns
  - `apps/mcp/package.json` - No direct drizzle-orm dependency
  - `apps/mcp/tsconfig.json` - NodeNext module resolution

### Secondary (MEDIUM confidence)
- Drizzle ORM ^0.38.0 `sql` template tag and `ilike` operator behavior - verified via codebase usage in `apps/web/lib/search-skills.ts`
- PostgreSQL `array_to_string` function for tag matching - verified via codebase usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; all patterns exist in codebase
- Architecture: HIGH - Shared service pattern already established and proven (api-keys, skill-metrics, skill-embeddings)
- Pitfalls: HIGH - All pitfalls identified from direct codebase analysis (TypeScript resolution issue, three search locations, JOIN type, array matching)

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable - internal codebase patterns, no external dependency changes expected)
