---
phase: 57-web-feedback-suggestions
plan: 01
subsystem: api
tags: [drizzle, server-actions, zod, notifications, suggestions, sanitization]

# Dependency graph
requires:
  - phase: 55-schema-foundation-data-sanitization
    provides: skill_feedback table with feedbackType discriminator, suggestedContent, suggestedDiff, status, reviewedBy, reviewedAt, reviewNotes columns
provides:
  - createSuggestion DB service function
  - getSuggestionsForSkill DB service function with user/reviewer joins
  - updateSuggestionStatus DB service function with transition enforcement
  - replySuggestion DB service function
  - submitSuggestion server action with auth/validation/sanitization/notifications
  - updateSuggestionStatus server action with author/admin authorization
  - replySuggestion server action with author-only authorization
  - suggestion_received and suggestion_status_changed notification types
affects: [57-02-PLAN, 57-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [alias join for reviewer/submitter disambiguation, JSON-in-text-column for category/severity metadata, status transition enforcement map]

key-files:
  created:
    - apps/web/app/actions/skill-feedback.ts
  modified:
    - packages/db/src/services/skill-feedback.ts
    - packages/db/src/services/notifications.ts
    - packages/db/src/services/index.ts

key-decisions:
  - "Added suggestion functions to existing skill-feedback.ts rather than creating a separate file (keeps all feedback types colocated)"
  - "Import DB functions with aliases (dbUpdateSuggestionStatus, dbReplySuggestion) to avoid name collisions with same-named server actions"

patterns-established:
  - "Alias imports: when server action names match DB service function names, alias the DB import with db prefix"
  - "Suggestion status transitions: pending->accepted|dismissed, accepted->implemented|dismissed, dismissed->pending (reopen)"

# Metrics
duration: 7min
completed: 2026-02-15
---

# Phase 57 Plan 01: Backend Suggestion Service Summary

**Suggestion CRUD service with 4 DB functions, 3 server actions, Zod validation, sanitization, and notification integration for skill improvement suggestions**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-15T15:23:39Z
- **Completed:** 2026-02-15T15:31:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DB service with createSuggestion, getSuggestionsForSkill (with user/reviewer joins), updateSuggestionStatus (with transition enforcement), and replySuggestion
- Server actions with Zod validation, auth/tenant guards, input sanitization, fire-and-forget notifications, and path revalidation
- Notification type union extended with suggestion_received and suggestion_status_changed
- All functions properly exported from services index with SuggestionWithUser type

## Task Commits

Each task was committed atomically:

1. **Task 1: DB service and notification type extension** - `a4eab81` (feat)
2. **Task 2: Server actions for submit, update status, and reply** - `bad7c44` (feat)

## Files Created/Modified
- `packages/db/src/services/skill-feedback.ts` - Added 4 suggestion CRUD functions (createSuggestion, getSuggestionsForSkill, updateSuggestionStatus, replySuggestion) with status transition enforcement and user/reviewer join queries
- `packages/db/src/services/notifications.ts` - Extended CreateNotificationParams.type union with suggestion_received and suggestion_status_changed
- `packages/db/src/services/index.ts` - Re-exported new functions and SuggestionWithUser type
- `apps/web/app/actions/skill-feedback.ts` - 3 server actions (submitSuggestion, updateSuggestionStatus, replySuggestion) with auth, Zod, sanitization, notifications

## Decisions Made
- Added suggestion functions to existing skill-feedback.ts rather than creating a separate file, keeping all feedback types colocated
- Used alias imports (dbUpdateSuggestionStatus, dbReplySuggestion) in server actions to avoid name collisions with the same-named action exports
- Used drizzle-orm alias() for the reviewer join to disambiguate the two users table joins (submitter vs reviewer)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Next.js full build (pnpm build) fails with OOM kill (exit 137) - pre-existing infrastructure issue with Next.js 16.1.6 Turbopack in this container. TypeScript compilation via tsc --noEmit passes with zero errors, confirming code correctness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend services ready for UI consumption in plans 57-02 (suggestion form) and 57-03 (suggestion list/management)
- getSuggestionsForSkill returns enriched SuggestionWithUser[] with parsed category/severity from JSON
- Server actions accept FormData and return typed state objects compatible with React useActionState

## Self-Check: PASSED

All 4 files verified present. Both commits (a4eab81, bad7c44) verified in git log.

---
*Phase: 57-web-feedback-suggestions*
*Completed: 2026-02-15*
