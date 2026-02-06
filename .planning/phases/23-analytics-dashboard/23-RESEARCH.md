# Phase 23: Analytics Dashboard - Research

**Researched:** 2026-02-06
**Domain:** React charting, SQL aggregations, CSV export, URL-based state management
**Confidence:** HIGH

## Summary

Phase 23 adds an org-wide analytics dashboard to visualize usage_events data accumulated since Phase 21. The dashboard requires three tabs (Overview, Employees, Skills), area charts for usage trends, sortable tables for employee data, and CSV export functionality.

The codebase already has strong patterns to reuse: nuqs for URL-based tab/sort state, StatCard for metric display, sortable table columns via SortableColumnHeader, and SQL time-series aggregation patterns in `lib/usage-trends.ts` and `lib/total-stats.ts`. The key addition is Recharts for the area chart (replacing/augmenting the existing react-sparklines).

**Primary recommendation:** Use Recharts AreaChart with ResponsiveContainer for the usage trends visualization. Reuse existing nuqs tab pattern from HomeTabs. Reuse SortableColumnHeader and useSortState for the employees table. Implement CSV export via client-side Blob download.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.7.0 | Area charts, usage visualization | Most popular React chart lib. Already approved in STACK.md for v1.4. SVG-based, composable, works with Tailwind. |
| nuqs | ^2.8.7 | URL-based state for tabs, time range, sort | Already in use for home tabs and skills table sorting. Persists state in URL for shareability. |
| drizzle-orm | ^0.38.0 | SQL aggregations with time-series queries | Already in use. Supports raw SQL for date_trunc, GROUP BY patterns. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-sparklines | ^1.7.0 | Small inline trend charts | Already in use for StatCard trends. Could migrate to Recharts later but not required for Phase 23. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | Tremor | Tremor adds Radix UI dependency, overkill for 1-2 chart types |
| recharts | Chart.js | Canvas-based, harder to style with Tailwind |
| Client-side CSV | Server Action + streaming | Unnecessary complexity for small datasets (<1000 rows) |

**Installation:**
```bash
cd apps/web && pnpm add recharts
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── app/(protected)/
│   └── analytics/
│       └── page.tsx              # Server Component: data fetching
├── components/
│   ├── analytics-tabs.tsx        # Client: tab navigation (nuqs)
│   ├── overview-tab.tsx          # Client: stat cards + area chart
│   ├── employees-tab.tsx         # Client: sortable table
│   ├── skills-tab.tsx            # Client: skill leaderboard cards
│   ├── usage-area-chart.tsx      # Client: Recharts AreaChart wrapper
│   ├── time-range-selector.tsx   # Client: 7d/30d/90d/1y buttons (nuqs)
│   ├── employee-detail-modal.tsx # Client: drill-down view
│   ├── skill-analytics-modal.tsx # Client: drill-down view
│   └── csv-export-button.tsx     # Client: download handler
└── lib/
    └── analytics-queries.ts      # Server: SQL aggregation functions
```

### Pattern 1: Tab Navigation with nuqs
**What:** URL-persisted tab state for shareable views
**When to use:** Any multi-tab interface
**Example:**
```typescript
// Source: apps/web/components/home-tabs.tsx (existing pattern)
"use client";
import { useQueryState, parseAsStringLiteral } from "nuqs";

const TABS = ["overview", "employees", "skills"] as const;

export function AnalyticsTabs({ children }: { children: Record<string, ReactNode> }) {
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("overview")
  );
  // ...render tabs and content
}
```

### Pattern 2: Time Range with nuqs
**What:** URL-persisted time range for filtering
**When to use:** Any date-filtered view
**Example:**
```typescript
// New pattern based on existing nuqs usage
"use client";
import { useQueryState, parseAsStringLiteral } from "nuqs";

const RANGES = ["7d", "30d", "90d", "1y"] as const;
type TimeRange = typeof RANGES[number];

export function useTimeRange() {
  const [range, setRange] = useQueryState(
    "range",
    parseAsStringLiteral(RANGES).withDefault("30d")
  );
  return { range: range as TimeRange, setRange };
}
```

