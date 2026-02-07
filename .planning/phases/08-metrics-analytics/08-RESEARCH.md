# Phase 8: Metrics & Analytics - Research

**Researched:** 2026-01-31
**Domain:** Analytics dashboards, leaderboards, trending algorithms, platform-wide aggregations
**Confidence:** HIGH

## Summary

Phase 8 requires building platform-level analytics features: a global dashboard showing aggregate statistics, a trending section to surface popular skills based on usage velocity, a leaderboard recognizing top contributors, and complete user profile statistics. The phase builds on existing infrastructure (skill-level FTE Days Saved calculation, usage tracking, sparkline visualization) and extends it to platform-wide aggregations and discovery features.

The standard approach uses server-side data fetching with Next.js 15 Server Components, PostgreSQL window functions for ranking queries, Drizzle ORM for type-safe aggregations, and time-decay algorithms for trending content discovery. The existing tech stack (Next.js 15, React 19, Tailwind CSS 4, Drizzle ORM, PostgreSQL) is well-suited for these requirements.

**Primary recommendation:** Use Server Components for all dashboard data fetching, PostgreSQL RANK() window functions for leaderboards, and a simple time-decay trending algorithm (Hacker News-style) to surface skills with recent usage velocity. Aggregate statistics should be computed on-demand from existing denormalized fields (skills.totalUses, skills.averageRating) rather than creating additional aggregate tables.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5+ | Server Components for dashboards | Industry standard for React SSR, optimal for analytics dashboards with heavy data fetching |
| Drizzle ORM | 0.38.0 | Type-safe SQL aggregations | Already in use, excellent for complex aggregation queries with full TypeScript support |
| PostgreSQL | Latest | Window functions (RANK), aggregations | Native support for analytics queries, window functions ideal for leaderboards |
| react-sparklines | 1.7.0 | Usage trend visualization | Already implemented for skill-level trends, reuse for consistency |
| Tailwind CSS | 4.0 | Dashboard UI styling | Already in use, consistent with existing design system |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sql`` operator | Built-in Drizzle | Raw SQL for complex queries | Window functions, CTEs not yet supported by query builder |
| PostgreSQL date_trunc | Built-in | Time-based aggregations | Trending calculations, usage velocity over time windows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-sparklines | recharts, victory | More features but heavier bundle, existing sparklines sufficient |
| On-demand aggregation | Materialized views | Better performance but adds complexity, premature for current scale |
| Simple trending | ML-based recommendations | More sophisticated but overkill for Phase 8 scope |

**Installation:**
```bash
# All dependencies already installed
# react-sparklines: 1.7.0 ✓
# drizzle-orm: 0.38.0 ✓
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── lib/
│   ├── skill-stats.ts          # ✓ Existing - skill-level FTE calculation
│   ├── usage-trends.ts         # ✓ Existing - sparkline data fetching
│   ├── platform-stats.ts       # NEW - platform-wide aggregations
│   ├── leaderboard.ts          # NEW - contributor rankings
│   └── trending.ts             # NEW - trending algorithm
├── app/(protected)/
│   ├── page.tsx                # ✓ Existing - update with real dashboard data
│   └── profile/page.tsx        # ✓ Existing - update with real user stats
packages/db/src/
├── services/
│   └── skill-metrics.ts        # ✓ Existing - denormalized updates
```

### Pattern 1: Server Component Dashboard Data Fetching
**What:** Fetch all dashboard data server-side in parallel using Promise.all
**When to use:** Dashboard pages that show aggregated statistics
**Example:**
```typescript
// Source: Next.js 15 best practices + existing codebase patterns
// apps/web/app/(protected)/page.tsx
export default async function DashboardPage() {
  const [platformStats, trending, topContributors] = await Promise.all([
    getPlatformStats(),
    getTrendingSkills(10),
    getLeaderboard(10)
  ]);

  return (
    <div>
      <PlatformStatsCards stats={platformStats} />
      <TrendingSection skills={trending} />
      <LeaderboardTable contributors={topContributors} />
    </div>
  );
}
```

