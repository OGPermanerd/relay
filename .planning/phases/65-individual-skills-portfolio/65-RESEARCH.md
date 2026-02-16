# Phase 65: Individual Skills Portfolio - Research

**Researched:** 2026-02-16
**Domain:** Next.js server component page + SQL aggregation queries + visibility scoping
**Confidence:** HIGH

## Summary

Phase 65 creates a new `/portfolio` route (not an extension of `/profile`) where any authenticated user can see their personal skills portfolio: skills authored, total usage, total hours saved, contribution ranking within the tenant, and a portable vs company-IP breakdown based on visibility scoping (`personal` vs `tenant`).

The implementation is straightforward because all required data already exists in the `skills` and `usage_events` tables. The visibility scoping system (Phase 40) already distinguishes `personal` and `tenant` visibility on skills. The existing `getLeaderboard()` function in `apps/web/lib/leaderboard.ts` uses `RANK()` window functions and can be adapted for percentile/ranking context. No new schema is needed -- everything is SQL aggregation on existing tables.

**Primary recommendation:** Build a query module (`apps/web/lib/portfolio-queries.ts`) with 2-3 functions for portfolio stats, skill list with visibility, and contribution ranking. Then build a server component page at `apps/web/app/(protected)/portfolio/page.tsx` and a client view component, following the exact patterns from `/leverage` (page.tsx) and `/leverage/ip-dashboard` (page.tsx + view component). Add a "Portfolio" link in the main header nav.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App router, server components | Already in use across all pages |
| Drizzle ORM | 0.42.0 | SQL query builder | Already in use for all DB queries |
| PostgreSQL | - | `RANK()`, `PERCENT_RANK()` window functions | Already used in leaderboard.ts |
| Tailwind CSS | - | Styling | Already in use for all components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @everyskill/db | workspace | DB client and schema access | All query functions |
| auth() | Auth.js v5 | Session + userId + tenantId | Page-level auth guard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw SQL via db.execute() | Drizzle query builder | Raw SQL preferred for complex aggregations with window functions -- matches existing pattern in leaderboard.ts, analytics-queries.ts, ip-dashboard-queries.ts |
| New /portfolio route | Extend /profile page | Decision already made: separate /portfolio route. Profile is account-focused; portfolio is impact-focused. |
| Client-side ranking calculation | Server-side SQL | SQL window functions are more efficient and avoid data leakage (don't send all users' data to the client) |

**Installation:**
No new packages needed -- everything uses existing dependencies.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
  lib/
    portfolio-queries.ts          # New: SQL queries for portfolio data
  app/(protected)/
    portfolio/
      page.tsx                    # New: Server component page (auth + data fetch)
  components/
    portfolio-view.tsx            # New: Client component (rendering)
```

### Pattern 1: Server Component Page with Parallel Data Fetching
**What:** Server component fetches multiple queries in parallel via `Promise.all()`, passes serialized data to client view component.
**When to use:** Every data-heavy page in this codebase follows this pattern.
**Example (from existing leverage/page.tsx):**
```typescript
// apps/web/app/(protected)/portfolio/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPortfolioStats, getPortfolioSkills, getContributionRanking } from "@/lib/portfolio-queries";
import { PortfolioView } from "@/components/portfolio-view";

