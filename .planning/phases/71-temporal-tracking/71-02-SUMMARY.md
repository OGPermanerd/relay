---
phase: 71-temporal-tracking
plan: 02
subsystem: ui
tags: [temporal-tracking, change-detection, server-actions, next.js, amber-theme]

# Dependency graph
requires:
  - phase: 71-01
    provides: getUserView, recordSkillView, getVersionNumber, countFeedbackSince service functions
provides:
  - Change detection logic (detectChanges) comparing skill state against last user view
  - ChangeSummary client component with amber-themed change list
  - View recording on skill detail page load (fire-and-forget UPSERT)
  - recordView server action wrapping recordSkillView with auth
affects: [71-03 (What's New page), temporal-tracking UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [compute-before-record, fire-and-forget-view-tracking, change-detection-pipeline]

key-files:
  created:
    - apps/web/lib/change-detection.ts
    - apps/web/app/actions/skill-views.ts
    - apps/web/components/change-summary.tsx
  modified:
    - apps/web/app/(protected)/skills/[slug]/page.tsx

key-decisions:
  - "Auth import uses @/auth (codebase convention) not @/lib/auth (plan reference)"
  - "Changes computed BEFORE recording view to preserve comparison baseline (pitfall TEMP-03)"
  - "ChangeSummary placed after SkillDetail and before Install/Fork/Delete buttons"
  - "View recording is fire-and-forget with .catch(() => {}) — never blocks page render"

patterns-established:
  - "Temporal change detection: fetch previous view -> detect changes -> record new view (strict ordering)"
  - "Fire-and-forget server-side calls: wrap in try/catch or .catch(() => {}) for non-critical operations"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 71 Plan 02: View Tracking & Change Summary Summary

**Skill detail page records user views via UPSERT, detects version bumps and new feedback since last visit, and renders amber-themed ChangeSummary component**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T21:34:49Z
- **Completed:** 2026-02-16T21:38:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created change detection pipeline: detectChanges() identifies version bumps and new feedback since last view
- Created ChangeSummary client component with amber color scheme (border-amber-200, bg-amber-50/50) and per-type icons
- Wired view tracking into skill detail page with correct ordering (compute changes BEFORE recording view)
- Created recordView server action with auth guard and fire-and-forget semantics
- All E2E tests pass (skill-rating, hydration) confirming no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create change detection logic and server action** - `400379a` (feat)
2. **Task 2: Create ChangeSummary component and wire into skill detail page** - `3130090` (feat)

## Files Created/Modified
- `apps/web/lib/change-detection.ts` - detectChanges() function and ChangeItem interface for computing version bumps and new feedback count
- `apps/web/app/actions/skill-views.ts` - recordView server action wrapping recordSkillView with auth session
- `apps/web/components/change-summary.tsx` - Client component rendering amber change list with per-type icons (arrow-up, chat-bubble, pencil)
- `apps/web/app/(protected)/skills/[slug]/page.tsx` - Added imports, temporal tracking block (getUserView -> detectChanges -> recordSkillView), and ChangeSummary rendering

## Decisions Made
- Used `@/auth` import (codebase convention) instead of `@/lib/auth` (plan reference) -- consistent with all other server actions
- Placed ChangeSummary after SkillDetail component but before action buttons -- logically separates content display from user actions
- Used direct `recordSkillView` call in page (not the server action) since page is already server-side -- avoids unnecessary action overhead
- Strict compute-before-record ordering prevents losing the comparison baseline

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed auth import path**
- **Found during:** Task 1
- **Issue:** Plan specified `import { auth } from "@/lib/auth"` but codebase uses `import { auth } from "@/auth"`
- **Fix:** Used codebase convention `@/auth` in server action
- **Files modified:** apps/web/app/actions/skill-views.ts
- **Verification:** Typecheck passes, consistent with all other server actions
- **Committed in:** 400379a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial import path correction. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- View tracking and change detection fully operational on skill detail page
- Ready for Plan 03 (What's New page) which will use getWhatsNewForUser
- No blockers

## Self-Check: PASSED

All 3 files verified present. Both commit hashes (400379a, 3130090) found in git log.

---
*Phase: 71-temporal-tracking*
*Completed: 2026-02-16*
