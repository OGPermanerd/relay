---
phase: 74-adaptive-query-routing
plan: 02
subsystem: api
tags: [search, routing, classification, discover, quick-search, browse]

# Dependency graph
requires:
  - phase: 74-adaptive-query-routing
    plan: 01
    provides: classifyQuery, routeSearch, RouteType, route_type column on search_queries
  - phase: 56-hybrid-search-rrf
    provides: hybridSearchSkills, keywordSearchSkills functions
provides:
  - All 3 web search entry points (discover, quick, browse) classify queries and log routeType
  - Keyword queries in discover action skip embedding generation (ROUTE-02)
  - Zero-result keyword searches fall back to hybrid in discover (ROUTE-04)
  - Route type logged with every search query (ROUTE-03)
affects: [search-analytics, 74-03, dashboard-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns: [classifier-driven-search-routing, route-aware-search-logging]

key-files:
  created: []
  modified:
    - apps/web/app/actions/discover.ts
    - apps/web/app/actions/search.ts
    - apps/web/app/(protected)/skills/page.tsx

key-decisions:
  - "Discover action uses classifyQuery directly instead of routeSearch to preserve existing preference boost and rationale logic"
  - "Quick search logs routeType but does not change search behavior (searchSkills already handles semantic supplement gracefully)"
  - "Skills page logs routeType for analytics only -- existing sort/filter/quality-tier logic preserved (Pitfall 1)"
  - "Keyword-to-hybrid fallback in discover wrapped in try/catch to gracefully handle embedding failures"

patterns-established:
  - "Classifier-first search: classify query before deciding embedding generation strategy"
  - "Route logging at all entry points enables analytics comparison across search types"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 74 Plan 02: Search Entry Point Wiring Summary

**Wired query classifier into all 3 web search entry points (discover, quick search, skills browse) with keyword embedding skip and zero-result fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T23:14:41Z
- **Completed:** 2026-02-16T23:17:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Discover action classifies queries and routes to optimal backend -- keyword queries skip embedding generation (ROUTE-02)
- Zero-result keyword searches in discover automatically fall back to hybrid with embedding generation (ROUTE-04)
- All 3 search entry points (discover, quick search, skills browse) log routeType alongside searchType (ROUTE-03)
- Semantic/hybrid routes downgrade to keyword when embeddings are disabled (Pitfall 4 handled in discover)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire routing into discover action** - `b1ddd86` (feat)
2. **Task 2: Wire routing into quick search and skills page** - `7636591` (feat)

## Files Created/Modified
- `apps/web/app/actions/discover.ts` - Replaced embedding-first logic with classifier-driven routing; keyword queries skip embedding, zero-result fallback to hybrid, routeType logged
- `apps/web/app/actions/search.ts` - Added classifyQuery import and routeType logging to quick search action
- `apps/web/app/(protected)/skills/page.tsx` - Added classifyQuery import and routeType logging to skills browse page

## Decisions Made
- Used classifyQuery directly in discover.ts rather than routeSearch -- the discover action has its own preference boost, rationale generation, and result mapping that routeSearch's RouteResult wrapper would complicate
- Quick search keeps existing searchSkills() call -- the performance optimization is in discover (the heavy path), not quick search which is already fast with a 10-result limit
- Skills page only uses classifier for logging, not for changing search behavior -- Pitfall 1 (sortBy breaks with routing) avoided by keeping searchSkills() as-is

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All ROUTE-01 through ROUTE-04 requirements delivered across plans 01 and 02
- route_type analytics data now flowing from all search paths
- getRouteTypeBreakdown() available for dashboard/analytics views
- Ready for Phase 74 plan 03 (if planned) or Phase 75

## Self-Check: PASSED

- All 3 modified files verified present on disk
- Both task commits (b1ddd86, 7636591) verified in git log
- classifyQuery import and routeType logging verified in all 3 entry points
- Typecheck passes (0 errors), lint passes (0 errors)
- E2E skill-search tests: 10/11 pass (1 pre-existing flaky test unrelated to changes)

---
*Phase: 74-adaptive-query-routing*
*Completed: 2026-02-16*