### Pattern 3: Server Component Data Fetching
**What:** Fetch all data in Server Component, pass to Client Components as props
**When to use:** Any page with charts (Recharts requires "use client")
**Example:**
```typescript
// Source: apps/web/app/(protected)/page.tsx (existing pattern)
export default async function AnalyticsPage() {
  const [overviewStats, employeeData, skillData] = await Promise.all([
    getOverviewStats(),
    getEmployeeUsage(),
    getSkillUsage(),
  ]);

  return (
    <AnalyticsTabs>
      <OverviewTab stats={overviewStats} />
      <EmployeesTab data={employeeData} />
      <SkillsTab data={skillData} />
    </AnalyticsTabs>
  );
}
```

### Pattern 4: Sortable Table
**What:** Client-side sorting with URL persistence
**When to use:** Data tables with sortable columns
**Example:**
```typescript
// Source: apps/web/hooks/use-sort-state.ts + components/sortable-column-header.tsx
// Reuse existing pattern: useSortState() hook + SortableColumnHeader component
// Just add new column definitions for analytics-specific fields
```

### Pattern 5: Recharts Area Chart
**What:** Responsive area chart with tooltips
**When to use:** Time-series data visualization
**Example:**
```typescript
// Source: Recharts official docs
"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface UsageChartProps {
  data: Array<{ date: string; value: number }>;
}

export function UsageAreaChart({ data }: UsageChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(date) => new Date(date).toLocaleDateString()}
            formatter={(value: number) => [value.toFixed(1), 'Hours Saved']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Fetching data in Client Components:** Charts require "use client" but data fetching should happen in Server Components. Pass data as props.
- **Custom date formatting without consideration for time zones:** Use UTC for database queries, format for display only in client.
- **Large CSV exports in client memory:** For truly large datasets, stream from server. But for <1000 rows, client-side Blob is fine.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL state persistence | Custom useState + router.push | nuqs useQueryState | Already in use, handles serialization, shallow routing |
| Sortable table headers | Custom onClick + state | SortableColumnHeader + useSortState | Existing component with accessibility, chevron indicators |
| Date formatting | Inline string manipulation | date.toLocaleDateString() with options | Handles localization properly |
| SQL date grouping | JavaScript post-processing | PostgreSQL date_trunc() | More efficient, handles time zones |
| Stat cards | Custom divs | StatCard component | Existing component with icon + sparkline support |
| Time-series gap filling | Complex logic | Pattern from usage-trends.ts fillMissingDays | Already debugged for edge cases |

**Key insight:** The codebase has mature patterns for tables, stats, and time-series data. Phase 23 mostly combines existing patterns with Recharts for the area chart.

## Common Pitfalls

### Pitfall 1: Recharts Hydration Mismatches
**What goes wrong:** Recharts renders differently on server vs client, causing hydration errors
**Why it happens:** Date formatting, random IDs, or conditional rendering differ between SSR and CSR
**How to avoid:**
- Mark chart components as "use client"
- Use consistent date formatting (ISO strings from server, format in client)
- Avoid Math.random() in chart config
**Warning signs:** "Text content did not match" console errors

### Pitfall 2: Time Range Filter Not Applied to SQL
**What goes wrong:** Changing time range doesn't update chart data
**Why it happens:** Server Component fetched data once at page load
**How to avoid:**
- Either refetch via Server Action when range changes
- Or fetch all data (1 year) and filter client-side for small datasets
**Warning signs:** Same chart regardless of time range selection

### Pitfall 3: Date Serialization Across Server/Client Boundary
**What goes wrong:** Date objects become invalid strings when passed as props
**Why it happens:** JSON serialization during RSC streaming
**How to avoid:**
- Use `.toISOString()` before passing from Server Component
- Accept `string` type in Client Component interfaces
- Parse with `new Date(isoString)` in client
**Warning signs:** "Invalid Date" in tooltips, [object Object] in charts

### Pitfall 4: Granularity Mismatch with Time Range
**What goes wrong:** 7-day chart shows 365 data points (too dense) or 1-year chart shows 7 points (too sparse)
**Why it happens:** Fixed granularity regardless of selected range
**How to avoid:**
- 7d: daily granularity (7 points)
- 30d: daily granularity (30 points)
- 90d: weekly granularity (~13 points)
- 1y: monthly granularity (12 points)
**Warning signs:** Chart looks cluttered or empty

### Pitfall 5: Empty State Not Handled
**What goes wrong:** Blank chart or errors when no usage data exists
**Why it happens:** Recharts doesn't gracefully handle empty arrays
**How to avoid:**
- Check for empty data before rendering chart
- Show EmptyState component with helpful message
**Warning signs:** Empty chart area, console errors about missing data

## Code Examples

Verified patterns from official sources and codebase:

### SQL: Org-Wide Overview Stats
```typescript
// Source: Based on apps/web/lib/my-leverage.ts pattern
export async function getOverviewStats(startDate: Date): Promise<OverviewStats> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(COALESCE(r.hours_saved_estimate, s.hours_saved, 1)), 0) AS total_hours_saved,
      COUNT(DISTINCT ue.user_id) AS active_employees,
      COUNT(DISTINCT ue.skill_id) AS skills_deployed,
      COUNT(*) AS deployments,
      (
        SELECT s2.name FROM usage_events ue2
        LEFT JOIN skills s2 ON s2.id = ue2.skill_id
        WHERE ue2.created_at >= ${startDate}
        GROUP BY ue2.skill_id, s2.name
        ORDER BY COUNT(*) DESC LIMIT 1
      ) AS most_used_skill,
      (
        SELECT u.name FROM usage_events ue2
        LEFT JOIN users u ON u.id = ue2.user_id
        LEFT JOIN skills s2 ON s2.id = ue2.skill_id
        WHERE ue2.created_at >= ${startDate}
        GROUP BY ue2.user_id, u.name
        ORDER BY SUM(COALESCE(s2.hours_saved, 1)) DESC LIMIT 1
      ) AS highest_saver
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    WHERE ue.created_at >= ${startDate}
  `);
  // ... parse result
}
```

