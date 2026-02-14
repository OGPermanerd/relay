# Phase 54: Deployment Plan - Research

**Researched:** 2026-02-14
**Domain:** Skill adoption roadmap UI with cumulative time-savings projection, Recharts AreaChart, client-side computation from existing recommendation data
**Confidence:** HIGH

## Summary

Phase 54 builds a "Deployment Plan" view that transforms the existing `SkillRecommendation[]` data (from Phase 53) into three deliverables: (1) a ranked adoption list ordered by projected weekly time savings, (2) a cumulative FTE Days Saved projection chart, and (3) a "start here" sequential adoption guide. All data needed already exists in the `SkillRecommendation` type (`projectedWeeklySavings`, `matchedCategories`, `personalizedReason`). No new server actions, DB tables, or API calls are required -- everything can be computed client-side from the recommendations array.

The existing codebase has 3 proven Recharts chart components (`usage-area-chart.tsx`, `category-pie-chart.tsx`, `time-bar-chart.tsx`) and 2 AreaChart usages (`usage-area-chart.tsx`, `skill-analytics-modal.tsx`) that establish the project's Recharts patterns. Recharts 3.7.0 is installed. The AreaChart with `fillOpacity`, `stroke`, `ResponsiveContainer`, and `CartesianGrid` patterns are well-established. For the cumulative projection, a single-series AreaChart is sufficient (no stacking needed) since we compute cumulative totals in the data transformation.

The UI should live as a new section within the existing `/my-leverage` page or as a sub-page at `/my-leverage/deployment-plan`, following the same nested route pattern as `/my-leverage/email-diagnostic`. A sub-page is recommended because: (a) the my-leverage page already has 3 sections (EmailDiagnosticCard, RecommendationsSection, MyLeverageView) and adding more would create scroll fatigue, and (b) a sub-page mirrors the email-diagnostic pattern that already exists.

**Primary recommendation:** Create a `/my-leverage/deployment-plan` sub-page with a client component that receives the `SkillRecommendation[]` array. Compute cumulative FTE Days Saved projection client-side (projectedWeeklySavings * 5/40 for FTE-days-per-week, accumulated over weeks 1-12). Use a single Recharts AreaChart for the projection. Add a link to it from the RecommendationsSection when recommendations exist.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| recharts | 3.7.0 | AreaChart for cumulative savings projection | Installed, 5 existing chart components |
| Next.js | 16.1.6 | Server component page + client component dashboard | Installed |
| React | 19 | Client-side state for tab/view selection | Installed |

### Supporting (Already Available)
| Service | Purpose | When to Use |
|---------|---------|-------------|
| `getRecommendations()` server action | Fetch skill recommendations | Page load (server component calls it) |
| `SkillRecommendation` type | Data shape with `projectedWeeklySavings` | All computations |
| `CategoryBreakdownItem` type | Available via diagnostic data | Category display labels |
| Tailwind CSS | Styling | All UI components |

### No New Dependencies Needed
- Recharts AreaChart: already imported/used in `usage-area-chart.tsx` and `skill-analytics-modal.tsx`
- All recommendation data comes from the existing `getRecommendations()` server action
- No new database tables, migrations, or server actions required

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
  app/(protected)/my-leverage/
    deployment-plan/
      page.tsx                          # NEW: Server component, fetches recommendations
      deployment-plan-dashboard.tsx     # NEW: Client component with 3 sections
  components/
    adoption-roadmap-chart.tsx          # NEW: Recharts AreaChart for cumulative FTE projection
```

### Pattern 1: Sub-page Under my-leverage (Following email-diagnostic Pattern)

**What:** Create `/my-leverage/deployment-plan` as a new Next.js route
**When to use:** This phase
**Why:** Mirrors the existing `/my-leverage/email-diagnostic` sub-page pattern exactly

```typescript
// Source: apps/web/app/(protected)/my-leverage/email-diagnostic/page.tsx (existing pattern)
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRecommendations } from "@/app/actions/recommendations";
import { DeploymentPlanDashboard } from "./deployment-plan-dashboard";

export const metadata = { title: "Deployment Plan | EverySkill" };

export default async function DeploymentPlanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const result = await getRecommendations();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link href="/my-leverage" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
          &larr; Back to My Leverage
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Skill Deployment Plan</h1>
        <p className="mt-2 text-gray-600">Your prioritized adoption roadmap with projected time savings</p>
      </div>
      {"recommendations" in result && result.recommendations ? (
        <DeploymentPlanDashboard recommendations={result.recommendations} />
      ) : (
        /* empty state matching email-diagnostic pattern */
      )}
    </div>
  );
}
```

### Pattern 2: Client-Side Cumulative FTE Computation (No Server Action Needed)

**What:** Compute cumulative FTE Days Saved from `SkillRecommendation[]` purely on the client
**When to use:** In the dashboard client component
**Why:** The math is simple (accumulation over weeks) and all data is already fetched

```typescript
// FTE calculation: 1 FTE day = 8 hours
// projectedWeeklySavings is in hours/week per skill
// Cumulative = as each skill is adopted in sequence, total savings accumulate

