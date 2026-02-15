---
phase: 62-company-ip-dashboard-core
plan: 01
subsystem: api
tags: [sql, analytics, drizzle, ip-dashboard, tenant-scoped]

# Dependency graph
requires:
  - phase: 56-benchmark-engine
    provides: benchmark_runs and benchmark_results tables for quality trend queries
  - phase: 25-multi-tenancy
    provides: tenant_id filtering pattern on all tables
provides:
  - getIpDashboardStats() - hero KPI stats (skills, uses, hours saved, contributors)
  - getQualityTrends() - monthly quality trend data (ratings, sentiment, benchmarks)
  - IpDashboardStats and QualityTrendPoint TypeScript interfaces
  - IP Dashboard nav tab in leverage navigation
affects: [62-02-ip-dashboard-page, 63-ip-dashboard-drilldowns]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-query-merge for multi-series trend data, all-time KPI aggregation]

key-files:
  created:
    - apps/web/lib/ip-dashboard-queries.ts
  modified:
    - apps/web/app/(protected)/leverage/leverage-nav.tsx

key-decisions:
  - "Three separate queries merged by month (not complex multi-table JOIN) for quality trends"
  - "Hours saved = SUM(hours_saved * total_uses) from skills table (denormalized aggregates)"
  - "Rating normalized 1-5 to 0-100 by multiplying by 20"

patterns-established:
  - "IP dashboard queries: tenant-scoped SQL aggregation with db.execute(sql`...`) pattern"
  - "Quality trend merge: Map-based month merge for multi-series chart data"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 62 Plan 01: IP Dashboard Data Layer & Nav Summary

**SQL aggregation queries for IP dashboard hero stats (skills, uses, hours, contributors) and monthly quality trends (ratings, sentiment, benchmarks) with admin-only nav tab**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T20:19:24Z
- **Completed:** 2026-02-15T20:21:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created IP dashboard query module with `getIpDashboardStats()` for all-time KPI hero cards
- Created `getQualityTrends()` returning three monthly series normalized to 0-100 scale
- Added admin-only IP Dashboard tab to leverage navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IP dashboard query module** - `1bfa3a3` (feat)
2. **Task 2: Add IP Dashboard tab to leverage nav** - `d843f88` (feat)

## Files Created/Modified
- `apps/web/lib/ip-dashboard-queries.ts` - SQL aggregation queries for hero stats and quality trends
- `apps/web/app/(protected)/leverage/leverage-nav.tsx` - Added IP Dashboard tab (adminOnly: true)

## Decisions Made
- Used three separate SQL queries for quality trends (ratings, sentiment, benchmarks) merged by month rather than a complex multi-table JOIN -- simpler, more maintainable, and each series has different source tables
- Hero stats are all-time cumulative (no date filter) -- these are KPI totals, not period-bounded
- Hours saved calculated as SUM(hours_saved * total_uses) using denormalized skill aggregates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Query module ready for consumption by IP dashboard page component (plan 02)
- Nav tab links to `/leverage/ip-dashboard` which will be created in plan 02
- All functions are tenant-scoped and follow established patterns from analytics-queries.ts

---
*Phase: 62-company-ip-dashboard-core*
*Completed: 2026-02-15*
