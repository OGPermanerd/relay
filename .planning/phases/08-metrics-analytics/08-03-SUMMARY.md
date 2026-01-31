---
phase: 08-metrics-analytics
plan: 03
subsystem: api
tags: [sql, trending, time-decay, analytics, postgresql]

# Dependency graph
requires:
  - phase: 04-data-model-storage
    provides: skills and usageEvents tables
provides:
  - Trending skills algorithm with Hacker News time-decay formula
  - getTrendingSkills function for surfacing recently popular skills
affects: [08-05, discovery, homepage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Raw SQL CTE queries with db.execute(sql`...`)
    - Hacker News time-decay formula for trending scores
    - Type-safe result mapping from raw SQL

key-files:
  created:
    - apps/web/lib/trending.ts
  modified: []

key-decisions:
  - "Use Hacker News time-decay formula: (recent_uses - 1) / (age_hours + 2)^1.8"
  - "7-day lookback window for recent usage calculation"
  - "Minimum 3 uses threshold to qualify for trending"
  - "Type-safe mapping from raw SQL results using explicit conversions"

patterns-established:
  - "Time-decay trending algorithm for content freshness ranking"
  - "Raw SQL with explicit type mapping for complex aggregations"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 8 Plan 3: Trending Skills Algorithm Summary

**Hacker News-style time-decay trending algorithm using CTE-based SQL query with 7-day window and minimum 3-use threshold**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T19:51:10Z
- **Completed:** 2026-01-31T19:53:13Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created trending skills service with time-decay formula
- Implemented Hacker News-style algorithm: `(recent_uses - 1) / (age_hours + 2)^1.8`
- Used raw SQL CTE for efficient aggregation of recent usage
- Added proper filtering: 7-day window, 3+ uses minimum, published skills only

## Task Commits

Each task was committed atomically:

1. **Task 1: Create trending skills service** - `df4b8b7` (feat)

## Files Created/Modified

- `apps/web/lib/trending.ts` - Trending skills service with time-decay algorithm

## Decisions Made

1. **Time-decay formula parameters** - Used standard Hacker News values:
   - Subtract 1 from recent uses to avoid initial spike bias
   - Add 2 to age hours to prevent division by zero
   - Gravity factor 1.8 for moderate decay rate

2. **Type-safe result mapping** - Used explicit type casting with `String()` and `Number()` conversions rather than direct type assertion to handle raw SQL result types properly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Trending algorithm ready for use in discovery UI and homepage
- Can be integrated with sparkline visualization for trending skills display
- Ready for Plan 04 (Contributor Leaderboard) and Plan 05 (User Profile Statistics)

---
*Phase: 08-metrics-analytics*
*Completed: 2026-01-31*
