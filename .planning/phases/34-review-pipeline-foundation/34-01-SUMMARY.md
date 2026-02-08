---
phase: 34-review-pipeline-foundation
plan: 01
subsystem: database
tags: [drizzle, postgres, state-machine, review-pipeline, migration]

# Dependency graph
requires:
  - phase: 25-multi-tenancy
    provides: skills table with tenant_id column
provides:
  - status column on skills table (TEXT NOT NULL DEFAULT 'published')
  - skill-status state machine service (canTransition, getValidTransitions, SKILL_STATUSES)
  - migration 0013 with status column and indexes
affects: [34-02, 34-03, 34-04, 34-05, 35-review-mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [state-machine-service, status-column-with-default]

key-files:
  created:
    - packages/db/src/services/skill-status.ts
    - packages/db/src/migrations/0013_add_skill_status.sql
  modified:
    - packages/db/src/schema/skills.ts
    - packages/db/src/services/index.ts

key-decisions:
  - "DEFAULT 'published' for backward compat -- existing skills remain visible without data migration"
  - "7-status state machine: draft->pending_review->ai_reviewed->approved/rejected/changes_requested->published"
  - "Composite index on (author_id, status) for My Skills page filtering"

patterns-established:
  - "State machine as pure function service: canTransition(from, to) returns boolean, no DB dependency"
  - "Status column with DEFAULT for safe migration of existing rows"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 34 Plan 01: Skill Status Schema and State Machine Summary

**Status column on skills table with 7-state review pipeline state machine and DB migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T17:05:00Z
- **Completed:** 2026-02-08T17:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `status TEXT NOT NULL DEFAULT 'published'` column to skills table
- Created pure-function state machine service with 7 statuses and valid transition rules
- Applied migration 0013 with status column and two indexes (status, author_id+status)
- All existing skills retain status='published' after migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status column to schema + create state machine service** - `d047dfc` (feat)
2. **Task 2: Write and run migration** - `aa3d7d1` (feat)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added status column to skills table definition
- `packages/db/src/services/skill-status.ts` - State machine with SKILL_STATUSES, canTransition, getValidTransitions
- `packages/db/src/services/index.ts` - Re-exports skill-status service
- `packages/db/src/migrations/0013_add_skill_status.sql` - ALTER TABLE + indexes

## Decisions Made
- Used `DEFAULT 'published'` so existing skills remain visible without a backfill step
- State machine is a pure function service (no DB dependency) for easy testing and reuse
- Added composite `(author_id, status)` index anticipating My Skills page filtering needs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Shell `$DATABASE_URL` pointed to wrong database; sourced from `apps/web/.env.local` to get correct connection string. Not a code issue, just an environment configuration detail.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Status column and state machine are ready for all downstream plans (34-02 through 34-05)
- Plans 34-02 (submit action) and 34-03 (AI review) can proceed immediately
- No blockers or concerns

## Self-Check: PASSED

All files verified present. Both commits (d047dfc, aa3d7d1) confirmed in git log.

---
*Phase: 34-review-pipeline-foundation*
*Completed: 2026-02-08*
