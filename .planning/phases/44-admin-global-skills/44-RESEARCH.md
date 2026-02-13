# Phase 44: Admin Global Skills - Research

**Researched:** 2026-02-13
**Domain:** Admin approval workflow, badge display, homepage section
**Confidence:** HIGH

## Summary

This phase adds the ability for admins to stamp published skills as "Company Approved" with a distinctive badge, and surfaces those skills in a dedicated homepage section. The codebase already has a robust admin role system (`session.user.role === "admin"`), an established admin panel at `/admin/skills`, and existing badge patterns (QualityBadge). The implementation requires adding columns to the skills table, a new server action for toggling approval, badge rendering in multiple components, and a new homepage section.

The approach is straightforward: add `companyApproved`, `approvedAt`, and `approvedBy` columns directly to the `skills` table (no separate table needed -- this is a simple boolean flag with audit trail). The admin skills table already lists all skills and is the natural place to add an "Approve" toggle. The homepage already has a trending section that can be preceded by a "Company Recommended" section.

**Primary recommendation:** Add three columns to the skills table, create a toggle server action in the existing admin-skills actions file, add a distinctive badge component, and insert a "Company Recommended" section above the trending section on the homepage.

## Standard Stack

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.42.0 | Schema definition, queries | Already used throughout |
| next.js | 16.1.6 | Server components, server actions | Already the framework |
| tailwindcss | 4.x | Styling badges and sections | Already used throughout |

### Supporting (Already in Use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-auth (Auth.js v5) | 5.x | Session + role detection | Admin check via `isAdmin()` |

No new libraries needed. Everything required is already in the project.

## Architecture Patterns

### Admin Detection Pattern (ESTABLISHED)
**What:** `isAdmin(session)` from `apps/web/lib/admin.ts` checks `session?.user?.role === "admin"`
**Where used:**
- `apps/web/app/(protected)/layout.tsx` -- shows Admin nav link
- `apps/web/app/(protected)/admin/layout.tsx` -- guards admin routes (redirects non-admins)
- `apps/web/app/(protected)/admin/skills/page.tsx` -- double-checks before rendering
- `apps/web/app/actions/admin-skills.ts` -- guards server actions
- `apps/web/app/(protected)/skills/[slug]/page.tsx` -- allows admins to see unpublished/personal skills

### Server Action Pattern for Admin Actions (ESTABLISHED)
```typescript
// From apps/web/app/actions/admin-skills.ts
"use server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

export async function someAdminAction(prevState: StateType, formData: FormData): Promise<StateType> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }
  // ... action logic ...
  revalidatePath("/admin/skills");
  return { success: true };
}
```

### Badge Pattern (ESTABLISHED)
The `QualityBadge` component renders tier-based badges as colored pill spans:
```typescript
// apps/web/components/quality-badge.tsx
<span
  className={`inline-block rounded-full font-medium ${sizeClasses}`}
  style={{ backgroundColor: style.backgroundColor, color: style.color }}
>
  {tierInfo.label}
</span>
```
Sizes: `sm` (text-xs px-2 py-0.5) and `md` (text-sm px-3 py-1).

### Homepage Section Pattern (ESTABLISHED)
The homepage at `apps/web/app/(protected)/page.tsx` fetches data in parallel via `Promise.all`, then renders sections:
1. CTA cards (Create/Get Leverage)
2. Platform Stats (4 StatCards)
3. Trending Skills + Leaderboard (2/3 + 1/3 grid)
4. Your Impact section

The TrendingSection component renders a grid of skill cards with sparkline underlay.

## Schema Changes

### Recommendation: Add columns to existing `skills` table

Three new columns on `packages/db/src/schema/skills.ts`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `company_approved` | `boolean` | `false` | Whether admin has stamped this skill |
| `approved_at` | `timestamp` | `null` | When it was approved (audit trail) |
| `approved_by` | `text` (FK to users.id) | `null` | Which admin approved it (audit trail) |

**Why not a separate table:** This is a simple boolean flag, not a many-to-many or complex relationship. Adding columns keeps queries simple (no JOINs needed to check approval status). The audit trail (who/when) is captured via `approved_at` and `approved_by`.

**Migration file:** `packages/db/src/migrations/0022_add_company_approved.sql`

```sql
ALTER TABLE skills ADD COLUMN company_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE skills ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE skills ADD COLUMN approved_by TEXT REFERENCES users(id);
CREATE INDEX skills_company_approved_idx ON skills (company_approved) WHERE company_approved = true;
```

The partial index (`WHERE company_approved = true`) is efficient since only a small fraction of skills will be approved.

## Files to Modify