### Pattern 2: PostgreSQL Window Functions for Leaderboards
**What:** Use RANK() or DENSE_RANK() window functions to generate rankings in SQL
**When to use:** Leaderboards, top contributors, ranking queries
**Example:**
```typescript
// Source: https://neon.com/postgresql/postgresql-window-function/postgresql-rank-function
// apps/web/lib/leaderboard.ts
import { sql } from "drizzle-orm";

const leaderboard = await db.execute(sql`
  WITH contributor_stats AS (
    SELECT
      u.id,
      u.name,
      u.image,
      COUNT(DISTINCT s.id) as skills_shared,
      COALESCE(SUM(s.total_uses), 0) as total_uses,
      COALESCE(AVG(s.average_rating), 0) as avg_rating,
      COALESCE(SUM(s.total_uses * s.hours_saved) / 8.0, 0) as fte_days_saved
    FROM users u
    LEFT JOIN skills s ON s.author_id = u.id
    WHERE s.published_version_id IS NOT NULL
    GROUP BY u.id, u.name, u.image
  )
  SELECT
    *,
    RANK() OVER (ORDER BY fte_days_saved DESC) as rank
  FROM contributor_stats
  WHERE skills_shared > 0
  ORDER BY rank
  LIMIT 10
`);
```

### Pattern 3: Time-Decay Trending Algorithm (Hacker News-style)
**What:** Calculate trending score using recent usage velocity with time decay
**When to use:** Surfacing recently popular content, "hot" sections
**Example:**
```typescript
// Source: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d
// apps/web/lib/trending.ts
// Formula: score = (p - 1) / (t + 2)^gravity
// p = points (usage count in last 7 days)
// t = age in hours since skill published
// gravity = 1.8 (higher = faster decay)

const trending = await db.execute(sql`
  WITH skill_recent_usage AS (
    SELECT
      skill_id,
      COUNT(*) as recent_uses,
      EXTRACT(EPOCH FROM (NOW() - MIN(s.created_at))) / 3600 as age_hours
    FROM usage_events ue
    JOIN skills s ON s.id = ue.skill_id
    WHERE ue.created_at >= NOW() - INTERVAL '7 days'
      AND s.published_version_id IS NOT NULL
    GROUP BY skill_id
  )
  SELECT
    s.*,
    sru.recent_uses,
    (sru.recent_uses - 1) / POWER(sru.age_hours + 2, 1.8) as trending_score
  FROM skill_recent_usage sru
  JOIN skills s ON s.id = sru.skill_id
  WHERE sru.recent_uses >= 3  -- minimum threshold
  ORDER BY trending_score DESC
  LIMIT 20
`);
```

### Pattern 4: Platform-Wide Aggregations from Denormalized Fields
**What:** Sum denormalized counters (totalUses, averageRating) across all skills
**When to use:** Dashboard summary statistics
**Example:**
```typescript
// Source: Existing codebase + Drizzle ORM aggregation patterns
// apps/web/lib/platform-stats.ts
import { sql } from "drizzle-orm";
import { db } from "@everyskill/db";
import { skills, users } from "@everyskill/db/schema";

export async function getPlatformStats() {
  const [skillStats, userStats] = await Promise.all([
    db.select({
      totalDownloads: sql<number>`COALESCE(SUM(${skills.totalUses}), 0)`,
      totalFteDaysSaved: sql<number>`COALESCE(SUM(${skills.totalUses} * ${skills.hoursSaved}) / 8.0, 0)`,
    }).from(skills).where(sql`${skills.publishedVersionId} IS NOT NULL`),

    db.select({
      totalContributors: sql<number>`COUNT(DISTINCT ${users.id})`,
    }).from(users)
      .innerJoin(skills, sql`${skills.authorId} = ${users.id} AND ${skills.publishedVersionId} IS NOT NULL`)
  ]);

  return {
    totalContributors: userStats[0]?.totalContributors ?? 0,
    totalDownloads: skillStats[0]?.totalDownloads ?? 0,
    totalUses: skillStats[0]?.totalDownloads ?? 0, // alias
    totalFteDaysSaved: Math.round((skillStats[0]?.totalFteDaysSaved ?? 0) * 10) / 10,
  };
}
```

### Pattern 5: User Profile Statistics Aggregation
**What:** Aggregate all skills authored by a user with their totals
**When to use:** Profile pages showing user contributions
**Example:**
```typescript
// apps/web/lib/user-stats.ts
export async function getUserStats(userId: string) {
  const result = await db.select({
    skillsShared: sql<number>`COUNT(DISTINCT ${skills.id})`,
    totalUses: sql<number>`COALESCE(SUM(${skills.totalUses}), 0)`,
    avgRating: sql<string>`AVG(${skills.averageRating})`, // returns string
    fteDaysSaved: sql<number>`COALESCE(SUM(${skills.totalUses} * ${skills.hoursSaved}) / 8.0, 0)`,
  })
  .from(skills)
  .where(and(
    eq(skills.authorId, userId),
    isNotNull(skills.publishedVersionId)
  ));

  const avgRating = result[0]?.avgRating
    ? parseFloat(result[0].avgRating)
    : null;

  return {
    skillsShared: result[0]?.skillsShared ?? 0,
    totalUses: result[0]?.totalUses ?? 0,
    avgRating: avgRating ? (avgRating / 100).toFixed(1) : null,
    fteDaysSaved: Math.round((result[0]?.fteDaysSaved ?? 0) * 10) / 10,
  };
}
```

