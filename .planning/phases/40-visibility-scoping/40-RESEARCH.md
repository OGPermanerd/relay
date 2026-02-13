# Phase 40: Visibility Scoping - Research

**Researched:** 2026-02-13
**Domain:** Application-level access control (visibility filtering on existing DB schema)
**Confidence:** HIGH

## Summary

Visibility Scoping adds a `visibility` column to the `skills` table with two values: `"tenant"` (visible to all tenant members) and `"personal"` (visible only to the author). This is a **pure application-level feature** -- no new libraries, no new architectural patterns. It requires:

1. A single schema change (new column + migration)
2. A reusable filter function used across all skill query paths
3. UI for setting visibility on create/edit
4. Enforcement in MCP tools that pass userId downstream

The codebase already has the exact same pattern from the `status` column addition (Phase 13, migration 0013). That migration added a column with a default, an index, and then all query paths were updated to filter by status. Visibility scoping follows the identical playbook.

**Primary recommendation:** Add `visibility TEXT NOT NULL DEFAULT 'tenant'` to the `skills` table, create a `buildVisibilityFilter(userId)` helper in `packages/db/src/lib/visibility.ts`, and systematically apply it to every skill query path. The migration defaults all existing skills to `"tenant"` so nothing changes for current users.

## Standard Stack

### Core

No new libraries needed. This is entirely implemented with existing stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Schema column addition, query filters | Already in use, SQL builder handles the OR conditions cleanly |
| postgres.js | (current) | Migration execution | Already in use for all migrations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | No new dependencies required |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| App-level visibility filter | PostgreSQL RLS policy for visibility | RLS already handles tenant isolation; adding visibility to RLS would couple two concerns and make debugging harder. App-level filter is simpler, testable, and matches the existing `status` filter pattern. |
| `visibility` column on skills | Separate `skill_visibility` join table | Over-engineering for two values. Column is simpler and has zero join overhead. |

## Architecture Patterns

### Recommended Project Structure

No new files beyond:
```
packages/db/src/
  schema/skills.ts           # Add visibility column
  lib/visibility.ts          # NEW: buildVisibilityFilter() helper
  migrations/0019_*.sql      # NEW: migration

apps/web/
  lib/search-skills.ts       # Add visibility filter
  lib/similar-skills.ts      # Add visibility filter
  lib/trending.ts            # Add visibility filter
  lib/leaderboard.ts         # Add visibility filter (only count tenant-visible skills)
  lib/platform-stats.ts      # Add visibility filter
  app/actions/skills.ts      # Accept visibility param on create
  app/actions/search.ts      # Pass userId for filtering
  components/skill-form.tsx   # Add visibility selector UI

apps/mcp/src/
  tools/search.ts            # Pass userId to filter
  tools/recommend.ts         # Pass userId to filter
  tools/list.ts              # Pass userId to filter
  tools/describe.ts          # Check visibility before returning
```

### Pattern 1: Reusable Visibility Filter (buildVisibilityFilter)

**What:** A single function that produces the SQL WHERE clause fragment for visibility filtering. Every query path calls this instead of hand-rolling the logic.

**When to use:** Every skill read query that returns skills to users (browse, search, detail, trending, similar, stats, MCP tools).

**Example:**
```typescript
// packages/db/src/lib/visibility.ts
import { sql, SQL, eq, or, and } from "drizzle-orm";
import { skills } from "../schema/skills";

/**
 * Build visibility filter for skill queries.
 *
 * Rules:
 * - "tenant" visibility: visible to all users in the tenant
 * - "personal" visibility: visible only to the author
 * - If no userId provided (anonymous), only tenant-visible skills shown
 *
 * Note: Status filtering (published only) is handled separately.
 * This function ONLY handles visibility.
 */
export function buildVisibilityFilter(userId?: string): SQL {
  if (!userId) {
    // Anonymous users: only tenant-visible skills
    return eq(skills.visibility, "tenant");
  }

  // Authenticated users: tenant-visible OR (personal AND authored by me)
  return or(
    eq(skills.visibility, "tenant"),
    and(
      eq(skills.visibility, "personal"),
      eq(skills.authorId, userId)
    )
  )!;
}
```

### Pattern 2: Integration with Existing Status Filter

**What:** Visibility is an additional filter applied alongside the existing `status = 'published'` filter. Status takes precedence -- unpublished skills are never returned regardless of visibility.

