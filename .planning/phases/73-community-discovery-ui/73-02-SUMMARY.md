---
phase: 73-community-discovery-ui
plan: 02
subsystem: ui
tags: [nextjs, server-components, tailwind, community-discovery, dashboard]

# Dependency graph
requires:
  - phase: 73-community-discovery-ui
    plan: 01
    provides: "getCommunities, getCommunityDetail query functions + CommunityOverview/CommunityDetail types"
provides:
  - "Community browse page at /communities with responsive card grid"
  - "Community detail page at /communities/[id] with similarity-ranked skill list"
  - "Dashboard communities section showing top 3 with View All link"
  - "Reusable CommunityCard component"
affects: [73-03 further community UI refinements]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Server component pages fetching from @everyskill/db barrel", "Community card as Link with pill badges"]

key-files:
  created:
    - "apps/web/components/community-card.tsx"
    - "apps/web/app/(protected)/communities/page.tsx"
    - "apps/web/app/(protected)/communities/[communityId]/page.tsx"
  modified:
    - "apps/web/app/(protected)/page.tsx"
    - "apps/web/tests/e2e/home.spec.ts"

key-decisions:
  - "CommunityCard renders as Link wrapping card content (not separate button) for full-card clickability"
  - "Detail page uses div-based skill list (not HTML table) for responsive mobile layout"
  - "Dashboard shows max 3 communities (top by member count) with View All link"
  - "Community description included in card accessible name; E2E test scoped by href to avoid ambiguity"

patterns-established:
  - "Community browse/detail pattern: auth guard, server component, getCommunities/getCommunityDetail from barrel"
  - "Similarity color coding: >=80% green, >=60% yellow, <60% gray"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 73 Plan 02: Community Browse & Detail Pages Summary

**Responsive community browse page with card grid, detail page with similarity-ranked skills, and dashboard section showing top 3 communities**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-16T22:42:41Z
- **Completed:** 2026-02-16T22:49:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Community browse page at /communities renders responsive grid of CommunityCard components with AI labels, descriptions, member counts, and top skill pills
- Community detail page at /communities/[id] shows community header, description, stats, and member skills ranked by centroid similarity with color-coded percentage scores
- Dashboard "Skill Communities" section appears between Category Tiles and Company Recommended with top 3 communities and "View all" link
- All navigation works: card -> detail, skill name -> skill page, back link, view all link
- Empty state handled gracefully with helpful message

## Task Commits

Each task was committed atomically:

1. **Task 1: Community card component + browse page** - `c27defa` (feat)
2. **Task 2: Community detail page + dashboard section** - `13446fc` (feat)

## Files Created/Modified
- `apps/web/components/community-card.tsx` - Reusable card with label, description, member count, top skill pills
- `apps/web/app/(protected)/communities/page.tsx` - Browse page with responsive grid and empty state
- `apps/web/app/(protected)/communities/[communityId]/page.tsx` - Detail page with similarity-ranked skill list and dynamic metadata
- `apps/web/app/(protected)/page.tsx` - Dashboard updated with communities section (imports, Promise.all, JSX)
- `apps/web/tests/e2e/home.spec.ts` - Fixed category tiles test to scope by href (avoid community card text collision)

## Decisions Made
- CommunityCard renders as full-card Link (click anywhere to navigate) matching existing card patterns
- Detail page uses flex div layout (not HTML table) for responsive mobile support
- Dashboard limited to 3 communities max with "View all" overflow
- Similarity color coding: green >= 80%, yellow >= 60%, gray < 60%

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed E2E test category tiles assertion colliding with community card text**
- **Found during:** Task 2 (dashboard integration)
- **Issue:** Community card for "Duplicate Detection Verification" has description containing "productivity workflows" + "37 skills" member count, matching the regex `/Productivity.*skills/i` used by the category tiles E2E test
- **Fix:** Changed test to scope by href `a[href="/skills?type=productivity"]` instead of accessible name regex
- **Files modified:** apps/web/tests/e2e/home.spec.ts
- **Verification:** All 13 home E2E tests pass
- **Committed in:** 13446fc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test fix necessary for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Community browse and detail pages fully functional
- Dashboard integration complete
- Ready for any Phase 73 plan 03 refinements (if planned)
- All navigation paths verified working

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 73-community-discovery-ui*
*Completed: 2026-02-16*