### Schema Layer (packages/db)
| File | Change |
|------|--------|
| `packages/db/src/schema/skills.ts` | Add `companyApproved`, `approvedAt`, `approvedBy` columns |
| `packages/db/src/migrations/0022_add_company_approved.sql` | New migration file |
| `packages/db/src/relations/index.ts` | Add `approvedByUser` relation to skillsRelations |

### Server Actions
| File | Change |
|------|--------|
| `apps/web/app/actions/admin-skills.ts` | Add `toggleCompanyApproval` server action; extend `AdminSkill` type with `companyApproved`; extend `getAdminSkills` to include new field |

### Admin Panel
| File | Change |
|------|--------|
| `apps/web/components/admin-skills-table.tsx` | Add "Approved" column with toggle button per row |

### Homepage
| File | Change |
|------|--------|
| `apps/web/app/(protected)/page.tsx` | Fetch company-approved skills; render CompanyRecommended section above trending |
| New: `apps/web/lib/company-approved.ts` | Query function to get company-approved skills |
| New: `apps/web/components/company-approved-section.tsx` | Section component for homepage |

### Badge Display
| File | Change |
|------|--------|
| New: `apps/web/components/company-approved-badge.tsx` | Distinctive "Company Approved" badge component |
| `apps/web/components/skill-detail.tsx` | Show CompanyApprovedBadge next to skill name (alongside QualityBadge) |
| `apps/web/components/skills-table-row.tsx` | Show small badge indicator next to skill name in browse table |
| `apps/web/components/trending-section.tsx` | Show small badge indicator next to skill name |

### Data Flow for Badge
| File | Change |
|------|--------|
| `apps/web/app/(protected)/skills/[slug]/page.tsx` | Pass `companyApproved` to SkillDetail; skill already fetched with all columns |
| `apps/web/lib/search-skills.ts` | Add `companyApproved` to select fields in searchSkills |
| `apps/web/lib/trending.ts` | Add `company_approved` to getTrendingSkills SQL |
| `apps/web/components/skills-table.tsx` | Add `companyApproved` to `SkillTableRow` interface |

## Badge Design Approach

### Company Approved Badge
**Distinct from QualityBadge** to avoid confusion:
- **Color:** Deep purple/indigo gradient (not gold/silver/bronze which are quality tiers)
- **Icon:** Shield or checkmark icon (official/endorsed feel)
- **Label:** "Company Approved" (md size) or shield icon only (sm size)
- **Style:** `bg-indigo-100 text-indigo-800 border border-indigo-200` with a small shield SVG icon

