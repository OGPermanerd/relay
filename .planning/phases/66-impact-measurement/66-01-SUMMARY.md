---
phase: 66-impact-measurement
plan: 01
subsystem: api, ui
tags: [recharts, sql, window-function, union-all, composedchart, portfolio, impact]

# Dependency graph
requires:
  - phase: 65-individual-portfolio
    provides: portfolio-queries.ts with getPortfolioStats, getPortfolioSkills, getContributionRanking
provides:
  - getImpactTimeline query function with UNION ALL + window function for cumulative hours saved
  - getImpactCalculatorStats query function with FILTER WHERE conditional aggregation
  - ImpactTimelineChart client component with ComposedChart (Area + 3 Scatter series)
  - ImpactCalculator client component with stat cards for hours/cost/contributions
affects: [66-impact-measurement remaining plans, portfolio page integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [UNION ALL with window function for timeline events, ComposedChart with mixed Area + Scatter series]

key-files:
  created:
    - apps/web/components/impact-timeline-chart.tsx
    - apps/web/components/impact-calculator.tsx
  modified:
    - apps/web/lib/portfolio-queries.ts

key-decisions:
  - "UNION ALL combines skill creations, forks, and implemented suggestions into a single timeline"
  - "SUM() OVER (ORDER BY event_date ROWS UNBOUNDED PRECEDING) for cumulative hours saved"
  - "Suggestions have 0 hours_impact but still appear as timeline events"
  - "Inline formatCurrency in ImpactCalculator (cannot import server-only ip-valuation.ts in use client)"
  - "Parallel Promise.all for skills + suggestions queries in getImpactCalculatorStats"

patterns-established:
  - "ComposedChart pattern: Area for continuous series + Scatter for categorical event markers"
  - "UNION ALL timeline pattern: multiple event sources merged with window function"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 66 Plan 01: Impact Timeline & Calculator Summary

**UNION ALL timeline query with cumulative window function, ComposedChart with Area + 3 Scatter event markers, and impact calculator stat cards with hours/cost breakdown**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T09:56:07Z
- **Completed:** 2026-02-16T10:00:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- getImpactTimeline() combines 3 event sources (creations, forks, suggestions) via UNION ALL with cumulative SUM window function
- getImpactCalculatorStats() uses FILTER WHERE conditional aggregation for single-pass creation/fork counts
- ImpactTimelineChart renders ComposedChart with blue Area (cumulative hours) overlaid with green/purple/amber Scatter dots for event types
- ImpactCalculator shows 2 hero stats (hours saved, dollar value at $150/hr) and 3 breakdown stats (created, forked, suggestions)
- Both components handle empty state with dashed-border placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Add impact timeline and calculator queries** - `ea4c270` (feat)
2. **Task 2: Create impact timeline chart and calculator components** - `ff728cb` (feat)

## Files Created/Modified
- `apps/web/lib/portfolio-queries.ts` - Added getImpactTimeline, getImpactCalculatorStats, TimelineEvent, ImpactCalculatorStats
- `apps/web/components/impact-timeline-chart.tsx` - ComposedChart with Area + 3 Scatter series, UTC-safe date formatting
- `apps/web/components/impact-calculator.tsx` - Stat cards with inline formatCurrency, empty state handling

## Decisions Made
- UNION ALL combines three distinct event sources into a single chronological timeline
- SUM() OVER (ROWS UNBOUNDED PRECEDING) computes running cumulative total in PostgreSQL (not JS)
- Suggestions contribute 0 hours_impact but are still visible as timeline events
- Inline formatCurrency function in client component since ip-valuation.ts transitively imports DB modules
- Promise.all parallelizes the two independent queries in getImpactCalculatorStats

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timeline and calculator queries ready for integration into the portfolio page
- Components accept props directly -- parent page just needs to call queries and pass data
- ImpactTimelineChart expects TimelineEvent[] from getImpactTimeline()
- ImpactCalculator expects ImpactCalculatorStats from getImpactCalculatorStats()

## Self-Check: PASSED

All 3 created/modified files verified present. Both task commits (ea4c270, ff728cb) verified in git log.

---
*Phase: 66-impact-measurement*
*Completed: 2026-02-16*
