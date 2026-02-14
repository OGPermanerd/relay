---
phase: 53-skill-recommendations
plan: 01
subsystem: ai
tags: [anthropic, claude-haiku, search, recommendations, email-diagnostics]

# Dependency graph
requires:
  - phase: 51-email-analysis-pipeline
    provides: email diagnostics with category breakdown and time estimates
  - phase: 45-hybrid-search
    provides: searchSkills function for skill discovery
provides:
  - AI recommendation engine (query generation + ranking)
  - Server action for authenticated recommendation access
  - Skill recommendations with projected time savings
affects: [52-diagnostic-dashboard, recommendations-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [ai-query-generation, multi-query-deduplication, time-savings-projection]

key-files:
  created:
    - apps/web/lib/skill-recommendations.ts
    - apps/web/app/actions/recommendations.ts
  modified: []

key-decisions:
  - "Use Claude Haiku 4.5 for cost-efficient query generation (not Sonnet)"
  - "Filter to high-time categories only: >10% OR >30 min/week"
  - "Generate 1-2 search queries per high-time category"
  - "Take top 10 search results per query, deduplicate by skill ID"
  - "Rank by projected weekly savings (category time × AI savings percentage)"
  - "Return top 5 recommendations with personalized reasoning"

patterns-established:
  - "AI query generation: Map email categories to automation task queries"
  - "Multi-query search: Execute multiple searches, merge, deduplicate by ID"
  - "Projected savings: category time (hrs/week) × AI estimated percentage"
  - "Personalized reasoning: Explain match with specific categories and time savings"

# Metrics
duration: 8min
completed: 2026-02-14
---

# Phase 53 Plan 01: Skill Recommendations Summary

**AI-powered recommendation engine generating targeted skill searches from email diagnostic categories, ranked by projected weekly time savings using Claude Haiku**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-14T18:41:02Z
- **Completed:** 2026-02-14T18:49:00Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments

- AI query generation using Claude Haiku 4.5 with structured output schema
- Hybrid search integration for each generated query with deduplication
- Projected weekly time savings calculation (category time × AI percentage)
- Personalized reasoning explaining match with user's email patterns
- Server action with auth, error handling, and diagnostic data loading

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recommendation engine library** - `a935d44` (feat)
2. **Task 2: Create recommendations server action** - `d5e27b2` (feat)

## Files Created/Modified

- `apps/web/lib/skill-recommendations.ts` - AI recommendation engine with query generation, search execution, deduplication, and ranking by projected savings
- `apps/web/app/actions/recommendations.ts` - Server action wrapping recommendation engine with auth and diagnostic data loading

## Decisions Made

**Query generation filtering:** Only analyze categories with >10% time OR >30 min/week to minimize AI input tokens and focus on high-impact automations.

**Model selection:** Claude Haiku 4.5 instead of Sonnet for cost efficiency (~10x cheaper) - query generation is a simpler task than code review.

**Search breadth:** Top 10 results per query before deduplication gives good coverage without overwhelming the ranking phase.

**Ranking formula:** Projected savings = category time (hrs/week) × average AI estimated savings percentage across matched queries. Simple, explainable, and aligned with user value.

**Top 5 limit:** Prevents decision paralysis, focuses on highest-impact recommendations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript JSONB typing:** `diagnostic.categoryBreakdown` returned as `unknown` because Drizzle JSONB columns don't have typed inference. Fixed with explicit cast to `CategoryBreakdownItem[]` with proper import.

**Linting errors:** Unused variable parameters (`skillId`, `tenantId`) in loops. Fixed by prefixing with underscore (`_skillId`, `_tenantId`) per ESLint convention.

## User Setup Required

None - no external service configuration required. Uses existing ANTHROPIC_API_KEY from .env.local.

## Next Phase Readiness

**Ready for Phase 52 (Diagnostic Dashboard):** Recommendation server action is callable from any page. Dashboard can:
- Call `getRecommendations()` to fetch recommendations
- Display loading state during AI processing (1-3s)
- Show recommendations with time savings and personalized reasoning
- Link to skill detail pages for install flow

**Blockers:** None

**Notes:**
- Recommendations compute on-demand (not cached) - fast enough with Haiku (<3s)
- Empty results possible if skill library lacks relevant automations for user's email patterns
- Search quality depends on Phase 45 hybrid search implementation (currently uses basic searchSkills)

---
*Phase: 53-skill-recommendations*
*Completed: 2026-02-14*

## Self-Check: PASSED

All created files verified:
- FOUND: apps/web/lib/skill-recommendations.ts
- FOUND: apps/web/app/actions/recommendations.ts

All commits verified:
- FOUND: a935d44 (Task 1)
- FOUND: d5e27b2 (Task 2)
