# Phase 46: Search Analytics - Research

**Researched:** 2026-02-13
**Domain:** Search query logging, analytics dashboard, PostgreSQL aggregation
**Confidence:** HIGH

## Summary

This phase adds search analytics to EverySkill: logging every search query (with result counts) in a fire-and-forget pattern, then surfacing that data on a new admin dashboard page. The codebase already has well-established patterns for all three concerns -- fire-and-forget logging (`writeAuditLog`), schema with tenant isolation (`usage_events`), and admin dashboard pages (`/admin/compliance`, `/admin/skills`).

The implementation is straightforward: a new `search_queries` table, a fire-and-forget `logSearchQuery()` service function, two insertion points in the search actions (`discoverSkills` and `quickSearch`), and one new admin page at `/admin/search` with summary cards and a data table.

**Primary recommendation:** Follow existing patterns exactly. New table with `tenant_id` + RLS policy, fire-and-forget service matching `writeAuditLog`, server component admin page matching `/admin/compliance` pattern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Schema definition, query building | Already used throughout `@everyskill/db` |
| postgres (postgres.js) | Current | SQL execution | Already the DB driver |
| Next.js | 16.1.6 | Server components for admin page | App framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | Current | Admin page styling | All UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated search_queries table | Reuse usage_events table with metadata | Separate table is cleaner -- usage_events tracks MCP tool invocations, not web searches. Different schema needs (query text, result_count, search_type). Separate table avoids polluting existing analytics. |
| Dedicated search_queries table | Reuse audit_logs table | audit_logs has no RLS, is for SOC2 compliance events. Search queries are operational analytics, not audit events. |

## Architecture Patterns

### Search Entry Points (Where Logging Hooks In)

There are **three** distinct search paths, each needing a logging call:

| Entry Point | File | Search Type | Returns |
|---|---|---|---|
| `discoverSkills()` | `apps/web/app/actions/discover.ts` | `"discover"` (semantic/hybrid) | `DiscoveryResult[]` |
| `quickSearch()` | `apps/web/app/actions/search.ts` | `"quick"` (dropdown autocomplete) | `QuickSearchResult[]` |
| `searchSkills()` | `apps/web/lib/search-skills.ts` | `"browse"` (full page search) | `SearchSkillResult[]` |

**Important:** `quickSearch` calls `searchSkills` internally. To avoid double-logging, log at the action level (`quickSearch` and `discoverSkills`) and at the page level (`/skills` page which calls `searchSkills` directly). Do NOT add logging inside `searchSkills()` itself -- it would fire for both quick search and browse, causing duplicates.

**Revised approach:** Actually, the cleanest approach is:
1. Log in `discoverSkills()` -- this is a server action, has session, knows result count
2. Log in `quickSearch()` -- this is a server action, has session, knows result count
3. Log in the `/skills` page server component -- this calls `searchSkills()` directly when `?q=` is present

### Recommended Project Structure

```
packages/db/src/
  schema/
    search-queries.ts          # NEW: table definition
  services/
    search-analytics.ts        # NEW: logSearchQuery() + admin query functions
  schema/index.ts              # ADD: export from search-queries
  services/index.ts            # ADD: export from search-analytics
  relations/index.ts           # ADD: searchQueriesRelations

apps/web/
  app/actions/discover.ts      # MODIFY: add logSearchQuery() call
  app/actions/search.ts        # MODIFY: add logSearchQuery() call
  app/(protected)/skills/page.tsx  # MODIFY: add logSearchQuery() call for ?q= searches
  app/(protected)/admin/
    layout.tsx                 # MODIFY: add "Search" nav item
    search/page.tsx            # NEW: admin search analytics page
  components/
    admin-search-table.tsx     # NEW: client component for search data table
```

### Pattern 1: Fire-and-Forget Logging (from `writeAuditLog`)

**What:** Insert a log row without awaiting in the request path
**When to use:** For all search query logging -- must not add latency to search
**Example:**
```typescript
// Source: packages/db/src/services/audit.ts (existing pattern)
export async function logSearchQuery(entry: SearchQueryEntry): Promise<void> {
  if (!db) return;
  try {
    await db.insert(searchQueries).values(entry);
  } catch (error) {
    console.error("Failed to log search query:", error);
  }
}
```

**Caller pattern (fire-and-forget):**
```typescript
// In server action -- don't await, don't block the response
logSearchQuery({
  tenantId,
  userId: session?.user?.id ?? null,
  query: trimmed,
  resultCount: results.length,
  searchType: "discover",
}).catch(() => {}); // swallow any unhandled rejection

return results;
```

