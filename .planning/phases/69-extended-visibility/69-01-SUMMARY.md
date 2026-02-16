---
phase: 69-extended-visibility
plan: 01
subsystem: database
tags: [visibility, rls, drizzle, vitest, postgres]

# Dependency graph
requires:
  - phase: 40-visibility-scoping
    provides: original 2-level visibility helpers (tenant/personal)
provides:
  - VISIBILITY_LEVELS constant with 4 levels (global_approved, tenant, personal, private)
  - VisibilityLevel type
  - isOrgVisible() helper
  - orgVisibleSQL() raw SQL helper
  - Updated buildVisibilityFilter() for 4 levels
  - Updated visibilitySQL() for 4 levels
  - Migration 0038 with CHECK constraint and cross-tenant RLS policy
  - Vitest test infrastructure in packages/db
affects: [69-02, 69-03, skill-upload, skill-browse, marketplace]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [4-level visibility enum, cross-tenant RLS for global_approved, recursive SQL object inspection for testing]

key-files:
  created:
    - packages/db/src/lib/__tests__/visibility.test.ts
    - packages/db/src/migrations/0038_extend_visibility.sql
  modified:
    - packages/db/src/lib/visibility.ts
    - packages/db/src/schema/skills.ts
    - packages/db/package.json

key-decisions:
  - "RLS USING clause allows cross-tenant reads for global_approved skills while WITH CHECK restricts writes to own tenant"
  - "CHECK constraint enforces exactly 4 valid visibility values at database level"
  - "Vitest added to @everyskill/db for unit testing (first test infrastructure in this package)"

patterns-established:
  - "extractSQLStrings(): recursive helper for testing Drizzle SQL objects without DB connection"
  - "4-level visibility: global_approved > tenant > personal > private"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 69 Plan 01: Visibility Foundation Summary

**4-level visibility system (global_approved/tenant/personal/private) with centralized helpers, CHECK constraint migration, cross-tenant RLS policy, and 17 unit tests via vitest**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-16T19:37:42Z
- **Completed:** 2026-02-16T19:42:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended visibility from 2 levels (tenant/personal) to 4 levels (global_approved/tenant/personal/private)
- Created migration 0038 with CHECK constraint and updated RLS policy for cross-tenant global_approved reads
- Added vitest to @everyskill/db and created 17 comprehensive unit tests covering all helpers
- All existing consumers of buildVisibilityFilter/visibilitySQL remain backwards compatible

## Task Commits

Each task was committed atomically:

1. **Task 1: Update visibility helpers and schema** - `a5cf56b` (feat)
2. **Task 2: Create visibility unit tests** - `c65a31d` (test)

## Files Created/Modified
- `packages/db/src/lib/visibility.ts` - Extended with VISIBILITY_LEVELS, VisibilityLevel, ORG_VISIBLE_LEVELS, isOrgVisible, orgVisibleSQL; updated buildVisibilityFilter and visibilitySQL for 4 levels
- `packages/db/src/schema/skills.ts` - Updated visibility column comment to document 4 levels; updated RLS policy USING clause for cross-tenant global_approved reads
- `packages/db/src/migrations/0038_extend_visibility.sql` - CHECK constraint for 4 valid values; recreated tenant_isolation policy
- `packages/db/src/lib/__tests__/visibility.test.ts` - 17 unit tests covering all exports
- `packages/db/package.json` - Added vitest, updated test script

## Decisions Made
- Used CHECK constraint (not enum type) for visibility values to allow easy extension without migration
- RLS policy uses OR for global_approved reads (permissive USING, restrictive WITH CHECK) -- ensures global skills are readable cross-tenant but only writable within own tenant
- Added vitest as first test framework in packages/db (no prior test infrastructure existed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed vitest test framework**
- **Found during:** Task 2 (Create visibility unit tests)
- **Issue:** No test framework configured in packages/db or monorepo root
- **Fix:** Installed vitest as devDependency, updated test script in package.json
- **Files modified:** packages/db/package.json, pnpm-lock.yaml
- **Verification:** `npx vitest run` executes successfully
- **Committed in:** c65a31d (Task 2 commit)

**2. [Rule 1 - Bug] Fixed unused import lint error**
- **Found during:** Task 2 (pre-commit hook)
- **Issue:** `VisibilityLevel` type imported but not used in test file
- **Fix:** Removed unused import
- **Files modified:** packages/db/src/lib/__tests__/visibility.test.ts
- **Verification:** ESLint passes
- **Committed in:** c65a31d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both necessary for test execution and CI compliance. No scope creep.

## Issues Encountered
- Drizzle query builder expressions (from `eq()`, `or()`, `and()`) produce deeply nested objects with circular references that cannot be JSON.stringify'd. Solved by creating a recursive `extractSQLStrings()` helper that walks `queryChunks`, `value` (handling both string and array forms for StringChunk), and `name` properties with circular reference protection.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Visibility helpers ready for plans 02 (UI integration) and 03 (service layer updates)
- Migration 0038 ready to run (`pnpm db:migrate`) but not yet applied -- will be applied when needed
- All existing imports of buildVisibilityFilter/visibilitySQL continue to work unchanged

---
*Phase: 69-extended-visibility*
*Completed: 2026-02-16*
