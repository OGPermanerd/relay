# Phase 63: IP Risk Analysis - Research

**Researched:** 2026-02-16
**Domain:** SQL aggregation queries + risk scoring logic + Next.js server components + Recharts visualization
**Confidence:** HIGH

## Summary

Phase 63 adds IP concentration risk analysis and key person dependency alerts to the existing IP dashboard page (`/leverage/ip-dashboard`). The core data model is simple: a "single-author skill" is a published skill where `author_id` is the sole author AND `forked_from_id IS NULL` (no forks exist of it). A "high-usage" skill is one where `total_uses` exceeds a configurable threshold. Combining these two dimensions (single-author + high-usage) produces the risk signal.

The implementation requires: (1) new SQL query functions in `ip-dashboard-queries.ts` to identify at-risk skills and rank employees by IP concentration, (2) a new client component section on the IP dashboard page for risk alerts and employee risk table with drill-down, and (3) a server action for the employee drill-down modal to fetch an individual's at-risk skills on demand.

No new schema or migrations are needed. All data exists in the `skills` table: `author_id`, `total_uses`, `forked_from_id`, `status`, `tenant_id`, `name`, `category`, `hours_saved`. The existing index `skills_author_status_idx ON skills (author_id, status)` supports efficient author-grouped queries. Recharts BarChart is already used in the codebase (`time-bar-chart.tsx`) and can be reused for the concentration visualization.

**Primary recommendation:** Add 2-3 new query functions to `ip-dashboard-queries.ts`, a new `ip-risk-section.tsx` client component (table + alert badges + drill-down modal), wire into the existing IP dashboard page. Follow the exact employee-tab + employee-detail-modal pattern for the drill-down interaction.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | SQL queries for risk analysis aggregations | Already in use for all IP dashboard queries |
| recharts | ^3.7.0 | BarChart for concentration visualization | Already used: `time-bar-chart.tsx`, `quality-trend-chart.tsx` |
| next.js | 16.1.6 | Server component data fetching + server action for drill-down | All leverage pages follow this pattern |
| nuqs | (installed) | URL state for sort column/direction in risk table | Already used in `use-analytics-sort.ts` for employee/skill tables |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | (installed) | Amber/red severity indicator styling | `text-amber-600`, `bg-amber-50`, `text-red-600`, `bg-red-50` patterns already in codebase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline risk severity with Tailwind colors | Dedicated `<RiskBadge>` component | Component is better for reuse in Phase 64; but a simple inline span is sufficient for Phase 63 given only 2 severity levels |
| Horizontal BarChart for employee risk ranking | Sortable table only | BarChart adds visual impact for exec audiences; table-only is simpler. Recommend: table as primary + optional bar chart if time allows |
| Server action for drill-down data | Pre-fetching all drill-down data on page load | Server action is better -- avoids loading all employee skill details upfront when most rows won't be expanded |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
  lib/
    ip-dashboard-queries.ts      # ADD: getIpRiskEmployees(), getAtRiskSkills(), getEmployeeAtRiskSkills()
  app/(protected)/leverage/
    ip-dashboard/
      page.tsx                   # MODIFY: add risk data fetching, pass to new component
  app/actions/
    get-employee-risk-skills.ts  # NEW: server action for drill-down modal
  components/
    ip-risk-section.tsx          # NEW: risk alerts + employee risk table + drill-down modal
  hooks/
    use-analytics-sort.ts        # ADD: risk table sort columns
```

### Pattern 1: Risk Scoring SQL Query
**What:** Identify single-author, high-usage skills with no forks as "at-risk" IP. Group by author to rank employees by concentration.
**When to use:** Main IP risk analysis query, called on every IP dashboard page load.
**Key SQL logic:**
```sql
-- "At-risk" skill = published, single author, no forks of it exist, high usage
-- Step 1: Find skills with exactly one author and no forks
SELECT
  s.id, s.name, s.author_id, s.total_uses, s.hours_saved, s.category,
  u.name AS author_name, u.email AS author_email, u.image AS author_image,
  -- Risk severity: RED if total_uses >= 50, AMBER if total_uses >= 10
  CASE
    WHEN s.total_uses >= 50 THEN 'critical'
    WHEN s.total_uses >= 10 THEN 'high'
    ELSE 'medium'
  END AS risk_level
