---
phase: 43-user-preferences
plan: 01
subsystem: database
tags: [drizzle, jsonb, zod, postgres, rls, user-preferences]

# Dependency graph
requires: []
provides:
  - user_preferences table with JSONB column and RLS
  - getOrCreateUserPreferences and updateUserPreferences service functions
  - Shared Zod schema with SKILL_CATEGORIES, SORT_OPTIONS, PREFERENCES_DEFAULTS
  - UserPreferencesData type (mirrored in packages/db and apps/web)
affects: [43-02, 43-03, settings-page, skill-listing-filters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB preferences with code-defined defaults merged at read time"
    - "Mirrored interface in packages/db and Zod schema in apps/web to avoid cross-package imports"

key-files:
  created:
    - packages/db/src/schema/user-preferences.ts
    - packages/db/src/services/user-preferences.ts
    - packages/db/src/migrations/0021_add_user_preferences.sql
    - apps/web/lib/preferences-defaults.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/services/index.ts
    - packages/db/src/relations/index.ts

key-decisions:
  - "JSONB column with code-defined defaults merged at read time (not DB defaults)"
  - "Interface mirrored in packages/db, Zod schema in apps/web to avoid cross-package imports"
  - "Validation happens at server action layer, not in DB service"

patterns-established:
  - "JSONB preferences pattern: schema defines interface, service merges defaults, app layer validates with Zod"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 43 Plan 01: User Preferences Data Layer Summary

**JSONB user_preferences table with Zod-validated schema, getOrCreate/update services, and shared defaults**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T21:36:43Z
- **Completed:** 2026-02-13T21:39:06Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments
- Created user_preferences table with JSONB preferences column, unique user_id constraint, tenant_id FK, and RLS tenant_isolation policy
- Built getOrCreateUserPreferences (with default merge) and updateUserPreferences service functions mirroring notification-preferences pattern
- Established shared Zod schema with SKILL_CATEGORIES, SORT_OPTIONS, and PREFERENCES_DEFAULTS for use across server actions and client components
- Registered all schema, service, and relation exports in index files

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, service, shared defaults, migration, and exports** - `0f964d3` (feat)

## Files Created/Modified
- `packages/db/src/schema/user-preferences.ts` - Table definition with JSONB column, UserPreferencesData interface, tenant_id FK, RLS policy
- `packages/db/src/services/user-preferences.ts` - getOrCreateUserPreferences and updateUserPreferences with default merging
- `packages/db/src/migrations/0021_add_user_preferences.sql` - Migration creating table, index, RLS policy
- `apps/web/lib/preferences-defaults.ts` - Zod schema, SKILL_CATEGORIES, SORT_OPTIONS, PREFERENCES_DEFAULTS constants
- `packages/db/src/schema/index.ts` - Added user-preferences export
- `packages/db/src/services/index.ts` - Added service function exports
- `packages/db/src/relations/index.ts` - Added userPreferencesRelations, updated users and tenants relations

## Decisions Made
- JSONB column with code-defined defaults merged at read time ensures new preference fields always have values for existing users
- UserPreferencesData interface mirrored in packages/db (plain TS interface) and apps/web (Zod inferred type) to avoid cross-package import issues
- Validation deferred to server action layer -- DB service does raw writes, Zod validates in apps/web actions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer complete for Plans 02 (server actions + settings UI) and 03 (skill listing integration)
- Migration 0021 applied to development database
- Zod schema ready for import in server actions

## Self-Check: PASSED

All 4 created files verified present. Commit `0f964d3` verified in git log.

---
*Phase: 43-user-preferences*
*Completed: 2026-02-13*
