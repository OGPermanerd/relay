---
phase: 23-analytics-dashboard
plan: 01
subsystem: api
tags: [sql, analytics, drizzle-orm, time-series]

# Dependency graph
requires:
  - phase: 21-employee-usage-tracking
    provides: usage_events table with user_id, skill_id, tool_name columns
provides:
  - 7 analytics query functions for org-wide dashboard
  - TimeRange type and helper functions for time filtering
  - Employee drill-down and skill trend queries
affects: [23-02, 23-03, 23-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - COALESCE fallback chain for hours (rating estimate -> creator estimate -> 1)
    - date_trunc for time-series aggregation
    - fillMissingDates for gap-filling in charts

key-files:
  created:
    - apps/web/lib/analytics-queries.ts
  modified: []

key-decisions:
  - "Org filtering via email domain matching (LIKE '%@domain')"
  - "Two separate queries for getSkillUsage to avoid N+1 on breakdown"
  - "TimeRange type includes 7d, 30d, 90d, 1y options"

patterns-established:
  - "Pattern: Analytics queries accept orgId + startDate for filtering"
  - "Pattern: Return types use .toISOString() for Date serialization"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 23 Plan 01: Analytics Queries Summary

**SQL analytics query functions with 7 queries (overview, trend, employees, skills, export, drill-downs) plus TimeRange helpers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T04:28:23Z
- **Completed:** 2026-02-06T04:30:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created 7 analytics query functions for org-wide dashboard
- Added TimeRange type and getGranularity/getStartDate helpers
- Implemented COALESCE fallback chain for hours saved calculations
- Added fillMissingDates helper for time-series gap filling
- All functions use proper Date serialization with .toISOString()

## Task Commits

Each task was committed atomically:

1. **Task 1: Create analytics-queries.ts with all query functions** - `458ed05` (feat)
2. **Task 2: Add granularity auto-selection helper** - included in Task 1 commit

**Plan metadata:** see below

## Files Created/Modified
- `apps/web/lib/analytics-queries.ts` - All 7 analytics query functions plus helpers

## Decisions Made
- Used email domain matching (`LIKE '%@domain'`) for org filtering since there's no explicit org_id column
- Split getSkillUsage into two queries (main stats + breakdown) to avoid N+1 complexity
- Included both queries and helpers in single task commit since they're tightly coupled

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analytics queries ready for use by dashboard pages
- Next plans can import query functions and build UI components
- getEmployeeActivity and getSkillTrend ready for drill-down modals

---
*Phase: 23-analytics-dashboard*
*Completed: 2026-02-06*