FROM skills s
JOIN users u ON u.id = s.author_id
WHERE s.tenant_id = $tenantId
  AND s.status = 'published'
  AND s.author_id IS NOT NULL
  -- No forks exist of this skill
  AND NOT EXISTS (
    SELECT 1 FROM skills fork
    WHERE fork.forked_from_id = s.id
      AND fork.status = 'published'
      AND fork.tenant_id = $tenantId
  )
  -- High usage threshold
  AND s.total_uses >= 10
ORDER BY s.total_uses DESC
```

### Pattern 2: Employee IP Concentration Ranking
**What:** Aggregate at-risk skills per employee to rank who holds the most critical IP.
**When to use:** Primary table in the IP risk section.
**Key SQL logic:**
```sql
-- Group at-risk skills by author, rank by total risk exposure
SELECT
  u.id, u.name, u.email, u.image,
  COUNT(*)::integer AS at_risk_skill_count,
  SUM(s.total_uses)::integer AS total_at_risk_uses,
  SUM(COALESCE(s.hours_saved, 1) * s.total_uses)::double precision AS total_at_risk_hours_saved,
  MAX(CASE WHEN s.total_uses >= 50 THEN 'critical' WHEN s.total_uses >= 10 THEN 'high' ELSE 'medium' END) AS highest_risk_level
FROM skills s
JOIN users u ON u.id = s.author_id
WHERE s.tenant_id = $tenantId
  AND s.status = 'published'
  AND s.author_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM skills fork
    WHERE fork.forked_from_id = s.id AND fork.status = 'published' AND fork.tenant_id = $tenantId
  )
  AND s.total_uses >= 10
GROUP BY u.id, u.name, u.email, u.image
ORDER BY total_at_risk_uses DESC
```

### Pattern 3: Admin-Gated Page Data Fetching (Existing Pattern)
**What:** The IP dashboard page.tsx already follows this pattern. Phase 63 adds more data to the same page.
**When to use:** Same server component, additional `Promise.all` entry.
**Example (extending existing page.tsx):**
```typescript
// In ip-dashboard/page.tsx -- add to existing Promise.all
const [stats, trendData, riskEmployees, atRiskSkills] = await Promise.all([
  getIpDashboardStats(tenantId),
  getQualityTrends(tenantId, startDate),
  getIpRiskEmployees(tenantId),       // NEW
  getAtRiskSkillAlerts(tenantId),     // NEW
]);
```

### Pattern 4: Drill-Down Modal via Server Action (Existing Pattern)
**What:** Click a table row to open a modal that fetches detail data on demand via server action.
**When to use:** Employee risk drill-down to see which specific at-risk skills they own.
**Reference:** `employees-tab.tsx` + `employee-detail-modal.tsx` + `get-employee-activity.ts`
```typescript
// Server action: apps/web/app/actions/get-employee-risk-skills.ts
"use server";
import { auth } from "@/auth";
import { getEmployeeAtRiskSkills } from "@/lib/ip-dashboard-queries";

export async function fetchEmployeeRiskSkills(userId: string): Promise<AtRiskSkill[]> {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Unauthorized");
  return getEmployeeAtRiskSkills(session.user.tenantId, userId);
}
```

### Pattern 5: Risk Severity Badge Styling
**What:** Amber/red badge indicators inline with table cells and alert cards.
**When to use:** Risk level indicators on skills and employees.
**Reference:** `drift-indicator.tsx` uses amber styling, `company-approved-badge.tsx` shows badge pattern.
```typescript
// Inline severity badge (follows drift-indicator.tsx pattern)
const RISK_STYLES = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-amber-100 text-amber-700 border-amber-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
} as const;

