---
phase: 25-multi-tenancy-schema-audit
plan: 03
subsystem: database
tags: [drizzle, multi-tenancy, schema, postgres, foreign-key, composite-index]

# Dependency graph
requires:
  - phase: 25-01
    provides: tenants table schema for FK references
provides:
  - tenantId column on skills, users, ratings, usage-events, skill-versions
  - Composite unique index (tenantId, slug) on skills
  - Schema barrel exports for tenants and audit-logs
  - Seed data updated with default tenant
affects: [25-04, 25-05, 25-06, 25-07, 25-08, 25-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tenantId FK pattern: text('tenant_id').notNull().references(() => tenants.id)"
    - "Composite unique for tenant-scoped slugs: uniqueIndex on (tenantId, slug)"
    - "Per-table tenant_id index for query performance"

key-files:
  created: []
  modified:
    - packages/db/src/schema/skills.ts
    - packages/db/src/schema/users.ts
    - packages/db/src/schema/ratings.ts
    - packages/db/src/schema/usage-events.ts
    - packages/db/src/schema/skill-versions.ts
    - packages/db/src/schema/index.ts
    - packages/db/src/seed.ts

key-decisions:
  - "Skills slug unique replaced with composite (tenantId, slug) to allow same slug across tenants"
  - "Users email stays globally unique (login identity) while tenantId scopes data access"
  - "Seed script creates a default tenant and assigns all seed data to it"

patterns-established:
  - "tenantId column added after id on every data table"
  - "tenant_id index added to every table for query performance"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 25 Plan 03: Add tenantId to First 5 Data Tables Summary

**tenantId FK column on skills/users/ratings/usage-events/skill-versions with composite unique slug and seed data migration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-07T16:32:36Z
- **Completed:** 2026-02-07T16:37:00Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments
- Added tenantId column with FK to tenants.id on all 5 core data tables
- Replaced global slug unique on skills with composite (tenantId, slug) unique index
- Added tenant_id indexes on all 5 tables for query performance
- Updated schema/index.ts barrel exports to include tenants and audit-logs
- Updated seed.ts to create a default tenant and assign tenantId to all seed records

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tenantId to skills, users, ratings, usage-events, skill-versions and update schema index** - `9a93706` (feat)

_Note: This plan's changes were committed together with plan 25-04 changes in a single commit during a prior execution session._

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added tenantId FK, composite unique on (tenantId, slug), tenant_id index
- `packages/db/src/schema/users.ts` - Added tenantId FK, tenant_id index; email stays globally unique
- `packages/db/src/schema/ratings.ts` - Added tenantId FK, tenant_id index
- `packages/db/src/schema/usage-events.ts` - Added tenantId FK, tenant_id index
- `packages/db/src/schema/skill-versions.ts` - Added tenantId FK, tenant_id index
- `packages/db/src/schema/index.ts` - Added exports for tenants and audit-logs modules
- `packages/db/src/seed.ts` - Added default tenant creation and tenantId on all seed data

## Decisions Made
- Skills slug unique constraint replaced with composite (tenantId, slug) -- allows same slug in different tenants
- Users email stays globally unique since it serves as login identity across Auth.js
- Seed script creates DEFAULT_TENANT_ID constant and inserts a "Seed Company" tenant before all other data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated seed.ts to include tenantId on all seed data**
- **Found during:** Task 1 (schema modifications)
- **Issue:** Adding notNull tenantId columns caused TypeScript compilation failures in seed.ts (30+ type errors)
- **Fix:** Added DEFAULT_TENANT_ID constant, tenant import, tenant creation step, and tenantId on all user/skill/rating/version/event seed objects. Fixed nullable authorId type in insertedSkills array. Added non-null assertion on rater.id for ratings insert.
- **Files modified:** packages/db/src/seed.ts
- **Verification:** `npx tsc --noEmit -p packages/db/tsconfig.json` passes with zero errors
- **Committed in:** 9a93706 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Seed.ts update was necessary for compilation to pass. No scope creep.

## Issues Encountered
None beyond the seed.ts update documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 core data tables have tenantId columns ready for plan 25-04 (remaining 4 tables)
- Schema index exports tenants and audit-logs for use by services and relations
- TypeScript compiles cleanly across packages/db

---
## Self-Check: PASSED

*Phase: 25-multi-tenancy-schema-audit*
*Completed: 2026-02-07*