### Anti-Patterns to Avoid
- **Creating aggregate tables:** Don't create separate analytics tables - use denormalized fields and on-demand aggregation for current scale
- **Client-side aggregation:** Don't fetch raw data and aggregate in React - always aggregate in SQL
- **N+1 queries in dashboards:** Don't fetch user stats in a loop - use single query with GROUP BY
- **Real-time updates:** Don't use WebSockets for dashboard updates - static SSR with revalidation sufficient

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trending algorithm | Complex ML ranking model | Hacker News time-decay formula | Simple, proven, sufficient for discovery at current scale |
| Leaderboard rankings | Manual sorting in JS | PostgreSQL RANK() window function | Native SQL performance, handles ties correctly |
| Date aggregations | Custom date bucketing | PostgreSQL date_trunc() | Optimized, timezone-aware, built-in |
| Sparkline rendering | Custom SVG charts | react-sparklines (existing) | Already implemented, consistent UI |
| FTE calculation | New aggregation logic | Existing getSkillStats pattern | Already handles user vs creator estimates correctly |

**Key insight:** PostgreSQL has powerful built-in analytics capabilities (window functions, aggregations, date functions) that are faster and more correct than custom JavaScript implementations. Leverage the database for what it does best.

## Common Pitfalls

### Pitfall 1: avg() Returns String in Drizzle ORM
**What goes wrong:** Treating avgRating as number causes TypeScript/runtime errors
**Why it happens:** PostgreSQL avg() returns NUMERIC type, Drizzle maps to string
**How to avoid:** Always use `sql<string>` type annotation and parseFloat before calculations
**Warning signs:** TypeScript errors on numeric operations, NaN in calculations
```typescript
// WRONG
const avg = sql<number>`AVG(${skills.averageRating})`;  // Type mismatch

// CORRECT (already in codebase)
const avgRating = sql<string>`AVG(${skills.averageRating})`;
const parsed = parseFloat(avgRating) / 100;
```

### Pitfall 2: Division by Zero in FTE Calculation
**What goes wrong:** NULL or zero hoursSaved causes division errors or incorrect results
**Why it happens:** Skills may not have hoursSaved set, or default to NULL
**How to avoid:** Use COALESCE in SQL or null-coalescing in JS with sensible defaults
**Warning signs:** NULL in dashboard displays, NaN in calculations
```typescript
// Use COALESCE in SQL for safety
sql`COALESCE(SUM(${skills.totalUses} * ${skills.hoursSaved}), 0) / 8.0`
```

### Pitfall 3: Including Unpublished Skills in Aggregations
**What goes wrong:** Draft skills inflate contributor counts and statistics
**Why it happens:** Forgetting WHERE clause for publishedVersionId IS NOT NULL
**How to avoid:** Always filter for published skills in all platform statistics
**Warning signs:** Stats jump when users create drafts, inaccurate contributor counts
```typescript
// ALWAYS include this filter
.where(sql`${skills.publishedVersionId} IS NOT NULL`)
```

### Pitfall 4: Trending Algorithm Without Minimum Threshold
**What goes wrong:** Brand new skills with 1-2 uses dominate trending due to recency
**Why it happens:** Time decay favors very recent items regardless of absolute usage
**How to avoid:** Require minimum usage threshold (e.g., 3+ uses in lookback period)
**Warning signs:** Trending section shows barely-used skills, unstable rankings
```typescript
WHERE sru.recent_uses >= 3  -- minimum threshold
```

### Pitfall 5: Leaderboard Ties Without DENSE_RANK
**What goes wrong:** Using RANK() creates gaps in rankings for tied scores
**Why it happens:** RANK() assigns 1, 1, 3 for ties instead of 1, 1, 2
**How to avoid:** Use DENSE_RANK() if you want continuous rankings, or RANK() if gaps are acceptable
**Warning signs:** Ranking goes from #1 to #5 with ties at #1
```typescript
// Use DENSE_RANK() for continuous rankings
DENSE_RANK() OVER (ORDER BY fte_days_saved DESC) as rank
// Or RANK() if gaps are intentional (shows magnitude of ties)
RANK() OVER (ORDER BY fte_days_saved DESC) as rank
```

