---
phase: 59-suggestion-to-fork-pipeline
plan: 01
subsystem: api, database
tags: [drizzle, server-actions, fork, suggestion, skill-feedback, migration]

# Dependency graph
requires:
  - phase: 57-web-feedback-suggestions
    provides: suggestion-card.tsx, updateSuggestionStatus, skill-feedback.ts service
provides:
  - implementedBySkillId column on skill_feedback table
  - linkSuggestionToSkill() and autoImplementLinkedSuggestions() DB service functions
  - acceptAndForkSuggestion() server action (creates fork from suggestion)
  - applyInlineSuggestion() server action (updates skill content inline)
  - Shared frontmatter utility at apps/web/lib/frontmatter.ts
affects: [59-02-PLAN, publish hooks, skill detail UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared frontmatter extraction, suggestion-to-fork linking via implementedBySkillId]

key-files:
  created:
    - packages/db/src/migrations/0034_add_implemented_by_skill_id.sql
    - apps/web/lib/frontmatter.ts
  modified:
    - packages/db/src/schema/skill-feedback.ts
    - packages/db/src/services/skill-feedback.ts
    - packages/db/src/relations/index.ts
    - apps/web/app/actions/skill-feedback.ts
    - apps/web/app/actions/skills.ts

key-decisions:
  - "Extracted frontmatter helpers to shared lib/frontmatter.ts to avoid duplication across skill-feedback and skills actions"
  - "acceptAndForkSuggestion uses direct async handler pattern (not useActionState) matching existing suggestion-card.tsx pattern"
  - "applyInlineSuggestion marks suggestion as 'implemented' (not 'accepted') since content is applied immediately"
  - "autoImplementLinkedSuggestions designed as fire-and-forget for publish hook integration (Plan 02)"

patterns-established:
  - "Suggestion-to-fork traceability: implementedBySkillId links feedback rows to resulting skills"
  - "Shared frontmatter utility: import from @/lib/frontmatter instead of local functions"

# Metrics
duration: 6min
completed: 2026-02-15
---

# Phase 59 Plan 01: Suggestion-to-Fork Pipeline Backend Summary

**Schema migration for implementedBySkillId, DB service functions for fork linking, and two server actions (Accept & Fork, Apply Inline) with shared frontmatter extraction**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-15T16:44:37Z
- **Completed:** 2026-02-15T16:50:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added `implemented_by_skill_id` column to `skill_feedback` table with FK to skills and index
- Created `linkSuggestionToSkill()` and `autoImplementLinkedSuggestions()` DB service functions
- Built `acceptAndForkSuggestion` server action that creates fork pre-populated with suggestion content and redirects to fork with `?improve=1`
- Built `applyInlineSuggestion` server action that updates skill content inline, creates version record, and marks suggestion as implemented
- Extracted frontmatter helpers to shared utility at `apps/web/lib/frontmatter.ts`, fixing `relay_` regex bug

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration and DB service functions** - `47eeb23` (feat)
2. **Task 2: Accept & Fork and Apply Inline server actions** - `2708d2c` (feat)

## Files Created/Modified
- `packages/db/src/migrations/0034_add_implemented_by_skill_id.sql` - Migration adding implemented_by_skill_id column and index
- `packages/db/src/schema/skill-feedback.ts` - Added implementedBySkillId column definition and index
- `packages/db/src/relations/index.ts` - Added implementedBySkill relation to skillFeedbackRelations
- `packages/db/src/services/skill-feedback.ts` - Added linkSuggestionToSkill, autoImplementLinkedSuggestions, updated SuggestionWithUser and getSuggestionsForSkill
- `apps/web/lib/frontmatter.ts` - New shared utility with buildEverySkillFrontmatter and stripEverySkillFrontmatter
- `apps/web/app/actions/skills.ts` - Replaced local frontmatter functions with imports from shared utility
- `apps/web/app/actions/skill-feedback.ts` - Added acceptAndForkSuggestion and applyInlineSuggestion server actions

## Decisions Made
- Extracted frontmatter helpers to shared `lib/frontmatter.ts` rather than duplicating across server action files
- Used direct async handler pattern (not useActionState) for both new actions, matching the existing suggestion-card.tsx button handler pattern
- `applyInlineSuggestion` marks suggestion as "implemented" directly (skipping "accepted") since content is applied immediately
- `autoImplementLinkedSuggestions` returns count for logging but is designed as fire-and-forget for publish hooks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed relay_ regex in stripEverySkillFrontmatter**
- **Found during:** Task 2 (frontmatter extraction)
- **Issue:** `stripEverySkillFrontmatter` in skills.ts checked for `relay_` prefix instead of `everyskill_` (leftover from rebrand)
- **Fix:** Corrected regex to `/^everyskill_/m` in the extracted shared utility
- **Files modified:** apps/web/lib/frontmatter.ts
- **Verification:** Typecheck passes
- **Committed in:** 2708d2c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential bug fix for correctness of frontmatter stripping. No scope creep.

## Issues Encountered
- Parallel agent (Phase 58) committed skill-feedback.ts changes that included my uncommitted edits, so Task 2's commit only needed the frontmatter.ts and skills.ts changes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend foundation complete for Plan 02 (UI wiring and publish hooks)
- `acceptAndForkSuggestion` and `applyInlineSuggestion` are ready to be wired to suggestion-card.tsx buttons
- `autoImplementLinkedSuggestions` is ready to be called from publish hooks
- `implementedBySkillId` field available on `SuggestionWithUser` for UI to show linked fork status

## Self-Check: PASSED

- All 7 files exist on disk
- Both commit hashes (47eeb23, 2708d2c) found in git log
- acceptAndForkSuggestion, applyInlineSuggestion exported from server actions
- autoImplementLinkedSuggestions, linkSuggestionToSkill exported from DB service
- implementedBySkillId present in schema
- Column verified in database via psql

---
*Phase: 59-suggestion-to-fork-pipeline*
*Completed: 2026-02-15*