### SQL: Time-Series for Area Chart
```typescript
// Source: Based on apps/web/lib/usage-trends.ts pattern
export async function getUsageTrend(
  startDate: Date,
  granularity: 'day' | 'week' | 'month'
): Promise<Array<{ date: string; hoursSaved: number }>> {
  const trunc = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month';

  const results = await db
    .select({
      date: sql<string>`date_trunc(${trunc}, ${usageEvents.createdAt})::date::text`,
      hoursSaved: sql<number>`cast(sum(coalesce(${skills.hoursSaved}, 1)) as float)`,
    })
    .from(usageEvents)
    .innerJoin(skills, eq(usageEvents.skillId, skills.id))
    .where(gte(usageEvents.createdAt, startDate))
    .groupBy(sql`date_trunc(${trunc}, ${usageEvents.createdAt})`)
    .orderBy(sql`date_trunc(${trunc}, ${usageEvents.createdAt})`);

  return results;
}
```

### SQL: Employee Usage Table
```typescript
// Source: Based on apps/web/lib/my-leverage.ts getSkillsUsedStats pattern
export async function getEmployeeUsage(startDate: Date): Promise<EmployeeRow[]> {
  const result = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.image,
      COUNT(DISTINCT ue.skill_id) AS skills_used,
      COUNT(*) AS usage_frequency,
      COALESCE(SUM(COALESCE(r.hours_saved_estimate, s.hours_saved, 1)), 0) AS hours_saved,
      MAX(ue.created_at) AS last_active,
      (
        SELECT s2.name FROM usage_events ue2
        LEFT JOIN skills s2 ON s2.id = ue2.skill_id
        WHERE ue2.user_id = u.id AND ue2.created_at >= ${startDate}
        GROUP BY ue2.skill_id, s2.name
        ORDER BY COUNT(*) DESC LIMIT 1
      ) AS top_skill
    FROM users u
    INNER JOIN usage_events ue ON ue.user_id = u.id
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    WHERE ue.created_at >= ${startDate}
    GROUP BY u.id, u.name, u.email, u.image
    ORDER BY hours_saved DESC
  `);
  // ... parse result
}
```

### CSV Export
```typescript
// Source: Standard browser Blob pattern
"use client";

interface ExportButtonProps {
  getData: () => Promise<Record<string, unknown>[]>;
  filename: string;
}