function RiskBadge({ level }: { level: "critical" | "high" | "medium" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_STYLES[level]}`}>
      {level === "critical" ? "Critical" : level === "high" ? "High" : "Medium"}
    </span>
  );
}
```

### Anti-Patterns to Avoid
- **Computing risk in the client:** All risk scoring must happen in SQL/server-side. Client components only display pre-computed data.
- **Hard-coding usage thresholds without visibility:** Thresholds (10 for "high", 50 for "critical") should be defined as named constants in the query module, not buried in SQL strings.
- **Loading all drill-down data eagerly:** Use server actions for on-demand modal data, not pre-fetching all employee skill details.
- **Counting forks incorrectly:** Only published forks within the same tenant count as risk mitigation. Draft or deleted forks do not reduce risk.
- **toLocaleDateString() in any new components:** Follow UTC formatting rules from existing codebase patterns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table headers | Custom sort state management | `useAnalyticsSort` pattern from `use-analytics-sort.ts` (add new column set) | URL-persisted sort state via nuqs, already proven |
| Modal overlay + backdrop | Custom modal implementation | Follow `employee-detail-modal.tsx` pattern exactly | Consistent look, handles click-outside-to-close, scroll management |
| Admin access control | Custom role checks in page or components | `isAdmin(session)` from `@/lib/admin` + redirect guard in page.tsx | Already done in existing page.tsx |
| Risk badge coloring | Manual hex colors | Tailwind utility classes (bg-amber-100, text-red-700, etc.) | Consistent with existing badge patterns (drift-indicator.tsx) |
| Empty state rendering | Skip when no data | Dashed-border placeholder pattern from all chart components | Consistent UX for zero-data scenarios |

**Key insight:** This phase is primarily new SQL queries plus UI composition from existing component patterns. The novel work is the risk scoring logic and alert presentation. The drill-down, table, modal, badge, and chart patterns all exist already.

## Common Pitfalls

### Pitfall 1: Threshold Magic Numbers
**What goes wrong:** Risk thresholds (10, 50) are buried in SQL and become impossible to adjust or explain to admins.
**Why it happens:** Developer embeds thresholds directly in query strings.
**How to avoid:** Define named constants at the top of `ip-dashboard-queries.ts`: `const HIGH_RISK_USAGE_THRESHOLD = 10; const CRITICAL_RISK_USAGE_THRESHOLD = 50;`. Use them in both SQL and UI (to display threshold explanations in tooltips).
**Warning signs:** Admin asks "why is this red?" and there's no way to explain the threshold.

### Pitfall 2: NOT EXISTS Subquery Performance
**What goes wrong:** The `NOT EXISTS (SELECT 1 FROM skills WHERE forked_from_id = s.id ...)` subquery runs for every row, potentially slow on large skill tables.
**Why it happens:** No index on `forked_from_id`.
**How to avoid:** The codebase doesn't currently have an index on `forked_from_id`. For small tenants (< 1000 skills) this is fine. If performance becomes an issue, add an index: `CREATE INDEX skills_forked_from_id_idx ON skills (forked_from_id) WHERE forked_from_id IS NOT NULL`. For Phase 63, the `NOT EXISTS` approach is correct and simple -- optimize only if measured slow.
**Warning signs:** IP dashboard page loads > 3 seconds for large tenants.

### Pitfall 3: Null author_id Skills
**What goes wrong:** Skills with `author_id IS NULL` are silently excluded from risk analysis, which is correct, but if most skills lack authors the dashboard appears empty.
**Why it happens:** Skills uploaded via MCP or API may not have author_id set.
**How to avoid:** Query already filters `author_id IS NOT NULL`. Add a note in the UI if the count of skills without authors is significant: "X skills have no assigned author and are excluded from risk analysis."
**Warning signs:** Dashboard shows zero risk when the tenant has many high-usage skills.

### Pitfall 4: Tenant Isolation in Subqueries
**What goes wrong:** The `NOT EXISTS` fork check must also filter by `tenant_id`, otherwise forks in other tenants could falsely reduce risk.
**Why it happens:** Forgetting `tenant_id` in the subquery WHERE clause.
**How to avoid:** Every subquery MUST include `AND fork.tenant_id = $tenantId`. See the SQL examples above.
**Warning signs:** Risk levels appear lower than expected for multi-tenant deployments.

### Pitfall 5: Hydration Mismatches
**What goes wrong:** Using `toLocaleDateString()` or browser-dependent formatting in the risk section causes hydration errors.
**Why it happens:** New components forget the established rule.
**How to avoid:** All date formatting in client components must use the `MONTHS[d.getUTCMonth()]` pattern from `cost-trend-chart.tsx`. For this phase, dates are minimal (last updated times in drill-down modal) -- use `RelativeTime` component which is already hydration-safe.
**Warning signs:** Console errors about "Text content does not match server-rendered HTML."

### Pitfall 6: Risk Level MAX Aggregation in SQL
**What goes wrong:** Using `MAX(CASE ... END)` to get highest risk level per employee doesn't sort correctly because alphabetical order of 'critical'/'high'/'medium' doesn't match severity order.
**Why it happens:** String comparison: 'critical' < 'high' < 'medium' alphabetically, which is opposite to severity.
**How to avoid:** Use a numeric severity in SQL then map to labels in TypeScript:
```sql
MAX(CASE WHEN s.total_uses >= 50 THEN 3 WHEN s.total_uses >= 10 THEN 2 ELSE 1 END) AS risk_severity
```
Then in TypeScript: `riskLevel = severity === 3 ? "critical" : severity === 2 ? "high" : "medium"`.
**Warning signs:** Employee with one critical skill shows "medium" risk.

## Code Examples

### Query: Get At-Risk Skill Alerts
```typescript
// Source: derived from ip-dashboard-queries.ts + skills schema
// Top-level alerts for the dashboard -- skills with highest risk, surfaced proactively

export const HIGH_USAGE_THRESHOLD = 10;     // min uses for "high" risk
export const CRITICAL_USAGE_THRESHOLD = 50;  // min uses for "critical" risk

export interface AtRiskSkillAlert {
  skillId: string;
  skillName: string;
  category: string;
  authorId: string;
  authorName: string | null;
  totalUses: number;
  hoursSavedPerUse: number;
  riskLevel: "critical" | "high";
}

export async function getAtRiskSkillAlerts(tenantId: string): Promise<AtRiskSkillAlert[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.category,
      s.author_id,
      u.name AS author_name,
      s.total_uses,
      COALESCE(s.hours_saved, 1) AS hours_saved_per_use
    FROM skills s
    JOIN users u ON u.id = s.author_id
    WHERE s.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.author_id IS NOT NULL
      AND s.total_uses >= ${HIGH_USAGE_THRESHOLD}
      AND NOT EXISTS (
        SELECT 1 FROM skills fork
        WHERE fork.forked_from_id = s.id
          AND fork.status = 'published'
          AND fork.tenant_id = ${tenantId}
      )
    ORDER BY s.total_uses DESC
    LIMIT 20
  `);

  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    skillId: String(row.skill_id),
    skillName: String(row.skill_name),
    category: String(row.category),
    authorId: String(row.author_id),
    authorName: row.author_name ? String(row.author_name) : null,
    totalUses: Number(row.total_uses),
    hoursSavedPerUse: Number(row.hours_saved_per_use),
    riskLevel: Number(row.total_uses) >= CRITICAL_USAGE_THRESHOLD ? "critical" : "high",
  }));
}
```

### Query: Get Employee IP Risk Ranking
```typescript
// Source: derived from analytics-queries.ts getEmployeeUsage pattern

