# Phase 66: Impact Measurement - Research

**Researched:** 2026-02-16
**Domain:** Recharts timeline visualization, SQL event aggregation, portfolio impact metrics
**Confidence:** HIGH

## Summary

Phase 66 adds two visual components to the existing `/portfolio` page: (1) a skills impact timeline chart showing cumulative hours saved with event markers for skill creation, fork, and suggestion-implemented events, and (2) an impact calculator card showing total value added (hours saved, cost equivalent, contribution breakdown). All data comes from existing tables via SQL aggregation queries -- no new schema is needed.

The timeline requires a Recharts ComposedChart combining an Area (cumulative hours saved over time) with a Scatter overlay (event markers for creation/fork/suggestion events). This pattern is not yet used in the codebase but is well-supported by Recharts v3.7.0 which is already installed. The impact calculator reuses the existing `HOURLY_RATE` constant and `formatCurrency` helper from `apps/web/lib/ip-valuation.ts`.

**Critical schema finding:** The phase description references a `skill_suggestions` table that does not exist. Suggestion-implemented events are tracked in the `skill_feedback` table via `feedbackType = 'suggestion'` and `status = 'accepted'` with `implementedBySkillId` linking to the resulting skill. The SQL queries must join on `skill_feedback` rather than a nonexistent `skill_suggestions` table.

**Primary recommendation:** Build two new query functions in `apps/web/lib/portfolio-queries.ts` (timeline events + impact calculator stats), two new client components (`impact-timeline-chart.tsx` and `impact-calculator.tsx`), and integrate them into the existing `portfolio-view.tsx`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.7.0 | ComposedChart with Area + Scatter for timeline | Already installed, used in 8+ chart components |
| drizzle-orm | 0.42.0 | SQL query construction for timeline/impact data | Project ORM, used everywhere |
| Next.js | 16.1.6 | Server component data fetching, parallel queries | Project framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ip-valuation.ts | local | HOURLY_RATE ($150), formatCurrency() | Impact calculator cost display |
| stat-card.tsx | local | Reusable stat card with optional sparkline | Impact calculator hero numbers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ComposedChart + Scatter | AreaChart + ReferenceDot per event | ReferenceDot requires hardcoding each point; Scatter is data-driven and scales |
| ComposedChart + Scatter | Separate AreaChart + custom SVG overlay | More complex, no Recharts tooltip integration |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Data Flow
```
page.tsx (server component)
├── getImpactTimeline(userId) → TimelineEvent[]     # new query
├── getImpactCalculatorStats(userId) → ImpactStats   # new query
├── getPortfolioStats(userId)                         # existing
├── getPortfolioSkills(userId)                        # existing
└── getContributionRanking(userId, tenantId)          # existing
    ↓
PortfolioView (client component)
├── ImpactTimelineChart (new)      # Recharts ComposedChart
├── ImpactCalculator (new)         # stat cards + breakdown
├── StatCard (existing)            # hero stats row
└── skills list (existing)
```

### Recommended File Structure
```
apps/web/
├── lib/
│   └── portfolio-queries.ts          # ADD: getImpactTimeline, getImpactCalculatorStats
├── components/
│   ├── impact-timeline-chart.tsx     # NEW: ComposedChart with Area + Scatter
│   └── impact-calculator.tsx         # NEW: value-added display card
├── app/(protected)/portfolio/
│   └── page.tsx                      # MODIFY: add new parallel queries + pass to view
└── components/
    └── portfolio-view.tsx            # MODIFY: add new sections for timeline + calculator
```

