---
phase: 14-mobile-accessibility-polish
plan: 05
subsystem: ui
tags: [a11y, keyboard-navigation, roving-tabindex, aria, swipe-gestures, react-swipeable]

# Dependency graph
requires:
  - phase: 14-01
    provides: Responsive panel layout with mobile stacking
  - phase: 14-02
    provides: useRovingTabindex hook for keyboard navigation
provides:
  - Fully accessible, keyboard-navigable skills table
  - Focus-triggered accordion expansion
  - Swipe-to-install gesture for mobile
  - Complete ARIA attributes (aria-expanded, aria-controls)
affects: []

# Tech tracking
tech-stack:
  added: [react-swipeable@7.0.2]
  patterns: [roving-tabindex, focus-triggered-expansion, swipe-gestures]

key-files:
  created: []
  modified:
    - apps/web/components/skills-table.tsx
    - apps/web/components/skills-table-row.tsx
    - apps/web/hooks/use-expanded-rows.ts
    - apps/web/components/skill-accordion-content.tsx

key-decisions:
  - "Spread swipeHandlers before ref to prevent ref overwrite"
  - "80px delta threshold for swipe gesture activation"
  - "Blur-to-collapse checks if focus moved to accordion content before collapsing"

patterns-established:
  - "Focus-triggered expansion: expandRow on focus, collapseRow on blur unless focus in accordion"
  - "Roving tabindex with single column (row-level focus only)"
  - "Enter key navigates to detail page via router.push"

# Metrics
duration: 9min
completed: 2026-02-01
---

# Phase 14 Plan 05: Keyboard Navigation and Accessibility Summary

**Fully accessible skills table with roving tabindex keyboard navigation, ARIA accordion attributes, focus-triggered expansion, and mobile swipe-to-install gestures**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-01T15:49:43Z
- **Completed:** 2026-02-01T15:58:20Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments
- Keyboard navigation via roving tabindex (Tab to enter, Arrow keys to move between rows)
- Enter key on focused row navigates to skill detail page
- Focus on row automatically expands accordion, blur collapses (unless focus in accordion content)
- Complete ARIA attributes: aria-expanded on rows, aria-controls linking to accordion id
- Mobile swipe left/right triggers install action (80px threshold)
- Visible focus ring (ring-2 ring-blue-500 ring-inset) for keyboard users

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-swipeable** - `f06acc8` (chore)
2. **Task 2: Update useExpandedRows for focus-triggered expansion** - `5b60f5e` (feat)
3. **Task 3: Add keyboard navigation and ARIA to SkillsTable** - `7a43fb3` (feat)
4. **Task 4: Add ARIA attributes and swipe gestures to SkillsTableRow** - `1e59820` (feat)

## Files Created/Modified
- `apps/web/package.json` - Added react-swipeable dependency
- `apps/web/hooks/use-expanded-rows.ts` - Added expandRow and collapseRow functions
- `apps/web/components/skills-table.tsx` - Integrated roving tabindex, focus handlers, role="grid"
- `apps/web/components/skills-table-row.tsx` - Added ARIA attributes, swipe handlers, focus/blur handlers
- `apps/web/components/skill-accordion-content.tsx` - Added id attribute for aria-controls linkage

## Decisions Made
- Spread swipeHandlers before ref in JSX to prevent TypeScript "ref specified more than once" error
- 80px delta threshold for swipe gestures balances sensitivity with accidental activation prevention
- Blur handler checks relatedTarget to prevent collapse when focus moves to accordion content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript error "ref is specified more than once" when swipeHandlers spread after ref - resolved by moving spread before ref

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 14 complete - all accessibility and mobile polish tasks finished
- v1.2 UI Redesign milestone ready for completion audit

---
*Phase: 14-mobile-accessibility-polish*
*Completed: 2026-02-01*
