---
phase: 44-admin-global-skills
plan: 02
subsystem: ui, api
tags: [react, next.js, drizzle, company-approved, badges, homepage]

# Dependency graph
requires:
  - phase: 44-admin-global-skills/01
    provides: "companyApproved, approvedAt, approvedBy columns on skills table"
provides:
  - "CompanyApprovedBadge component (sm/md sizes) with indigo shield-check icon"
  - "Company Recommended homepage section with approved skill cards"
  - "companyApproved field in SearchSkillResult, TrendingSkill, and SkillTableRow interfaces"
affects: [homepage, skill-detail, skill-browse, trending]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Conditional section rendering via empty array check (return null)"]

key-files:
  created:
    - "apps/web/components/company-approved-badge.tsx"
    - "apps/web/lib/company-approved.ts"
    - "apps/web/components/company-approved-section.tsx"
  modified:
    - "apps/web/lib/search-skills.ts"
    - "apps/web/lib/trending.ts"
    - "apps/web/components/skills-table.tsx"
    - "apps/web/components/skill-detail.tsx"
    - "apps/web/components/skills-table-row.tsx"
    - "apps/web/components/trending-section.tsx"
    - "apps/web/app/(protected)/page.tsx"

key-decisions:
  - "Badge uses Heroicons shield-check filled SVG for consistency with admin toggle"
  - "Indigo color scheme (bg-indigo-100, text-indigo-800, border-indigo-200) distinguishes from quality badges"
  - "Homepage section uses same grid-cols-2 layout as TrendingSection for visual consistency"

patterns-established:
  - "CompanyApprovedBadge: sm=icon only with title tooltip, md=icon+text for detail pages"

# Metrics
duration: 5min
completed: 2026-02-13
---

# Phase 44 Plan 02: Company Approved Badge and Homepage Section Summary

**CompanyApprovedBadge component (sm/md) rendered on detail pages, browse table, and trending cards, plus Company Recommended homepage section with indigo-accented skill cards**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-13T22:11:01Z
- **Completed:** 2026-02-13T22:15:57Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created CompanyApprovedBadge with sm (icon-only, 16px) and md (icon+text, 20px) size variants
- Added companyApproved field to SearchSkillResult, TrendingSkill, and SkillTableRow data flow interfaces
- Badge renders on skill detail page (md), browse table rows (sm after loom icon), and trending cards (sm next to category)
- Created getCompanyApprovedSkills query fetching published, tenant-visible, approved skills ordered by approvedAt DESC
- Created CompanyApprovedSection client component with indigo-hover cards linking to skill detail
- Integrated section into homepage between Platform Stats and Trending/Leaderboard, hidden when empty

## Task Commits

Each task was committed atomically:

1. **Task 1: Badge component and display in detail, browse, and trending** - `688081d` (feat)
2. **Task 2: Homepage Company Recommended section** - `14955a6` (feat)

## Files Created/Modified
- `apps/web/components/company-approved-badge.tsx` - Badge component with sm/md sizes and shield-check SVG
- `apps/web/lib/company-approved.ts` - Query for company-approved skills with author join
- `apps/web/components/company-approved-section.tsx` - Homepage section rendering approved skill cards
- `apps/web/lib/search-skills.ts` - Added companyApproved to SearchSkillResult interface and select
- `apps/web/lib/trending.ts` - Added company_approved to SQL SELECT and TrendingSkill interface
- `apps/web/components/skills-table.tsx` - Added companyApproved to SkillTableRow interface
- `apps/web/components/skill-detail.tsx` - Added companyApproved to SkillWithAuthor, renders md badge in header
- `apps/web/components/skills-table-row.tsx` - Renders sm badge after loom icon in name cell
- `apps/web/components/trending-section.tsx` - Renders sm badge next to category badge in card header
- `apps/web/app/(protected)/page.tsx` - Fetches approved skills in Promise.all, renders section between stats and trending

## Decisions Made
- Used same Heroicons shield-check filled SVG as admin toggle for visual consistency across the app
- Indigo color scheme differentiates company badges from quality tier badges (gold/silver/bronze)
- Homepage section uses identical 2-column grid as TrendingSection for consistent layout
- Card hover uses indigo-300 border instead of blue-300 to match badge theme

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Company-approved badges are visible across all skill surfaces
- Homepage highlights approved skills when they exist
- Future plans can add bulk approval, approval history, and approval-based search filtering

## Self-Check: PASSED

All 10 files verified present. Both commits (688081d, 14955a6) confirmed in git log. Build passes. 20 E2E tests pass (home.spec.ts + skill-search.spec.ts).

---
*Phase: 44-admin-global-skills*
*Completed: 2026-02-13*
