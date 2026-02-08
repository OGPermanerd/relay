---
phase: 29-tenant-scoped-analytics-mcp
plan: 01
subsystem: analytics, database
tags: [multi-tenancy, tenant-isolation, sql, analytics, security]

# Dependency graph
requires:
  - phase: 25-multi-tenancy-foundation
    provides: "tenant_id columns on usage_events and users tables"
  - phase: 26-auth-subdomain-routing
    provides: "session.user.tenantId JWT claim"
provides:
  - "Tenant-scoped analytics queries filtering by tenant_id"
  - "Defense-in-depth tenantId parameter on drill-down queries"
  - "All 4 analytics callers passing session.user.tenantId"
affects: [29-tenant-scoped-analytics-mcp, analytics, multi-tenancy]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Direct tenant_id WHERE clause filtering in raw SQL queries", "tenantId null guard with redirect/throw at entry points"]

key-files:
  created: []
  modified:
    - "apps/web/lib/analytics-queries.ts"
    - "apps/web/app/(protected)/analytics/page.tsx"
    - "apps/web/app/actions/export-analytics.ts"
    - "apps/web/app/actions/get-employee-activity.ts"
    - "apps/web/app/actions/get-skill-trend.ts"

key-decisions:
  - "Filter by ue.tenant_id / u.tenant_id instead of email-domain subqueries for O(1) index lookups"
  - "Remove unnecessary LEFT JOIN users from queries that only needed user table for domain filtering"
  - "Add tenantId as first parameter to getEmployeeActivity and getSkillTrend for defense-in-depth"

patterns-established:
  - "Tenant-scoped raw SQL queries: always filter by tenant_id column directly, never derive from email domain"
  - "Analytics entry point guard: extract tenantId from session, null-check with redirect/throw before any query"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 29 Plan 01: Tenant-Scoped Analytics Queries Summary

**Migrated all 6 analytics query functions from email-domain subquery matching to direct tenant_id column filtering, eliminating cross-tenant data leakage**

## Performance

- **Duration:** 5 min 32s
- **Started:** 2026-02-08T03:35:18Z
- **Completed:** 2026-02-08T03:40:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Replaced 8 email-domain subquery patterns across 6 query functions with direct `tenant_id = ${tenantId}` WHERE clauses
- Added defense-in-depth tenantId parameter to `getEmployeeActivity` and `getSkillTrend` drill-down queries
- Updated all 4 analytics entry points to extract and guard `session.user.tenantId`
- Removed unnecessary `LEFT JOIN users` from queries that only joined users for email-domain filtering
- Zero `orgId`, `split_part`, or email-domain patterns remain in analytics codebase

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate all 6 analytics query functions to tenant_id filtering** - `0718c31` (feat)
2. **Task 2: Update all analytics callers to pass tenantId** - `9e8d3c9` (feat)

## Files Created/Modified
- `apps/web/lib/analytics-queries.ts` - All 6 query functions now accept tenantId, filter by tenant_id column
- `apps/web/app/(protected)/analytics/page.tsx` - Passes session.user.tenantId to all 4 query functions
- `apps/web/app/actions/export-analytics.ts` - tenantId guard + passes to getExportData
- `apps/web/app/actions/get-employee-activity.ts` - tenantId guard + passes as first arg to getEmployeeActivity
- `apps/web/app/actions/get-skill-trend.ts` - tenantId guard + passes as first arg to getSkillTrend

## Decisions Made
- Filter by `ue.tenant_id` / `u.tenant_id` instead of email-domain subqueries for O(1) index lookups vs O(n) LIKE pattern matching
- Removed unnecessary `LEFT JOIN users` from `getUsageTrend` and `getSkillUsage` main query (users table was only needed for email-domain filtering)
- Added tenantId as first parameter (not last) to `getEmployeeActivity` and `getSkillTrend` for defense-in-depth consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `pnpm build` fails with `ENOENT: pages-manifest.json` (pre-existing Next.js 16.1.6 infrastructure issue, not related to changes). TypeScript compilation passes cleanly with `tsc --noEmit`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All analytics queries are tenant-scoped, ready for Phase 29 Plan 02 (MCP server tenant context)
- No blockers

## Self-Check: PASSED

All 5 modified files verified to exist. Both task commits (0718c31, 9e8d3c9) verified in git log.

---
*Phase: 29-tenant-scoped-analytics-mcp*
*Completed: 2026-02-08*
