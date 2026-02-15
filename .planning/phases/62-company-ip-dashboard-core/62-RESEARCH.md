# Phase 62: Company IP Dashboard Core - Research

**Researched:** 2026-02-15
**Domain:** Next.js Server Components + Recharts analytics dashboard + SQL aggregation
**Confidence:** HIGH

## Summary

Phase 62 adds a new admin-only "IP Dashboard" page under `/leverage/ip-dashboard` that displays hero KPI stat cards (total skills captured, total uses, total hours saved, active contributors) and an org-wide quality trends chart (monthly granularity) showing average quality scores, feedback sentiment, and benchmark results over time.

This phase requires zero new schema -- all data comes from existing tables: `skills`, `usage_events`, `ratings`, `skill_feedback`, `benchmark_results`, and `token_measurements`. The project already has a well-established pattern for Leverage analytics pages (server component page.tsx fetches data, passes to client components with Recharts charts). The quality trend chart is the only novel element -- it needs a multi-line Recharts LineChart (or AreaChart), which is a new pattern for this codebase (all existing charts are single-series AreaCharts).

**Primary recommendation:** Follow the exact `/leverage/company` page pattern -- new server page at `/leverage/ip-dashboard/page.tsx`, admin-gated, with a query module in `apps/web/lib/ip-dashboard-queries.ts` and client components for the stat cards grid and quality trends chart. Add the tab to `leverage-nav.tsx`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.7.0 | Chart rendering (AreaChart, LineChart, multi-line) | Already installed, used in 6+ chart components |
| drizzle-orm | 0.42.0 | SQL query builder for aggregate queries | Already in use, all analytics queries use `db.execute(sql`...`)` pattern |
| next.js | 16.1.6 | Server Components for data fetching | All leverage pages use async server components |
| nuqs | (installed) | URL query state for TimeRangeSelector | Already used for time range on all leverage pages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-sparklines | (installed) | Mini trend sparklines in stat cards | Optional enhancement for hero stat cards |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts LineChart | Recharts AreaChart with multiple Areas | AreaChart hides lower series under fill; LineChart is cleaner for multi-series overlay |
| Raw SQL via db.execute | Drizzle query builder | Raw SQL is the established pattern in analytics-queries.ts; switching would be inconsistent |
| New server action | Direct query in lib module | Existing pattern uses lib modules for server-component queries, server actions only for client-initiated fetches |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
  app/(protected)/leverage/
    ip-dashboard/
      page.tsx                    # Admin-gated server component (follows employees/page.tsx pattern)
    leverage-nav.tsx              # Add "IP Dashboard" tab (adminOnly: true)
  lib/
    ip-dashboard-queries.ts       # SQL aggregation queries (follows analytics-queries.ts pattern)
  components/
    ip-dashboard-view.tsx         # Client component: stat cards + quality chart container
    quality-trend-chart.tsx       # Multi-line Recharts chart for quality trends