export const metadata = { title: "Portfolio | EverySkill" };

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login");

  const [stats, skills, ranking] = await Promise.all([
    getPortfolioStats(session.user.id),
    getPortfolioSkills(session.user.id),
    getContributionRanking(session.user.id, tenantId),
  ]);

  return <PortfolioView stats={stats} skills={skills} ranking={ranking} />;
}
```

### Pattern 2: SQL Aggregation with Window Functions for Ranking
**What:** Use PostgreSQL `RANK()` or `PERCENT_RANK()` to compute contribution ranking without leaking other users' data.
**When to use:** When showing "Top X%" or "Nth highest" context.
**Example (adapted from existing leaderboard.ts):**
```typescript
// PERCENT_RANK() returns 0-1 value; multiply by 100 for percentile
const result = await db.execute(sql`
  WITH contributor_stats AS (
    SELECT
      u.id AS user_id,
      COALESCE(SUM(s.total_uses * COALESCE(s.hours_saved, 1)), 0) AS total_hours_saved,
      COUNT(DISTINCT s.id) AS skills_count
    FROM users u
    LEFT JOIN skills s ON s.author_id = u.id
      AND s.published_version_id IS NOT NULL
      AND s.status = 'published'
    WHERE u.tenant_id = ${tenantId}
    GROUP BY u.id
  ),
  ranked AS (
    SELECT
      user_id,
      total_hours_saved,
      skills_count,
      RANK() OVER (ORDER BY total_hours_saved DESC) AS rank,
      COUNT(*) OVER () AS total_contributors,
      PERCENT_RANK() OVER (ORDER BY total_hours_saved DESC) AS percentile_rank
    FROM contributor_stats
    WHERE skills_count > 0
  )
  SELECT rank, total_contributors, percentile_rank
  FROM ranked
  WHERE user_id = ${userId}
`);
```

### Pattern 3: Visibility Scope Breakdown
**What:** Group user's skills by `visibility` column to separate portable (personal) vs company (tenant) IP.
**When to use:** For the portable vs company IP breakdown.
**Example:**
```typescript
const result = await db.execute(sql`
  SELECT
    s.visibility,
    COUNT(*)::integer AS skill_count,
    COALESCE(SUM(s.total_uses), 0)::integer AS total_uses,
    COALESCE(SUM(s.total_uses * COALESCE(s.hours_saved, 1)), 0)::double precision AS total_hours_saved
  FROM skills s
  WHERE s.author_id = ${userId}
    AND s.published_version_id IS NOT NULL
    AND s.status = 'published'
  GROUP BY s.visibility
`);
```

### Pattern 4: Skill List with Visibility Badge
**What:** Each skill in the portfolio list includes its `visibility` value so the UI can render a personal/company badge.
**When to use:** For the skill portfolio list rendering.
**Example badge rendering:**
```typescript
function VisibilityBadge({ visibility }: { visibility: string }) {
  if (visibility === "personal") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Portable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      Company
    </span>
  );
}
```

### Anti-Patterns to Avoid
- **Sending all users' data to client for ranking calculation:** Use SQL window functions server-side. Only send the current user's rank/percentile to the client.
- **Using `toLocaleDateString()` in client components:** Causes hydration mismatch. Use manual UTC formatting as documented in MEMORY.md.
- **Importing from "use server" action files for types:** Causes bundler errors. Define interfaces in the query module (lib/) or a separate types file.
- **Creating new schema tables:** The phase description explicitly states "no new schema" -- all data comes from SQL aggregation on existing tables.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contribution ranking | Manual sort + index | PostgreSQL `RANK()` / `PERCENT_RANK()` window functions | Already proven in `leaderboard.ts`; handles ties correctly, runs server-side |
| Percentile labels | Custom math | `PERCENT_RANK()` result * 100, then label (Top 5%, Top 10%, Top 25%, etc.) | Exact, handles edge cases with 1-2 users |
| Visibility filtering | Custom filter logic | Existing `visibility` column on skills table | Already there since Phase 40, values are "personal" or "tenant" |
| FTE calculations | Custom formulas | Existing constants in `apps/web/lib/constants.ts` (`FTE_HOURS_PER_YEAR`, `FTE_DAYS_PER_YEAR`) | Consistency with rest of app |
| Stat cards | Custom card UI | Existing `StatCard` component from `apps/web/components/stat-card.tsx` | Already has sparkline support, consistent design |

**Key insight:** This phase is almost entirely glue -- the data exists, the UI patterns exist, the ranking logic exists. The only new work is the SQL queries specific to portfolio context and the portfolio view component.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch on Dates/Numbers
**What goes wrong:** Using `toLocaleString()` or `toLocaleDateString()` causes server/client rendering to differ.
**Why it happens:** Node.js and browser have different Intl implementations.
**How to avoid:** Use manual UTC formatting. The codebase has established patterns -- check `my-leverage-view.tsx` for `formatRelativeDate()` and `ip-valuation.ts` for `formatCurrency()`.
**Warning signs:** Console errors about hydration mismatch, text flickering on page load.

### Pitfall 2: Leaking Other Users' Stats
**What goes wrong:** Sending full leaderboard data to compute ranking client-side exposes all users' stats.
**Why it happens:** Naive approach of fetching all contributors and finding current user's position.
**How to avoid:** Use `PERCENT_RANK()` / `RANK()` with a WHERE clause to return only the current user's ranking. The SQL CTE computes the ranking over all users but only returns the current user's row.
**Warning signs:** Query returning more rows than needed, large data payload in server component props.

### Pitfall 3: Empty State for New Users
**What goes wrong:** Page crashes or shows confusing data when user has 0 skills.
**Why it happens:** Division by zero in FTE calculations, null aggregations, empty ranking result.
**How to avoid:** Always use COALESCE in SQL. Handle null/empty ranking result gracefully (show "Create your first skill to see your ranking"). The existing `getUserStats()` in `user-stats.ts` shows proper null handling.
**Warning signs:** NaN in UI, blank stat cards, SQL errors.

### Pitfall 4: Forgetting Tenant Scoping
**What goes wrong:** Portfolio ranking compares against users from all tenants instead of just the current tenant.
**Why it happens:** RLS is enabled but not forced; queries must still filter by tenant_id for defense-in-depth.
**How to avoid:** Always include `WHERE u.tenant_id = ${tenantId}` in ranking queries. Check `session.user.tenantId` exists (redirect if not).
**Warning signs:** Rankings that don't match expectations, users from other orgs appearing in context.

### Pitfall 5: Not Including Draft/Unpublished Skills
**What goes wrong:** User sees different skill count on portfolio vs my-skills page.
**Why it happens:** Portfolio should only count published skills (with `published_version_id IS NOT NULL AND status = 'published'`), but my-skills shows all.
**How to avoid:** Be explicit about which skills count. Portfolio = published only (matching `getUserStats()` pattern). Add a note to the user about this.
**Warning signs:** Inconsistent numbers between pages.

## Code Examples

Verified patterns from existing codebase:

### Auth Guard Pattern (from leverage/page.tsx)
```typescript
// Source: apps/web/app/(protected)/leverage/page.tsx
const session = await auth();
if (!session?.user) redirect("/login");
const tenantId = session.user.tenantId;
if (!tenantId) redirect("/login");
```

### SQL Aggregation with COALESCE (from user-stats.ts)
```typescript
// Source: apps/web/lib/user-stats.ts
const result = await db
  .select({
    skillsShared: sql<number>`COUNT(DISTINCT ${skills.id})`,
    totalUses: sql<number>`COALESCE(SUM(${skills.totalUses}), 0)`,
    avgRating: sql<string>`AVG(${skills.averageRating})`,
    fteDaysSaved: sql<number>`COALESCE(SUM(${skills.totalUses} * ${skills.hoursSaved}) / 8.0, 0)`,
  })
  .from(skills)
  .where(
    and(
      eq(skills.authorId, userId),
      isNotNull(skills.publishedVersionId),
      eq(skills.status, "published")
    )
  );