Note: The existing `writeAuditLog` is itself `async` but callers don't `await` it. The `.catch(() => {})` ensures no unhandled promise rejection warnings in stricter Node.js versions.

### Pattern 2: Schema with Tenant Isolation (from `usage_events`)

**What:** Table with `tenant_id` NOT NULL + RLS pgPolicy
**When to use:** All tenant-scoped data tables
**Example:**
```typescript
// Source: packages/db/src/schema/usage-events.ts (existing pattern)
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    // ... columns
  },
  (table) => [
    index("search_queries_tenant_id_idx").on(table.tenantId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Pattern 3: Admin Dashboard Page (from `/admin/compliance`)

**What:** Server component with auth guard, summary cards, data table
**When to use:** Admin-only analytics pages
**Example structure:**
```typescript
// Source: apps/web/app/(protected)/admin/compliance/page.tsx (existing pattern)
export default async function AdminSearchPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    redirect("/");
  }
  const tenantId = session.user.tenantId || DEFAULT_TENANT_ID;
  const data = await getSearchAnalytics(tenantId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1>...</h1>
      {/* Summary cards */}
      {/* Data table component */}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Logging inside `searchSkills()` lib function:** Would double-log for quick search (which calls searchSkills internally). Log at the action/page level instead.
- **Awaiting log writes in the search path:** Must be fire-and-forget. Never `await logSearchQuery()` in the response chain.
- **Storing full result sets:** Only store `resultCount`, not the actual results. Keeps the table small.
- **Complex trending algorithms:** Simple "count in last 7 days" is sufficient for trending. No need for decay functions or time-series databases.

## Schema Design

### `search_queries` Table

```typescript
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id").references(() => users.id),  // nullable for unauthenticated (shouldn't happen but defensive)
    query: text("query").notNull(),                       // the search text
    normalizedQuery: text("normalized_query").notNull(),  // lowercase, trimmed for grouping
    resultCount: integer("result_count").notNull(),        // how many results were returned
    searchType: text("search_type").notNull(),             // "discover" | "quick" | "browse"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("search_queries_tenant_id_idx").on(table.tenantId),
    index("search_queries_created_at_idx").on(table.createdAt),
    index("search_queries_normalized_query_idx").on(table.normalizedQuery),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

**Key design decisions:**
- `normalizedQuery`: Lowercase + trimmed version of `query` for accurate grouping in aggregation queries. Without this, "React Hooks" and "react hooks" would be counted separately.
- `resultCount`: Critical for identifying zero-result queries (skill gaps).
- `searchType`: Distinguishes discover (semantic), quick (dropdown), and browse (full page).
- No `metadata` JSONB column -- keep it simple. If needed later, it can be added.
- `withTimezone: true` on `createdAt` matches the `audit_logs` pattern.

### Migration SQL

```sql
-- 0023_create_search_queries.sql
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT REFERENCES users(id),
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  search_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX search_queries_tenant_id_idx ON search_queries (tenant_id);
CREATE INDEX search_queries_created_at_idx ON search_queries (created_at);
CREATE INDEX search_queries_normalized_query_idx ON search_queries (normalized_query);

ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON search_queries AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

## Admin Dashboard Queries

### Query 1: Top Searched Terms (All Time / Last 30 Days)

```typescript
// Top queries by frequency
const topQueries = await db
  .select({
    query: searchQueries.normalizedQuery,
    searchCount: sql<number>`count(*)::int`,
    avgResults: sql<number>`round(avg(${searchQueries.resultCount}))::int`,
    zeroResultCount: sql<number>`count(*) FILTER (WHERE ${searchQueries.resultCount} = 0)::int`,
    lastSearched: sql<string>`max(${searchQueries.createdAt})::text`,
  })
  .from(searchQueries)
  .where(and(
    eq(searchQueries.tenantId, tenantId),
    gte(searchQueries.createdAt, thirtyDaysAgo)
  ))
  .groupBy(searchQueries.normalizedQuery)
  .orderBy(sql`count(*) DESC`)
  .limit(50);
```

### Query 2: Zero-Result Queries (Skill Gaps)

```typescript
// Queries that ALWAYS return zero results -- these are skill gaps
const zeroResultQueries = await db
  .select({
    query: searchQueries.normalizedQuery,
    searchCount: sql<number>`count(*)::int`,
    lastSearched: sql<string>`max(${searchQueries.createdAt})::text`,
  })
  .from(searchQueries)
  .where(and(
    eq(searchQueries.tenantId, tenantId),
    eq(searchQueries.resultCount, 0),
    gte(searchQueries.createdAt, thirtyDaysAgo)
  ))
  .groupBy(searchQueries.normalizedQuery)
  .orderBy(sql`count(*) DESC`)
  .limit(30);
```

### Query 3: Trending Queries (Last 7 Days, Rising)

```typescript
// Simple trending: most searched in last 7 days
const trendingQueries = await db
  .select({
    query: searchQueries.normalizedQuery,
    searchCount: sql<number>`count(*)::int`,
    uniqueUsers: sql<number>`count(DISTINCT ${searchQueries.userId})::int`,
  })
  .from(searchQueries)
  .where(and(
    eq(searchQueries.tenantId, tenantId),
    gte(searchQueries.createdAt, sevenDaysAgo)
  ))
  .groupBy(searchQueries.normalizedQuery)
  .orderBy(sql`count(*) DESC`)
  .limit(20);
```

### Query 4: Summary Stats (for cards)

```typescript
const stats = await db
  .select({
    totalSearches: sql<number>`count(*)::int`,
    uniqueQueries: sql<number>`count(DISTINCT ${searchQueries.normalizedQuery})::int`,
    zeroResultSearches: sql<number>`count(*) FILTER (WHERE ${searchQueries.resultCount} = 0)::int`,
    uniqueSearchers: sql<number>`count(DISTINCT ${searchQueries.userId})::int`,
  })
  .from(searchQueries)
  .where(and(
    eq(searchQueries.tenantId, tenantId),
    gte(searchQueries.createdAt, thirtyDaysAgo)
  ));
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query normalization | Complex NLP stemming/synonyms | Simple `query.toLowerCase().trim()` | Good enough for grouping. Exact stemming is overkill for admin analytics. |
| Time-series storage | Custom bucketing or separate aggregation tables | Raw rows + SQL aggregation | At EverySkill's scale (tens of thousands of searches/month max), raw rows with indexes are fast enough. Pre-aggregation adds complexity for no benefit. |
| Trending algorithm | Weighted decay, moving averages | Simple "count in last 7 days ordered by count" | Complexity not justified for an internal admin tool. |
| Admin auth guard | Custom middleware | Existing `isAdmin(session)` pattern | Already used by every admin page. |

**Key insight:** This is an internal admin analytics feature, not a user-facing recommendation engine. Simple SQL aggregations on raw event rows are the right approach at this scale.

## Common Pitfalls

### Pitfall 1: Double-Logging Quick Searches
**What goes wrong:** `quickSearch()` calls `searchSkills()` internally. If logging is added to both, every quick search is counted twice.
**Why it happens:** Natural instinct to add logging at the lowest level.
**How to avoid:** Log at the SERVER ACTION level only (`quickSearch`, `discoverSkills`), and at the page level for browse searches. Never inside `searchSkills()` lib function.
**Warning signs:** Search counts much higher than expected; quick search queries appear with both "quick" and "browse" types.

### Pitfall 2: Blocking Search with Log Writes
**What goes wrong:** `await logSearchQuery()` in the response chain adds 5-20ms to every search.
**Why it happens:** Forgetting to make it fire-and-forget.
**How to avoid:** Call `logSearchQuery(...)` without `await`. Add `.catch(() => {})` to suppress unhandled rejections.
**Warning signs:** Search latency increases after deploying analytics.

### Pitfall 3: Missing Tenant ID
**What goes wrong:** `tenantId` is null or undefined, insert fails silently.
**Why it happens:** Some search paths may not have a session.
**How to avoid:** All three search entry points already call `auth()`. Use `session?.user?.tenantId ?? DEFAULT_TENANT_ID` as fallback, matching existing pattern in discover.ts.
**Warning signs:** No search queries being logged despite users searching.

### Pitfall 4: Hydration Mismatch in Admin Table
**What goes wrong:** Date rendering differs between server and client.
**Why it happens:** `toLocaleDateString()` produces different output in Node.js vs browser.
**How to avoid:** Pass dates as ISO strings to client components. Format with manual UTC methods per project convention (see MEMORY.md).
**Warning signs:** React hydration warnings in console.

### Pitfall 5: Forgetting to Export from Index Files
**What goes wrong:** New schema/service not available via `@everyskill/db` import.
**Why it happens:** Drizzle schema and services need explicit re-export in index files.
**How to avoid:** Update all four index files: `schema/index.ts`, `services/index.ts`, `relations/index.ts`, and `packages/db/src/index.ts` (if needed -- services/index.ts and schema/index.ts cover it since they're re-exported).
**Warning signs:** Import errors during build.

## Files to Create/Modify

### New Files
1. `packages/db/src/schema/search-queries.ts` -- Table definition
2. `packages/db/src/services/search-analytics.ts` -- logSearchQuery + admin query functions
3. `packages/db/src/migrations/0023_create_search_queries.sql` -- Migration
4. `apps/web/app/(protected)/admin/search/page.tsx` -- Admin dashboard page
5. `apps/web/components/admin-search-table.tsx` -- Client component for data table

### Modified Files
1. `packages/db/src/schema/index.ts` -- Add `export * from "./search-queries"`
2. `packages/db/src/services/index.ts` -- Add exports from search-analytics
3. `packages/db/src/relations/index.ts` -- Add `searchQueriesRelations`
4. `apps/web/app/actions/discover.ts` -- Add fire-and-forget logSearchQuery call
5. `apps/web/app/actions/search.ts` -- Add fire-and-forget logSearchQuery call
6. `apps/web/app/(protected)/skills/page.tsx` -- Add fire-and-forget logSearchQuery call for ?q= searches
7. `apps/web/app/(protected)/admin/layout.tsx` -- Add "Search" to adminNavItems

## Plan Structure Recommendation

Three plans, two can be parallelized:

### Plan 01: Schema + Migration + Service (no UI dependencies)
- Create `search-queries.ts` schema
- Create `search-analytics.ts` service (logSearchQuery + all query functions)
- Update schema/index.ts, services/index.ts, relations/index.ts exports
- Write and run migration 0023
- **Verification:** `pnpm build` in packages/db, confirm table exists

### Plan 02: Wire Logging into Search Actions (depends on Plan 01)
- Modify `discover.ts` to call logSearchQuery
- Modify `search.ts` to call logSearchQuery
- Modify `/skills/page.tsx` to call logSearchQuery for ?q= searches
- **Verification:** `pnpm build` in apps/web, manual test that searches log rows

### Plan 03: Admin Dashboard Page (depends on Plan 01)
- Add "Search" to admin nav in layout.tsx
- Create `/admin/search/page.tsx` with summary cards
- Create `admin-search-table.tsx` client component with tabs (Top Queries / Zero Results / Trending)
- **Verification:** `pnpm build`, Playwright test that page loads for admin

**Plans 02 and 03 can run in parallel** since they don't share any files. Both depend on Plan 01 (schema + service).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drizzle `pgTable` without RLS | `pgPolicy` in table definition | drizzle-orm 0.42.0 (already upgraded) | RLS policies defined alongside schema |
| Separate migration files | Drizzle kit generate + manual SQL | Current | Project uses hand-written migrations for control |

**No deprecated patterns apply** -- all techniques used are current in the codebase.

## Open Questions

1. **Data Retention**
   - What we know: search_queries will grow unbounded if not pruned
   - What's unclear: Whether a retention policy is needed now or later
   - Recommendation: Defer to a future phase. At current scale, even 1M rows is ~100MB. Add a comment in the schema noting that a cron-based cleanup (e.g., delete rows older than 90 days) should be added if the table grows large.

2. **Anonymous Searches**
   - What we know: All three search paths call `auth()` and have session context
   - What's unclear: Whether unauthenticated users can ever reach search (middleware should prevent it)
   - Recommendation: Make `userId` nullable in schema as a defensive measure, use `session?.user?.id ?? null`. The middleware redirects unauthenticated users, so this should never be null in practice.

## Sources

### Primary (HIGH confidence)
- `packages/db/src/services/audit.ts` -- Fire-and-forget logging pattern (lines 19-26)
- `packages/db/src/schema/usage-events.ts` -- Tenant-isolated table with RLS policy pattern
- `apps/web/app/(protected)/admin/compliance/page.tsx` -- Admin page with summary cards pattern
- `apps/web/app/(protected)/admin/layout.tsx` -- Admin nav structure (lines 8-15)
- `apps/web/app/actions/discover.ts` -- Discover search entry point
- `apps/web/app/actions/search.ts` -- Quick search entry point
- `apps/web/lib/search-skills.ts` -- Core search function
- `apps/web/app/(protected)/skills/page.tsx` -- Browse search entry point

### Secondary (MEDIUM confidence)
- `packages/db/src/migrations/0022_add_company_approved.sql` -- Migration naming/numbering convention

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- all patterns copied from existing codebase (audit logs, usage events, admin pages)
- Schema design: HIGH -- follows established conventions exactly
- Pitfalls: HIGH -- identified from reading actual code paths and known project conventions (MEMORY.md)

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- internal feature, no external dependencies)
