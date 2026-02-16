---
phase: 71-temporal-tracking
plan: 01
subsystem: database
tags: [drizzle, postgres, rls, upsert, temporal-tracking]

# Dependency graph
requires: []
provides:
  - user_skill_views table with tenant-isolated RLS
  - recordSkillView UPSERT function
  - getUserViewsForSkills batch Map query for badge rendering
  - getWhatsNewForUser SQL join with 30-day window
  - getVersionNumber and countFeedbackSince change detection helpers
affects: [71-02 (Updated badges), 71-03 (What's New page), temporal-tracking UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [upsert-on-unique-constraint, batch-map-query, temporal-join-with-window]

key-files:
  created:
    - packages/db/src/schema/user-skill-views.ts
    - packages/db/src/services/user-skill-views.ts
    - packages/db/src/migrations/0039_create_user_skill_views.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/relations/index.ts
    - packages/db/src/services/index.ts

key-decisions:
  - "UPSERT targets unique (tenant_id, user_id, skill_id) composite index for conflict resolution"
  - "getUserViewsForSkills returns Map<string, UserSkillView> for O(1) badge lookups per skill"
  - "getWhatsNewForUser uses 30-day rolling window and published status filter"
  - "countFeedbackSince uses gt() on createdAt for change detection granularity"

patterns-established:
  - "Temporal tracking UPSERT: insert first view, update+increment on repeat via onConflictDoUpdate"
  - "Batch view query pattern: inArray() + Map return for N+1 prevention on list pages"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 71 Plan 01: User Skill Views Data Layer Summary

**user_skill_views table with UPSERT service, batch Map query for badge rendering, and What's New temporal join with 30-day window**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T21:27:48Z
- **Completed:** 2026-02-16T21:31:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created user_skill_views table with 7 columns, 5 indexes (including unique composite), and tenant-isolated RLS policy
- Migration 0039 applied successfully to dev database
- Service layer with 6 exported functions: recordSkillView (UPSERT), getUserView (single), getUserViewsForSkills (batch Map), getWhatsNewForUser (temporal join), getVersionNumber, countFeedbackSince
- Full monorepo typecheck passes (6/6 packages)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create user_skill_views schema, migration, and relations** - `43658c7` (feat)
2. **Task 2: Create service layer with all query functions** - `423dc52` (feat)

## Files Created/Modified
- `packages/db/src/schema/user-skill-views.ts` - Table definition with tenant isolation RLS, unique composite index
- `packages/db/src/schema/index.ts` - Added barrel export for user-skill-views
- `packages/db/src/relations/index.ts` - Added userSkillViewsRelations + many refs on users, skills, tenants
- `packages/db/src/migrations/0039_create_user_skill_views.sql` - CREATE TABLE, indexes, RLS policy
- `packages/db/src/services/user-skill-views.ts` - 6 exported functions + WhatsNewItem interface
- `packages/db/src/services/index.ts` - Added barrel export for all service functions

## Decisions Made
- UPSERT targets the unique (tenant_id, user_id, skill_id) composite index for conflict resolution rather than a separate constraint name
- getUserViewsForSkills returns `Map<string, UserSkillView>` for O(1) per-skill lookup, preventing N+1 on list pages
- getWhatsNewForUser uses INNER JOIN (only shows skills user has viewed before that were subsequently updated), 30-day rolling window, and published-only filter
- countFeedbackSince uses drizzle `gt()` on `createdAt` timestamp for precise post-view change detection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- user_skill_views data layer complete, ready for Plan 02 (Updated badges) and Plan 03 (What's New page)
- All 6 service functions available via `@everyskill/db` barrel export
- No blockers

## Self-Check: PASSED

All 4 files verified present. Both commit hashes (43658c7, 423dc52) found in git log.

---
*Phase: 71-temporal-tracking*
*Completed: 2026-02-16*