```

### Window Function Ranking (from leaderboard.ts)
```typescript
// Source: apps/web/lib/leaderboard.ts
const result = await db.execute(sql`
  WITH contributor_stats AS (
    SELECT
      u.id as user_id,
      COUNT(DISTINCT s.id) as skills_shared,
      COALESCE(SUM(s.total_uses * s.hours_saved) / 8.0, 0) as fte_days_saved
    FROM users u
    LEFT JOIN skills s ON s.author_id = u.id
      AND s.published_version_id IS NOT NULL
      AND s.status = 'published'
      AND s.visibility = 'tenant'
    GROUP BY u.id
  )
  SELECT
    RANK() OVER (ORDER BY fte_days_saved DESC, skills_shared DESC) as rank,
    ...
  FROM contributor_stats
  WHERE skills_shared > 0
`);
```

### Visibility Column Values (from skills schema)
```typescript
// Source: packages/db/src/schema/skills.ts (line 49)
visibility: text("visibility").notNull().default("tenant"), // "tenant" or "personal"
```

### Visibility Filter (from packages/db/src/lib/visibility.ts)
```typescript
// Source: packages/db/src/lib/visibility.ts
export function buildVisibilityFilter(userId?: string): SQL {
  if (!userId) {
    return eq(skills.visibility, "tenant");
  }
  return or(
    eq(skills.visibility, "tenant"),
    and(eq(skills.visibility, "personal"), eq(skills.authorId, userId))
  )!;
}
```

### StatCard Reuse (from components/stat-card.tsx)
```typescript
// Source: apps/web/components/stat-card.tsx
<StatCard label="Skills Published" value={stats.skillsPublished} />
<StatCard label="Years Saved" value={(stats.totalHoursSaved / FTE_HOURS_PER_YEAR).toFixed(2)} />
```

### Header Nav Pattern (from layout.tsx)
```typescript
// Source: apps/web/app/(protected)/layout.tsx (lines 59-76)
<nav className="hidden sm:flex sm:gap-6">
  <NavLink href="/" theme={HEADER_THEME}>Home</NavLink>
  <NavLink href="/skills" theme={HEADER_THEME}>Skills</NavLink>
  <NavLink href="/leverage" theme={HEADER_THEME}>Leverage</NavLink>
  <NavLink href="/profile" theme={HEADER_THEME}>Profile</NavLink>
  {isAdmin(session) && (
    <NavLink href="/admin/settings" theme={HEADER_THEME}>Admin</NavLink>
  )}