```

### Pattern 1: Admin-Gated Leverage Page
**What:** Server component that checks auth + isAdmin before rendering, passes fetched data to client components.
**When to use:** All admin-only leverage sub-pages follow this pattern.
**Example (from employees/page.tsx):**
```typescript
// Source: apps/web/app/(protected)/leverage/employees/page.tsx
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function LeverageEmployeesPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isAdmin(session)) redirect("/leverage");

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login");

  // Fetch data, pass to client component
}
```

### Pattern 2: SQL Aggregation Queries in Lib Module
**What:** Raw SQL queries via `db.execute(sql`...`)` with tenant_id filtering, returning typed interfaces.
**When to use:** All analytics queries follow this pattern in `analytics-queries.ts`.
**Example (from analytics-queries.ts):**
```typescript
// Source: apps/web/lib/analytics-queries.ts
export async function getOverviewStats(tenantId: string, startDate: Date): Promise<OverviewStats> {
  if (!db) return { /* defaults */ };

  const startDateStr = startDate.toISOString();
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ue.skill_id)::integer AS skills_deployed,
      -- ...
    FROM usage_events ue
    WHERE ue.tenant_id = ${tenantId}
      AND ue.created_at >= ${startDateStr}
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];
  return { /* typed result */ };
}
```

### Pattern 3: Recharts Chart Component (Hydration-Safe)
**What:** "use client" component using ResponsiveContainer + chart type, with UTC date formatting to avoid hydration mismatches.
**When to use:** Every chart in the codebase.
**Key detail:** Use manual UTC formatting (`MONTHS[d.getUTCMonth()] + " " + d.getUTCDate()`) -- NEVER `toLocaleDateString()` which causes hydration mismatches between server and client.
**Example (from cost-trend-chart.tsx):**
```typescript
// Source: apps/web/components/cost-trend-chart.tsx
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDateShort(date: string): string {
  const d = new Date(date);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
}
```

### Pattern 4: Multi-Line Recharts Chart (NEW for this phase)
**What:** A LineChart (or AreaChart) with multiple `<Line>` (or `<Area>`) elements for different data series.
**When to use:** Quality trends chart needs 3 series: avg quality score, feedback sentiment %, benchmark avg score.
**Example (Recharts v3 multi-line):**
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Data: [{ date: "2026-01", avgRating: 4.2, sentimentPct: 78, benchmarkScore: 72 }, ...]
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} />
    <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }} />
    <Legend />
    <Line type="monotone" dataKey="avgRating" stroke="#3b82f6" name="Avg Rating" strokeWidth={2} dot={false} />
    <Line type="monotone" dataKey="sentimentPct" stroke="#10b981" name="Positive Sentiment %" strokeWidth={2} dot={false} />
    <Line type="monotone" dataKey="benchmarkScore" stroke="#8b5cf6" name="Benchmark Score" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

### Pattern 5: Leverage Nav Tab Registration
**What:** Add new tab to the `tabs` array in `leverage-nav.tsx`.
**Example (from leverage-nav.tsx):**
```typescript
const tabs = [
  { label: "Me", href: "/leverage", adminOnly: false },
  { label: "My Company", href: "/leverage/company", adminOnly: false },
  { label: "Employees", href: "/leverage/employees", adminOnly: true },
  { label: "Skills", href: "/leverage/skills", adminOnly: true },
  // ADD:
  { label: "IP Dashboard", href: "/leverage/ip-dashboard", adminOnly: true },
];
```

### Anti-Patterns to Avoid
- **toLocaleDateString() in client components:** Causes hydration mismatch -- use manual UTC formatting
- **Re-exporting types from "use server" files:** Causes runtime bundler errors -- types go in lib modules
- **New schema for aggregation:** Phase 62 explicitly requires NO new schema -- all data derived from existing tables
- **Server actions for initial page data:** Use direct queries in lib modules; server actions are for client-triggered fetches only

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time series gap filling | Custom date iteration | `fillMissingDates()` from analytics-queries.ts | Already handles day/week/month granularity correctly |
| Time range selection | Custom URL state management | `TimeRangeSelector` + `useTimeRange()` hook (nuqs-based) | Already used on all leverage pages |
| Stat card layout | Custom card styling | Existing `StatCard` component | Consistent look, supports sparklines |
| Admin access control | Custom role checks | `isAdmin(session)` from `@/lib/admin` | Single source of truth for admin checks |
| Date formatting | `toLocaleDateString()` | Manual UTC formatting (see cost-trend-chart.tsx pattern) | Prevents hydration mismatches |

**Key insight:** This page is 90% recombination of existing patterns. The only novel SQL is the quality trends aggregation. Everything else (page structure, stat cards, nav tab, time range, chart rendering) follows established patterns.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch on Dates
**What goes wrong:** `toLocaleDateString()` produces different output on Node.js vs browser, causing React hydration errors.
**Why it happens:** Different Intl implementations between server and client environments.
**How to avoid:** Use manual UTC formatting: `MONTHS[d.getUTCMonth()] + " " + d.getUTCDate()` (pattern from `cost-trend-chart.tsx`).
**Warning signs:** Console errors about "Text content does not match server-rendered HTML."

### Pitfall 2: Empty Data Rendering
**What goes wrong:** Charts crash or look broken when there are zero rows in skill_feedback, ratings, or benchmark_results.
**Why it happens:** New or test tenants may have skills but no feedback/ratings/benchmarks yet.
**How to avoid:** Every chart component must have an empty-state fallback (dashed border + "No data" message). Every SQL query must use COALESCE for nullable aggregates. The trends query must handle zero rows by returning an empty array.
**Warning signs:** Division by zero in percentage calculations, null reference errors in chart rendering.

### Pitfall 3: Mixing Scales on Multi-Line Chart
**What goes wrong:** Quality scores (0-100), sentiment percentages (0-100%), and ratings (1-5) have different scales, making the chart unreadable.
**Why it happens:** Naively plotting all three on the same Y axis.
**How to avoid:** Normalize all values to 0-100 scale. Ratings (1-5) can be mapped to 0-100: `((rating - 1) / 4) * 100`. Sentiment is already 0-100%. Benchmark quality_score is already 0-100.
**Warning signs:** One line hugging the bottom while another is at the top.

### Pitfall 4: Performance on Large Datasets
**What goes wrong:** Monthly aggregation across all time for large tenants could be slow.
**Why it happens:** No time bounds on trend queries, scanning entire tables.
**How to avoid:** Always filter by `created_at >= startDate` using the TimeRangeSelector. The `_created_at_idx` indexes on skill_feedback, ratings, and benchmark_results tables support this. Use `date_trunc('month', ...)` for monthly granularity.
**Warning signs:** Page load times > 3 seconds.

### Pitfall 5: Tenant Isolation
**What goes wrong:** Data leak between tenants if tenant_id filter is missing from any query.
**Why it happens:** Copy-paste error or forgetting tenant_id in a subquery.
**How to avoid:** Every SQL query MUST include `WHERE ... tenant_id = ${tenantId}`. Follow the existing pattern in analytics-queries.ts where tenantId is the first parameter to every function.
**Warning signs:** Dashboard shows data from other organizations.

### Pitfall 6: "Active Contributors" Definition Ambiguity
**What goes wrong:** Different definition of "active contributor" leads to confusing numbers.
**Why it happens:** Could mean skill authors, skill users, feedback givers, etc.
**How to avoid:** Define precisely: an "active contributor" is a user who has authored at least one skill (skills.author_id) within the tenant. This is distinct from "active employees" (users who have used skills) shown on the company page.
**Warning signs:** Numbers look the same as the company page's "Active Employees" stat.

## Code Examples

### IP Dashboard Hero Stats Query
```typescript
// Source: derived from analytics-queries.ts pattern + skills/usage_events schemas
export interface IpDashboardStats {
  totalSkillsCaptured: number;
  totalUses: number;
  totalHoursSaved: number;
  activeContributors: number;
}

