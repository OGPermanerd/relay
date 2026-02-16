---
phase: 74-adaptive-query-routing
plan: 01
subsystem: api
tags: [search, routing, classification, hybrid-search, pgvector]

# Dependency graph
requires:
  - phase: 56-hybrid-search-rrf
    provides: hybridSearchSkills, keywordSearchSkills functions
  - phase: 50-semantic-search
    provides: semanticSearchSkills, generateEmbedding, getSiteSettings
provides:
  - query-classifier.ts pure-function classifier (RouteType, ClassificationResult, classifyQuery)
  - search-router.ts dispatcher (routeSearch, RouteResult) with keyword-to-hybrid fallback
  - route_type column on search_queries with NOT NULL, default hybrid, index
  - getRouteTypeBreakdown analytics function
affects: [74-02, search-analytics, discover-actions]

# Tech tracking
tech-stack:
  added: []
  patterns: [rule-based-classification, search-route-dispatch-with-fallback]

key-files:
  created:
    - apps/web/lib/query-classifier.ts
    - apps/web/lib/search-router.ts
    - packages/db/src/migrations/0042_add_route_type.sql
  modified:
    - packages/db/src/schema/search-queries.ts
    - packages/db/src/services/search-analytics.ts
    - packages/db/src/services/index.ts
    - packages/db/src/migrations/meta/_journal.json

key-decisions:
  - "Pure-function classifier with zero dependencies — testable and deterministic"
  - "Centralized embedding generation in router to avoid double-generation on fallback (Pitfall 2)"
  - "Optional routeType in SearchQueryEntry for backward compatibility with MCP callers"
  - "Explicit spread in logSearchQuery to conditionally include routeType field"

patterns-established:
  - "Route dispatch pattern: classify -> check capabilities -> execute -> fallback on zero results"
  - "RouteResult<T> carries fellBack flag and classificationReason for analytics transparency"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 74 Plan 01: Query Classification & Search Routing Summary

**Rule-based query classifier with 7 classification rules and search router with keyword-to-hybrid fallback dispatch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T23:08:35Z
- **Completed:** 2026-02-16T23:12:15Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments
- Pure-function query classifier with 7 deterministic rules mapping queries to keyword/semantic/hybrid/browse routes
- Search router that dispatches to the optimal backend and falls back from keyword to hybrid on zero results (ROUTE-04)
- Migration 0042 adding route_type column to search_queries with NOT NULL constraint, hybrid default, and index
- Analytics service extended with routeType tracking and getRouteTypeBreakdown() for route distribution analysis

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + classifier + router** - `a9b8873` (feat)

## Files Created/Modified
- `apps/web/lib/query-classifier.ts` - Pure-function classifier: classifyQuery() with RouteType and ClassificationResult exports
- `apps/web/lib/search-router.ts` - Search dispatcher: routeSearch() with fallback logic, centralized embedding generation
- `packages/db/src/migrations/0042_add_route_type.sql` - Migration adding route_type column with backfill to hybrid
- `packages/db/src/schema/search-queries.ts` - Added routeType field to searchQueries table definition
- `packages/db/src/services/search-analytics.ts` - Added routeType to SearchQueryEntry, getRouteTypeBreakdown()
- `packages/db/src/services/index.ts` - Barrel export for getRouteTypeBreakdown
- `packages/db/src/migrations/meta/_journal.json` - Journal entry for migration 0042

## Decisions Made
- Pure-function classifier with zero external dependencies -- fully testable, deterministic, no async
- Centralized embedding generation in the router to avoid double-generation when falling back between routes (prevents Pitfall 2 from research)
- routeType is optional in SearchQueryEntry so existing MCP callers don't break (backward compatible)
- Explicit object spread in logSearchQuery rather than passing entry directly, to conditionally include routeType only when present
- Semantic/hybrid routes automatically downgrade to keyword when semanticSimilarityEnabled is false (Pitfall 4)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused fellBack variable in search-router.ts**
- **Found during:** Task 1 (lint verification)
- **Issue:** `let fellBack = false` declared at function scope but never used -- each return path used inline boolean literals
- **Fix:** Removed the unused variable declaration
- **Files modified:** apps/web/lib/search-router.ts
- **Verification:** Lint passes (0 errors), typecheck passes
- **Committed in:** a9b8873 (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial cleanup of unused variable. No scope creep.

## Issues Encountered
- DATABASE_URL not set in turbo pipeline environment -- ran migration directly via `pnpm --filter @everyskill/db db:migrate` with explicit DATABASE_URL

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- query-classifier.ts and search-router.ts ready for wiring into search entry points (Plan 02)
- route_type column ready for tracking in all search analytics flows
- Existing searchSkills() in search-skills.ts left untouched as planned -- Plan 02 will wire callers

---
*Phase: 74-adaptive-query-routing*
*Completed: 2026-02-16*
