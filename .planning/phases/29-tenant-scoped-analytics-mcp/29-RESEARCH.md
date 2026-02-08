# Phase 29: Tenant-Scoped Analytics & MCP - Research

**Researched:** 2026-02-08
**Domain:** Multi-tenant data isolation (analytics queries + MCP server)
**Confidence:** HIGH

## Summary

Phase 29 converts the analytics dashboard and MCP server from the current email-domain-based org scoping to proper tenant-scoped filtering via `tenantId`. The codebase has 6 analytics queries in `apps/web/lib/analytics-queries.ts` that all use a complex email-domain-matching pattern (`u.email LIKE '%@' || (SELECT split_part(...))`), which must be replaced with direct `tenant_id` filtering. The MCP server's 3 tool operations (search, list, deploy) currently operate without tenant scoping. Additionally, the FTE Years Saved calculation must be standardized to 2,080 hours/year (USA FTE standard) instead of the current `/ 8 / 365` pattern.

The architecture is well-prepared for this change: `session.user.tenantId` is already available via Phase 26's JWT/session augmentation, `validateApiKey()` already returns `tenantId` from Phase 28, and all tables have `tenant_id` columns with RLS policies from Phase 25. The work is primarily query-level refactoring with no schema changes needed.

**Primary recommendation:** Replace `orgId` (userId) parameter with `tenantId` in all 6 analytics query functions, add `tenantId` to MCP tool handlers via the auth module, and centralize the FTE constant as `FTE_HOURS_PER_YEAR = 2080`.

## Standard Stack

No new libraries needed. This phase uses the existing stack:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | SQL query builder | Already in use, supports raw SQL templates |
| next-auth | v5 | Session with tenantId | Already provides session.user.tenantId |
| @everyskill/db | local | DB services + schema | All tables already have tenant_id |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | existing | Input validation | MCP tool schemas (already in use) |

### Alternatives Considered
None -- this phase is pure refactoring of existing queries and handlers.

## Architecture Patterns

### Current State: Email-Domain Matching (MUST REPLACE)

All 6 analytics query functions in `apps/web/lib/analytics-queries.ts` use this pattern:

```sql
-- Current: Derives org membership from email domain
WHERE u.email LIKE '%@' || (SELECT split_part(u2.email, '@', 2) FROM users u2 WHERE u2.id = ${orgId} LIMIT 1)
```

This is:
1. **Fragile** -- relies on email domain as proxy for org membership
2. **Slow** -- subquery per filter clause
3. **Insecure** -- doesn't use actual tenant boundaries

### Target State: Direct tenant_id Filtering

```sql
-- Target: Direct tenant_id filtering on usage_events
WHERE ue.tenant_id = ${tenantId}
```

Or filtering via users table when needed:

```sql
-- When joining users, filter by users.tenant_id
WHERE u.tenant_id = ${tenantId}
```

### Pattern: Session-to-Query tenantId Flow (Web)

```typescript
// analytics page.tsx -- current
const orgId = session.user.id;  // userId
const data = await getOverviewStats(orgId, startDate);

// analytics page.tsx -- target
const tenantId = session.user.tenantId;
if (!tenantId) redirect("/login");
const data = await getOverviewStats(tenantId, startDate);
```

### Pattern: API-Key-to-Query tenantId Flow (MCP)

```typescript
// MCP auth.ts -- current: caches only userId
let cachedUserId: string | null = null;

// MCP auth.ts -- target: cache tenantId alongside userId
let cachedUserId: string | null = null;
let cachedTenantId: string | null = null;

export async function resolveUserId(): Promise<string | null> {
  // ... existing validation ...
  if (result) {
    cachedUserId = result.userId;
    cachedTenantId = result.tenantId;  // NEW: cache tenantId
  }
  return cachedUserId;
}

export function getTenantId(): string | null {
  return cachedTenantId;
}
```

### Pattern: FTE Years Saved Constant

```typescript
// Centralized constant
export const FTE_HOURS_PER_YEAR = 2080; // Standard USA FTE (40 hrs/wk * 52 wks)

// Usage: totalHours / FTE_HOURS_PER_YEAR = years saved
// Current (wrong): totalHours / 8 / 365 = years saved (gives 2920 hours/year)
```

### Recommended Project Structure (no changes needed)

