---
phase: 64-ip-valuation-export
plan: 01
subsystem: api
tags: [ip-valuation, replacement-cost, sql, server-action, export]

# Dependency graph
requires:
  - phase: 63-ip-risk-analysis
    provides: "IP risk queries, threshold constants, risk types"
provides:
  - "Replacement cost formula (calculateReplacementCost)"
  - "Skill valuation SQL query (getSkillValuationData)"
  - "IP report export server action (fetchIpReportData)"
  - "IpReportData type for PDF/CSV export payload"
  - "formatCurrency hydration-safe helper"
affects: [64-02 UI components, future PDF/CSV generation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["replacement-cost formula with complexity/quality multipliers", "parallel data fetching for export payloads"]

key-files:
  created:
    - apps/web/lib/ip-valuation.ts
    - apps/web/app/actions/export-ip-report.ts
  modified:
    - apps/web/lib/ip-dashboard-queries.ts

key-decisions:
  - "HOURLY_RATE = $150 for knowledge worker replacement cost baseline"
  - "averageRating normalized from 0-500 (rating*100) to 0-1 scale; null defaults to 0.6"
  - "Complexity multiplier uses log10(contentLength/1000), clamped [1.0, 2.0]"
  - "Quality multiplier = 0.5 + (normalized * 0.5), range [0.5, 1.0]"
  - "1-year lookback for quality trends in export context"

patterns-established:
  - "Replacement cost formula: base * complexity * quality with clamped multipliers"
  - "formatCurrency uses manual regex instead of toLocaleString for hydration safety"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 64 Plan 01: IP Valuation Data Layer Summary

**Replacement cost formula with complexity/quality multipliers, skill valuation SQL query, and export server action fetching complete IP report data**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T03:08:59Z
- **Completed:** 2026-02-16T03:12:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replacement cost formula handles edge cases (null rating, zero content, zero uses) with clamped multipliers
- SQL query returns all published skills with valuation ingredients including content length and risk level
- Server action fetches 5 data sources in parallel with auth + admin guards
- Hydration-safe currency formatting helper avoids Node.js/browser Intl differences

## Task Commits

Each task was committed atomically:

1. **Task 1: Create replacement cost formula and types** - `4d35f7e` (feat)
2. **Task 2: Add skill valuation SQL query and server action** - `9d9baa8` (feat)

## Files Created/Modified
- `apps/web/lib/ip-valuation.ts` - Replacement cost formula, types (SkillValuationRow, SkillValuation, IpReportData), constants, formatting helpers
- `apps/web/lib/ip-dashboard-queries.ts` - Added getSkillValuationData query for per-skill valuation data
- `apps/web/app/actions/export-ip-report.ts` - Server action fetching complete IP report payload with auth/admin guard

## Decisions Made
- HOURLY_RATE set to $150 (knowledge worker replacement cost baseline)
- averageRating stored as rating*100 (0-500), normalized to 0-1 for quality multiplier; null defaults to 0.6
- Complexity multiplier uses log10 of content length normalized to 1000 chars, clamped to [1.0, 2.0]
- Quality multiplier ranges [0.5, 1.0] so even low-quality skills retain half their base value
- Export trends use 1-year lookback (same context as dashboard default)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete, ready for Plan 02 UI components
- IpReportData type available for PDF/CSV rendering
- fetchIpReportData server action available for client-side consumption

## Self-Check: PASSED

All 3 files exist. Both task commits (4d35f7e, 9d9baa8) verified in git log.

---
*Phase: 64-ip-valuation-export*
*Completed: 2026-02-16*