export interface IpRiskEmployee {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  atRiskSkillCount: number;
  totalAtRiskUses: number;
  totalAtRiskHoursSaved: number;
  highestRiskSeverity: number; // 3=critical, 2=high, 1=medium
  riskLevel: "critical" | "high" | "medium";
}

export async function getIpRiskEmployees(tenantId: string): Promise<IpRiskEmployee[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      u.id, u.name, u.email, u.image,
      COUNT(*)::integer AS at_risk_skill_count,
      SUM(s.total_uses)::integer AS total_at_risk_uses,
      SUM(COALESCE(s.hours_saved, 1) * s.total_uses)::double precision AS total_at_risk_hours_saved,
      MAX(CASE
        WHEN s.total_uses >= ${CRITICAL_USAGE_THRESHOLD} THEN 3
        WHEN s.total_uses >= ${HIGH_USAGE_THRESHOLD} THEN 2
        ELSE 1
      END)::integer AS highest_risk_severity
    FROM skills s
    JOIN users u ON u.id = s.author_id
    WHERE s.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.author_id IS NOT NULL
      AND s.total_uses >= ${HIGH_USAGE_THRESHOLD}
      AND NOT EXISTS (
        SELECT 1 FROM skills fork
        WHERE fork.forked_from_id = s.id
          AND fork.status = 'published'
          AND fork.tenant_id = ${tenantId}
      )
    GROUP BY u.id, u.name, u.email, u.image
    ORDER BY total_at_risk_uses DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    userId: String(row.id),
    name: row.name ? String(row.name) : null,
    email: String(row.email),
    image: row.image ? String(row.image) : null,
    atRiskSkillCount: Number(row.at_risk_skill_count),
    totalAtRiskUses: Number(row.total_at_risk_uses),
    totalAtRiskHoursSaved: Number(row.total_at_risk_hours_saved),
    highestRiskSeverity: Number(row.highest_risk_severity),
    riskLevel: Number(row.highest_risk_severity) === 3 ? "critical" : Number(row.highest_risk_severity) === 2 ? "high" : "medium",
  }));
}
```

### Query: Get Individual Employee's At-Risk Skills (Drill-Down)
```typescript
// Source: derived from getEmployeeActivity pattern for server action usage