## Code Examples

Verified patterns from official sources:

### Dashboard Page with Parallel Data Fetching
```typescript
// apps/web/app/(protected)/page.tsx
import { getPlatformStats } from "@/lib/platform-stats";
import { getTrendingSkills } from "@/lib/trending";
import { getLeaderboard } from "@/lib/leaderboard";

export default async function DashboardPage() {
  // Fetch all dashboard data in parallel (Server Component)
  const [stats, trending, leaderboard] = await Promise.all([
    getPlatformStats(),
    getTrendingSkills(10),
    getLeaderboard(10),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Platform Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Contributors" value={stats.totalContributors} />
        <StatCard label="Total Downloads" value={stats.totalDownloads} />
        <StatCard label="Total Uses" value={stats.totalUses} />
        <StatCard label="FTE Days Saved" value={stats.totalFteDaysSaved} />
      </div>

      {/* Trending Skills Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Trending Skills</h2>
        <div className="grid grid-cols-2 gap-4">
          {trending.map(skill => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </section>

      {/* Leaderboard Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Top Contributors</h2>
        <LeaderboardTable contributors={leaderboard} />
      </section>
    </div>
  );
}
```

### Complete Leaderboard Query with Rankings
```typescript
// apps/web/lib/leaderboard.ts
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  skillsShared: number;
  totalUses: number;
  avgRating: string | null;
  fteDaysSaved: number;
}

export async function getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  if (!db) return [];

  const results = await db.execute(sql`
    WITH contributor_stats AS (
      SELECT
        u.id as user_id,
        u.name,
        u.image,
        COUNT(DISTINCT s.id) as skills_shared,
        COALESCE(SUM(s.total_uses), 0) as total_uses,
        COALESCE(AVG(s.average_rating), 0) as avg_rating,
        COALESCE(SUM(s.total_uses * s.hours_saved) / 8.0, 0) as fte_days_saved
      FROM users u
      LEFT JOIN skills s ON s.author_id = u.id
        AND s.published_version_id IS NOT NULL
      GROUP BY u.id, u.name, u.image
    )
    SELECT
      RANK() OVER (ORDER BY fte_days_saved DESC, skills_shared DESC) as rank,
      user_id,
      name,
      image,
      skills_shared::integer,
      total_uses::integer,
      CASE
        WHEN avg_rating > 0 THEN (avg_rating / 100)::numeric(3,1)::text
        ELSE NULL
      END as avg_rating,
      ROUND(fte_days_saved::numeric, 1)::double precision as fte_days_saved
    FROM contributor_stats
    WHERE skills_shared > 0
    ORDER BY rank
    LIMIT ${limit}
  `);

  return results.rows as LeaderboardEntry[];
}
```

### Trending Skills Algorithm
```typescript
// apps/web/lib/trending.ts
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

export interface TrendingSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  recentUses: number;
  trendingScore: number;
  totalUses: number;
}

/**
 * Get trending skills using time-decay algorithm
 * Formula: score = (recent_uses - 1) / (age_hours + 2)^1.8
 *
 * Surfaces skills with high recent usage velocity
 * 7-day lookback window, minimum 3 uses to qualify
 */
export async function getTrendingSkills(limit: number = 10): Promise<TrendingSkill[]> {
  if (!db) return [];

  const results = await db.execute(sql`
    WITH skill_recent_usage AS (
      SELECT
        ue.skill_id,
        COUNT(*) as recent_uses,
        EXTRACT(EPOCH FROM (NOW() - MIN(s.created_at))) / 3600 as age_hours
      FROM usage_events ue
      JOIN skills s ON s.id = ue.skill_id
      WHERE ue.created_at >= NOW() - INTERVAL '7 days'
        AND s.published_version_id IS NOT NULL
      GROUP BY ue.skill_id
      HAVING COUNT(*) >= 3  -- minimum threshold
    )
    SELECT
      s.id,
      s.name,
      s.slug,
      s.description,
      s.category,
      sru.recent_uses::integer,
      ((sru.recent_uses - 1) / POWER(sru.age_hours + 2, 1.8))::double precision as trending_score,
      s.total_uses
    FROM skill_recent_usage sru
    JOIN skills s ON s.id = sru.skill_id
    ORDER BY trending_score DESC
    LIMIT ${limit}
  `);

  return results.rows as TrendingSkill[];
}
```

