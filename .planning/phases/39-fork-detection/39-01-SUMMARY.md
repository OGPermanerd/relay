---
phase: 39-fork-detection
plan: 01
subsystem: database, api
tags: [drizzle, sha256, content-hash, fork, drift-detection, skill-versions]

# Dependency graph
requires:
  - phase: 34-skill-lifecycle
    provides: "skills schema with forkedFromId, skill_versions table"
provides:
  - "forkedAtContentHash column on skills table for drift anchor"
  - "forkSkill action creates skill_versions record with publishedVersionId"
affects: [39-fork-detection remaining plans, drift detection UI]

# Tech tracking
tech-stack:
  added: []
  patterns: ["stripped-body hash for drift detection (no frontmatter)", "full-content hash for version integrity"]

key-files:
  created:
    - "packages/db/src/migrations/0017_add_forked_at_content_hash.sql"
  modified:
    - "packages/db/src/schema/skills.ts"
    - "apps/web/app/actions/fork-skill.ts"

key-decisions:
  - "forkedAtContentHash computed from stripped body (no frontmatter) -- distinct from version contentHash which uses full content"
  - "No backfill for existing forks -- hash at fork time is unavailable, shown as unknown drift status in UI"
  - "Version creation in fork action is non-fatal (try/catch) matching create.ts pattern"

patterns-established:
  - "Two hash types: body-only hash for drift detection, full-content hash for version integrity"
  - "Fork creates version record immediately to avoid orphaned forks"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 39 Plan 01: Fork Detection Foundation Summary

**forkedAtContentHash column with SHA-256 body hash anchor and skill_versions record creation on fork**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T21:22:44Z
- **Completed:** 2026-02-08T21:25:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added nullable `forked_at_content_hash` text column to skills table via migration 0017
- Updated `forkSkill` action to compute SHA-256 hash of stripped parent body (no frontmatter) as drift anchor
- Fork action now creates `skill_versions` record and sets `publishedVersionId` so forks are not orphaned

## Task Commits

Each task was committed atomically:

1. **Task 1: Add forkedAtContentHash column and migration** - `d9433bb` (feat)
2. **Task 2: Update forkSkill action to store hash and create version record** - `bd4ff96` (feat)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added `forkedAtContentHash` column after `forkedFromId`
- `packages/db/src/migrations/0017_add_forked_at_content_hash.sql` - ALTER TABLE to add nullable text column
- `apps/web/app/actions/fork-skill.ts` - Computes body hash, stores forkedAtContentHash, creates version record, sets publishedVersionId

## Decisions Made
- `forkedAtContentHash` is computed from stripped body content (frontmatter removed) for pure drift detection -- different from version `contentHash` which uses full content with frontmatter
- No backfill migration for existing forks -- the original parent content at fork time is not recoverable, so any computed hash would be inaccurate
- Version record creation wrapped in try/catch (non-fatal) matching the pattern established in `skills.ts` create action

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- DATABASE_URL not set in shell environment -- resolved by reading from `.env.local` and using inline connection string for psql

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `forkedAtContentHash` anchor available for drift comparison in subsequent plans
- Version records for forks enable version-aware diff and merge operations
- Existing forks have null hash -- UI should display "unknown drift status" for these

## Self-Check: PASSED

All files exist, all commits verified, all content patterns confirmed, DB column present.

---
*Phase: 39-fork-detection*
*Completed: 2026-02-08*