export interface EmployeeAtRiskSkill {
  skillId: string;
  skillName: string;
  slug: string;
  category: string;
  totalUses: number;
  hoursSavedPerUse: number;
  riskLevel: "critical" | "high";
}

export async function getEmployeeAtRiskSkills(
  tenantId: string,
  userId: string
): Promise<EmployeeAtRiskSkill[]> {
  if (!db) return [];

  const result = await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.slug,
      s.category,
      s.total_uses,
      COALESCE(s.hours_saved, 1) AS hours_saved_per_use
    FROM skills s
    WHERE s.tenant_id = ${tenantId}
      AND s.author_id = ${userId}
      AND s.status = 'published'
      AND s.total_uses >= ${HIGH_USAGE_THRESHOLD}
      AND NOT EXISTS (
        SELECT 1 FROM skills fork
        WHERE fork.forked_from_id = s.id
          AND fork.status = 'published'
          AND fork.tenant_id = ${tenantId}
      )
    ORDER BY s.total_uses DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];
  return rows.map((row) => ({
    skillId: String(row.skill_id),
    skillName: String(row.skill_name),
    slug: String(row.slug),
    category: String(row.category),
    totalUses: Number(row.total_uses),
    hoursSavedPerUse: Number(row.hours_saved_per_use),
    riskLevel: Number(row.total_uses) >= CRITICAL_USAGE_THRESHOLD ? "critical" : "high",
  }));
}
```

### Server Action: Fetch Employee Risk Skills (Drill-Down)
```typescript
// Source: follows get-employee-activity.ts pattern exactly
"use server";
import { auth } from "@/auth";
import { getEmployeeAtRiskSkills } from "@/lib/ip-dashboard-queries";
import type { EmployeeAtRiskSkill } from "@/lib/ip-dashboard-queries";

export async function fetchEmployeeRiskSkills(userId: string): Promise<EmployeeAtRiskSkill[]> {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error("Unauthorized");
  return getEmployeeAtRiskSkills(session.user.tenantId, userId);
}
```

### IP Risk Section Component Structure
```typescript
// Source: derived from employees-tab.tsx + employee-detail-modal.tsx pattern
"use client";

interface IpRiskSectionProps {
  riskEmployees: IpRiskEmployee[];
  atRiskAlerts: AtRiskSkillAlert[];
}