### User Profile Statistics
```typescript
// apps/web/lib/user-stats.ts
import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema";
import { sql, eq, and, isNotNull } from "drizzle-orm";

export interface UserStats {
  skillsShared: number;
  totalUses: number;
  avgRating: string | null;
  fteDaysSaved: number;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  if (!db) {
    return {
      skillsShared: 0,
      totalUses: 0,
      avgRating: null,
      fteDaysSaved: 0,
    };
  }

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
        isNotNull(skills.publishedVersionId)
      )
    );

  const avgRatingValue = result[0]?.avgRating
    ? parseFloat(result[0].avgRating)
    : null;

  return {
    skillsShared: result[0]?.skillsShared ?? 0,
    totalUses: result[0]?.totalUses ?? 0,
    avgRating: avgRatingValue ? (avgRatingValue / 100).toFixed(1) : null,
    fteDaysSaved: Math.round((result[0]?.fteDaysSaved ?? 0) * 10) / 10,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side filtering for trending | Server-side SQL with time-decay | 2020s+ | Better performance, more sophisticated algorithms |
| JavaScript sorting for rankings | PostgreSQL window functions | PostgreSQL 8.4+ (2009) | Native DB performance, correct tie handling |
| Real-time WebSocket updates | Server Components with revalidation | Next.js 13+ (2022) | Simpler architecture, better SEO |
| Separate analytics database | Denormalized aggregates in main DB | Modern ORMs | Acceptable for <100k records, simpler stack |
| Manual date bucketing | date_trunc() native function | Always available | More correct, timezone-aware |

**Deprecated/outdated:**
- Class components for dashboards: Use Server Components in Next.js 15
- getServerSideProps: Use Server Components directly, not legacy data fetching
- Separate charting libraries: react-sparklines already in use, sufficient for sparklines

## Open Questions

1. **Leaderboard tie-breaking strategy**
   - What we know: PostgreSQL offers RANK() (with gaps) and DENSE_RANK() (continuous)
   - What's unclear: Product decision on whether ties should create ranking gaps
   - Recommendation: Use RANK() initially (shows magnitude of ties), easy to change to DENSE_RANK() if needed

2. **Trending time window and thresholds**
   - What we know: Hacker News uses hours-based decay, minimum thresholds prevent noise
   - What's unclear: Optimal lookback period (7 days?) and minimum uses (3?) for this platform
   - Recommendation: Start with 7-day window, 3-use minimum; tune based on data volume

3. **Dashboard caching strategy**
   - What we know: Server Components can use Next.js revalidation
   - What's unclear: Appropriate revalidation period for dashboard data (5 min? 15 min? 1 hour?)
   - Recommendation: Start with 5-minute revalidation, monitor and adjust based on traffic

4. **Leaderboard pagination**
   - What we know: Window functions can paginate with ROW_NUMBER and OFFSET
   - What's unclear: Whether leaderboard needs pagination in Phase 8 or just top 10
   - Recommendation: Implement top 10 only for Phase 8, add pagination if needed later

## Sources

### Primary (HIGH confidence)
- [PostgreSQL RANK() window function documentation](https://www.postgresql.org/docs/current/functions-window.html) - Official PostgreSQL docs
- [Drizzle ORM aggregation queries](https://orm.drizzle.team/docs/select) - Official Drizzle docs
- [Next.js 15 Server Components](https://nextjs.org/docs) - Official Next.js documentation
- [Hacker News ranking algorithm explained](https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d) - Detailed algorithm analysis
- Existing codebase patterns:
  - `/home/claude/projects/relay/apps/web/lib/skill-stats.ts` - FTE calculation pattern
  - `/home/claude/projects/relay/apps/web/lib/usage-trends.ts` - Batch query pattern
  - `/home/claude/projects/relay/apps/web/components/sparkline.tsx` - Visualization component

### Secondary (MEDIUM confidence)
- [Next.js dashboard patterns 2026](https://nextjstemplates.com/blog/admin-dashboard-templates) - Modern dashboard implementations
- [PostgreSQL leaderboard query example](https://blog.programster.org/postgresql-leaderboard-query-example) - Practical leaderboard implementation
- [Trending algorithms with decay](https://github.com/clux/decay) - npm package implementing Reddit/HN algorithms
- [Dashboard UI components with Tailwind](https://tailadmin.com/) - Reference for leaderboard UI patterns

### Tertiary (LOW confidence)
- [react-sparklines GitHub status](https://github.com/borisyankov/react-sparklines) - Library maintenance status (minimally maintained but functional)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified patterns from existing code
- Architecture: HIGH - PostgreSQL window functions well-documented, trending algorithms proven at scale
- Pitfalls: HIGH - avg() string behavior verified in existing code, other pitfalls from PostgreSQL docs

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (60 days - stable domain, minimal API changes expected)