```
apps/web/lib/analytics-queries.ts    # 6 query functions to update
apps/web/app/(protected)/analytics/  # Page that calls queries (update params)
apps/web/app/actions/                # Server actions (update params)
apps/mcp/src/auth.ts                 # Add tenantId caching
apps/mcp/src/tools/search.ts         # Add tenant filtering
apps/mcp/src/tools/list.ts           # Add tenant filtering
apps/mcp/src/tools/deploy.ts         # Add tenant filtering
apps/mcp/src/tracking/events.ts      # Use cached tenantId
```

### Anti-Patterns to Avoid

- **Don't use withTenant() for analytics queries** -- `withTenant()` uses transactions and `set_config()` which is for RLS-dependent queries. The analytics queries use raw SQL with explicit `WHERE tenant_id = ?` clauses, so they should filter directly. The RLS policies already exist as defense-in-depth.

- **Don't change query structure unnecessarily** -- The queries are working and tested. Only change the WHERE clauses and parameter signatures. Keep the same COALESCE chains, JOIN structures, and result mapping.

- **Don't pass both orgId and tenantId during transition** -- Clean cut: change function signatures from `orgId: string` to `tenantId: string`, update all callers in one pass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tenant resolution from session | Custom middleware | `session.user.tenantId` (Phase 26) | Already available via JWT claim |
| Tenant resolution from API key | Custom lookup | `validateApiKey().tenantId` (Phase 28) | Already returns tenantId |
| Connection-level tenant context | Manual set_config | `withTenant()` helper | Already implemented in Phase 25 |
| FTE calculation | Inline math | Shared constant `FTE_HOURS_PER_YEAR` | Prevents drift across components |

## Common Pitfalls

### Pitfall 1: Missing tenantId Guard

**What goes wrong:** `session.user.tenantId` is typed as `string | undefined` (optional on Session.user). If not checked, queries could filter by `undefined` which becomes `NULL` in SQL, returning zero rows silently.
**Why it happens:** TypeScript optional field, not guaranteed on every session.
**How to avoid:** Guard early in every analytics entry point: `if (!session?.user?.tenantId) redirect("/login");`
**Warning signs:** Dashboard shows zero data for authenticated users.

### Pitfall 2: Incomplete Query Migration

**What goes wrong:** Some queries get migrated to tenant_id filtering while others keep email-domain matching, causing inconsistent results across dashboard tabs.
**Why it happens:** 6 queries + 2 server actions + 1 page component -- easy to miss one.
**How to avoid:** Systematic audit -- grep for `split_part.*email.*@` pattern across the codebase to find all instances.
**Warning signs:** One tab shows data, another shows empty.

### Pitfall 3: MCP Skill Queries Not Tenant-Scoped

**What goes wrong:** MCP `list_skills` returns skills from ALL tenants because it uses `db.query.skills.findMany()` without any tenant filter.
**Why it happens:** Skills table has RLS policies, but current DB client sets connection-level `app.current_tenant_id` to DEFAULT_TENANT_ID, so RLS allows default-tenant rows only. In the future with dynamic tenants, this would need explicit filtering.
**How to avoid:** For search, `searchSkillsByQuery()` doesn't filter by tenant either. Add `WHERE tenant_id = ?` or use connection-level RLS.
**Warning signs:** Users see other tenants' skills in MCP search results.

### Pitfall 4: FTE Constant Inconsistency

**What goes wrong:** Some places use the new 2,080 hours/year constant while others keep the old `/8/365` pattern (which equals 2,920 hours/year).
**Why it happens:** FTE calculation appears in 10+ locations across components and query files.
**How to avoid:** Create a single exported constant and update all display locations in one sweep.
**Warning signs:** Different pages show different "Years Saved" values for the same data.

### Pitfall 5: MCP trackUsage Still Using Hardcoded DEFAULT_TENANT_ID

**What goes wrong:** `apps/mcp/src/tracking/events.ts` has `const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000"` hardcoded and always uses it.
**Why it happens:** Phase 28 deferred dynamic tenant resolution in MCP.
**How to avoid:** Use the cached tenantId from `auth.ts` when available, fall back to DEFAULT_TENANT_ID for anonymous usage.
**Warning signs:** All MCP-tracked events belong to default tenant regardless of authenticated user's actual tenant.

### Pitfall 6: getSkillTrend and getEmployeeActivity Not Tenant-Scoped

