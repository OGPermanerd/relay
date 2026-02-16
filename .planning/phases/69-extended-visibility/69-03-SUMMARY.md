---
phase: 69-extended-visibility
plan: 03
subsystem: ui
tags: [react, visibility, radio-buttons, badge, admin]

# Dependency graph
requires:
  - phase: 69-extended-visibility
    provides: "visibility column with CHECK constraint, VISIBILITY_LEVELS array, isOrgVisible helper"
provides:
  - "Upload form with 4 visibility radio options (Team, Personal, Private, Global)"
  - "Admin-conditional Global option in upload form"
  - "VisibilityBadge component handling all 4 levels in portfolio and resume"
affects: [skill-editing, admin-dashboard, skill-detail-page]

# Tech tracking
tech-stack:
  added: []
  patterns: ["server-side admin detection passed as prop to client component"]

key-files:
  created: []
  modified:
    - apps/web/app/(protected)/skills/new/page.tsx
    - apps/web/components/skill-upload-form.tsx
    - apps/web/components/portfolio-view.tsx
    - apps/web/components/resume-view.tsx

key-decisions:
  - "Server-side admin resolution via auth() + isAdmin() passed as boolean prop -- avoids client-side auth checks"
  - "Private uses gray styling (muted), Global uses purple (elevated/special)"
  - "flex-wrap layout for radio buttons to handle 4 options on smaller screens"

patterns-established:
  - "Admin-gated UI: resolve isAdmin in server component, pass as prop to client"
  - "VisibilityBadge switch pattern: Global=purple, Company=blue, Portable=green, Private=gray"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 69 Plan 03: UI Visibility Controls Summary

**Upload form with 4 visibility radio buttons (Team/Personal/Private/Global-admin-only) and VisibilityBadge updated for all levels in portfolio and resume views**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T19:45:32Z
- **Completed:** 2026-02-16T19:49:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Upload form now shows Team, Personal, Private for all users and Global for admins
- Server component resolves admin status via auth() + isAdmin() and passes as prop
- VisibilityBadge in both portfolio and resume views handles all 4 visibility levels with distinct colors
- Default visibility remains "tenant" (Team)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update upload form with 4 visibility options and admin detection** - `9befc5b` (feat)
2. **Task 2: Update VisibilityBadge in portfolio and resume views** - `289bea2` (feat)

## Files Created/Modified
- `apps/web/app/(protected)/skills/new/page.tsx` - Server component now async, calls auth() + isAdmin(), passes boolean prop
- `apps/web/components/skill-upload-form.tsx` - Accepts isAdmin prop, renders 4 visibility radio buttons with admin-conditional Global
- `apps/web/components/portfolio-view.tsx` - VisibilityBadge switch with Global (purple), Company (blue), Portable (green), Private (gray)
- `apps/web/components/resume-view.tsx` - Identical VisibilityBadge update as portfolio

## Decisions Made
- Server-side admin resolution passed as prop rather than client-side auth check -- keeps auth logic server-only
- Purple for Global (stands out as elevated), gray for Private (muted/hidden) -- consistent with badge color conventions
- Used flex-wrap layout for radio group to accommodate 4 options on mobile

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 plans in Phase 69 now complete
- Visibility column, RLS policies, upload form, and badge display all updated for 4-level visibility
- Ready for Phase 70 (next phase in v7.0 roadmap)

## Self-Check: PASSED

All 4 modified files exist. Both task commits (9befc5b, 289bea2) verified in git log.

---
*Phase: 69-extended-visibility*
*Completed: 2026-02-16*
