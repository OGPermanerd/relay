---
phase: 63-ip-risk-analysis
plan: 02
subsystem: ui
tags: [react, tailwind, nuqs, server-actions, risk-analysis, modal, sortable-table]

# Dependency graph
requires:
  - phase: 63-ip-risk-analysis
    provides: getIpRiskEmployees, getAtRiskSkillAlerts queries, fetchEmployeeRiskSkills server action, useIpRiskSortState hook
  - phase: 62-company-ip-dashboard-core
    provides: ip-dashboard page, IpDashboardView component, stat cards, quality trends chart
provides:
  - IpRiskSection component with alert cards, sortable employee table, and drill-down modal
  - Updated IpDashboardView rendering risk section between stat cards and quality chart
  - Updated IP dashboard page fetching risk data in parallel
affects: [64-ip-risk-mitigation, ip-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-side-risk-constants, server-type-only-import]

key-files:
  created:
    - apps/web/components/ip-risk-section.tsx
  modified:
    - apps/web/components/ip-dashboard-view.tsx
    - apps/web/app/(protected)/leverage/ip-dashboard/page.tsx

key-decisions:
  - "Inline threshold constants in client component to avoid importing server-only ip-dashboard-queries module at runtime"
  - "Max 5 visible alert cards with 'and X more' overflow text to prevent dashboard flooding"
  - "Risk section positioned between hero stat cards and quality trends chart per research layout plan"

patterns-established:
  - "Server-only modules with db import: use import type in client components, inline any runtime constants"
  - "Risk alert cards: red border/bg for critical, amber border/bg for high severity"
  - "Employee risk table: sortable via useIpRiskSortState with URL-persisted sort state"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 63 Plan 02: IP Risk Section UI Summary

**IpRiskSection component with proactive risk alert cards (red/amber severity), sortable employee IP concentration table, and drill-down modal showing per-employee at-risk skills**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-16T01:42:23Z
- **Completed:** 2026-02-16T01:47:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- IpRiskSection component with three sections: alert cards, sortable employee risk table, and drill-down modal
- Proactive risk alert cards with red (critical) and amber (high) severity indicators, max 5 visible with overflow count
- Employee IP concentration risk table with client-side sorting via useIpRiskSortState hook
- Drill-down modal fetches per-employee at-risk skills via server action with links to /skills/[slug]
- IP dashboard page fetches risk data in parallel via extended Promise.all

## Task Commits

Each task was committed atomically:

1. **Task 1: Create IpRiskSection component** - `365f0b1` (feat)
2. **Task 2: Wire risk data into IP dashboard page and view** - `eb2f403` (feat)

## Files Created/Modified
- `apps/web/components/ip-risk-section.tsx` - New IpRiskSection component with alert cards, sortable employee table, RiskBadge, RiskSortHeader, and RiskDrillDownModal
- `apps/web/components/ip-dashboard-view.tsx` - Added IpRiskSection import and rendering between stat cards and quality chart, extended props interface
- `apps/web/app/(protected)/leverage/ip-dashboard/page.tsx` - Added getIpRiskEmployees and getAtRiskSkillAlerts to Promise.all, passed risk data to IpDashboardView

## Decisions Made
- Inlined HIGH_USAGE_THRESHOLD (10) and CRITICAL_USAGE_THRESHOLD (50) as constants in the client component rather than importing from ip-dashboard-queries.ts, because that module imports `db` from `@everyskill/db` which pulls in Node.js-only modules (`child_process`, `fs`, `net`) that break the client bundle
- Limited visible alert cards to 5 with "and X more" text to prevent dashboard visual overload
- Used `import type` for all type imports from ip-dashboard-queries.ts (types are erased at compile time, avoiding the server-module bundling issue)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed client-side import of server-only module**
- **Found during:** Task 2 (build verification)
- **Issue:** ip-risk-section.tsx imported runtime constants (HIGH_USAGE_THRESHOLD, CRITICAL_USAGE_THRESHOLD) from ip-dashboard-queries.ts which imports `db` from `@everyskill/db`, causing Turbopack to fail with "Module not found: Can't resolve 'child_process'/'fs'/'net'" errors
- **Fix:** Inlined the two threshold constants directly in the client component, kept type imports as `import type`
- **Files modified:** apps/web/components/ip-risk-section.tsx
- **Verification:** `pnpm build` succeeds
- **Committed in:** eb2f403 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for build to pass. No scope creep. Constants are duplicated (2 numbers) with a comment to keep in sync.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- IP risk section is live on the dashboard with alert cards and employee risk table
- Drill-down modal works via server action for on-demand data loading
- Phase 63 is now fully complete (both plans)
- Ready for Phase 64 (IP risk mitigation features)

## Self-Check: PASSED

All files exist, all commits verified, all key links confirmed.

---
*Phase: 63-ip-risk-analysis*
*Completed: 2026-02-16*
