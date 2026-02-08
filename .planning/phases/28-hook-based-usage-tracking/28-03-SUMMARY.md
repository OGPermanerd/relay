---
phase: 28-hook-based-usage-tracking
plan: 03
subsystem: database
tags: [drizzle, usage-events, tracking, fire-and-forget]

# Dependency graph
requires:
  - phase: 25-multi-tenancy
    provides: "tenantId on all tables, usage_events schema"
provides:
  - "insertTrackingEvent service for enriched usage event insertion"
affects: [28-04, 28-05, 28-06, 28-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget tracking insertion with skill name enrichment"

key-files:
  created:
    - packages/db/src/services/usage-tracking.ts
  modified:
    - packages/db/src/services/index.ts

key-decisions:
  - "Follow audit.ts fire-and-forget pattern for usage tracking"
  - "Resolve skill name at insertion time rather than at query time"

patterns-established:
  - "TrackingEventInput interface for hook-based usage events"
  - "Metadata enrichment: source, serverTimestamp, skillName injected on insert"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 28 Plan 03: Usage Tracking Service Summary

**Fire-and-forget insertTrackingEvent service that enriches hook callbacks with skill name resolution and server timestamps**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T03:00:03Z
- **Completed:** 2026-02-08T03:02:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created usage-tracking service with TrackingEventInput interface
- Skill name resolved from skillId and embedded in metadata at insert time
- Metadata enriched with source: "hook", serverTimestamp, clientTimestamp, hookEvent
- All errors caught and logged, never propagated (fire-and-forget pattern)
- Exported from services index for downstream consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Create usage-tracking service** - `f7661fd` (feat)

## Files Created/Modified
- `packages/db/src/services/usage-tracking.ts` - Usage tracking service with insertTrackingEvent function
- `packages/db/src/services/index.ts` - Added export for insertTrackingEvent and TrackingEventInput

## Decisions Made
- Followed the same fire-and-forget pattern established in `audit.ts` for consistency
- Skill name resolved at insertion time so metadata is self-contained for analytics queries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- insertTrackingEvent ready to be called by /api/track endpoint (plan 28-05)
- TrackingEventInput interface available for hook callback integration

---
*Phase: 28-hook-based-usage-tracking*
*Completed: 2026-02-08*

## Self-Check: PASSED