**What goes wrong:** `getSkillTrend()` filters only by `skill_id` with no tenant check, and `getEmployeeActivity()` filters only by `user_id`. Both could leak cross-tenant data.
**Why it happens:** These are drill-down queries that were assumed safe because they're accessed from an already-filtered parent view.
**How to avoid:** Add `AND ue.tenant_id = ${tenantId}` to both queries for defense-in-depth.
**Warning signs:** A user could construct a direct API call with another tenant's skillId/userId.

## Code Examples

### Example 1: Migrating getOverviewStats

```typescript
// BEFORE: Email-domain matching
export async function getOverviewStats(orgId: string, startDate: Date): Promise<OverviewStats> {
  // ...
  const result = await db.execute(sql`
    SELECT ...
    FROM usage_events ue
    LEFT JOIN users u ON u.id = ue.user_id
    WHERE ue.user_id IS NOT NULL
      AND u.email LIKE '%@' || (SELECT split_part(u6.email, '@', 2) FROM users u6 WHERE u6.id = ${orgId} LIMIT 1)
      AND ue.created_at >= ${startDateStr}
  `);
}

// AFTER: Direct tenant_id filtering
export async function getOverviewStats(tenantId: string, startDate: Date): Promise<OverviewStats> {
  // ...
  const result = await db.execute(sql`
    SELECT ...
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    LEFT JOIN users u ON u.id = ue.user_id
    WHERE ue.tenant_id = ${tenantId}
      AND ue.user_id IS NOT NULL
      AND ue.created_at >= ${startDateStr}
  `);
  // The nested subqueries for most_used_skill and highest_saver
  // also need to filter by tenant_id instead of email domain
}
```

### Example 2: Migrating Analytics Page

```typescript
// BEFORE
const orgId = session.user.id;
const [overviewStats, trendData, employeeData, skillData] = await Promise.all([
  getOverviewStats(orgId, startDate),
  getUsageTrend(orgId, startDate, granularity),
  getEmployeeUsage(orgId, startDate),
  getSkillUsage(orgId, startDate),
]);

// AFTER
const tenantId = session.user.tenantId;
if (!tenantId) redirect("/login");
const [overviewStats, trendData, employeeData, skillData] = await Promise.all([
  getOverviewStats(tenantId, startDate),
  getUsageTrend(tenantId, startDate, granularity),
  getEmployeeUsage(tenantId, startDate),
  getSkillUsage(tenantId, startDate),
]);
```

### Example 3: MCP Auth tenantId Caching

```typescript
// In apps/mcp/src/auth.ts
let cachedUserId: string | null = null;
let cachedTenantId: string | null = null;

export async function resolveUserId(): Promise<string | null> {
  if (resolved) return cachedUserId;
  resolved = true;

  const apiKey = process.env.EVERYSKILL_API_KEY;
  if (!apiKey) { /* ... */ return null; }

  try {
    const result = await validateApiKey(apiKey);
    if (result) {
      cachedUserId = result.userId;
      cachedTenantId = result.tenantId;  // Cache tenantId
    }
  } catch (error) { /* ... */ }

  return cachedUserId;
}

export function getTenantId(): string | null {
  return cachedTenantId;
}
```

### Example 4: MCP Tracking with Tenant

```typescript
// In apps/mcp/src/tracking/events.ts
import { getTenantId } from "../auth.js";

const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export async function trackUsage(
  event: Omit<NewUsageEvent, "id" | "createdAt" | "tenantId"> & { tenantId?: string },
  { skipIncrement = false }: { skipIncrement?: boolean } = {}
): Promise<void> {
  try {
    if (!db) return;
    // Use cached tenantId from auth, or explicit event tenantId, or fallback
    const tenantId = event.tenantId || getTenantId() || DEFAULT_TENANT_ID;
    await db.insert(usageEvents).values({ tenantId, ...event });
    // ...
  } catch (error) { /* ... */ }
}
```

### Example 5: MCP Tool Tenant Filtering (list_skills)

```typescript
// In apps/mcp/src/tools/list.ts
import { getTenantId } from "../auth.js";

export async function handleListSkills({ category, limit, userId, skipNudge }) {
  if (!db) { /* error handling */ }

  const tenantId = getTenantId();

  // Use findMany with where clause to filter by tenant
  const allResults = await db.query.skills.findMany({
    limit: category ? undefined : limit,
    columns: { id: true, name: true, description: true, category: true, hoursSaved: true },
    where: tenantId ? eq(skills.tenantId, tenantId) : undefined,
  });
  // ... rest of handler
}
```

