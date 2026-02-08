---
phase: 29-tenant-scoped-analytics-mcp
plan: 03
subsystem: ui
tags: [fte-calculation, constants, metrics, display]

# Dependency graph
requires:
  - phase: 29-tenant-scoped-analytics-mcp
    provides: "RESEARCH.md identifying 11 FTE display locations with incorrect / 8 / 365 and / 365 patterns"
provides:
  - "Centralized FTE_HOURS_PER_YEAR (2080) and FTE_DAYS_PER_YEAR (260) constants"
  - "Consistent FTE Years Saved calculation across all 11 platform display locations"
affects: [analytics, dashboard, profile, leaderboard, skill-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [centralized-constants-for-business-metrics]

key-files:
  created:
    - apps/web/lib/constants.ts
  modified:
    - apps/web/components/skill-card.tsx
    - apps/web/components/skills-table-row.tsx
    - apps/web/components/my-leverage-view.tsx
    - apps/web/components/header-stats.tsx
    - apps/web/components/skill-detail.tsx
    - apps/web/components/leaderboard-table.tsx
    - apps/web/app/(protected)/page.tsx
    - apps/web/app/(protected)/users/[id]/page.tsx
    - apps/web/app/(protected)/profile/page.tsx

key-decisions:
  - "FTE_HOURS_PER_YEAR = 2080 (40 hrs/wk * 52 wks) as USA FTE standard"
  - "FTE_DAYS_PER_YEAR = 260 (2080 / 8) for pre-computed FTE days to years conversion"

patterns-established:
  - "Import FTE constants from @/lib/constants for all time-saved calculations"
  - "Pattern A: hours to years via / FTE_HOURS_PER_YEAR"
  - "Pattern B: FTE days to years via / FTE_DAYS_PER_YEAR"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 29 Plan 03: Standardize FTE Years Saved Summary

**Centralized FTE constants (2,080 hrs/yr, 260 days/yr) replacing incorrect / 8 / 365 and / 365 patterns across all 11 display locations**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T03:36:25Z
- **Completed:** 2026-02-08T03:38:34Z
- **Tasks:** 1
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments
- Created centralized FTE constants file with documented USA FTE standard (2,080 hours/year)
- Updated 5 Pattern A locations (hours to years) from `/ 8 / 365` to `/ FTE_HOURS_PER_YEAR`
- Updated 6 Pattern B locations (FTE days to years) from `/ 365` to `/ FTE_DAYS_PER_YEAR`
- All FTE Years Saved values now correctly based on 2,080 hrs/yr instead of 2,920 hrs/yr

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FTE constant and update all 11 display locations** - `7d72b8c` (feat)

## Files Created/Modified
- `apps/web/lib/constants.ts` - New file with FTE_HOURS_PER_YEAR (2080) and FTE_DAYS_PER_YEAR (260)
- `apps/web/components/skill-card.tsx` - Pattern A: hours to years via FTE_HOURS_PER_YEAR
- `apps/web/components/skills-table-row.tsx` - Pattern A: hours to years via FTE_HOURS_PER_YEAR
- `apps/web/components/my-leverage-view.tsx` - Pattern A: two locations (skills used + skills created)
- `apps/web/components/header-stats.tsx` - Pattern B: FTE days to years via FTE_DAYS_PER_YEAR
- `apps/web/components/skill-detail.tsx` - Pattern B: FTE days to years via FTE_DAYS_PER_YEAR
- `apps/web/components/leaderboard-table.tsx` - Pattern B: FTE days to years via FTE_DAYS_PER_YEAR
- `apps/web/app/(protected)/page.tsx` - Pattern B: platform stats FTE days to years
- `apps/web/app/(protected)/users/[id]/page.tsx` - Both patterns: stats (B) + skill list (A)
- `apps/web/app/(protected)/profile/page.tsx` - Pattern B: profile stats FTE days to years

## Decisions Made
- Used 2,080 hours/year (40 hrs/wk * 52 wks) as the USA FTE standard, correcting from the implicit 2,920 hrs/yr (8 * 365)
- Derived FTE_DAYS_PER_YEAR = 260 (2,080 / 8) for locations where hours are already converted to FTE days

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FTE calculation is now consistent across the entire platform
- Any future FTE display locations should import from `@/lib/constants`
- Ready for subsequent Phase 29 plans

## Self-Check: PASSED

All 10 files verified present. Commit 7d72b8c verified in git log.

---
*Phase: 29-tenant-scoped-analytics-mcp*
*Completed: 2026-02-08*
