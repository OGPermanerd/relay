# Phase 52: Diagnostic Dashboard - Research

**Researched:** 2026-02-14
**Domain:** Data visualization (Recharts), React client components, email diagnostic presentation
**Confidence:** HIGH

## Summary

Phase 52 adds a visual diagnostic dashboard page that displays email time breakdown using Recharts charts and KPIs. The infrastructure is already complete: Phase 51 built the data pipeline (fetch, classify, aggregate, persist), and the email-diagnostic-card shows aggregate results as text. This phase transforms those text aggregates into visual charts (PieChart for category distribution, BarChart for time-per-category) with a hero KPI showing total weekly email hours and a "Re-run Diagnostic" button.

Recharts is already installed (v3.7.0), and the codebase has established patterns for chart rendering in `usage-area-chart.tsx`. The data layer (`getLatestDiagnostic`) and types (`AggregateResults`, `CategoryBreakdownItem`) are production-ready. The page structure exists at `/my-leverage` with `email-diagnostic-card.tsx` showing results inline.

**Primary recommendation:** Create a dedicated `/my-leverage/email-diagnostic` route with server component page + client component charts, following the existing pattern in `usage-area-chart.tsx`. Use PieChart for category distribution, BarChart for time breakdown, and a hero stat card for total weekly hours.

## Requirements

From REQUIREMENTS.md:

### DASH-01: Category Breakdown Chart
- Diagnostic dashboard page displays email category breakdown chart (Recharts PieChart or BarChart)
- Shows distribution of email types with counts and percentages
- Data source: `categoryBreakdown` array from `AggregateResults`

### DASH-02: Time-Per-Category Visualization
- "Screentime"-style time-per-category visualization
- Shows hours per week each email category consumes
- Data source: `estimatedMinutes` field in each `CategoryBreakdownItem`

### DASH-03: Hero KPI
- Total estimated email time per week displayed prominently
- Data source: `estimatedHoursPerWeek` from `AggregateResults`

### DASH-04: Re-run Diagnostic
- User can click "Re-run Diagnostic" to trigger fresh 90-day analysis
- Dashboard updates with new results
- Shows date of last scan
- Uses existing `runEmailDiagnostic` server action

## Available Data

### Data Access Layer
**Service:** `packages/db/src/services/email-diagnostics.ts`

```typescript
// Get most recent diagnostic for user
async function getLatestDiagnostic(userId: string): Promise<EmailDiagnostic | null>

// Get diagnostic history (most recent first)
async function getDiagnosticHistory(userId: string, limit = 10): Promise<EmailDiagnostic[]>

// Save new diagnostic (already used by Phase 51 server action)
async function saveEmailDiagnostic(params: SaveEmailDiagnosticParams): Promise<EmailDiagnostic>
```

### Data Structures

**EmailDiagnostic** (persisted in database):
- `id: string`
- `userId: string`
- `tenantId: string`
- `scanDate: Date` — when the diagnostic was run
- `scanPeriodDays: number` — 90
- `totalMessages: number` — total emails analyzed
- `estimatedHoursPerWeek: number` — stored as tenths (125 = 12.5 hours)
- `categoryBreakdown: CategoryBreakdownItem[]` — JSONB array
- `patternInsights: PatternInsights` — JSONB object

**CategoryBreakdownItem**:
```typescript
{
  category: string;         // e.g., "newsletter", "direct-message", "internal-thread"
  count: number;            // number of emails in this category
  percentage: number;       // percentage of total (rounded to 1 decimal)
  estimatedMinutes: number; // time estimate for this category
}
```

**PatternInsights**:
```typescript
{
  busiestHour: number;              // 0-23
  busiestDayOfWeek: string;         // "Monday", "Tuesday", etc.
  averageResponseTimeHours: number | null;
  threadDepthAverage: number;
}
```

### Email Categories
From Phase 51 classifier:
- `newsletter` — automated content (time weight: 0.5 min)
- `automated-notification` — system notifications (0.3 min)
- `meeting-invite` — calendar invites (2 min)
- `direct-message` — personal emails (3 min)
- `internal-thread` — company discussions (4 min)
- `vendor-external` — external business (3.5 min)
- `support-ticket` — customer support (5 min)

## Chart Library Status

### Recharts Already Installed
```json
"recharts": "^3.7.0"
```