### Pattern 1: ComposedChart with Area + Scatter Overlay
**What:** Render cumulative hours saved as an area chart, with scatter dots marking individual events (creation, fork, suggestion-implemented).
**When to use:** When showing a time series with discrete event markers on top.
**Example:**
```typescript
// Recharts v3 ComposedChart — verified from official API docs
import {
  ComposedChart, Area, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface TimelineDataPoint {
  date: string;              // ISO date string
  cumulativeHoursSaved: number;
  // Scatter points need y-value at the same scale
  creationEvent?: number;    // y-value for creation dot (= cumulativeHoursSaved at that point)
  forkEvent?: number;        // y-value for fork dot
  suggestionEvent?: number;  // y-value for suggestion dot
  eventLabel?: string;       // skill name for tooltip
}

// ComposedChart allows Area + Scatter in same coordinate space
<ComposedChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Area type="monotone" dataKey="cumulativeHoursSaved" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" />
  <Scatter dataKey="creationEvent" fill="#10b981" name="Created" shape="circle" />
  <Scatter dataKey="forkEvent" fill="#8b5cf6" name="Forked" shape="diamond" />
  <Scatter dataKey="suggestionEvent" fill="#f59e0b" name="Suggestion Implemented" shape="star" />
</ComposedChart>
```

### Pattern 2: Single-Pass SQL with UNION ALL for Timeline Events
**What:** Combine three event types (creation, fork, suggestion-implemented) into a unified timeline using UNION ALL, then compute cumulative hours saved with a window function.
**When to use:** When aggregating heterogeneous events into a single time series.
**Example:**
```sql
-- Unified timeline events for a user
WITH events AS (
  -- Skills created by user
  SELECT
    s.created_at AS event_date,
    'creation' AS event_type,
    s.name AS skill_name,
    (COALESCE(s.total_uses, 0) * COALESCE(s.hours_saved, 1))::double precision AS hours_impact
  FROM skills s
  WHERE s.author_id = $userId
    AND s.published_version_id IS NOT NULL
    AND s.status = 'published'
    AND s.forked_from_id IS NULL  -- original creations only

  UNION ALL

  -- Skills forked by user (user created a fork)
  SELECT
    s.created_at AS event_date,
    'fork' AS event_type,
    s.name AS skill_name,
    (COALESCE(s.total_uses, 0) * COALESCE(s.hours_saved, 1))::double precision AS hours_impact
  FROM skills s
  WHERE s.author_id = $userId
    AND s.published_version_id IS NOT NULL
    AND s.status = 'published'
    AND s.forked_from_id IS NOT NULL  -- forks only

  UNION ALL

  -- Suggestions by user that were implemented
  SELECT
    sf.reviewed_at AS event_date,
    'suggestion' AS event_type,
    sk.name AS skill_name,
    0::double precision AS hours_impact  -- suggestions don't directly save hours
  FROM skill_feedback sf
  JOIN skills sk ON sk.id = sf.skill_id
  WHERE sf.user_id = $userId
    AND sf.feedback_type = 'suggestion'
    AND sf.status = 'accepted'
    AND sf.implemented_by_skill_id IS NOT NULL
)
SELECT
  event_date,
  event_type,
  skill_name,
  hours_impact,
  SUM(hours_impact) OVER (ORDER BY event_date ROWS UNBOUNDED PRECEDING) AS cumulative_hours_saved
FROM events
ORDER BY event_date ASC
```

### Pattern 3: Hydration-Safe Date Formatting (Codebase Convention)
**What:** Use manual UTC formatting instead of `toLocaleString()` to prevent server/client hydration mismatches.
**When to use:** Always, in all client components that display dates.
**Example:**
```typescript
// Source: codebase convention from quality-trend-chart.tsx, cost-trend-chart.tsx
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}
```

### Anti-Patterns to Avoid
- **toLocaleDateString() in client components:** Causes hydration mismatches. Use manual UTC formatting.
- **Separate queries per event type:** Three round-trips instead of one UNION ALL query. Combine in SQL.
- **Computing cumulative totals in JavaScript:** PostgreSQL window functions (`SUM() OVER`) are faster and cleaner.
- **Creating new schema tables:** The phase description mentions "no new schema" as a prior decision. All data exists in `skills` and `skill_feedback` tables.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency formatting | Custom Intl formatter | `formatCurrency()` from `ip-valuation.ts` | Already hydration-safe, already tested |
| Stat card layout | Custom card divs | `<StatCard>` component | Supports sparklines, consistent styling |
| Chart responsive sizing | CSS media queries | `<ResponsiveContainer>` from recharts | Handles resize events, all charts use it |
| Empty state display | Inline conditional | Consistent dashed-border pattern | Every chart in codebase uses `border-dashed border-gray-300 bg-gray-50` for empty states |

