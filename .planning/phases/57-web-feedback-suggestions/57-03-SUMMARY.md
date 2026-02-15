---
phase: 57-web-feedback-suggestions
plan: 03
subsystem: ui
tags: [react, tailwind, client-components, suggestion-management, status-badges, author-actions]

# Dependency graph
requires:
  - phase: 57-web-feedback-suggestions
    provides: createSuggestion, getSuggestionsForSkill, updateSuggestionStatus, replySuggestion DB services and server actions
provides:
  - SuggestionCard client component with status/severity badges and author action buttons
  - SuggestionList client component with status filter tabs and author/non-author views
  - Complete suggestion review workflow on skill detail Suggestions tab
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [useState + async handler for server action invocation (same as admin-review-detail), UTC-safe relative time formatting]

key-files:
  created:
    - apps/web/components/suggestion-card.tsx
    - apps/web/components/suggestion-list.tsx
  modified:
    - apps/web/app/(protected)/skills/[slug]/page.tsx

key-decisions:
  - "Direct useState + async handler pattern (not useActionState) for action buttons -- matches admin-review-detail.tsx pattern for consistency"
  - "Reply button available on all statuses (pending, accepted, implemented) so author can communicate at any lifecycle stage"
  - "SuggestionList returns null for unauthenticated users (form already handles that UX)"

patterns-established:
  - "Suggestion card action pattern: useState for pending state per action type, FormData construction inline, router.refresh() after success"
  - "Filter tabs with count badges on pill buttons for status filtering in list components"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 57 Plan 03: Suggestion List & Management UI Summary

**Suggestion card with status/severity badges, author Accept/Dismiss/Reply/Implement actions, filter tabs, and skill detail page wiring**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T15:43:15Z
- **Completed:** 2026-02-15T15:46:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- SuggestionCard component with colored status badges (Open/Accepted/Dismissed/Implemented), severity badges (Nice to Have/Important/Critical), category labels, and collapsible reply textarea
- Author action buttons with loading states: Accept, Dismiss, Reply (pending); Mark Implemented, Dismiss (accepted); Reopen (dismissed)
- SuggestionList with filter tab bar (All/Open/Accepted/Dismissed/Implemented) showing counts, status-sorted display
- Non-author view filtered to only their own suggestions with "no suggestions yet" empty state
- Skill detail page wired with serialized suggestions passed to SuggestionList in Suggestions tab

## Task Commits

Each task was committed atomically:

1. **Task 1: Suggestion card and list components** - `f92820b` (feat)
2. **Task 2: Wire suggestion list into skill detail page** - `b4c2906` (feat)

## Files Created/Modified
- `apps/web/components/suggestion-card.tsx` - Client component: individual suggestion display with status/severity badges, author reply box, action buttons (Accept/Dismiss/Reply/Implement/Reopen) with loading states
- `apps/web/components/suggestion-list.tsx` - Client component: filterable list of suggestion cards with author vs non-author views, status sorting, filter tab bar with counts
- `apps/web/app/(protected)/skills/[slug]/page.tsx` - Added SuggestionList import, suggestion Date serialization, wired SuggestionList into suggestionsContent prop

## Decisions Made
- Used direct useState + async handler pattern (not useActionState with form) for action buttons, matching the established admin-review-detail.tsx pattern for consistency across the codebase
- Reply button shown on all statuses except dismissed (pending, accepted, implemented) so authors can communicate at any lifecycle stage
- SuggestionList returns null for unauthenticated users since the parent already renders a "sign in" message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete suggestion workflow: submit, view, filter, accept/dismiss/reply/implement/reopen
- All 3 plans in Phase 57 complete -- web feedback and suggestions feature fully shipped
- No Playwright E2E test exists specifically for the suggestions tab (gap noted; hydration tests pass)

## Self-Check: PASSED

All 3 files verified present. Both commits (f92820b, b4c2906) verified in git log.

---
*Phase: 57-web-feedback-suggestions*
*Completed: 2026-02-15*