interface ProjectionPoint {
  week: number;
  cumulativeFteDays: number;
  label: string; // "Week 1", "Week 2", etc.
}

function computeCumulativeProjection(
  recommendations: SkillRecommendation[],
  weeksToProject: number = 12
): ProjectionPoint[] {
  // Sort by projectedWeeklySavings descending (highest ROI first)
  const sorted = [...recommendations].sort(
    (a, b) => b.projectedWeeklySavings - a.projectedWeeklySavings
  );

  const points: ProjectionPoint[] = [];
  let cumulativeFteDays = 0;

  for (let week = 1; week <= weeksToProject; week++) {
    // Each week, add the savings from all skills adopted up to that point
    // Stagger adoption: adopt one new skill every ~2 weeks
    const skillsAdoptedByWeek = Math.min(
      Math.ceil(week / 2),
      sorted.length
    );

    const weeklyHoursSaved = sorted
      .slice(0, skillsAdoptedByWeek)
      .reduce((sum, s) => sum + s.projectedWeeklySavings, 0);

    cumulativeFteDays += weeklyHoursSaved / 8; // 8 hours = 1 FTE day

    points.push({
      week,
      cumulativeFteDays: Math.round(cumulativeFteDays * 10) / 10,
      label: `Week ${week}`,
    });
  }

  return points;
}
```

### Pattern 3: AreaChart for Cumulative Projection (Matching Existing Codebase Style)

**What:** Single-series Recharts AreaChart showing cumulative FTE Days Saved over time
**When to use:** The projection chart section
**Why:** Matches the exact pattern from `usage-area-chart.tsx`

```typescript
// Source: Adapted from apps/web/components/usage-area-chart.tsx
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdoptionRoadmapChartProps {
  data: ProjectionPoint[];
  height?: number;
}