Recharts is installed and ready to use. No additional dependencies needed.

### Existing Chart Pattern

**File:** `apps/web/components/usage-area-chart.tsx`

```typescript
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

export function UsageAreaChart({ data, height = 300 }: UsageAreaChartProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }} />
          <Area type="monotone" dataKey="hoursSaved" stroke="#3b82f6" fill="#3b82f6" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Pattern observations:**
- Client component (`"use client"`)
- ResponsiveContainer for responsive sizing
- CartesianGrid with dashed gray lines
- Custom tick styling (fontSize: 12)
- Rounded tooltip with gray border
- Blue color scheme (#3b82f6)
- Empty state handling (dashed border, gray background, centered text)

## Existing Patterns to Follow

### Page Structure Pattern
Current `/my-leverage/page.tsx`:
- Server component page (async function)
- Auth check via `auth()` from `@/auth`
- Parallel data fetching with `Promise.all()`
- Serializes timestamps to ISO strings for client components
- Back link to home
- Page header with title + description
- Sections with client components

### Card Layout Pattern
Current `email-diagnostic-card.tsx`:
- Rounded border card: `rounded-lg border border-gray-200 bg-white p-6`
- Icon + title header with flexbox
- Loading state: blue spinner + text
- Error state: red background + error message
- Results state: hero stat card + category list + action button
- Empty state: gray button to run diagnostic

### Color Scheme
Existing UI colors:
- Primary blue: `bg-blue-600`, `text-blue-600`, `border-blue-500`
- Success green: `bg-green-100`, `text-green-700`
- Warning orange: `bg-orange-100`, `text-orange-700`
- Error red: `bg-red-50`, `text-red-700`
- Gray neutrals: `bg-gray-50`, `text-gray-600`, `border-gray-200`
- Purple accent: `bg-purple-50`, `from-blue-50 to-purple-50`

## Proposed File Structure

### New Files to Create

**1. Dashboard Page Route**
```
apps/web/app/(protected)/my-leverage/email-diagnostic/page.tsx
```
- Server component
- Fetch latest diagnostic via `getLatestDiagnostic(userId)`
- Pass data to client component
- Handle "no diagnostic yet" state with CTA to run first scan

**2. Dashboard Client Component**
```
apps/web/app/(protected)/my-leverage/email-diagnostic/diagnostic-dashboard.tsx
```
- Client component
- Accept `EmailDiagnostic` as prop
- Render hero KPI, PieChart, BarChart, pattern insights
- "Re-run Diagnostic" button triggers `runEmailDiagnostic` server action

**3. Category Pie Chart Component**
```
apps/web/components/category-pie-chart.tsx
```
- Client component
- PieChart showing category distribution
- Custom colors per category
- Tooltip with percentage and count

**4. Time Bar Chart Component**
```
apps/web/components/time-bar-chart.tsx
```
- Client component
- BarChart showing hours per week per category
- Horizontal bars sorted by time descending
- Tooltip with time estimate

### Files to Modify

**1. `apps/web/app/(protected)/my-leverage/email-diagnostic-card.tsx`**
- Add "View Full Dashboard" link when results exist
- Link to `/my-leverage/email-diagnostic`

**2. `apps/web/app/(protected)/my-leverage/page.tsx`** (optional)
- Could move email-diagnostic-card below My Leverage stats
- No structural changes required

## Standard Stack

### Core Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 3.7.0 | Charting library | Industry standard for React charts, composable API, responsive |
| React | 19.x | UI framework | Next.js 16 uses React 19 |
| Next.js | 16.1.6 | App framework | Already in use project-wide |
| Tailwind CSS | (installed) | Styling | Already in use project-wide |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle ORM | 0.42.0 | Database queries | Already used via `getLatestDiagnostic` service |
| Auth.js v5 | - | Session management | Already used via `auth()` |

**Installation:**
No new packages needed — all dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/app/(protected)/my-leverage/email-diagnostic/
├── page.tsx                    # Server component route
└── diagnostic-dashboard.tsx    # Client component with charts

apps/web/components/
├── category-pie-chart.tsx      # Reusable pie chart
├── time-bar-chart.tsx          # Reusable bar chart
└── usage-area-chart.tsx        # (already exists)
```

### Pattern 1: Server + Client Split
**What:** Server component page fetches data, client component renders interactive charts
**When to use:** Charts need interactivity (tooltips, hover effects), data fetching is async

