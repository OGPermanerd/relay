---
phase: 48-homepage-redesign
plan: 01
subsystem: ui
tags: [nextjs, react, server-components, tailwind, homepage, discovery]

# Dependency graph
requires:
  - phase: 45-ai-discovery
    provides: DiscoverySearch component, hybrid search
  - phase: 44-skill-marketplace
    provides: TrendingSection, CompanyApprovedSection, LeaderboardTable, platform-stats
provides:
  - Search-first homepage with single scrollable layout (no tabs)
  - CategoryTiles component with per-category skill counts
  - CompactStatsBar component replacing 4 stat cards
  - MiniLeverageWidget component with personal impact summary
  - getCategoryCounts SQL query for published skill counts by category
affects: [48-homepage-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-interfaces-for-client-components, server-component-category-tiles]

key-files:
  created:
    - apps/web/lib/category-counts.ts
    - apps/web/components/category-tiles.tsx
    - apps/web/components/compact-stats-bar.tsx
    - apps/web/components/mini-leverage-widget.tsx
  modified:
    - apps/web/app/(protected)/page.tsx
    - apps/web/tests/e2e/home.spec.ts

key-decisions:
  - "MiniLeverageWidget defines SkillsUsedStats/SkillsCreatedStats interfaces inline to avoid pulling server code into client bundle"
  - "CategoryTiles is a server component (no use client) for zero JS overhead"
  - "CompactStatsBar uses FTE_DAYS_PER_YEAR (not hours) since platform stats store FTE days"
  - "TrendingSection rendered without trendData prop (sparkline naturally disabled)"
  - "Category tile links use /skills?category=X pattern for filtered browsing"

patterns-established:
  - "Inline client interfaces: when client components need types from server modules, define interfaces inline rather than importing"
  - "Homepage section order: search hero -> category tiles -> company recommended -> trending -> compact stats -> leaderboard -> mini leverage -> CTAs"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 48 Plan 01: Homepage Core Restructure Summary

**Search-first scrollable homepage with category tiles, compact stats banner, and mini leverage widget replacing tabbed dashboard layout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T22:44:11Z
- **Completed:** 2026-02-13T22:48:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Eliminated tabbed layout (HomeTabs) -- homepage is now a single scrollable marketplace hub
- Created CategoryTiles with 4-column grid showing per-category published skill counts with color-coded cards linking to /skills?category=X
- Replaced 4 separate StatCard components with a single-line CompactStatsBar showing contributors, uses, FTE years saved, and avg rating
- Added MiniLeverageWidget showing personal impact (skills used, skills created, FTE years saved) with link to /my-leverage
- Created getCategoryCounts SQL query using Drizzle ORM GROUP BY for efficient per-category aggregation
- Updated all 13 E2E tests to verify the new layout -- all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Category counts query + three new components** - `cd16b90` (feat)
2. **Task 2: Rewrite homepage layout** - `7ea3734` (feat)

## Files Created/Modified
- `apps/web/lib/category-counts.ts` - SQL query for per-category published skill counts
- `apps/web/components/category-tiles.tsx` - 4-column responsive grid of category tiles with counts and links
- `apps/web/components/compact-stats-bar.tsx` - Single-line inline metrics banner (contributors, uses, FTE years, rating)
- `apps/web/components/mini-leverage-widget.tsx` - Compact personal impact widget with link to /my-leverage
- `apps/web/app/(protected)/page.tsx` - Rewritten from tabbed layout to single scrollable marketplace hub
- `apps/web/tests/e2e/home.spec.ts` - Updated E2E tests for new layout (13 tests, all passing)

## Decisions Made
- MiniLeverageWidget defines interfaces inline (not imported from my-leverage.ts) to prevent server-only code from leaking into client bundle
- CategoryTiles is a server component -- zero client JS for what is purely presentational
- CompactStatsBar uses FTE_DAYS_PER_YEAR constant (260) since getPlatformStats returns FTE days saved, not hours
- TrendingSection still receives no trendData prop -- sparkline naturally does not render (graceful degradation)
- Bottom CTA wording changed from "Install a Skill" to "Browse All Skills" to match the marketplace discovery theme

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated E2E tests for new homepage layout**
- **Found during:** Task 2 (Homepage rewrite)
- **Issue:** Existing home.spec.ts tests expected tabbed layout (Browse Skills tab, My Leverage tab) which no longer exists
- **Fix:** Rewrote all authenticated tests to verify new single-page layout: search hero, category tiles, trending, stats bar, leaderboard, mini leverage widget, CTAs, and absence of tabs
- **Files modified:** apps/web/tests/e2e/home.spec.ts
- **Verification:** All 13 Playwright tests pass
- **Committed in:** 7ea3734 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test update necessary to prevent broken CI. No scope creep.

## Issues Encountered
- Playwright strict mode violations on text selectors ("Prompts", "contributors", "FTE years saved") due to matching multiple elements on the redesigned page -- resolved by using heading roles and more specific regex patterns with numeric prefixes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Homepage core structure complete, ready for Phase 48-02 (further homepage enhancements if planned)
- All existing sections (company recommended, trending, leaderboard) still render correctly
- Category tiles are functional and link to filtered browse pages

---
*Phase: 48-homepage-redesign*
*Completed: 2026-02-13*