export async function getIpDashboardStats(tenantId: string): Promise<IpDashboardStats> {
  if (!db) return { totalSkillsCaptured: 0, totalUses: 0, totalHoursSaved: 0, activeContributors: 0 };

  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::integer FROM skills WHERE tenant_id = ${tenantId} AND status = 'published') AS total_skills,
      (SELECT COUNT(*)::integer FROM usage_events WHERE tenant_id = ${tenantId}) AS total_uses,
      (SELECT COALESCE(SUM(COALESCE(s.hours_saved, 1) * s.total_uses), 0)::double precision
       FROM skills s WHERE s.tenant_id = ${tenantId} AND s.status = 'published') AS total_hours_saved,
      (SELECT COUNT(DISTINCT author_id)::integer FROM skills WHERE tenant_id = ${tenantId} AND author_id IS NOT NULL AND status = 'published') AS active_contributors
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];
  return {
    totalSkillsCaptured: Number(row?.total_skills ?? 0),
    totalUses: Number(row?.total_uses ?? 0),
    totalHoursSaved: Number(row?.total_hours_saved ?? 0),
    activeContributors: Number(row?.active_contributors ?? 0),
  };
}
```

### Quality Trends Query (Monthly Aggregation)
```typescript
// Source: derived from benchmark.ts getCostTrendData pattern + skill_feedback/ratings/benchmark_results schemas
export interface QualityTrendPoint {
  date: string;        // "2026-01" format
  avgRating: number;   // Normalized 0-100 from ratings table (avg rating * 20)
  sentimentPct: number; // 0-100% positive from skill_feedback
  benchmarkScore: number; // 0-100 from benchmark_results
}