**Key insight:** The codebase already has 8+ Recharts chart components with identical patterns (ResponsiveContainer wrapper, CartesianGrid with strokeDasharray, consistent tooltip styling). Follow these patterns exactly.

## Common Pitfalls

### Pitfall 1: Assuming skill_suggestions table exists
**What goes wrong:** The phase requirements reference "suggestion-implemented events" which might be interpreted as needing a `skill_suggestions` table. No such table exists.
**Why it happens:** The requirements spec was written abstractly before schema was finalized.
**How to avoid:** Use `skill_feedback` table with `feedback_type = 'suggestion'`, `status = 'accepted'`, and `implemented_by_skill_id IS NOT NULL` to identify implemented suggestions.
**Warning signs:** Import errors or undefined table references.

### Pitfall 2: Scatter data format mismatch with Area data
**What goes wrong:** Recharts ComposedChart requires all series to share the same data array. Scatter points that exist only for certain data points need `undefined`/`null` for other points.
**Why it happens:** Scatter in ComposedChart reads from the same `data` prop as Area.
**How to avoid:** Structure the data array so every point has `cumulativeHoursSaved` (for Area) and optionally `creationEvent`/`forkEvent`/`suggestionEvent` (for Scatter, undefined when no event). Only points with a defined value render a scatter dot.
**Warning signs:** Scatter dots appearing at y=0 for all data points, or no dots at all.

### Pitfall 3: reviewed_at being NULL for accepted suggestions
**What goes wrong:** Timeline query uses `sf.reviewed_at` as the event date for suggestions, but older suggestion rows may have `reviewed_at = NULL` even with `status = 'accepted'`.
**Why it happens:** The `reviewed_at` column was added later; older acceptances may not have set it.
**How to avoid:** Use `COALESCE(sf.reviewed_at, sf.created_at)` as the event date for suggestion events.
**Warning signs:** Suggestions missing from the timeline despite being accepted.

### Pitfall 4: "Real-time" updates misinterpretation
**What goes wrong:** Success criteria #4 says "impact metrics update in real time." This does NOT mean WebSockets or polling.
**Why it happens:** "Real time" in this context means "whenever the page is loaded, the numbers reflect current data."
**How to avoid:** Standard server-component data fetching (which happens on every page load/navigation) satisfies this requirement. No client-side polling needed.
**Warning signs:** Over-engineering with useEffect + fetch intervals or WebSocket connections.

### Pitfall 5: Hydration mismatch from toLocaleString on numbers
**What goes wrong:** The existing `portfolio-view.tsx` uses `.toLocaleString()` on `totalUses` (line 49). This is risky for hydration.
**Why it happens:** Different Node.js and browser Intl implementations.
**How to avoid:** For new code, use manual comma formatting. Note: existing code has this issue but fixing it is not in scope for this phase unless it causes test failures.
**Warning signs:** React hydration warnings in console.

## Code Examples

Verified patterns from the existing codebase:

### Chart Component Pattern (from quality-trend-chart.tsx)
```typescript
"use client";

import {
  ComposedChart,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ImpactTimelineChartProps {
  data: TimelineDataPoint[];
  height?: number;
}

export function ImpactTimelineChart({ data, height = 350 }: ImpactTimelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">No impact data yet</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatDateShort} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => formatDateShort(String(label))}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="cumulativeHoursSaved"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.1}
            strokeWidth={2}
            name="Cumulative Hours Saved"
          />
          <Scatter dataKey="creationEvent" fill="#10b981" name="Skill Created" />
          <Scatter dataKey="forkEvent" fill="#8b5cf6" name="Skill Forked" />
          <Scatter dataKey="suggestionEvent" fill="#f59e0b" name="Suggestion Implemented" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Query Function Pattern (from portfolio-queries.ts)
```typescript
export interface TimelineEvent {
  date: string;           // ISO date string
  eventType: "creation" | "fork" | "suggestion";
  skillName: string;
  hoursImpact: number;
  cumulativeHoursSaved: number;
}