export function IpRiskSection({ riskEmployees, atRiskAlerts }: IpRiskSectionProps) {
  // 1. Alert cards section (proactive, always visible)
  //    - Top N critical/high risk skills shown as alert cards with amber/red styling
  //    - Each alert: skill name, author, usage count, risk badge
  //
  // 2. Employee risk ranking table (sortable)
  //    - Columns: Name, At-Risk Skills, Total At-Risk Uses, Hours at Risk, Risk Level
  //    - Click row to open drill-down modal
  //    - Follows employees-tab.tsx pattern
  //
  // 3. Drill-down modal (on-demand via server action)
  //    - Shows specific at-risk skills for the selected employee
  //    - Each skill links to /skills/[slug]
  //    - Risk badge per skill
  //    - Follows employee-detail-modal.tsx pattern
}
```

### Sort Hook Extension
```typescript
// Source: add to use-analytics-sort.ts
export const IP_RISK_SORT_COLUMNS = [
  "name",
  "atRiskSkillCount",
  "totalAtRiskUses",
  "totalAtRiskHoursSaved",
  "riskLevel",
] as const;
export type IpRiskSortColumn = (typeof IP_RISK_SORT_COLUMNS)[number];
```

## Data Model Summary

### What Defines "At Risk" IP
A skill is "at risk" when ALL of these are true:
1. `status = 'published'` (only live skills matter)
2. `author_id IS NOT NULL` (attributed to someone)
3. `total_uses >= HIGH_USAGE_THRESHOLD` (10) -- high usage means high impact if lost
4. No published forks exist (`NOT EXISTS (SELECT 1 FROM skills WHERE forked_from_id = s.id AND status = 'published' AND tenant_id = ...)`) -- no backup knowledge holders

### Risk Severity Levels
| Level | Criteria | Color | Meaning |
|-------|----------|-------|---------|
| Critical | `total_uses >= 50` | Red (`bg-red-100 text-red-700`) | This skill is used heavily and would cause significant disruption if the sole author left |
| High | `total_uses >= 10` | Amber (`bg-amber-100 text-amber-700`) | This skill has meaningful usage and no backup author |
| (Medium) | `total_uses >= 1` | Yellow (optional) | Low-usage single-author skill -- included only if we want completeness |

**Recommendation:** Only show "critical" and "high" in alerts. Don't show medium -- it would flood the dashboard with noise. The thresholds can be adjusted later or made configurable per tenant.

### Existing Indexes Used
| Index | Supports |
|-------|----------|
| `skills_author_status_idx ON skills (author_id, status)` | Efficient GROUP BY author_id WHERE status = 'published' |
| `skills_tenant_id_idx ON skills (tenant_id)` | Tenant isolation filter |
| `skills_status_idx ON skills (status)` | Status filter |

### Missing Index (Not Blocking)
| Index | Would Support | Priority |
|-------|---------------|----------|
| `skills_forked_from_id_idx ON skills (forked_from_id) WHERE forked_from_id IS NOT NULL` | NOT EXISTS fork check | LOW -- only needed if performance degrades with large datasets |

## UI Layout Plan

### Where Risk Section Goes on IP Dashboard
The IP dashboard page currently has:
1. Time range selector (top right)
2. Hero stat cards grid (4 cards)
3. Quality trends chart

Phase 63 adds BETWEEN the stat cards and quality trends:
1. Time range selector (top right) -- unchanged
2. Hero stat cards grid (4 cards) -- unchanged
3. **NEW: Key Person Dependency Alerts** -- proactive alert cards with red/amber styling
4. **NEW: IP Concentration Risk Table** -- employee ranking with drill-down
5. Quality trends chart -- unchanged (pushed down)

The alerts section appears BEFORE the table because the success criteria says "Risk alerts surface proactively on the IP dashboard (not hidden behind a click)."

### Alert Cards Design
```
+-----------------------------------------------+
| ! Key Person Risk: "Email Parser" (Critical)   |
| Sole author: Alice Smith | 87 uses | 3.5 hrs/use|
| No forks exist. If Alice leaves, this IP is lost|
+-----------------------------------------------+
```

### Employee Risk Table Columns
| Column | Data | Sortable |
|--------|------|----------|
| Employee | Name + avatar (click to drill down) | Yes (alphabetical) |
| At-Risk Skills | Count of single-author high-usage skills | Yes |
| Total At-Risk Uses | Sum of total_uses for at-risk skills | Yes (default, desc) |
| Hours at Risk | Sum of (hours_saved * total_uses) for at-risk skills | Yes |
| Risk Level | Highest severity badge (critical/high) | Yes |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No risk analysis | Phase 63 adds risk analysis | Now | First risk feature in codebase |
| BarChart for horizontal bars | Same BarChart from time-bar-chart.tsx | Already in codebase | No new chart type needed |
| Employee table + modal | Same pattern from employees-tab.tsx | Already in codebase | Proven drill-down interaction |

**Deprecated/outdated:**
- None -- this is new functionality

## Open Questions

1. **Threshold values: should they be configurable per tenant?**
   - What we know: Phase 63 success criteria doesn't mention configurability. Hardcoded constants are simpler.
   - What's unclear: Whether admins will want to adjust thresholds.
   - Recommendation: Use named constants in `ip-dashboard-queries.ts` (easy to change). Defer per-tenant configuration to a future phase. Add tooltip text explaining the threshold: "Skills with 50+ uses are critical risk; 10+ uses are high risk."

2. **Should "medium" risk (total_uses >= 1, < 10) be shown?**
   - What we know: Success criteria mentions "amber/red severity indicators" (2 levels, not 3).
   - What's unclear: Whether completeness matters for low-usage skills.
   - Recommendation: Only show "critical" (red) and "high" (amber). Skills with < 10 uses are low impact even if single-author.

3. **What about skills with multiple version contributors?**
   - What we know: `skill_versions` table has `created_by` which can differ from `skills.author_id`. A skill could have one author but multiple version contributors.
   - What's unclear: Whether version contributors reduce key person risk.
   - Recommendation: For Phase 63, use only `skills.author_id` as the risk dimension. Multi-contributor analysis via `skill_versions.created_by` is a potential Phase 64+ enhancement. The success criteria specifically says "single author" which maps to `author_id`.

4. **Should the forked_from_id index migration be included in Phase 63?**
   - What we know: The `NOT EXISTS` subquery works without an index for small datasets. Adding an index is a small migration.
   - What's unclear: Whether current tenant sizes justify the index.
   - Recommendation: Skip the index for Phase 63. Add it only if performance testing shows slow queries. The existing `skills_tenant_id_idx` helps the subquery enough for current data volumes.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/db/src/schema/skills.ts` -- `author_id`, `total_uses`, `forked_from_id`, `hours_saved` columns verified