**Example:**
```typescript
// page.tsx (server component)
export default async function EmailDiagnosticPage() {
  const session = await auth();
  const diagnostic = await getLatestDiagnostic(session.user.id);

  if (!diagnostic) {
    return <NoDiagnosticYet />;
  }

  return <DiagnosticDashboard diagnostic={diagnostic} />;
}

// diagnostic-dashboard.tsx (client component)
"use client";
export function DiagnosticDashboard({ diagnostic }: Props) {
  return (
    <div>
      <HeroKPI value={diagnostic.estimatedHoursPerWeek / 10} />
      <CategoryPieChart data={diagnostic.categoryBreakdown} />
      <TimeBarChart data={diagnostic.categoryBreakdown} />
    </div>
  );
}
```

### Pattern 2: Recharts Responsive Wrapper
**What:** Wrap charts in ResponsiveContainer for fluid sizing
**When to use:** Always, for responsive charts

**Example:**
```typescript
<div className="h-[300px] w-full">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie data={data} dataKey="count" nameKey="category" />
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
</div>
```

### Pattern 3: Empty State Handling
**What:** Show friendly message when no data exists
**When to use:** First-time users, no diagnostic run yet

**Example:**
```typescript
if (!diagnostic) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p className="text-gray-500">No diagnostic data yet. Run your first scan to see insights.</p>
      <button onClick={handleRun} className="mt-4 ...">Run Diagnostic</button>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Date hydration mismatch:** Don't use `toLocaleDateString()` in server components — format dates manually or serialize to ISO strings
- **Chart data mutation:** Recharts data must be plain objects — don't pass Proxy objects or class instances
- **Inline styles over Tailwind:** Use Tailwind classes for consistency, except for chart-specific sizing (`height`, `width`)
- **Client component data fetching:** Don't fetch in client components — fetch in server component and pass as props

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/Canvas charts | Recharts | Responsive, accessible, handles tooltips, legend, axis formatting |
| Data aggregation | Custom reduce/map logic | Already done in Phase 51 `diagnostic-aggregator.ts` | Pre-computed, tested, efficient |
| Time formatting | Manual hour/minute math | Existing patterns + toFixed() | Consistent with rest of app |
| Empty states | Conditional render logic | Existing card pattern | Consistent UX |

**Key insight:** Recharts handles all the complexity of responsive charts, tooltips, legends, and accessibility. Custom chart implementations are 10x more code and miss edge cases like mobile touch, screen readers, and RTL languages.

## Common Pitfalls

### Pitfall 1: Recharts Data Key Mismatches
**What goes wrong:** Chart renders empty or throws error because `dataKey` doesn't match object property
**Why it happens:** Typos in `dataKey` prop or data shape mismatch
**How to avoid:**
- Type your chart component props with the exact data shape
- Use TypeScript to catch key mismatches at compile time
**Warning signs:** Chart renders but shows no data, console warning about missing keys

**Example:**
```typescript
// WRONG: dataKey doesn't match object property
<Pie data={categoryBreakdown} dataKey="emails" nameKey="category" />

// RIGHT: dataKey matches CategoryBreakdownItem.count
<Pie data={categoryBreakdown} dataKey="count" nameKey="category" />
```

### Pitfall 2: ResponsiveContainer Sizing Issues
**What goes wrong:** Chart doesn't render or collapses to 0 height
**Why it happens:** Parent container has no explicit height
**How to avoid:** Always set explicit height on ResponsiveContainer parent (class or inline style)
**Warning signs:** Chart not visible, empty space where chart should be

**Example:**
```typescript
// WRONG: no height on parent
<div className="w-full">
  <ResponsiveContainer width="100%" height="100%">...</ResponsiveContainer>
</div>

// RIGHT: explicit height
<div className="h-[300px] w-full">
  <ResponsiveContainer width="100%" height="100%">...</ResponsiveContainer>
</div>
```

### Pitfall 3: Server Component Chart Import
**What goes wrong:** Build error: "useState can only be used in Client Components"
**Why it happens:** Recharts components use hooks internally, must be in client components
**How to avoid:** Import Recharts only in files with `"use client"` directive
**Warning signs:** Build error mentioning hooks, server component import

**Example:**
```typescript
// WRONG: server component importing Recharts
// page.tsx (server component, no "use client")
import { PieChart } from "recharts"; // ERROR

