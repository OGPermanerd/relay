---
phase: 63-ip-risk-analysis
plan: 01
subsystem: api
tags: [sql, drizzle-orm, risk-analysis, server-actions, nuqs]

# Dependency graph
requires:
  - phase: 62-company-ip-dashboard-core
    provides: ip-dashboard-queries.ts with existing IpDashboardStats and QualityTrendPoint queries
provides:
  - getAtRiskSkillAlerts query (single-author, high-usage, no-fork skills)
  - getIpRiskEmployees query (employees ranked by IP concentration risk)
  - getEmployeeAtRiskSkills query (per-employee drill-down)
  - fetchEmployeeRiskSkills server action with auth guard
  - useIpRiskSortState hook for risk table column sorting
  - HIGH_USAGE_THRESHOLD and CRITICAL_USAGE_THRESHOLD constants
  - AtRiskSkillAlert, IpRiskEmployee, EmployeeAtRiskSkill interfaces
affects: [63-02 ip-risk-section-ui, ip-dashboard page]

# Tech tracking
tech-stack:
  added: []
  patterns: [numeric-severity-aggregation, at-risk-skill-detection]

key-files:
  created:
    - apps/web/app/actions/get-employee-risk-skills.ts
  modified:
    - apps/web/lib/ip-dashboard-queries.ts
    - apps/web/hooks/use-analytics-sort.ts

key-decisions:
  - "Use numeric severity (3/2/1) for SQL MAX aggregation to avoid alphabetical sort bug with string risk levels"
  - "Only show critical (50+ uses) and high (10+ uses) risk -- no medium level in alerts"
  - "Server action returns EmployeeAtRiskSkill[] without re-exporting types (bundler safety)"

patterns-established:
  - "IP risk detection: single-author + high-usage + no published forks = at-risk skill"
  - "Numeric severity mapping in SQL, string risk levels in TypeScript"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 63 Plan 01: IP Risk Data Layer Summary

**Three SQL query functions for at-risk skill detection (single-author, high-usage, no forks), employee IP concentration ranking, and per-employee drill-down, plus server action and sort hook**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T01:38:02Z
- **Completed:** 2026-02-16T01:39:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Three query functions identifying at-risk skills by tenant with tenant-isolated NOT EXISTS subqueries
- Employee IP concentration ranking with numeric severity for correct MAX aggregation
- Server action with auth guard for on-demand drill-down modal data loading
- URL-persisted sort state hook (riskSort/riskDir) following existing nuqs pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add risk query functions and types** - `9ccc07a` (feat)
2. **Task 2: Add server action and sort hook** - `eb817f9` (feat)

## Files Created/Modified
- `apps/web/lib/ip-dashboard-queries.ts` - Added HIGH_USAGE_THRESHOLD, CRITICAL_USAGE_THRESHOLD constants, AtRiskSkillAlert/IpRiskEmployee/EmployeeAtRiskSkill interfaces, getAtRiskSkillAlerts/getIpRiskEmployees/getEmployeeAtRiskSkills query functions
- `apps/web/app/actions/get-employee-risk-skills.ts` - New server action with auth guard for employee drill-down
- `apps/web/hooks/use-analytics-sort.ts` - Added IP_RISK_SORT_COLUMNS, IpRiskSortColumn type, useIpRiskSortState hook

## Decisions Made
- Used numeric severity (3=critical, 2=high, 1=medium) in SQL MAX aggregation instead of string comparison, mapped to string risk levels in TypeScript (avoids alphabetical ordering bug where "critical" < "high" < "medium")
- Server action does not re-export types from the query module to avoid runtime bundler errors (documented project pattern)
- Threshold constants exported for UI tooltip usage in Phase 63-02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three query functions ready for Phase 63-02 UI consumption
- Server action ready for drill-down modal integration
- Sort hook ready for IP risk table column sorting
- IP dashboard page.tsx can import and add to Promise.all in next plan

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 63-ip-risk-analysis*
*Completed: 2026-02-16*