**When to use:** All public-facing queries already filter by `eq(skills.status, "published")`. The visibility filter is added as an additional condition in the same `and()` clause.

**Example (search-skills.ts):**
```typescript
import { buildVisibilityFilter } from "@everyskill/db/lib/visibility";

// In searchSkills():
const conditions = [];
conditions.push(eq(skills.status, "published"));
conditions.push(buildVisibilityFilter(userId));  // NEW
// ... rest of conditions
```

### Pattern 3: Raw SQL Queries Need Inline Visibility Logic

**What:** Several queries use `db.execute(sql`...`)` with raw SQL (trending, leaderboard, platform-stats, similar-skills semantic). These cannot use the Drizzle `buildVisibilityFilter()` directly and need an inline SQL fragment.

**When to use:** Any raw SQL query that touches skills.

**Example (raw SQL pattern):**
```sql
-- For raw SQL queries, add this condition:
AND (s.visibility = 'tenant' OR (s.visibility = 'personal' AND s.author_id = ${userId}))
```

**Recommendation:** Create a companion `visibilitySQL(userId?: string): SQL` that returns a raw SQL fragment usable in template literals:
```typescript
export function visibilitySQL(userId?: string): SQL {
  if (!userId) {
    return sql`visibility = 'tenant'`;
  }
  return sql`(visibility = 'tenant' OR (visibility = 'personal' AND author_id = ${userId}))`;
}
```

### Pattern 4: MCP Tools Must Thread userId

**What:** MCP tools currently pass `tenantId` to search/list services but NOT `userId`. For visibility filtering, the `userId` must be threaded through to the query layer.

**Current state:** `getUserId()` is already available in MCP auth module. The search/recommend/list handlers already receive `userId` as a parameter but DON'T pass it to the DB service functions.

**Required change:** Add `userId` parameter to `SearchSkillsParams`, `semanticSearchSkills` params, and the list tool query.

### Anti-Patterns to Avoid

- **Filtering in application code after DB fetch:** The MCP `list_skills` tool currently fetches ALL skills and filters in-memory. This is already a problem. DO NOT add visibility filtering in the same in-memory filter pattern. Instead, fix the query to use proper WHERE clauses.
- **Forgetting a query path:** The most common mistake. There are 14+ distinct query paths. Missing even one creates a data leak. See the complete inventory below.
- **Using RLS for visibility:** RLS is for tenant isolation (row-level, connection-scoped). Visibility is per-user, per-request. Mixing these creates debugging nightmares.

## Complete Query Path Inventory

Every place skills are queried, categorized by treatment needed:

### Drizzle Query Builder Paths (use `buildVisibilityFilter`)

| # | File | Function | Current Status Filter | Needs userId |
|---|------|----------|----------------------|-------------|
| 1 | `apps/web/lib/search-skills.ts` | `searchSkills()` | `eq(skills.status, "published")` | YES - from session |
| 2 | `apps/web/lib/search-skills.ts` | `getAvailableTags()` | `status = 'published'` (raw SQL) | YES - raw SQL inline |
| 3 | `packages/db/src/services/search-skills.ts` | `searchSkillsByQuery()` | `eq(skills.status, "published")` | YES - new param |
| 4 | `packages/db/src/services/semantic-search.ts` | `semanticSearchSkills()` | `eq(skills.status, "published")` | YES - new param |
| 5 | `apps/web/lib/similar-skills.ts` | `checkSimilarSkills()` | `eq(skills.status, "published")` | YES - from session or omit (tenant-only OK) |
| 6 | `apps/web/lib/similar-skills.ts` | `findSimilarSkillsByName()` | `eq(skills.status, "published")` | YES - from session |
| 7 | `packages/db/src/services/skill-forks.ts` | `getForkCount()` | `eq(skills.status, "published")` | YES - new param |
| 8 | `packages/db/src/services/skill-forks.ts` | `getTopForks()` | `eq(skills.status, "published")` | YES - new param |
| 9 | `apps/web/app/actions/admin-skills.ts` | `getAdminSkills()` | None (shows all) | NO - admin sees all |
| 10 | `apps/mcp/src/tools/list.ts` | `handleListSkills()` | In-memory filter | YES - fix to DB query |

### Raw SQL Paths (use `visibilitySQL` inline)

