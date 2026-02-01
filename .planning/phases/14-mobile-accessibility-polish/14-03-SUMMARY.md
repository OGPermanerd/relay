---
phase: 14-mobile-accessibility-polish
plan: 03
subsystem: ui
tags: [accessibility, aria-sort, screen-reader, a11y, wcag]

# Dependency graph
requires:
  - phase: 14-02
    provides: announceToScreenReader utility in lib/accessibility.ts
  - phase: 12-01
    provides: SortableColumnHeader component
  - phase: 12-02
    provides: SkillsTable with sort state
provides:
  - aria-sort attribute on sorted column headers for screen readers
  - Sort change announcements via live region
  - Decorative icons hidden from assistive technology
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ARIA live region for dynamic content announcements"
    - "Skip initial mount announcements with useRef pattern"

key-files:
  created: []
  modified:
    - apps/web/components/sortable-column-header.tsx
    - apps/web/components/skills-table.tsx

key-decisions:
  - "Omit aria-sort on non-sorted columns per Adrian Roselli guidance (not aria-sort='none')"
  - "Use isInitialMount ref to prevent announcement on page load"

patterns-established:
  - "COLUMN_LABELS mapping for human-readable column names in announcements"

# Metrics
duration: 5min
completed: 2026-02-01
---

# Phase 14 Plan 03: Screen Reader Sort Indicators Summary

**aria-sort attributes on sortable column headers with live region announcements for sort changes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-01T15:42:59Z
- **Completed:** 2026-02-01T15:47:44Z
- **Tasks:** 2 (1 already complete, 1 implemented)
- **Files modified:** 1 (sortable-column-header.tsx was already updated)

## Accomplishments

- Column headers indicate sort state via aria-sort attribute (ascending/descending)
- Sort changes trigger screen reader announcements with column name and direction
- Decorative chevron icons hidden from assistive technology
- No announcement on initial page load (only user-triggered changes)

## Task Commits

Note: Task 1 (aria-sort on SortableColumnHeader) was already implemented in a prior plan (commit 84bfe3a or earlier). The attributes were already present in HEAD.

1. **Task 1: Add aria-sort to SortableColumnHeader** - Already present (no commit needed)
2. **Task 2: Add sort change announcements** - `c5027b5` (feat)

## Files Created/Modified

- `apps/web/components/sortable-column-header.tsx` - Already had aria-sort={ariaSortValue} and aria-hidden="true" on SVG
- `apps/web/components/skills-table.tsx` - Added announceToScreenReader import and useEffect for sort change announcements

## Decisions Made

- **Omit aria-sort on non-sorted columns:** Per WCAG best practices and Adrian Roselli's guidance, aria-sort is only set on the active sorted column. Non-sorted columns have no aria-sort attribute at all (not "none").
- **Skip initial mount:** Using useRef to track initial render prevents announcing sort state when page loads, which would be disruptive. Only user-triggered sort changes are announced.
- **Human-readable column labels:** COLUMN_LABELS mapping converts internal column identifiers (days_saved, installs) to user-friendly names ("Days Saved", "Installs") for clearer announcements.

## Deviations from Plan

None - Task 1 was already complete in codebase. Task 2 executed exactly as specified.

## Issues Encountered

- **Task 1 already implemented:** The aria-sort and aria-hidden attributes were already present in the sortable-column-header.tsx file from a prior plan execution. This was discovered when the lint-staged pre-commit hook rejected an "empty commit" (no changes after formatting). The changes exist and work correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- A11Y-03 requirement satisfied: sort indicators are screen reader accessible
- Screen reader users can now:
  - Identify which column is sorted and in what direction via aria-sort
  - Hear announcements when sort changes ("Table sorted by Days Saved, descending")
- Ready to continue with remaining Phase 14 plans

---
*Phase: 14-mobile-accessibility-polish*
*Completed: 2026-02-01*