### Example 6: FTE Years Saved Constant

```typescript
// In apps/web/lib/constants.ts (or inline in analytics-queries.ts)
/**
 * Standard USA FTE hours per year.
 * 40 hours/week * 52 weeks/year = 2,080 hours/year
 * Used for "FTE Years Saved" calculations across the dashboard.
 */
export const FTE_HOURS_PER_YEAR = 2080;

// Usage in display components:
// OLD: (totalHours / 8 / 365).toFixed(2)  -- gives 2920 hrs/yr
// NEW: (totalHours / FTE_HOURS_PER_YEAR).toFixed(2) -- gives 2080 hrs/yr
```

## Detailed Inventory of Changes Required

### TENANT-12: Analytics Queries (6 functions)

All in `apps/web/lib/analytics-queries.ts`:

| # | Function | Lines | Email-Domain Pattern Instances | Notes |
|---|----------|-------|-------------------------------|-------|
| 1 | `getOverviewStats()` | 193-257 | 3 (main WHERE + 2 nested subqueries) | Most complex -- nested subqueries for most_used_skill, highest_saver each have their own email domain filter |
| 2 | `getUsageTrend()` | 270-308 | 1 | Straightforward replacement |
| 3 | `getEmployeeUsage()` | 320-372 | 1 (main) + nested subquery has none | Main WHERE + nested subquery for top_skill doesn't filter by domain (it filters by user_id which is already correct) |
| 4 | `getSkillUsage()` | 384-466 | 2 (main query + breakdown query) | Two separate db.execute calls both need tenant_id filtering |
| 5 | `getExportData()` | 477-513 | 1 | Simple replacement |
| 6 | `getEmployeeActivity()` | 524-557 | 0 (filters by userId only) | Add tenant_id for defense-in-depth |
| - | `getSkillTrend()` | 570-604 | 0 (filters by skillId only) | Add tenant_id for defense-in-depth |

**Callers to update (parameter change from orgId to tenantId):**
- `apps/web/app/(protected)/analytics/page.tsx` (line 31: `const orgId = session.user.id`)
- `apps/web/app/actions/export-analytics.ts` (line 24: `getExportData(session.user.id, ...)`)
- `apps/web/app/actions/get-employee-activity.ts` (line 31: uses userId directly -- keep, but add tenantId param)
- `apps/web/app/actions/get-skill-trend.ts` (line 27: uses skillId directly -- keep, but add tenantId param)

### TENANT-13: MCP Operations (3 tools + auth + tracking)

| # | File | What Changes |
|---|------|--------------|
| 1 | `apps/mcp/src/auth.ts` | Add `cachedTenantId` and `getTenantId()` |
| 2 | `apps/mcp/src/tools/search.ts` | Pass tenantId to `searchSkillsByQuery()` (requires updating that service) |
| 3 | `apps/mcp/src/tools/list.ts` | Filter `db.query.skills.findMany()` by tenantId |
| 4 | `apps/mcp/src/tools/deploy.ts` | Filter `db.query.skills.findMany()` by tenantId (or the find) |
| 5 | `apps/mcp/src/tracking/events.ts` | Use `getTenantId()` instead of hardcoded DEFAULT_TENANT_ID |
| 6 | `packages/db/src/services/search-skills.ts` | Add optional `tenantId` param for filtered search |

### METRIC-01: FTE Years Saved Calculation

**All locations using the old formula (/ 8 / 365 = 2920 hrs/yr):**

| # | File | Line | Current Formula |
|---|------|------|-----------------|
| 1 | `apps/web/components/skill-card.tsx` | 41 | `(totalUses * hoursSaved) / 8 / 365` |
| 2 | `apps/web/components/skills-table-row.tsx` | 91 | `(totalUses * hoursSaved) / 8 / 365` |
| 3 | `apps/web/components/my-leverage-view.tsx` | 128 | `totalHoursSaved / 8 / 365` |
| 4 | `apps/web/components/my-leverage-view.tsx` | 186 | `hoursSavedByOthers / 8 / 365` |
| 5 | `apps/web/components/header-stats.tsx` | 14 | `totalDaysSaved / 365` (days=hours/8) |
| 6 | `apps/web/components/skill-detail.tsx` | 106 | `fteDaysSaved / 365` |
| 7 | `apps/web/components/leaderboard-table.tsx` | 92 | `fteDaysSaved / 365` |
| 8 | `apps/web/app/(protected)/page.tsx` | 166 | `totalFteDaysSaved / 365` |
| 9 | `apps/web/app/(protected)/users/[id]/page.tsx` | 60 | `fteDaysSaved / 365` |
| 10 | `apps/web/app/(protected)/users/[id]/page.tsx` | 121 | `(totalUses * hoursSaved) / 8 / 365` |
| 11 | `apps/web/app/(protected)/profile/page.tsx` | 45 | `fteDaysSaved / 365` |