export function CsvExportButton({ getData, filename }: ExportButtonProps) {
  const handleExport = async () => {
    const data = await getData();
    if (data.length === 0) return;

    // Build CSV
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(h => {
        const val = row[h];
        // Escape quotes and wrap if contains comma
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleExport} className="...">
      Export CSV
    </button>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-sparklines for all charts | Recharts for complex, react-sparklines for inline | v1.4 | Recharts supports tooltips, legends, responsive containers |
| useState for filter state | nuqs URL state | Phase 8 | Shareable URLs, browser back works |
| Server-side CSV generation | Client-side Blob for small data | - | Simpler, no API route needed |

**Deprecated/outdated:**
- None for this phase. All recommended approaches are current.

## Open Questions

Things that couldn't be fully resolved:

1. **Time range refresh strategy**
   - What we know: Server Components fetch once at page load
   - What's unclear: Should time range changes trigger Server Action refetch or client-side filter?
   - Recommendation: For datasets <1000 rows, fetch 1 year of data and filter client-side. Avoids complexity of partial refetch.

2. **Employee/Skill drill-down implementation**
   - What we know: User decisions specify clicking rows opens detail views
   - What's unclear: Modal vs. new page? Keep same page context vs. deep link?
   - Recommendation: Use modal for quick drill-down (keeps filter/tab state), but also support direct link to employee profile via existing `/users/[id]` route.

## Recommendations for Claude's Discretion Items

Based on existing codebase patterns:

| Item | Recommendation | Rationale |
|------|----------------|-----------|
| Stat card styling/icons | Blue icons, white bg, gray-50 hover | Matches existing StatCard + home page icons |
| Area chart colors | Blue (#3b82f6) fill, 10% opacity | Matches existing Tailwind blue-500, existing sparkline pattern |
| Chart hover interactions | Default Recharts Tooltip | Works well, consistent with expectations |
| Loading states | Gray skeleton divs | Match existing pattern (e.g., skill cards) |
| Empty state | Dashed border, centered text | Match existing `my-leverage-view.tsx` empty state |
| Sort order defaults | Hours saved descending | Most impactful first, matches existing skills table |
| Employee detail layout | Modal with close button | Keeps context, matches existing accordion expand pattern |
| Skill analytics layout | Modal with usage chart + user list | Consistent with employee detail |

## Sources

### Primary (HIGH confidence)
- `/home/dev/projects/relay/apps/web/components/home-tabs.tsx` - nuqs tab pattern
- `/home/dev/projects/relay/apps/web/hooks/use-sort-state.ts` - nuqs sort state pattern
- `/home/dev/projects/relay/apps/web/components/sortable-column-header.tsx` - sortable column pattern
- `/home/dev/projects/relay/apps/web/lib/usage-trends.ts` - SQL time-series with date_trunc
- `/home/dev/projects/relay/apps/web/lib/total-stats.ts` - SQL aggregation pattern
- `/home/dev/projects/relay/apps/web/lib/my-leverage.ts` - per-user usage queries
- `/home/dev/projects/relay/apps/web/components/stat-card.tsx` - stat card component
- `/home/dev/projects/relay/apps/web/components/my-leverage-view.tsx` - empty state pattern
- `/home/dev/projects/relay/.planning/research/STACK.md` - Recharts approval, version 3.7.0
- [Recharts API Documentation](https://recharts.github.io/en-US/api/) - AreaChart, ResponsiveContainer

### Secondary (MEDIUM confidence)
- [DEV Community CSV Export](https://dev.to/graciesharma/implementing-csv-data-export-in-react-without-external-libraries-3030) - Blob download pattern
- [Recharts GitHub](https://github.com/recharts/recharts) - Version verification, examples

### Tertiary (LOW confidence)
- None - all findings verified with codebase or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Recharts already approved in STACK.md, nuqs already in use
- Architecture: HIGH - Existing patterns in codebase (tabs, tables, stats)
- Pitfalls: HIGH - Based on codebase-specific patterns (serialization, hydration)
- SQL queries: HIGH - Based on existing my-leverage.ts and usage-trends.ts patterns

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable patterns)
