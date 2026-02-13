---
phase: 40-visibility-scoping
plan: 01
subsystem: database
tags: [drizzle, postgres, visibility, schema, migration, sql-helpers]

# Dependency graph
requires: []
provides:
  - "visibility column on skills table (TEXT NOT NULL DEFAULT 'tenant')"
  - "buildVisibilityFilter helper for Drizzle query builder"
  - "visibilitySQL helper for raw SQL templates"
  - "skills_visibility_idx and skills_visibility_author_idx indexes"
affects: [40-02, 40-03, 40-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["visibility filter helpers for authenticated/anonymous access"]

key-files:
  created:
    - packages/db/src/lib/visibility.ts
    - packages/db/src/migrations/0019_add_skill_visibility.sql
  modified:
    - packages/db/src/schema/skills.ts

key-decisions:
  - "Applied migration via psql directly (drizzle-kit migrate replays all migrations and fails on existing tables)"
  - "visibility column uses TEXT type with 'tenant' default to match existing pattern from status column"
  - "Two-function approach: buildVisibilityFilter for query builder, visibilitySQL for raw SQL templates"

patterns-established:
  - "Visibility filtering: always use buildVisibilityFilter(userId) or visibilitySQL(userId) rather than inline visibility checks"
  - "Helper location: packages/db/src/lib/ for reusable database utilities importable via @everyskill/db/lib/*"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 40 Plan 01: Visibility Schema & Helpers Summary

**Skills visibility column with tenant/personal scoping and reusable Drizzle/SQL filter helpers**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T20:29:21Z
- **Completed:** 2026-02-13T20:31:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `visibility` TEXT NOT NULL DEFAULT 'tenant' column to skills table with two indexes
- All existing skills automatically set to 'tenant' visibility (zero behavior change)
- Created `buildVisibilityFilter(userId?)` for Drizzle query builder paths
- Created `visibilitySQL(userId?)` for raw SQL template paths
- Both helpers handle anonymous (tenant-only) and authenticated (tenant + own personal) access patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Add visibility column to skills schema and create migration** - `fd8edaa` (feat)
2. **Task 2: Create visibility filter helper functions** - `3aed26a` (feat)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added visibility column definition after statusMessage
- `packages/db/src/migrations/0019_add_skill_visibility.sql` - Migration with column and two indexes
- `packages/db/src/lib/visibility.ts` - Reusable visibility filter helpers (buildVisibilityFilter, visibilitySQL)

## Decisions Made
- Applied migration via psql directly rather than drizzle-kit migrate (drizzle migrations table is empty, causing it to replay all migrations from scratch)
- Used non-null assertion on `or()` return since we always pass 2 arguments (Drizzle types return `SQL | undefined`)
- Placed helpers in `packages/db/src/lib/` establishing a new directory for reusable DB utilities

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `drizzle-kit migrate` fails because the migrations tracking table is empty (all prior migrations were applied via `db:push` or direct psql). Applied migration directly via psql, which succeeded immediately. This is consistent with how all previous migrations (0001-0018) were applied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Visibility column and helpers are ready for Plans 02-04 to integrate
- Plan 02 can use `buildVisibilityFilter` in service layer queries
- Plan 03 can use `visibilitySQL` in raw SQL search queries
- Plan 04 can read/write the visibility column for UI controls

---
*Phase: 40-visibility-scoping*
*Completed: 2026-02-13*
