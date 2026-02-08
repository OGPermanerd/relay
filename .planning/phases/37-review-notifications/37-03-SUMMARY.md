---
phase: 37-review-notifications
plan: 03
subsystem: api
tags: [notifications, server-actions, review-lifecycle, fire-and-forget]

# Dependency graph
requires:
  - phase: 37-01
    provides: "notification DB tables and getAdminsInTenant service"
  - phase: 37-02
    provides: "notifyReviewEvent dispatch function and email templates"
provides:
  - "RVNT-01 through RVNT-05 wired to review lifecycle trigger points"
  - "All 5 review notification events dispatched from server actions"
affects: [37-04, review-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fire-and-forget notification dispatch after DB transactions", "nullable authorId null-guard before user lookup"]

key-files:
  created: []
  modified:
    - apps/web/app/actions/submit-for-review.ts
    - apps/web/app/actions/admin-reviews.ts

key-decisions:
  - "Auto-approved skills send ONLY RVNT-05 (published) to author, NOT RVNT-01 (no admin review needed)"
  - "approveSkillAction sends ONLY RVNT-05 (published), NOT both RVNT-02 + RVNT-05, to avoid double notification"
  - "All notification dispatch happens AFTER DB transactions commit, never inside them"
  - "Guard nullable authorId with if-check before eq() to satisfy Drizzle ORM types"

patterns-established:
  - "Fire-and-forget pattern: notifyReviewEvent({...}).catch(() => {}) -- never blocks return"
  - "Author lookup outside transaction: separate db.query.users.findFirst after tx commits"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 37 Plan 03: Notification Dispatch Wiring Summary

**Wired notifyReviewEvent dispatch into submit-for-review and admin-reviews server actions covering all 5 review lifecycle events (RVNT-01 through RVNT-05)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08T19:43:05Z
- **Completed:** 2026-02-08T19:47:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- submit-for-review.ts dispatches RVNT-05 (review_published) to author on auto-approve, RVNT-01 (review_submitted) to all tenant admins otherwise
- admin-reviews.ts dispatches RVNT-05 (approve), RVNT-03 (reject), RVNT-04 (changes_requested) to skill author
- All notifications fire-and-forget after DB transactions, never inside them
- All skill queries expanded with authorId, name, slug columns for notification context

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire submit-for-review.ts (RVNT-01 + RVNT-05)** - `2c6d239` (feat)
2. **Task 2: Wire admin-reviews.ts (RVNT-03/04/05)** - `650d097` (feat)

## Files Created/Modified
- `apps/web/app/actions/submit-for-review.ts` - Added notifyReviewEvent import, slug to query, RVNT-01/RVNT-05 dispatch
- `apps/web/app/actions/admin-reviews.ts` - Added notifyReviewEvent/users imports, expanded queries, RVNT-03/04/05 dispatch in all 3 actions
- `apps/web/app/(protected)/settings/notifications/page.tsx` - Fixed pre-existing type error in fallback defaults (added reviewNotificationsEmail/InApp)

## Decisions Made
- Auto-approved: send ONLY RVNT-05 to author (not RVNT-01 to admins -- no admin review needed)
- approveSkillAction: send ONLY RVNT-05 (published) to author, NOT both RVNT-02 (approved) + RVNT-05 to avoid double notification
- Guard nullable authorId before eq() call -- skills.authorId is nullable in schema
- tenantId sourced from session.user.tenantId (submit) and skill.tenantId (admin actions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nullable authorId type error in admin-reviews.ts**
- **Found during:** Task 2 (Wire admin-reviews.ts)
- **Issue:** `eq(users.id, skill.authorId)` fails TypeScript check because authorId is `string | null` and eq() requires `string | SQLWrapper`
- **Fix:** Added `if (skill.authorId)` null guard wrapping each author lookup block
- **Files modified:** apps/web/app/actions/admin-reviews.ts
- **Verification:** `pnpm --filter web exec tsc --noEmit` passes
- **Committed in:** 650d097 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed pre-existing type error in notification settings page defaults**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** Fallback default object in notification settings page was missing reviewNotificationsEmail and reviewNotificationsInApp fields added by plan 37-02
- **Fix:** Added the two missing boolean defaults to the fallback object
- **Files modified:** apps/web/app/(protected)/settings/notifications/page.tsx
- **Verification:** `pnpm --filter web exec tsc --noEmit` passes
- **Committed in:** 2c6d239 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for type safety. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 review notification events (RVNT-01 through RVNT-05) are wired to their trigger points
- Ready for Plan 04 (E2E verification / integration testing)
- Notification preferences respected via getOrCreatePreferences in notifyReviewEvent

---
*Phase: 37-review-notifications*
*Completed: 2026-02-08*