// RIGHT: client component importing Recharts
// diagnostic-dashboard.tsx
"use client";
import { PieChart } from "recharts"; // OK
```

### Pitfall 4: estimatedHoursPerWeek Tenths Conversion
**What goes wrong:** Display shows "125 hours" instead of "12.5 hours"
**Why it happens:** Database stores value as tenths (125 = 12.5 hours) to avoid float precision issues
**How to avoid:** Divide by 10 before displaying: `diagnostic.estimatedHoursPerWeek / 10`
**Warning signs:** Unreasonably high hour values in UI

**Example:**
```typescript
// WRONG: displaying raw tenths value
<p>{diagnostic.estimatedHoursPerWeek} hours</p> // shows "125 hours"

// RIGHT: converting tenths to hours
<p>{(diagnostic.estimatedHoursPerWeek / 10).toFixed(1)} hours</p> // shows "12.5 hours"
```

## Code Examples

### Example 1: Server Component Page
```typescript
// apps/web/app/(protected)/my-leverage/email-diagnostic/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLatestDiagnostic } from "@everyskill/db/services/email-diagnostics";
import { DiagnosticDashboard } from "./diagnostic-dashboard";
import Link from "next/link";

export const metadata = { title: "Email Diagnostic | EverySkill" };

export default async function EmailDiagnosticPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const diagnostic = await getLatestDiagnostic(session.user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/my-leverage" className="text-sm text-blue-600 hover:underline">
        &larr; Back to My Leverage
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Email Time Diagnostic</h1>
        <p className="mt-2 text-gray-600">
          Visual breakdown of where your email time goes
        </p>
      </div>

      {diagnostic ? (
        <DiagnosticDashboard diagnostic={diagnostic} userId={session.user.id} />
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-gray-500">No diagnostic data yet.</p>
          <p className="mt-2 text-sm text-gray-400">
            Go to <Link href="/my-leverage" className="text-blue-600 hover:underline">My Leverage</Link> to run your first scan.
          </p>
        </div>
      )}
    </div>
  );
}
```

### Example 2: Client Dashboard Component
```typescript
// apps/web/app/(protected)/my-leverage/email-diagnostic/diagnostic-dashboard.tsx
"use client";

import { useState } from "react";
import type { EmailDiagnostic } from "@everyskill/db/schema/email-diagnostics";
import { runEmailDiagnostic } from "@/app/actions/email-diagnostic";
import { CategoryPieChart } from "@/components/category-pie-chart";
import { TimeBarChart } from "@/components/time-bar-chart";

interface Props {
  diagnostic: EmailDiagnostic;
  userId: string;
}