| # | File | Function | Notes |
|---|------|----------|-------|
| 11 | `apps/web/lib/trending.ts` | `getTrendingSkills()` | Has `s.status = 'published'` in CTE |
| 12 | `apps/web/lib/leaderboard.ts` | `getLeaderboard()` | Has `s.status = 'published'` in CTE |
| 13 | `apps/web/lib/platform-stats.ts` | `getPlatformStats()` | Has `eq(skills.status, "published")` -- mixed Drizzle+raw |
| 14 | `apps/web/lib/similar-skills.ts` | `trySemanticSearch()` | Raw SQL with `s.status = 'published'` |
| 15 | `apps/web/lib/similar-skills.ts` | `trySemanticSearchBySkill()` | Raw SQL with `s.status = 'published'` |

### Single-Skill Access Paths (visibility check on fetch)

| # | File | Function | Notes |
|---|------|----------|-------|
| 16 | `apps/web/app/(protected)/skills/[slug]/page.tsx` | Skill detail page | Already has access control for non-published. Add visibility check. |
| 17 | `apps/mcp/src/tools/describe.ts` | `handleDescribeSkill()` | Fetches by ID + published. Add visibility check. |
| 18 | `apps/web/app/actions/get-skill-content.ts` | `getSkillContent()` | Fetches by ID, no status filter. Needs visibility + author check. |
| 19 | `apps/web/app/actions/fork-skill.ts` | `forkSkill()` | Fetches parent by ID. Should check visibility. |

### Write Paths (accept visibility on creation)

| # | File | Function | Notes |
|---|------|----------|-------|
| 20 | `apps/web/app/actions/skills.ts` | `checkAndCreateSkill()` | Accept visibility from form |
| 21 | `apps/web/app/actions/skills.ts` | `createSkill()` | Accept visibility from form |
| 22 | `apps/mcp/src/tools/create.ts` | `handleCreateSkill()` | Accept visibility param |
| 23 | `apps/web/app/actions/fork-skill.ts` | `forkSkill()` | Inherit parent's visibility or default to personal |

### Paths That DON'T Need Visibility Filtering

| File | Function | Why Exempt |
|------|----------|-----------|
| `apps/web/app/actions/admin-skills.ts` | `getAdminSkills()` | Admins see everything |
| `apps/web/lib/my-leverage.ts` | `getSkillsUsed()` | Queries by userId's own usage events |
| `apps/web/lib/my-leverage.ts` | `getSkillsCreated()` | Queries by userId as author |
| `apps/web/lib/skill-stats.ts` | `getSkillStats()` | Fetches for specific skill already accessed |
| `apps/web/app/actions/submit-for-review.ts` | `submitForReview()` | Author-only action |
| `apps/web/app/actions/ratings.ts` | (rating submission) | Operates on already-accessed skill |
| `packages/db/src/services/skill-reviews.ts` | `getSkillReview()` | Fetched after skill access check |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Visibility filter logic | Inline conditions in each query | `buildVisibilityFilter()` + `visibilitySQL()` centralized helpers | 14+ query paths. Duplicating logic = guaranteed inconsistency. |
| Enum validation for visibility | String checking | Drizzle schema with `text("visibility").notNull().default("tenant")` + Zod enum on input | Schema enforces valid values at DB level |
| RLS-based visibility | PostgreSQL policy | App-level filter | RLS is connection-scoped, visibility is request-scoped per-user. Wrong abstraction level. |

**Key insight:** The existing `status` filter is the perfect precedent. It was added as a column with a safe default, then systematically applied to every query. Visibility follows the exact same pattern.

## Common Pitfalls

### Pitfall 1: Missing a Query Path (DATA LEAK)
**What goes wrong:** A user's personal skill shows up in another user's search results, trending section, or leaderboard calculation because one query path was missed.
**Why it happens:** 14+ distinct query paths in different files. Easy to overlook one.
**How to avoid:** Use the complete inventory above as a checklist. After implementation, write a verification query: `SELECT * FROM skills WHERE visibility = 'personal' AND author_id != '<test-user-id>'` and confirm the app never shows these.
**Warning signs:** Any skill query that doesn't include a visibility condition (except the exempted ones).

### Pitfall 2: Raw SQL Queries Miss the Filter
**What goes wrong:** Drizzle query builder paths get the filter via the helper, but raw SQL paths (trending, leaderboard, similar-skills semantic) are forgotten.
**Why it happens:** Raw SQL queries are string templates -- no type system to catch the missing filter.
**How to avoid:** The `visibilitySQL()` helper returns a SQL fragment for template interpolation. Search for all `db.execute(sql` calls that reference the skills table and add the fragment.
**Warning signs:** Any `db.execute(sql` that joins/queries skills without a visibility condition.

