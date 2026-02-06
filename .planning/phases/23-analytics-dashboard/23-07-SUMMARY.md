---
phase: 23-analytics-dashboard
plan: 07
subsystem: testing
tags: [playwright, e2e, analytics, nuqs, drizzle-sql]

# Dependency graph
requires:
  - phase: 23-analytics-dashboard (plans 01-06)
    provides: analytics page, tabs, time range, export, queries
provides:
  - Playwright E2E tests for analytics dashboard
  - Bug fixes for analytics SQL queries (Date serialization, GROUP BY, IN clause)
  - Fix for ExportDataRow re-export from server action
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sql.raw() for literal SQL keywords in Drizzle template tags"
    - "Date.toISOString() before passing to drizzle sql`` templates"
    - "sql.join() for building IN clauses in raw SQL"
    - "exact:true for Playwright button selectors when names are substrings of other buttons"

key-files:
  created:
    - apps/web/tests/e2e/analytics.spec.ts
  modified:
    - apps/web/lib/analytics-queries.ts
    - apps/web/app/actions/export-analytics.ts
    - apps/web/components/csv-export-button.tsx

key-decisions:
  - "Convert Date to ISO string at SQL boundary rather than changing function signatures"
  - "Use sql.raw() with quoted granularity for date_trunc since parameterized values cause GROUP BY mismatch"
  - "Use sql.join() with IN clause instead of ANY(array) for cross-driver compatibility"
  - "Import ExportDataRow directly from analytics-queries in client, not re-exported from server action"

patterns-established:
  - "Drizzle sql template: always convert Date to string before interpolation"
  - "Drizzle sql template: use sql.raw() for SQL keywords like granularity in date_trunc"

# Metrics
duration: 10min
completed: 2026-02-06
---

# Phase 23 Plan 07: Analytics E2E Tests Summary

**8 Playwright E2E tests verifying analytics page load, tab navigation, time range selection, CSV export, and direct URL params -- plus fixes for 4 SQL query bugs discovered during testing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-06T12:23:24Z
- **Completed:** 2026-02-06T12:33:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created comprehensive E2E test suite with 8 test cases covering all analytics dashboard functionality
- Discovered and fixed 4 server-side SQL bugs that prevented the analytics page from rendering
- All 8 analytics tests pass reliably in ~16 seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create analytics E2E test file** - `3a34efe` (test)
2. **Task 2: Run tests and fix issues** - `fde4e03` (fix)

**Plan metadata:** (pending)

## Files Created/Modified
- `apps/web/tests/e2e/analytics.spec.ts` - 8 E2E test cases for analytics dashboard
- `apps/web/lib/analytics-queries.ts` - Fixed Date serialization, date_trunc GROUP BY, IN clause
- `apps/web/app/actions/export-analytics.ts` - Removed type re-export causing runtime error
- `apps/web/components/csv-export-button.tsx` - Import ExportDataRow from source module

## Decisions Made
- Convert Date objects to ISO strings at the SQL query boundary (inside each function) rather than changing the `getStartDate` return type, preserving the existing API contract
- Use `sql.raw()` with single-quoted granularity values for PostgreSQL `date_trunc()` since parameterized values create separate parameter references that PostgreSQL cannot match across SELECT/GROUP BY/ORDER BY
- Replace `ANY(${array})` with `IN (${sql.join(...)})` pattern since the Drizzle `sql` template doesn't properly serialize JS arrays for PostgreSQL's ANY operator
- Import types directly from source modules in client components rather than re-exporting from "use server" files, as Next.js server action bundler can't handle type re-exports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Date serialization error in all analytics SQL queries**
- **Found during:** Task 2 (running tests)
- **Issue:** `TypeError: The "string" argument must be of type string or an instance of Buffer or ArrayBuffer. Received an instance of Date` -- the PostgreSQL driver rejected Date objects in Drizzle `sql` template literals
- **Fix:** Added `const startDateStr = startDate.toISOString()` in each query function and used the string instead
- **Files modified:** apps/web/lib/analytics-queries.ts (7 query functions)
- **Verification:** All tests pass, page renders correctly
- **Committed in:** fde4e03 (Task 2 commit)

**2. [Rule 1 - Bug] date_trunc GROUP BY mismatch in getUsageTrend and getSkillTrend**
- **Found during:** Task 2 (running tests)
- **Issue:** `column "ue.created_at" must appear in the GROUP BY clause` -- parameterized granularity in `date_trunc()` created different parameter references in SELECT vs GROUP BY
- **Fix:** Used `sql.raw()` to inline the granularity as a literal SQL string instead of a parameterized value
- **Files modified:** apps/web/lib/analytics-queries.ts (2 functions)
- **Verification:** Queries execute without GROUP BY errors
- **Committed in:** fde4e03 (Task 2 commit)

**3. [Rule 1 - Bug] ANY(array) type mismatch in getSkillUsage breakdown query**
- **Found during:** Task 2 (running tests)
- **Issue:** `op ANY/ALL (array) requires array on right side` -- Drizzle `sql` template parameterized the JS array as a single value, not a PostgreSQL array type
- **Fix:** Replaced `ANY(${skillIds})` with `IN (${sql.join(skillIds.map(id => sql`${id}`), sql`, `)})` pattern
- **Files modified:** apps/web/lib/analytics-queries.ts (1 query)
- **Verification:** Skill breakdown query executes correctly
- **Committed in:** fde4e03 (Task 2 commit)

**4. [Rule 1 - Bug] ExportDataRow runtime reference error in server action**
- **Found during:** Task 2 (running tests)
- **Issue:** `ReferenceError: ExportDataRow is not defined` -- re-exporting a TypeScript type from a "use server" file caused Next.js server action bundler to try to evaluate it as a runtime value
- **Fix:** Removed `export type { ExportDataRow }` from server action; imported type directly from analytics-queries in the client component
- **Files modified:** apps/web/app/actions/export-analytics.ts, apps/web/components/csv-export-button.tsx
- **Verification:** No more runtime error, export button works
- **Committed in:** fde4e03 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs via Rule 1)
**Impact on plan:** All 4 bugs were pre-existing in the analytics code from plans 01-06 that had not been E2E tested before. Fixing them was essential for the page to render at all. No scope creep.

## Issues Encountered
- Skills tab button selector conflicted with "Skills Used" sort header in Employees tab -- resolved with `{ exact: true }` in Playwright selector
- Default tab (Overview) doesn't add `?tab=overview` to URL since nuqs omits default values -- adjusted test to verify button class instead of URL param

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 23 (Analytics Dashboard) is now complete with all 7 plans executed
- All analytics features have E2E test coverage
- Ready to proceed to Phase 24 (Extended MCP Search) or next milestone

---
*Phase: 23-analytics-dashboard*
*Completed: 2026-02-06*