export function DiagnosticDashboard({ diagnostic, userId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRerun() {
    setLoading(true);
    await runEmailDiagnostic();
    window.location.reload(); // Refresh to show new data
  }

  const hoursPerWeek = (diagnostic.estimatedHoursPerWeek / 10).toFixed(1);
  const scanDateFormatted = new Date(diagnostic.scanDate).toLocaleDateString();

  return (
    <div className="mt-8 space-y-6">
      {/* Hero KPI */}
      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <p className="text-sm font-medium text-gray-700">Total Email Time</p>
        <p className="mt-2 text-4xl font-bold text-gray-900">{hoursPerWeek} hours</p>
        <p className="text-sm text-gray-600">per week</p>
      </div>

      {/* Category Pie Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Email Category Distribution</h2>
        <CategoryPieChart data={diagnostic.categoryBreakdown} />
      </div>

      {/* Time Bar Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Time Per Category</h2>
        <TimeBarChart data={diagnostic.categoryBreakdown} />
      </div>

      {/* Pattern Insights */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Email Patterns</h2>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Busiest time:</span>{" "}
            {diagnostic.patternInsights.busiestDayOfWeek}s at{" "}
            {diagnostic.patternInsights.busiestHour}:00
          </p>
          <p>
            <span className="font-medium">Last scanned:</span> {scanDateFormatted}
          </p>
          <p className="text-gray-500">
            {diagnostic.totalMessages} messages analyzed over {diagnostic.scanPeriodDays} days
          </p>
        </div>
      </div>

      {/* Re-run Button */}
      <button
        onClick={handleRerun}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Running Diagnostic..." : "Re-run Diagnostic"}
      </button>
    </div>
  );
}
```

### Example 3: Category Pie Chart
```typescript
// apps/web/components/category-pie-chart.tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategoryBreakdownItem } from "@everyskill/db/services/email-diagnostics";

interface Props {
  data: CategoryBreakdownItem[];
}

const CATEGORY_COLORS: Record<string, string> = {
  newsletter: "#3b82f6",           // blue
  "automated-notification": "#10b981", // green
  "meeting-invite": "#f59e0b",     // amber
  "direct-message": "#8b5cf6",     // purple
  "internal-thread": "#ef4444",    // red
  "vendor-external": "#06b6d4",    // cyan
  "support-ticket": "#ec4899",     // pink
};

export function CategoryPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <p className="text-sm text-gray-500">No category data</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ category, percentage }) => `${category}: ${percentage}%`}
          >
            {data.map((entry) => (
              <Cell
                key={entry.category}
                fill={CATEGORY_COLORS[entry.category] || "#6b7280"}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Example 4: Time Bar Chart
```typescript
// apps/web/components/time-bar-chart.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CategoryBreakdownItem } from "@everyskill/db/services/email-diagnostics";

interface Props {
  data: CategoryBreakdownItem[];
}

export function TimeBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <p className="text-sm text-gray-500">No time data</p>
      </div>
    );
  }

  // Convert minutes to hours per week, sort by time descending
  const chartData = data
    .map((item) => ({
      category: item.category.replace(/-/g, " "),
      hoursPerWeek: Number(((item.estimatedMinutes / 60) * 7).toFixed(1)),
    }))
    .sort((a, b) => b.hoursPerWeek - a.hoursPerWeek);

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="horizontal" margin={{ top: 10, right: 30, left: 100, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={90} />
          <Tooltip
            formatter={(value: number) => [`${value} hrs/week`, "Time"]}
            contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="hoursPerWeek" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Victory Charts | Recharts | 2020-2021 | Recharts became de facto standard for React |
| Class components | Function components + hooks | React 16.8+ | All new components use hooks |
| Pages directory | App directory | Next.js 13+ | This project uses app directory |
| Client data fetching | Server component fetching | Next.js 13+ | Server components fetch, client components display |

**Deprecated/outdated:**
- Victory Charts: Still maintained but Recharts has larger community
- Chart.js with react-chartjs-2: Canvas-based, Recharts uses SVG (better for responsive)
- Custom D3 charts: Too low-level for business dashboards, Recharts abstracts D3 complexity

## Open Questions

None. All technical questions resolved:

1. **Recharts installed?** YES — v3.7.0 already installed
2. **Existing chart patterns?** YES — `usage-area-chart.tsx` provides template
3. **Data access layer complete?** YES — `getLatestDiagnostic` service ready
4. **Type definitions?** YES — `AggregateResults`, `CategoryBreakdownItem` fully typed
5. **Server action for re-run?** YES — `runEmailDiagnostic` already exists from Phase 51

## Sources

### Primary (HIGH confidence)
- Codebase files:
  - `apps/web/package.json` — Recharts v3.7.0 confirmed installed
  - `apps/web/components/usage-area-chart.tsx` — Existing Recharts pattern
  - `apps/web/app/(protected)/my-leverage/page.tsx` — Page structure pattern
  - `apps/web/app/(protected)/my-leverage/email-diagnostic-card.tsx` — Card layout pattern
  - `packages/db/src/services/email-diagnostics.ts` — Data access layer
  - `packages/db/src/schema/email-diagnostics.ts` — Schema and types
  - `apps/web/lib/diagnostic-aggregator.ts` — AggregateResults type
  - `apps/web/app/actions/email-diagnostic.ts` — Server action for re-run

### Secondary (MEDIUM confidence)
- Recharts official docs (v3.x) — Component API and examples
- Next.js 16 docs — App directory patterns
- React 19 docs — Server component patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Recharts installed, existing usage confirmed in codebase
- Architecture: HIGH — Server/client split pattern established, chart pattern exists
- Pitfalls: HIGH — Common Recharts issues (dataKey mismatch, ResponsiveContainer sizing) well-documented

**Research date:** 2026-02-14
**Valid until:** 30 days (stable stack, no fast-moving dependencies)