export function AdoptionRoadmapChart({ data, height = 300 }: AdoptionRoadmapChartProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => value.toFixed(1)}
            label={{ value: "FTE Days Saved", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
          />
          <Tooltip
            formatter={(value) => [Number(value).toFixed(1) + " FTE days", "Cumulative Savings"]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeFteDays"
            stroke="#10b981"  // green for savings (differentiate from blue usage charts)
            fill="#10b981"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Pattern 4: Ranked Adoption List with Step Numbers

**What:** Numbered list of skills in adoption order, showing name, matched category, and projected savings
**When to use:** Main section of the deployment plan
**Why:** Directly serves success criterion #1

```typescript
// Adapts the RecommendationCard pattern but adds sequential numbering
// and "start here" callout for the first item

{sorted.map((rec, index) => (
  <div key={rec.skillId} className="relative rounded-lg border border-gray-200 bg-white p-5">
    {/* Step number badge */}
    <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
      {index + 1}
    </div>
    {/* ... card content with name, category, savings ... */}
    {index === 0 && (
      <div className="mt-3 rounded border-l-4 border-green-400 bg-green-50 p-3">
        <p className="text-sm font-medium text-green-800">Start here — biggest time savings</p>
      </div>
    )}
  </div>
))}
```

### Anti-Patterns to Avoid
- **Do NOT call `getRecommendations()` from the client component:** Fetch in the server component (`page.tsx`) and pass as props. The existing `RecommendationsSection` uses `useEffect` to call the server action from the client -- this works but is less efficient. For the deployment plan page, server-side fetch is cleaner since the page is dedicated to this data.
- **Do NOT create a separate server action for the deployment plan:** All computation (sorting, cumulative projection) is pure math on existing data. No new server action needed.
- **Do NOT use `toLocaleDateString()` for any date formatting:** Per project memory, this causes hydration mismatches between server and client.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Area chart rendering | Custom SVG chart | Recharts AreaChart | Already installed, 5 existing components use it |
| Responsive chart sizing | Manual resize observers | Recharts ResponsiveContainer | Standard pattern in all existing charts |
| FTE calculation | Complex workforce modeling | Simple hours/8 division | FTE Days = hours saved / 8 hours per day. Keep it simple. |
| Cumulative projection | Forecasting library | Simple array accumulation | It's just running addition over sorted recommendations |
| Chart tooltips | Custom tooltip components | Recharts Tooltip with formatter | Matches existing chart tooltip patterns |

**Key insight:** The "deployment plan" is fundamentally a data transformation of the existing `SkillRecommendation[]` -- sort by savings, compute cumulative totals, render with existing chart/card patterns. Zero new data fetching or storage required.

## Common Pitfalls

### Pitfall 1: Empty Recommendations State
**What goes wrong:** User navigates to deployment plan but has no recommendations (no diagnostic scan run)
**Why it happens:** Deployment plan depends on Phase 53 recommendations which depend on Phase 51 diagnostic
**How to avoid:** Show clear empty state with link to run diagnostic first. Check for empty array before rendering charts.
**Warning signs:** Blank page, chart renders with no data points

### Pitfall 2: Hydration Mismatch from Number Formatting
**What goes wrong:** Server renders "1.5" but client renders "1.50" or vice versa
**Why it happens:** `toFixed()` and number formatting can differ subtly
**How to avoid:** Use consistent `.toFixed(1)` everywhere. Do all formatting in the client component (not in server props).
**Warning signs:** React hydration warnings in console

### Pitfall 3: Recharts Rendering in Server Components
**What goes wrong:** Recharts crashes with "window is not defined" or similar
**Why it happens:** Recharts uses browser APIs and must run client-side only
**How to avoid:** All chart components must be "use client". The page.tsx (server component) passes data to a client dashboard component.
**Warning signs:** Build errors mentioning window/document

### Pitfall 4: Division by Zero in FTE Calculation
**What goes wrong:** NaN or Infinity in chart data
**Why it happens:** `projectedWeeklySavings` could be 0 for all recommendations
**How to avoid:** Guard with `Math.max(totalSavings, 0)` and show meaningful empty state when all projections are 0
**Warning signs:** Chart Y-axis shows NaN

### Pitfall 5: Chart Not Rendering at Correct Height
**What goes wrong:** Chart collapses to 0 height or overflows container
**Why it happens:** ResponsiveContainer needs a parent with explicit height
**How to avoid:** Always wrap in a `<div style={{ height }}>` like existing charts do
**Warning signs:** Empty space where chart should be

## Code Examples

### Verified Pattern: AreaChart with ResponsiveContainer (from codebase)

```typescript
// Source: apps/web/components/usage-area-chart.tsx (line 33-60)
<div style={{ height }} className="w-full">
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => value.toFixed(0)} />
      <Tooltip
        formatter={(value) => [Number(value).toFixed(1) + " hours", "Hours Saved"]}
        contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
      />
      <Area
        type="monotone"
        dataKey="hoursSaved"
        stroke="#3b82f6"
        fill="#3b82f6"
        fillOpacity={0.1}
        strokeWidth={2}
      />
    </AreaChart>
  </ResponsiveContainer>
</div>
```

### Verified Pattern: Server Component Page with Client Dashboard (from codebase)

```typescript
// Source: apps/web/app/(protected)/my-leverage/email-diagnostic/page.tsx
// Server component fetches data, passes to "use client" dashboard
export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const diagnostic = await getLatestDiagnostic(session.user.id);
  return diagnostic ? <DiagnosticDashboard diagnostic={diagnostic} /> : <EmptyState />;
}
```

### Verified Pattern: RecommendationCard Data Shape (from codebase)

```typescript
// Source: apps/web/lib/skill-recommendations.ts (line 22-34)
export interface SkillRecommendation {
  skillId: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  hoursSaved: number | null;       // historical hours saved per use
  totalUses: number;
  averageRating: number | null;
  matchedCategories: string[];      // email categories this skill addresses
  projectedWeeklySavings: number;   // hours/week this skill could save
  personalizedReason: string;       // AI-generated explanation
}
```

### Verified Pattern: Back Link + Page Header (from codebase)

```typescript
// Source: apps/web/app/(protected)/my-leverage/email-diagnostic/page.tsx (line 18-33)
<div className="mb-4">
  <Link href="/my-leverage" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
    &larr; Back to My Leverage
  </Link>
</div>
<div className="mb-8">
  <h1 className="text-3xl font-bold text-gray-900">Page Title</h1>
  <p className="mt-2 text-gray-600">Description text</p>
</div>
```

## Data Flow

```
getRecommendations() server action
        |
        v
SkillRecommendation[] (already sorted by projectedWeeklySavings desc)
        |
        +---> Ranked Adoption List (success criterion #1)
        |     - Sort by projectedWeeklySavings desc
        |     - Render numbered cards with name, matchedCategories, projectedWeeklySavings
        |
        +---> Cumulative FTE Projection Chart (success criterion #2)
        |     - Compute cumulative hours saved assuming staggered adoption
        |     - Convert to FTE days (hours / 8)
        |     - Plot as AreaChart over 12-week horizon
        |
        +---> "Start Here" Adoption Order (success criterion #3)
              - First item in sorted list = "Start Here"
              - Each subsequent item shows incremental reasoning
              - personalizedReason field provides the "why"
```

## FTE Days Saved Calculation

**Definition:** 1 FTE day = 8 working hours

**Projection model (simple, no ML):**
1. Sort recommendations by `projectedWeeklySavings` DESC (highest ROI first)
2. Assume staggered adoption: 1 new skill every 2 weeks
3. For each week, compute total weekly hours saved from all adopted-so-far skills
4. Convert weekly hours to FTE days: `weeklyHours / 8`
5. Accumulate: `cumulativeFteDays[week] = cumulativeFteDays[week-1] + fteDaysThisWeek`

**Example with 3 recommendations (2.0h, 1.5h, 0.8h/week):**
| Week | Skills Adopted | Weekly Hours Saved | FTE Days This Week | Cumulative FTE Days |
|------|---------------|-------------------|--------------------|--------------------|
| 1 | Skill 1 | 2.0 | 0.25 | 0.25 |
| 2 | Skill 1 | 2.0 | 0.25 | 0.50 |
| 3 | Skill 1+2 | 3.5 | 0.44 | 0.94 |
| 4 | Skill 1+2 | 3.5 | 0.44 | 1.38 |
| 5 | Skill 1+2+3 | 4.3 | 0.54 | 1.91 |
| ... | ... | ... | ... | ... |
| 12 | All 3 | 4.3 | 0.54 | 5.72 |

This produces a stepped cumulative curve that shows acceleration as each skill is adopted.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat recommendation list | Ranked adoption roadmap with cumulative projection | Phase 54 | Guides user through sequential adoption |
| Individual skill savings | Cumulative FTE Days Saved visualization | Phase 54 | Shows compound value of adopting multiple skills |
| Generic "try this" | "Start here" with prioritized reasoning | Phase 54 | Actionable first step with clear ROI justification |

## Open Questions

1. **Adoption cadence assumption (2 weeks per skill)**
   - What we know: A reasonable default is 1 new skill every 2 weeks for onboarding
   - What's unclear: Whether this should be configurable by the user
   - Recommendation: Hardcode 2-week cadence for v1. Can add a slider later if needed.

2. **Link from RecommendationsSection to Deployment Plan**
   - What we know: RecommendationsSection currently shows top 5 cards in a grid
   - What's unclear: Whether to add a "View Deployment Plan" button inline or as a separate CTA
   - Recommendation: Add a "View Full Deployment Plan" link below the recommendations grid, similar to how EmailDiagnosticCard has "View Full Dashboard"

3. **Number of projection weeks**
   - What we know: 12 weeks (3 months) is a standard business quarter planning horizon
   - What's unclear: Whether 12 is the right default
   - Recommendation: Use 12 weeks, hardcoded for simplicity

## Sources

### Primary (HIGH confidence)
- `apps/web/components/usage-area-chart.tsx` - Verified Recharts AreaChart pattern (single-series, ResponsiveContainer, Tooltip formatter)
- `apps/web/components/skill-analytics-modal.tsx` - Verified second AreaChart usage with same pattern
- `apps/web/lib/skill-recommendations.ts` - Complete SkillRecommendation type and generation logic
- `apps/web/app/actions/recommendations.ts` - Server action wrapping recommendation engine
- `apps/web/components/recommendations-section.tsx` - Existing recommendations UI with loading/error/empty states
- `apps/web/components/recommendation-card.tsx` - Individual recommendation card layout
- `apps/web/app/(protected)/my-leverage/email-diagnostic/page.tsx` - Sub-page routing pattern
- `apps/web/app/(protected)/my-leverage/email-diagnostic/diagnostic-dashboard.tsx` - Client dashboard pattern
- `packages/db/src/services/email-diagnostics.ts` - CategoryBreakdownItem type definition
- `apps/web/package.json` - Recharts 3.7.0 confirmed installed

### Secondary (MEDIUM confidence)
- Recharts stacked area chart documentation - stackId prop for stacking (not needed here, but verified pattern exists)
- GeeksforGeeks Recharts stacked area example - Confirmed stackId="1" syntax for stacking multiple Areas

### Tertiary (LOW confidence)
- None. All findings verified against codebase source code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, 5 existing chart components in codebase
- Architecture: HIGH - Following exact existing patterns (sub-page route, server/client component split)
- Pitfalls: HIGH - Based on project-specific issues documented in MEMORY.md and observed in codebase
- Data computation: HIGH - SkillRecommendation type inspected, FTE math is straightforward

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable -- no external dependencies or fast-moving APIs)