export async function getImpactTimeline(userId: string): Promise<TimelineEvent[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    WITH events AS (
      -- Original skill creations
      SELECT created_at AS event_date, 'creation' AS event_type, name AS skill_name,
        (COALESCE(total_uses, 0) * COALESCE(hours_saved, 1))::double precision AS hours_impact
      FROM skills
      WHERE author_id = ${userId} AND published_version_id IS NOT NULL
        AND status = 'published' AND forked_from_id IS NULL

      UNION ALL

      -- Fork creations
      SELECT created_at AS event_date, 'fork' AS event_type, name AS skill_name,
        (COALESCE(total_uses, 0) * COALESCE(hours_saved, 1))::double precision AS hours_impact
      FROM skills
      WHERE author_id = ${userId} AND published_version_id IS NOT NULL
        AND status = 'published' AND forked_from_id IS NOT NULL

      UNION ALL

      -- Implemented suggestions
      SELECT COALESCE(sf.reviewed_at, sf.created_at) AS event_date,
        'suggestion' AS event_type, sk.name AS skill_name,
        0::double precision AS hours_impact
      FROM skill_feedback sf
      JOIN skills sk ON sk.id = sf.skill_id
      WHERE sf.user_id = ${userId} AND sf.feedback_type = 'suggestion'
        AND sf.status = 'accepted' AND sf.implemented_by_skill_id IS NOT NULL
    )
    SELECT event_date, event_type, skill_name, hours_impact,
      SUM(hours_impact) OVER (ORDER BY event_date ROWS UNBOUNDED PRECEDING) AS cumulative_hours_saved
    FROM events
    ORDER BY event_date ASC
  `);

  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    date: new Date(String(row.event_date)).toISOString(),
    eventType: String(row.event_type) as "creation" | "fork" | "suggestion",
    skillName: String(row.skill_name),
    hoursImpact: Number(row.hours_impact),
    cumulativeHoursSaved: Number(row.cumulative_hours_saved),
  }));
}
```

### Impact Calculator Stats Pattern
```typescript
export interface ImpactCalculatorStats {
  totalHoursSaved: number;
  estimatedCostSaved: number;     // totalHoursSaved * HOURLY_RATE
  skillsCreated: number;
  skillsForked: number;
  suggestionsImplemented: number;
}

export async function getImpactCalculatorStats(userId: string): Promise<ImpactCalculatorStats> {
  if (!db) {
    return { totalHoursSaved: 0, estimatedCostSaved: 0, skillsCreated: 0, skillsForked: 0, suggestionsImplemented: 0 };
  }

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(total_uses * COALESCE(hours_saved, 1)), 0)::double precision AS total_hours_saved,
      COUNT(*) FILTER (WHERE forked_from_id IS NULL)::integer AS skills_created,
      COUNT(*) FILTER (WHERE forked_from_id IS NOT NULL)::integer AS skills_forked
    FROM skills
    WHERE author_id = ${userId}
      AND published_version_id IS NOT NULL
      AND status = 'published'
  `);

  // Separate query for suggestions (different table)
  const sugResult = await db.execute(sql`
    SELECT COUNT(*)::integer AS suggestions_implemented
    FROM skill_feedback
    WHERE user_id = ${userId}
      AND feedback_type = 'suggestion'
      AND status = 'accepted'
      AND implemented_by_skill_id IS NOT NULL
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];
  const sugRows = sugResult as unknown as Record<string, unknown>[];
  const sugRow = sugRows[0];

  const totalHoursSaved = Number(row?.total_hours_saved ?? 0);

  return {
    totalHoursSaved,
    estimatedCostSaved: totalHoursSaved * HOURLY_RATE,  // from ip-valuation.ts
    skillsCreated: Number(row?.skills_created ?? 0),
    skillsForked: Number(row?.skills_forked ?? 0),
    suggestionsImplemented: Number(sugRow?.suggestions_implemented ?? 0),
  };
}
```

### Data Transformation for ComposedChart
```typescript
// Transform timeline events into ComposedChart data format
// Each point needs cumulativeHoursSaved (for Area) and
// optionally creationEvent/forkEvent/suggestionEvent (for Scatter dots)
function transformTimelineForChart(events: TimelineEvent[]): TimelineDataPoint[] {
  return events.map((event) => ({
    date: event.date,
    cumulativeHoursSaved: event.cumulativeHoursSaved,
    eventLabel: event.skillName,
    // Set scatter value = cumulative at that point, undefined for non-matching types
    creationEvent: event.eventType === "creation" ? event.cumulativeHoursSaved : undefined,
    forkEvent: event.eventType === "fork" ? event.cumulativeHoursSaved : undefined,
    suggestionEvent: event.eventType === "suggestion" ? event.cumulativeHoursSaved : undefined,
  }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate AreaChart + custom overlays | ComposedChart with native Scatter | Recharts v2+ | Cleaner composition, shared coordinate system |
| Multiple queries for event types | UNION ALL with window functions | PostgreSQL standard | Single round-trip, cumulative computed in DB |
| skill_suggestions table (spec) | skill_feedback with feedbackType='suggestion' | Phase 59 | Use existing schema, no migration needed |

**Deprecated/outdated:**
- The phase requirements reference `skill_suggestions` table -- this does not exist. Use `skill_feedback` table.
- Recharts v2 `<Scatter>` in `<ComposedChart>` required workarounds; v3.7.0 supports it natively.

## Open Questions

1. **Custom Scatter dot shapes for event types**
   - What we know: Recharts Scatter supports `shape` prop with strings ("circle", "diamond", "star", etc.) and custom React elements.
   - What's unclear: Whether "star" shape renders well at small sizes for suggestion markers.
   - Recommendation: Start with string shapes ("circle", "diamond", "triangle"), adjust if needed during implementation. Custom SVG shapes are trivial to add.

2. **Tooltip content for scatter events**
   - What we know: Recharts Tooltip works across all child chart types in ComposedChart.
   - What's unclear: How tooltip renders when Area and Scatter points overlap (same x-value).
   - Recommendation: Use a custom Tooltip content function that checks for event data and renders skill name + event type when present.

3. **Timeline density for users with many skills**
   - What we know: Users with 50+ skills could create a dense timeline.
   - What's unclear: Performance impact of 100+ scatter points.
   - Recommendation: Recharts handles hundreds of data points fine. If needed later, aggregate to monthly buckets with a SQL GROUP BY date_trunc('month', event_date).

## Sources

### Primary (HIGH confidence)
- Codebase: `apps/web/components/quality-trend-chart.tsx` -- existing Recharts LineChart pattern
- Codebase: `apps/web/components/cost-trend-chart.tsx` -- existing AreaChart pattern with UTC formatting
- Codebase: `apps/web/lib/portfolio-queries.ts` -- existing portfolio SQL patterns
- Codebase: `apps/web/lib/ip-valuation.ts` -- HOURLY_RATE, formatCurrency
- Codebase: `packages/db/src/schema/skills.ts` -- skills table schema (forked_from_id, author_id, etc.)
- Codebase: `packages/db/src/schema/skill-feedback.ts` -- skill_feedback schema (feedbackType, implementedBySkillId, status)
- [Recharts ComposedChart API](https://recharts.github.io/en-US/api/ComposedChart/) -- confirms Area + Scatter composability
- [Recharts Scatter API](https://recharts.github.io/en-US/api/Scatter/) -- shape prop, data format
- [Recharts ReferenceDot API](https://recharts.github.io/en-US/api/ReferenceDot/) -- alternative for individual markers

### Secondary (MEDIUM confidence)
- [Recharts GitHub Discussion #4684](https://github.com/recharts/recharts/discussions/4684) -- ComposedChart with Scatter overlay confirmed working

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used extensively in codebase
- Architecture: HIGH -- follows existing patterns exactly (server query + client chart component)
- Pitfalls: HIGH -- identified through schema analysis (skill_suggestions DNE) and codebase conventions
- SQL queries: HIGH -- verified against actual schema columns and existing query patterns
- ComposedChart + Scatter: MEDIUM -- Recharts API docs confirm it works, but no existing example in codebase

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- all dependencies pinned, schema frozen)
