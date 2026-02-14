---
phase: 51-email-analysis-pipeline
plan: 01
subsystem: database
tags: [drizzle-orm, postgres, jsonb, rls, email-diagnostics]

# Dependency graph
requires:
  - phase: 50-gmail-oauth-infrastructure
    provides: Gmail token storage and OAuth flow
provides:
  - email_diagnostics table with aggregate-only columns
  - Service layer for saving and querying diagnostic scans
  - Privacy-first schema (no individual email metadata)
affects: [51-02-email-scanner, 51-03-diagnostic-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [aggregate-only storage, privacy-first data model]

key-files:
  created:
    - packages/db/src/schema/email-diagnostics.ts
    - packages/db/src/services/email-diagnostics.ts
    - packages/db/src/migrations/0029_add_email_diagnostics.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/services/index.ts
    - packages/db/src/relations/index.ts

key-decisions:
  - "Store estimated_hours_per_week as tenths (integer) to avoid floating point precision issues"
  - "Use JSONB for category_breakdown and pattern_insights for flexible aggregate storage"
  - "No individual email columns (From/Subject/Date) - aggregate stats only"
  - "RLS tenant_isolation policy enforced on all operations"

patterns-established:
  - "Privacy-first pattern: raw metadata processed in-memory only, persist aggregate stats"
  - "JSONB columns for flexible typed data: categoryBreakdown as array, patternInsights as object"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 51 Plan 01: Email Diagnostics Schema Summary

**Aggregate-only email diagnostics schema with JSONB category breakdown and pattern insights, zero individual email metadata storage**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T18:14:00Z
- **Completed:** 2026-02-14T18:19:09Z
- **Tasks:** 2 (schema creation was committed in previous session as 88c7013)
- **Files modified:** 6

## Accomplishments
- Created email_diagnostics table with privacy-first aggregate-only design
- Service layer with saveEmailDiagnostic, getLatestDiagnostic, getDiagnosticHistory
- Migration 0029 successfully applied with RLS tenant isolation policy
- TypeScript types exported for CategoryBreakdownItem and PatternInsights
- Relations established with users and tenants tables

## Task Commits

1. **Task 1: Create email_diagnostics schema and migration** - `88c7013` (feat) - committed in previous session
2. **Task 2: Create email diagnostics service layer** - `5faa615` (feat)

_Note: Task 1 was committed in the previous session along with gmail-client.ts as part of plan 51-02. The work was already complete when this plan executed._

## Files Created/Modified
- `packages/db/src/schema/email-diagnostics.ts` - Table definition with JSONB columns for aggregate data
- `packages/db/src/services/email-diagnostics.ts` - Service layer with save, getLatest, getHistory functions
- `packages/db/src/migrations/0029_add_email_diagnostics.sql` - Migration with table, indexes, RLS policy, comments
- `packages/db/src/schema/index.ts` - Export emailDiagnostics table
- `packages/db/src/services/index.ts` - Export service functions and types
- `packages/db/src/relations/index.ts` - Relations for emailDiagnostics with users/tenants

## Decisions Made

**1. Integer storage for hours per week**
Store estimated_hours_per_week as tenths (integer 125 = 12.5 hours) to avoid floating point precision issues in Postgres JSONB queries.

**2. JSONB for flexible aggregate data**
categoryBreakdown stored as JSONB array, patternInsights as JSONB object. Allows flexible schema evolution without migrations while maintaining strong TypeScript types.

**3. No individual email metadata columns**
Deliberately omit From, Subject, Date columns. Table stores ONLY aggregate statistics computed from in-memory analysis. Privacy-first by design.

**4. RLS tenant isolation**
AS RESTRICTIVE policy on all operations ensures tenant data isolation at database level, not just application level.

## Deviations from Plan

None - plan executed exactly as written. Schema and service layer follow established patterns from gmail-tokens phase.

## Issues Encountered

**1. Pre-commit hook failure on unrelated file**
`apps/web/lib/gmail-client.ts` had unused import and console.error from previous work. Lint-staged auto-fixed the console.error, and the file was already committed separately.

**2. Migration execution pattern**
Initial attempt with psql failed due to database schema not existing. Used drizzle-kit push which detected the table needed creation. Migration then ran successfully with direct psql execution.

## User Setup Required

None - no external service configuration required. Migration 0029 has been applied to local database.

## Next Phase Readiness

- email_diagnostics table ready for use
- Service layer ready to persist scan results
- Types exported for app layer consumption
- Ready for Phase 51-02 (email scanner) to compute and save diagnostics
- Ready for Phase 51-03 (diagnostic UI) to query and display results

No blockers or concerns.

## Self-Check: PASSED

All claimed files and commits verified:
- ✓ packages/db/src/schema/email-diagnostics.ts exists
- ✓ packages/db/src/services/email-diagnostics.ts exists
- ✓ packages/db/src/migrations/0029_add_email_diagnostics.sql exists
- ✓ Commit 88c7013 exists (Task 1 schema)
- ✓ Commit 5faa615 exists (Task 2 service)

---
*Phase: 51-email-analysis-pipeline*
*Completed: 2026-02-14*
