---
phase: 59-suggestion-to-fork-pipeline
plan: 02
subsystem: ui, api
tags: [suggestion-card, fork, accept-and-fork, apply-inline, auto-implement, publish-hooks]

# Dependency graph
requires:
  - phase: 59-suggestion-to-fork-pipeline
    plan: 01
    provides: acceptAndForkSuggestion, applyInlineSuggestion server actions, autoImplementLinkedSuggestions DB service, implementedBySkillId column
provides:
  - Accept & Fork and Apply Inline buttons on suggestion cards
  - Traceability link showing "Implemented in: [Skill Name]" on linked suggestions
  - Auto-implement hook in submitForReview (auto-approve path)
  - Auto-implement hook in approveSkillAction (admin approve path)
  - getSuggestionsForSkill returns implemented-by skill slug and name via join
affects: [skill-detail-page, suggestion-lifecycle, fork-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: [redirect-safe error handling in client handlers, fire-and-forget auto-implement hooks in publish flows]

key-files:
  created: []
  modified:
    - apps/web/components/suggestion-card.tsx
    - packages/db/src/services/skill-feedback.ts
    - apps/web/app/actions/submit-for-review.ts
    - apps/web/app/actions/admin-reviews.ts

key-decisions:
  - "Accept & Fork replaces the old Accept button on pending suggestions -- forking is the primary acceptance action"
  - "Both pending and accepted suggestions show Accept & Fork and Apply Inline buttons for flexibility"
  - "Redirect-safe error handling: re-throw Next.js redirect digest errors, catch only real errors"
  - "autoImplementLinkedSuggestions placed before embedding generation in both publish paths"

patterns-established:
  - "Suggestion traceability: implemented suggestions link to resulting fork/skill with navigable UI"
  - "Publish hook pattern: fire-and-forget autoImplementLinkedSuggestions after skill reaches published status"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 59 Plan 02: Suggestion-to-Fork Pipeline UI & Publish Hooks Summary

**Accept & Fork and Apply Inline buttons on suggestion cards, traceability links to implemented forks, and auto-implement hooks in both publish paths (auto-approve and admin approve)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T16:53:47Z
- **Completed:** 2026-02-15T16:58:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added Accept & Fork and Apply Inline action buttons to pending and accepted suggestion cards, replacing the old simple Accept button
- Added traceability link showing "Implemented in: [Skill Name]" for suggestions linked to a fork/skill
- Extended getSuggestionsForSkill with left join to skills table for implemented-by metadata (slug, name)
- Added fire-and-forget autoImplementLinkedSuggestions hooks to both submitForReview and approveSkillAction

## Task Commits

Each task was committed atomically:

1. **Task 1: Suggestion card UI -- Accept & Fork, Apply Inline, and traceability link** - `cc62393` (feat)
2. **Task 2: Auto-implement hooks in publish flows** - `84b365b` (feat)

## Files Created/Modified
- `apps/web/components/suggestion-card.tsx` - Added imports, new interface fields, handleAcceptAndFork/handleApplyInline handlers, new buttons for pending/accepted statuses, traceability link
- `packages/db/src/services/skill-feedback.ts` - Extended SuggestionWithUser with implementedBySkillSlug/Name, added leftJoin in getSuggestionsForSkill
- `apps/web/app/actions/submit-for-review.ts` - Added autoImplementLinkedSuggestions import and fire-and-forget call after auto-approve publish
- `apps/web/app/actions/admin-reviews.ts` - Added autoImplementLinkedSuggestions import and fire-and-forget call after admin approve publish

## Decisions Made
- Accept & Fork replaces the old Accept button on pending suggestions -- forking is the primary acceptance action for the suggestion-to-fork pipeline
- Both pending and accepted suggestions show Accept & Fork and Apply Inline (when suggestedContent exists) for maximum flexibility
- Used redirect-safe error handling pattern: re-throw Next.js redirect digest errors (navigation signals) and only catch real errors
- autoImplementLinkedSuggestions placed before embedding generation in both publish paths, but after the publish status update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 59 (Suggestion-to-Fork Pipeline) is now complete
- Full pipeline works: user submits suggestion -> author sees Accept & Fork or Apply Inline -> fork is created and linked -> when fork is published, suggestion auto-transitions to "implemented"
- Traceability links provide navigation from suggestions to resulting forks/skills

## Self-Check: PASSED

- All 4 modified files exist on disk
- Both commit hashes (cc62393, 84b365b) found in git log
- acceptAndForkSuggestion and applyInlineSuggestion imported in suggestion-card.tsx
- autoImplementLinkedSuggestions imported in both submit-for-review.ts and admin-reviews.ts
- SuggestionCardData includes implementedBySkillId/Slug/Name
- getSuggestionsForSkill includes implementedSkillAlias join
- Hydration E2E tests pass (3/3)

---
*Phase: 59-suggestion-to-fork-pipeline*
*Completed: 2026-02-15*
