---
phase: 65-individual-skills-portfolio
plan: 01
subsystem: database, api
tags: [sql, drizzle, postgresql, window-functions, cte, portfolio]

requires:
  - phase: 64-ip-valuation-export
    provides: "Company IP dashboard track complete; skills schema with visibility, total_uses, hours_saved, average_rating"
provides:
  - "getPortfolioStats() - aggregate portfolio stats with personal/tenant visibility breakdown"
  - "getPortfolioSkills() - published skills list ordered by total impact"
  - "getContributionRanking() - tenant-scoped RANK()/PERCENT_RANK() ranking"
  - "Portfolio NavLink in header navigation"
affects: [65-02-portfolio-page, 65-03-portfolio-export]

tech-stack:
  added: []
  patterns:
    - "FILTER (WHERE) conditional aggregation for per-visibility breakdown in single query"
    - "PERCENT_RANK() with inverted percentile for 'top N%' labels"
    - "Ordinal formatting utility (1st, 2nd, 3rd) for small-team rank labels"

key-files:
  created:
    - apps/web/lib/portfolio-queries.ts
  modified:
    - apps/web/app/(protected)/layout.tsx

key-decisions:
  - "Used FILTER (WHERE) conditional aggregation instead of separate queries for visibility breakdown"
  - "Contribution ranking uses only tenant-visible skills (visibility='tenant'), matching leaderboard behavior"
  - "Label logic: percentile-based for teams >20, absolute ordinal rank for teams <=20"
  - "PERCENT_RANK inverted to 'top percentage' (0 = best, 100 = worst) for intuitive label thresholds"

patterns-established:
  - "Portfolio query pattern: single-pass aggregation with FILTER for dimension breakdowns"
  - "Ordinal formatting: formatOrdinal() helper for rank display in small teams"

duration: 2min
completed: 2026-02-16
---

# Phase 65 Plan 01: Portfolio Data Layer Summary

**Three SQL query functions (stats, skills list, contribution ranking) with conditional aggregation and CTE-based tenant-scoped ranking, plus Portfolio NavLink in header**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T03:57:35Z
- **Completed:** 2026-02-16T03:59:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `getPortfolioStats()` with single-pass FILTER (WHERE) aggregation for overall + per-visibility breakdown
- Created `getPortfolioSkills()` returning published skills ordered by total impact with ISO date serialization
- Created `getContributionRanking()` using CTE with RANK()/PERCENT_RANK() window functions, tenant-scoped
- Added "Portfolio" NavLink to header between Leverage and Profile

## Task Commits

Each task was committed atomically:

1. **Task 1: Create portfolio-queries.ts with three query functions** - `43d7e5f` (feat)
2. **Task 2: Add Portfolio NavLink to header navigation** - `d62950b` (feat)

## Files Created/Modified
- `apps/web/lib/portfolio-queries.ts` - Three query functions (getPortfolioStats, getPortfolioSkills, getContributionRanking) with 3 exported interfaces
- `apps/web/app/(protected)/layout.tsx` - Added Portfolio NavLink between Leverage and Profile

## Decisions Made
- Used PostgreSQL `FILTER (WHERE)` clause for conditional aggregation instead of separate queries -- single pass is more efficient
- Contribution ranking only counts `visibility = 'tenant'` skills, matching leaderboard behavior (personal skills are private)
- Label logic splits at team size 20: percentile-based ("Top 5%") for large teams, ordinal ("1st of 12") for small teams
- PERCENT_RANK returns 0 for rank 1 and 1 for last; inverted to "top percentage" for intuitive threshold comparison
- Edge case: user with no published skills gets separate COUNT query for totalContributors context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three query functions ready for consumption by portfolio page component (Plan 02)
- Portfolio NavLink active in header -- route will 404 until Plan 02 creates the page
- Interfaces exported for direct import by portfolio-view component

## Self-Check: PASSED

- [x] apps/web/lib/portfolio-queries.ts exists (3 functions, 3 interfaces)
- [x] apps/web/app/(protected)/layout.tsx modified (Portfolio NavLink)
- [x] Commit 43d7e5f found (Task 1)
- [x] Commit d62950b found (Task 2)
- [x] TypeScript compilation clean

---
*Phase: 65-individual-skills-portfolio*
*Completed: 2026-02-16*