### Pitfall 3: Platform Stats Count Personal Skills
**What goes wrong:** Platform stats (total uses, FTE days saved) include personal skills, inflating org-level metrics with private data.
**Why it happens:** `getPlatformStats()` aggregates across all published skills. If personal skills are published but personal, they shouldn't count toward org stats.
**How to avoid:** Add `AND visibility = 'tenant'` to platform stats queries. Personal skills should only appear in the author's "My Leverage" view.
**Warning signs:** Platform stats increasing when personal skills are created.

### Pitfall 4: Leaderboard Ranks Personal Skills
**What goes wrong:** A user's leaderboard ranking includes their personal skills' usage/FTE contributions, giving them an unfair ranking boost from private skills.
**Why it happens:** Leaderboard CTE joins skills by `author_id` and `status = 'published'`.
**How to avoid:** Add `AND s.visibility = 'tenant'` to the leaderboard CTE. Personal skills don't count toward leaderboard.

### Pitfall 5: MCP List Tool In-Memory Filtering
**What goes wrong:** The MCP `list_skills` tool fetches ALL skills and filters in JS. Adding visibility filtering in JS still fetches personal skills over the wire, and the in-memory pattern is fragile.
**Why it happens:** Legacy code comment says "filter in-memory to avoid TypeScript module resolution issues."
**How to avoid:** Rewrite the list query to use proper Drizzle `where()` clause. The original module resolution issue was likely fixed in subsequent Drizzle upgrades.