**Note on conversion approach:** The current codebase has two patterns:
1. **Direct hours-to-years:** `totalHours / 8 / 365` -- should become `totalHours / FTE_HOURS_PER_YEAR`
2. **Days-to-years:** `fteDaysSaved / 365` where fteDaysSaved = totalHours / 8 -- these can either (a) keep the `/ 365` but change upstream to use `totalHours / (FTE_HOURS_PER_YEAR / 260)` for days, or (b) switch entirely to hours-based math: `totalHours / FTE_HOURS_PER_YEAR`.

**Recommended approach:** Since `fteDaysSaved` is already computed in DB queries (`SUM(total_uses * hours_saved) / 8.0`), the cleanest fix is:
- Keep DB queries returning `fteDaysSaved` (hours / 8)
- In display components: `fteDaysSaved / 260` instead of `fteDaysSaved / 365` (since 2080/8 = 260 working days)
- OR convert everything to hours and use `hours / 2080`

Actually, the simplest and most correct approach: change all display formulas from `/ 8 / 365` to `/ 2080` (hours-to-years directly), and from `fteDaysSaved / 365` to `fteDaysSaved / 260` (260 = 2080/8 working days per FTE year).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Email-domain matching for org scoping | tenant_id FK filtering | Phase 25 (schema), Phase 29 (queries) | Correct multi-tenant isolation, better performance |
| userId as org identifier | tenantId from session/JWT | Phase 26 | Clean separation of user identity from org membership |
| `/8/365` FTE calculation | `/2080` or `/260` (FTE standard) | Phase 29 | Correct FTE year representation |

## Open Questions

1. **MCP search tenant scoping for anonymous users**
   - What we know: When `EVERYSKILL_API_KEY` is not set, MCP runs in anonymous mode with no tenantId
   - What's unclear: Should anonymous MCP users see ALL skills (cross-tenant public marketplace) or no skills?
   - Recommendation: Keep current behavior (anonymous users see default-tenant skills) since CROSS-01 (cross-tenant marketplace) is deferred to post-v1.5. For authenticated users, scope to their tenant.

2. **getSkillTrend tenant scoping**
   - What we know: `getSkillTrend()` only filters by `skill_id`, not tenant. The calling server action `fetchSkillTrend()` doesn't pass tenantId.
   - What's unclear: If a skillId is UUID and unique globally, is tenant filtering redundant?
   - Recommendation: Add tenant_id filter for defense-in-depth. Skill IDs could theoretically be guessed/enumerated.

3. **FTE display label change**
   - What we know: Currently labels say "FTE Years Saved" or "Years Saved"
   - What's unclear: Should the label explicitly mention "FTE" to clarify it's working-hours-based?
   - Recommendation: Keep "FTE Years Saved" label where it exists; it correctly communicates the metric.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 6 analytics query functions in `apps/web/lib/analytics-queries.ts`
- Direct codebase analysis of MCP tools in `apps/mcp/src/tools/`
- Direct codebase analysis of auth module in `apps/mcp/src/auth.ts`
- `validateApiKey()` return type in `packages/db/src/services/api-keys.ts` -- confirms `tenantId` is returned
- `session.user.tenantId` type augmentation in `apps/web/types/next-auth.d.ts`
- RLS policies on `usage_events` and `skills` tables in schema files
- Phase 25/26 architecture documented in `.planning/STATE.md`

### Secondary (MEDIUM confidence)
- METRIC-01 requirement: 2,080 hours/year is standard USA FTE (40 hrs/wk * 52 wks)
- FTE calculation locations identified via grep across all component files

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, purely existing codebase refactoring
- Architecture: HIGH -- all patterns verified by reading actual source files
- Pitfalls: HIGH -- identified from actual code analysis, not speculation
- FTE constant: HIGH -- 2,080 hours/year is well-established standard (40 * 52)
- Query migration: HIGH -- every query function read in full, all email-domain patterns catalogued

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- internal refactoring, no external dependencies)