</nav>
```

## Existing Code to Reuse or Adapt

### Direct Reuse (no changes needed)
| Component/Module | Location | Use In Portfolio |
|------------------|----------|------------------|
| `StatCard` | `components/stat-card.tsx` | Hero stats (skills authored, total uses, hours saved, ranking) |
| `NavLink` | `components/nav-link.tsx` | Add "Portfolio" to header nav |
| `FTE_HOURS_PER_YEAR`, `FTE_DAYS_PER_YEAR` | `lib/constants.ts` | FTE calculations |
| `auth()` | `@/auth` | Session + tenantId |
| `formatRating()` | `@everyskill/db` | Display average ratings |

### Adapt (use as reference pattern)
| Source | Location | Adapt For |
|--------|----------|-----------|
| `getUserStats()` | `lib/user-stats.ts` | Portfolio stats query (add visibility breakdown) |
| `getLeaderboard()` | `lib/leaderboard.ts` | Contribution ranking query (adapt to return only current user's rank/percentile) |
| `getSkillsCreated()` | `lib/my-leverage.ts` | Skill list query (add visibility column to results) |
| `MyLeverageView` | `components/my-leverage-view.tsx` | Portfolio view component layout pattern |
| `IpDashboardView` | `components/ip-dashboard-view.tsx` | Stat card + section layout pattern |

## Data Model Analysis

### Skills Table (key columns for portfolio)
- `author_id` -- FK to users, identifies skill creator
- `visibility` -- "tenant" (company IP) or "personal" (portable IP)
- `total_uses` -- denormalized usage count
- `hours_saved` -- estimated hours saved per use (default 1)
- `average_rating` -- stored as rating * 100 (e.g., 450 = 4.5 stars)
- `status` -- "published" for active skills
- `published_version_id` -- non-null means skill is published
- `tenant_id` -- tenant scoping

### Visibility Scoping (Phase 40)
- `"personal"` = User's own skills, portable, visible only to them
- `"tenant"` = Company-wide skills, company IP, visible to all tenant members
- For portfolio purposes: personal = "Portable" badge, tenant = "Company" badge
- Note: The schema technically supports more values but the UI currently only uses "personal" and "tenant"

### Data Available Without New Schema
All portfolio requirements can be met with existing tables:
1. **Skills authored** -- `SELECT FROM skills WHERE author_id = :userId`
2. **Total usage** -- `SUM(skills.total_uses) WHERE author_id = :userId`
3. **Total hours saved** -- `SUM(total_uses * COALESCE(hours_saved, 1))`
4. **Contribution ranking** -- CTE with `RANK()` over all tenant users
5. **Portable vs company breakdown** -- `GROUP BY skills.visibility`
6. **Per-skill visibility badge** -- `skills.visibility` column in skill list query

## Proposed Query Functions

### 1. `getPortfolioStats(userId: string)`
Returns aggregate stats: skills authored, total uses, total hours saved, avg rating.
Essentially `getUserStats()` with additional breakdown by visibility scope.

### 2. `getPortfolioSkills(userId: string)`
Returns list of published skills with: name, slug, category, totalUses, hoursSaved, avgRating, visibility, createdAt.
Adapt from `getSkillsCreated()` in my-leverage.ts, add `visibility` column.

### 3. `getContributionRanking(userId: string, tenantId: string)`
Returns: rank (integer), totalContributors (integer), percentile (0-100 float), label (string like "Top 15%" or "3rd highest impact").
New function using CTE + RANK() + PERCENT_RANK().

## UI Layout Proposal

```
/portfolio page:
+------------------------------------------------------+
| Hero Stats Row (4 StatCards)                         |
| [Skills Authored] [Total Uses] [Hours Saved] [Rank] |
+------------------------------------------------------+
| Portable vs Company IP Breakdown                      |
| +------------------+  +------------------+           |
| | Portable Skills  |  | Company Skills   |           |
| | 5 skills         |  | 12 skills        |           |
| | 234 hours saved  |  | 1,456 hours saved|           |
| +------------------+  +------------------+           |
+------------------------------------------------------+
| Skills List (sorted by hours saved desc)              |
| [Skill Name] [Category] [Uses] [Hours] [Visibility]  |
| [Skill Name] [Category] [Uses] [Hours] [Visibility]  |
+------------------------------------------------------+
```

## Nav Integration

Add "Portfolio" link to the main header nav between "Leverage" and "Profile":
```typescript
<NavLink href="/portfolio" theme={HEADER_THEME}>Portfolio</NavLink>
```

This is visible to all authenticated users (not admin-gated).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Profile page shows basic stats | Separate portfolio route for impact focus | Phase 65 (new) | Clean separation of account vs impact concerns |
| No visibility badges | Visibility scoping from Phase 40 | Phase 40 (v3.0) | Enables portable vs company IP distinction |
| Leaderboard on home page | Leaderboard + individual ranking on portfolio | Phase 65 (new) | Personalized context for each user |

**Deprecated/outdated:**
- None relevant. All existing patterns are current.

## Open Questions

1. **Ranking label format**
   - What we know: Success criteria says "Top 15% of contributors" or "3rd highest impact" -- two different formats.
   - What's unclear: Which format to use, or both?
   - Recommendation: Use percentile for large teams (>20 users, show "Top X%"), absolute rank for small teams (<=20, show "Xth of Y"). This gives meaningful context at any scale. Claude's discretion.

2. **Include all skills or only tenant-visible in ranking?**
   - What we know: The existing `getLeaderboard()` filters to `visibility = 'tenant'` only. Personal skills are excluded from the public leaderboard.
   - What's unclear: Should the portfolio ranking also exclude personal skills (ranking by company contribution only), or include all skills (ranking by total output)?
   - Recommendation: Include all skills in the user's own portfolio stats (they should see their full impact). For the ranking comparison against other users, use only tenant-visible skills (matching leaderboard behavior) since personal skills are private.

3. **Link from Profile to Portfolio**
   - What we know: Profile page exists at /profile with basic stats. Portfolio is a separate route.
   - What's unclear: Should Profile link to Portfolio, or are they fully independent nav items?
   - Recommendation: Add a link card on the Profile page pointing to Portfolio ("View your full portfolio"), and add Portfolio as a top-level nav item. Both approaches are low-cost.

## Plan Sizing Estimate

This phase can be completed in **2 plans**:

**Plan 1 (Data Layer):** Query module + nav link
- Create `apps/web/lib/portfolio-queries.ts` with 3 functions
- Add "Portfolio" NavLink in header layout
- ~100 lines of SQL + TypeScript

**Plan 2 (UI Layer):** Page + view component + E2E test
- Create `apps/web/app/(protected)/portfolio/page.tsx` (server component)
- Create `apps/web/components/portfolio-view.tsx` (client component with StatCards, breakdown, skill list)
- Create `apps/web/tests/e2e/portfolio.spec.ts` (basic load + content verification)
- ~200 lines of TSX

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/skills.ts` -- Skills table with visibility column, totalUses, hoursSaved, authorId
- `packages/db/src/schema/usage-events.ts` -- Usage tracking table
- `packages/db/src/schema/ratings.ts` -- Ratings with hoursSavedEstimate
- `packages/db/src/lib/visibility.ts` -- Visibility filter functions
- `apps/web/lib/user-stats.ts` -- Existing user stats aggregation
- `apps/web/lib/leaderboard.ts` -- RANK() window function pattern
- `apps/web/lib/my-leverage.ts` -- getSkillsCreated() and getSkillsCreatedStats()
- `apps/web/lib/ip-dashboard-queries.ts` -- Complex SQL aggregation patterns
- `apps/web/app/(protected)/layout.tsx` -- Header nav structure
- `apps/web/components/stat-card.tsx` -- Reusable stat card component
- `apps/web/components/my-leverage-view.tsx` -- Client view component pattern

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` -- Phase 65 requirements and dependency graph
- `.planning/REQUIREMENTS.md` -- PORT-01, PORT-02 requirement text

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries needed; all patterns well-established in codebase
- Architecture: HIGH -- Follows exact patterns from 10+ existing pages (leverage, ip-dashboard, profile, etc.)
- Pitfalls: HIGH -- All pitfalls observed from existing codebase patterns and documented in MEMORY.md
- Data model: HIGH -- Directly inspected schema and confirmed visibility column, aggregation fields

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no external dependencies, all internal patterns)