export async function getQualityTrends(tenantId: string, startDate: Date): Promise<QualityTrendPoint[]> {
  if (!db) return [];

  const startDateStr = startDate.toISOString();

  // Three separate queries joined by month to avoid complex multi-table GROUP BY
  // Query 1: Average ratings by month (normalize 1-5 -> 0-100)
  const ratingsResult = await db.execute(sql`
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
      (AVG(rating) * 20)::double precision AS avg_rating_pct
    FROM ratings
    WHERE tenant_id = ${tenantId} AND created_at >= ${startDateStr}
    GROUP BY date_trunc('month', created_at)
  `);

  // Query 2: Feedback sentiment by month
  const feedbackResult = await db.execute(sql`
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
      CASE WHEN COUNT(*) FILTER (WHERE feedback_type IN ('thumbs_up','thumbs_down')) > 0
        THEN (COUNT(*) FILTER (WHERE feedback_type = 'thumbs_up') * 100.0 /
              COUNT(*) FILTER (WHERE feedback_type IN ('thumbs_up','thumbs_down')))::double precision
        ELSE NULL
      END AS sentiment_pct
    FROM skill_feedback
    WHERE tenant_id = ${tenantId} AND created_at >= ${startDateStr}
    GROUP BY date_trunc('month', created_at)
  `);

  // Query 3: Benchmark average quality by month
  const benchmarkResult = await db.execute(sql`
    SELECT
      to_char(date_trunc('month', br.created_at), 'YYYY-MM') AS month,
      AVG(bres.quality_score)::double precision AS avg_benchmark
    FROM benchmark_runs br
    JOIN benchmark_results bres ON bres.benchmark_run_id = br.id
    WHERE br.tenant_id = ${tenantId} AND br.created_at >= ${startDateStr}
      AND bres.quality_score IS NOT NULL
    GROUP BY date_trunc('month', br.created_at)
  `);

  // Merge by month
  // ... (combine all three result sets into QualityTrendPoint[])
}
```

### Nav Tab Addition
```typescript
// Source: apps/web/app/(protected)/leverage/leverage-nav.tsx
const tabs = [
  { label: "Me", href: "/leverage", adminOnly: false },
  { label: "My Company", href: "/leverage/company", adminOnly: false },
  { label: "Employees", href: "/leverage/employees", adminOnly: true },
  { label: "Skills", href: "/leverage/skills", adminOnly: true },
  { label: "IP Dashboard", href: "/leverage/ip-dashboard", adminOnly: true },
];
```

## Data Sources Deep Dive

### Hero KPI Data Sources

| KPI | Source Table | Column/Aggregation | Notes |
|-----|-------------|-------------------|-------|
| Total Skills Captured | `skills` | `COUNT(*) WHERE status='published'` | Tenant-scoped, published only |
| Total Uses | `usage_events` | `COUNT(*)` | All-time count for tenant (no time filter on hero stats) |
| Total Hours Saved | `skills` | `SUM(hours_saved * total_uses)` | Uses denormalized `total_uses` on skills table for efficiency |
| Active Contributors | `skills` | `COUNT(DISTINCT author_id)` | Users who have authored skills, not just used them |

### Quality Trend Data Sources

| Series | Source Table(s) | Aggregation | Scale | Normalization |
|--------|----------------|-------------|-------|---------------|
| Avg Rating | `ratings` | `AVG(rating)` per month | 1-5 stars | Multiply by 20 to get 0-100 |
| Feedback Sentiment | `skill_feedback` | `COUNT(thumbs_up) / COUNT(thumbs_up + thumbs_down)` per month | 0-100% | Already percentage |
| Benchmark Quality | `benchmark_runs` + `benchmark_results` | `AVG(quality_score)` per month | 0-100 | Already 0-100 |

### Key Schema Fields Referenced

**skills table:**
- `tenant_id`, `status`, `author_id`, `total_uses` (denormalized), `hours_saved`, `average_rating` (denormalized, rating*100)

**ratings table:**
- `tenant_id`, `skill_id`, `user_id`, `rating` (1-5), `hours_saved_estimate`, `created_at`

**skill_feedback table:**
- `tenant_id`, `feedback_type` ("thumbs_up"|"thumbs_down"|"suggestion"|...), `sentiment` (-1,0,1), `quality_score` (1-10), `created_at`

**benchmark_results table:**
- `tenant_id`, `benchmark_run_id`, `quality_score` (0-100), `created_at`

**benchmark_runs table:**
- `tenant_id`, `skill_id`, `status`, `best_quality_score`, `created_at`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-series AreaChart | Multi-series LineChart needed | Phase 62 | First multi-line chart in codebase |
| toLocaleDateString | Manual UTC formatting | Phase 52 (cost-trend-chart.tsx) | Must follow this pattern |
| Recharts v2 | Recharts v3.7.0 | Already upgraded | Some API differences (ResponsiveContainer is stable) |

**Deprecated/outdated:**
- `toLocaleDateString()` for chart labels: replaced by manual UTC formatting to prevent hydration mismatches

## Open Questions

1. **Hero stats: all-time vs time-filtered?**
   - What we know: The company page uses time-filtered stats (via TimeRangeSelector). IP dashboard "total skills captured" is naturally all-time.
   - What's unclear: Should hero KPIs respond to the time range selector, or always show all-time totals?
   - Recommendation: Hero stats show ALL-TIME totals (no date filter) since they represent cumulative IP value. The quality trends chart uses the time range selector for its data window. This matches the success criteria which says "total skills captured" (all-time language).

2. **"Active contributors" precise definition**
   - What we know: Could mean authors of published skills, or authors who contributed in a time period.
   - What's unclear: Whether "active" implies recency.
   - Recommendation: Count DISTINCT `author_id` from published skills -- no time filter. This is a cumulative "how many people have contributed IP" metric.

3. **Quality trend chart: what if only one data source has data?**
   - What we know: A new tenant might have ratings but no benchmarks, or feedback but no ratings.
   - What's unclear: How to handle partial data in the multi-line chart.
   - Recommendation: Show lines only for series that have data. Use Recharts' `connectNulls` prop on Line elements so gaps don't break the line. Include a legend so users understand which lines are present.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/web/lib/analytics-queries.ts` -- established SQL aggregation patterns
- Codebase analysis: `apps/web/app/(protected)/leverage/` -- all existing leverage page patterns
- Codebase analysis: `apps/web/components/cost-trend-chart.tsx` -- hydration-safe Recharts pattern
- Codebase analysis: `apps/web/components/overview-tab.tsx` -- stat card grid + chart layout
- Codebase analysis: `packages/db/src/schema/` -- all table schemas referenced
- Codebase analysis: `apps/web/lib/admin.ts` -- admin check pattern
- Codebase analysis: `apps/web/components/time-range-selector.tsx` -- nuqs-based time range

### Secondary (MEDIUM confidence)
- Recharts v3 multi-line LineChart pattern -- based on Recharts documentation; v3.7.0 is installed

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used extensively in codebase
- Architecture: HIGH -- follows established patterns from 4+ existing leverage pages
- SQL queries: HIGH -- table schemas verified, query patterns from analytics-queries.ts
- Multi-line chart: MEDIUM -- Recharts LineChart is standard but this is the first multi-series chart in the codebase
- Pitfalls: HIGH -- identified from existing codebase patterns and known hydration issues

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable -- no external dependency changes expected)