### Pitfall 6: Fork Inherits Wrong Visibility
**What goes wrong:** Forking a personal skill creates a fork that's also personal but owned by someone else, making it invisible to the forker.
**Why it happens:** Fork copies parent fields blindly.
**How to avoid:** Forked skills should default to `"personal"` (the forker's own personal skill). If the parent was tenant-visible, the fork could be either. The fork flow should let the user choose or default to the parent's visibility.
**Decision needed:** Should forks inherit parent visibility or always start as personal? Recommendation: default to `"personal"` so the forker can explicitly choose to share.

## Code Examples

### Schema Addition

```typescript
// packages/db/src/schema/skills.ts - add to table definition
visibility: text("visibility").notNull().default("tenant"), // "tenant" or "personal"
```

### Migration SQL

```sql
-- 0019_add_skill_visibility.sql
-- Add visibility column with safe default (all existing skills remain visible)
ALTER TABLE skills ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'tenant';

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS skills_visibility_idx ON skills (visibility);

-- Composite index for personal skill lookups
CREATE INDEX IF NOT EXISTS skills_visibility_author_idx ON skills (visibility, author_id);
```

### Visibility Helper (Drizzle)

```typescript
// packages/db/src/lib/visibility.ts
import { sql, SQL, eq, or, and } from "drizzle-orm";
import { skills } from "../schema/skills";

export function buildVisibilityFilter(userId?: string): SQL {
  if (!userId) {
    return eq(skills.visibility, "tenant");
  }
  return or(
    eq(skills.visibility, "tenant"),
    and(eq(skills.visibility, "personal"), eq(skills.authorId, userId))
  )!;
}

export function visibilitySQL(userId?: string): SQL {
  if (!userId) {
    return sql`visibility = 'tenant'`;
  }
  return sql`(visibility = 'tenant' OR (visibility = 'personal' AND author_id = ${userId}))`;
}
```

### UI: Visibility Selector on Create Form

```typescript
// Add to create skill form (radio group or toggle)
<fieldset>
  <legend className="text-sm font-medium text-gray-700">Visibility</legend>
  <div className="mt-2 flex gap-4">
    <label className="flex items-center gap-2">
      <input type="radio" name="visibility" value="tenant" defaultChecked />
      <span>Team</span>
      <span className="text-xs text-gray-500">Everyone in your org can see this</span>
    </label>
    <label className="flex items-center gap-2">
      <input type="radio" name="visibility" value="personal" />
      <span>Personal</span>
      <span className="text-xs text-gray-500">Only you can see this</span>
    </label>
  </div>
</fieldset>
```

### Applying to search-skills.ts

```typescript
// apps/web/lib/search-skills.ts
export async function searchSkills(params: SearchParams & { userId?: string }): Promise<...> {
  const conditions = [];
  conditions.push(eq(skills.status, "published"));
  conditions.push(buildVisibilityFilter(params.userId));  // ADD THIS
  // ... rest unchanged
}
```

### Applying to Trending (Raw SQL)

```typescript
// apps/web/lib/trending.ts
export async function getTrendingSkills(limit: number = 10, userId?: string): Promise<...> {
  const visFilter = visibilitySQL(userId);
  const results = await db.execute(sql`
    WITH skill_recent_usage AS (
      SELECT ...
      FROM usage_events ue
      JOIN skills s ON s.id = ue.skill_id
      WHERE ue.created_at >= NOW() - INTERVAL '7 days'
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        AND ${visFilter}                         -- ADD THIS
      GROUP BY ue.skill_id
      HAVING COUNT(*) >= 3
    )
    ...
  `);
}
```

### Skill Detail Page Visibility Check

```typescript
// apps/web/app/(protected)/skills/[slug]/page.tsx
// After fetching skill, add visibility check alongside existing access control:
const isPublished = skill.status === "published";
const isAuthorOfSkill = session?.user?.id === skill.authorId;
const userIsAdmin = isAdmin(session);

// NEW: Visibility check
const isPersonalAndNotAuthor =
  skill.visibility === "personal" && !isAuthorOfSkill && !userIsAdmin;

if (!isPublished && !isAuthorOfSkill && !userIsAdmin) {
  notFound();
}
if (isPersonalAndNotAuthor) {
  notFound();  // Personal skill, not the author, not admin
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No visibility concept | `status` column controls lifecycle (published/draft/etc) | Phase 13 | Visibility scoping extends this pattern with a second axis |

**Deprecated/outdated:**
- None. This feature follows the established pattern from the status column addition.

## Open Questions

1. **Should forked skills inherit parent visibility?**
   - What we know: Forks copy parent data. A tenant-visible skill forked by a user could be either.
   - What's unclear: User expectation -- does forking a public skill create a public fork or a private draft?
   - Recommendation: Default forks to `"personal"`. The fork is the user's private copy. They can publish to team visibility later. This is safest from a data privacy perspective.

2. **Should platform stats/leaderboard include personal skills?**
   - What we know: Platform stats are org-level. Personal skills are individual.
   - What's unclear: Do personal skill uses count toward FTE savings?
   - Recommendation: Exclude personal skills from platform stats and leaderboard. Include them only in "My Leverage" (already scoped by userId). This is cleaner and avoids inflating org metrics.

3. **Can users change visibility after creation?**
   - What we know: Requirements say "when creating or editing."
   - What's unclear: Should there be restrictions on changing from personal to tenant (review pipeline) or tenant to personal (orphans existing usage data)?
   - Recommendation: Allow both directions freely. Changing to personal hides it from team searches. Changing to tenant reveals it. No re-review needed since the content hasn't changed. Usage data stays; it just becomes inaccessible to non-authors.

4. **Should the `quickSearch` action filter by visibility?**
   - What we know: `quickSearch` in `apps/web/app/actions/search.ts` calls `searchSkills()` from lib.
   - If `searchSkills()` gets the visibility filter, `quickSearch` needs to pass userId.
   - Recommendation: Yes, thread the session userId through `quickSearch` to `searchSkills`. This is a server action, so `auth()` is available.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 20+ files listed in the query inventory were read and analyzed directly
- Migration pattern from `0013_add_skill_status.sql` -- exact precedent for this pattern
- Schema at `packages/db/src/schema/skills.ts` -- verified column types and existing patterns
- MCP auth at `apps/mcp/src/auth.ts` -- verified `getUserId()` and `getTenantId()` availability

### Secondary (MEDIUM confidence)
- Drizzle ORM `or()`, `and()`, `eq()` operators -- verified via codebase usage in search-skills.ts, semantic-search.ts
- PostgreSQL `ALTER TABLE ADD COLUMN IF NOT EXISTS` -- standard DDL, verified via existing migrations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, pure application-level change
- Architecture: HIGH - Follows exact pattern of status column (Phase 13), all query paths inventoried
- Pitfalls: HIGH - All query paths read and categorized, specific miss-risk paths identified
- Query inventory: HIGH - Every file was read, every function analyzed

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- this is internal application logic, not external dependency)