```typescript
// CompanyApprovedBadge component
interface Props {
  size?: "sm" | "md";
}

export function CompanyApprovedBadge({ size = "sm" }: Props) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-medium ${sizeClasses}`}>
      <ShieldCheckIcon />
      {size === "md" && "Company Approved"}
    </span>
  );
}
```

The shield icon (Heroicon `shield-check`) is a natural choice for "company endorsed." SVG inline, no library needed.

## Homepage "Company Recommended" Section Placement

### Position: Above Trending Skills, below Platform Stats

Current layout:
1. Welcome + Search
2. CTA cards
3. **Platform Stats** (4 cards)
4. **Trending + Leaderboard** (grid)
5. Your Impact

Proposed layout:
1. Welcome + Search
2. CTA cards
3. Platform Stats (4 cards)
4. **Company Recommended** (new -- full width, 1-2 rows of cards) <-- INSERT HERE
5. Trending + Leaderboard (grid)
6. Your Impact

**Why this position:** Company-endorsed skills are more important than algorithmically-trending skills, so they come first. They are distinct from stats (which are aggregate metrics), so they come after stats.

### Section Design
- Header: "Company Recommended" with shield icon
- Grid: Same card style as TrendingSection (2-column grid)
- Limit: Show up to 6 approved skills, sorted by `approved_at DESC` (most recently approved first)
- Empty state: If no skills are approved, don't render the section at all (no empty message)

### Query Function (`apps/web/lib/company-approved.ts`)
```typescript
export async function getCompanyApprovedSkills(limit = 6) {
  // Query skills where company_approved = true
  // Join with users for author info
  // Order by approved_at DESC
  // Limit to N
}
```

## Admin Toggle UI in Admin Skills Table

### Approach: Add column + toggle button to existing AdminSkillsTable

The `admin-skills-table.tsx` already has a table with columns: checkbox, Name, Author, Uses, Created, Actions.

Add a new column "Status" between "Uses" and "Created" with:
- A toggle button showing current state (approved/not approved)
- Clicking calls the `toggleCompanyApproval` server action
- Visual indicator: green checkmark when approved, gray dash when not

The toggle uses `useActionState` following the same pattern as `deleteSkillAdminAction`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin auth check | Custom middleware | `isAdmin(session)` from `@/lib/admin` | Already established pattern |
| Badge component | Complex badge library | Simple Tailwind span + inline SVG | Matches QualityBadge pattern |
| Form state management | Custom state machine | `useActionState` hook | Already used in AdminSkillsTable |

## Common Pitfalls

### Pitfall 1: Forgetting to update all data flows
**What goes wrong:** Adding `companyApproved` to the schema but forgetting to include it in search results, trending queries, or skill detail fetches.
**Why it happens:** The `companyApproved` flag needs to be available everywhere skills are displayed.
**How to avoid:** Trace every component that renders skills and ensure the field is passed through.
**Files that need the field:** `search-skills.ts`, `trending.ts`, `company-approved.ts` (new), skill detail page (already gets all columns via `db.query.skills.findFirst`).

### Pitfall 2: Hydration mismatch with dates
**What goes wrong:** Passing `approvedAt` as a Date object to client components causes hydration errors.
**Why it happens:** Node.js and browser Intl formatting differ (documented in MEMORY.md).
**How to avoid:** Always serialize dates with `.toISOString()` before passing to client components.

### Pitfall 3: Not revalidating the homepage after approval toggle
**What goes wrong:** Admin approves a skill but homepage still shows old data.
**How to avoid:** `revalidatePath("/")` in addition to `revalidatePath("/admin/skills")` in the toggle action.

### Pitfall 4: RLS policy already on skills table
**What goes wrong:** The skills table has RLS with tenant isolation. The new columns are just regular columns -- they don't need separate RLS rules.
**How to avoid:** The migration only adds columns, no new tables or policies needed. The existing `tenant_isolation` policy on skills already covers new columns.

## Plan Structure Recommendation

This phase can be split into 3 lean plans:

### Plan 01: Schema + Migration + Server Action
- Add columns to schema
- Write migration SQL
- Add `toggleCompanyApproval` server action
- Update `getAdminSkills` to include `companyApproved`
- Update `AdminSkillsTable` with approval toggle column
- **Test:** Toggle approval from admin panel

### Plan 02: Badge Component + Display Everywhere
- Create `CompanyApprovedBadge` component
- Add badge to `SkillDetail` (detail page header)
- Add badge to `SkillsTableRow` (browse table)
- Add badge to `TrendingSection` (homepage trending cards)
- Update data types/interfaces to include `companyApproved`
- Update `searchSkills` and `getTrendingSkills` to include the field
- **Test:** Badge visible on detail page and browse page

### Plan 03: Homepage "Company Recommended" Section
- Create `getCompanyApprovedSkills` query
- Create `CompanyApprovedSection` component
- Add section to homepage between stats and trending
- **Test:** Section appears when skills are approved; hidden when none approved

Plans 01 and 02 must be sequential (02 depends on schema from 01). Plan 03 depends on both 01 (schema) and 02 (badge component).

## Sources

### Primary (HIGH confidence)
- `packages/db/src/schema/skills.ts` -- current skills table schema, 89 lines
- `apps/web/lib/admin.ts` -- isAdmin helper, 13 lines
- `apps/web/app/actions/admin-skills.ts` -- admin action pattern, 127 lines
- `apps/web/components/quality-badge.tsx` -- badge pattern, 62 lines
- `apps/web/components/admin-skills-table.tsx` -- admin table pattern, 252 lines
- `apps/web/app/(protected)/page.tsx` -- homepage layout, 255 lines
- `apps/web/components/trending-section.tsx` -- trending card pattern, 84 lines
- `apps/web/components/skill-detail.tsx` -- detail page header, 191 lines
- `apps/web/app/(protected)/skills/[slug]/page.tsx` -- detail page data flow, 290 lines
- `apps/web/lib/search-skills.ts` -- browse query, 219 lines
- `apps/web/lib/trending.ts` -- trending query, 87 lines
- `apps/web/components/skills-table-row.tsx` -- browse table row, 205 lines
- `apps/web/components/skills-table.tsx` -- browse table, 241 lines
- `apps/web/app/(protected)/admin/layout.tsx` -- admin layout/guard, 47 lines
- `packages/db/src/relations/index.ts` -- Drizzle relations, 279 lines

## Metadata

**Confidence breakdown:**
- Schema changes: HIGH -- simple column additions, well-established pattern in codebase (20+ migrations)
- Admin detection: HIGH -- `isAdmin()` pattern is used in 8+ files, thoroughly established
- Badge design: HIGH -- follows QualityBadge pattern exactly
- Homepage section: HIGH -- follows TrendingSection pattern, clear insertion point
- Data flow: HIGH -- all query files identified, interfaces well-typed

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable codebase, no external dependencies)