- Codebase analysis: `apps/web/lib/ip-dashboard-queries.ts` -- existing query pattern for IP dashboard
- Codebase analysis: `apps/web/components/employees-tab.tsx` -- sortable table + drill-down modal pattern
- Codebase analysis: `apps/web/components/employee-detail-modal.tsx` -- modal with server action data loading
- Codebase analysis: `apps/web/app/actions/get-employee-activity.ts` -- server action pattern for drill-down
- Codebase analysis: `apps/web/hooks/use-analytics-sort.ts` -- nuqs-based sort state management
- Codebase analysis: `apps/web/components/drift-indicator.tsx` -- amber badge styling pattern
- Codebase analysis: `apps/web/components/company-approved-badge.tsx` -- badge component pattern
- Codebase analysis: `apps/web/components/time-bar-chart.tsx` -- Recharts BarChart pattern
- Codebase analysis: `packages/db/src/migrations/0013_add_skill_status.sql` -- `skills_author_status_idx` index verified
- Codebase analysis: `packages/db/src/services/skill-forks.ts` -- fork detection patterns

### Secondary (MEDIUM confidence)
- Codebase analysis: risk threshold values (10, 50) are informed by typical SaaS usage patterns; actual thresholds may need tuning after seeing real data

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in existing IP dashboard
- Architecture: HIGH -- follows established employees-tab + detail-modal + server-action pattern exactly
- SQL queries: HIGH -- all referenced columns verified in schema, indexes checked, NOT EXISTS pattern is standard SQL
- Risk scoring logic: MEDIUM -- threshold values (10, 50) are reasonable defaults but may need tuning
- Pitfalls: HIGH -- identified from existing codebase patterns and known issues (hydration, tenant isolation)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no external dependency changes expected)
