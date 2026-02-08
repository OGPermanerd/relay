---
phase: 37-review-notifications
plan: 02
subsystem: notifications
tags: [email, react-email, notifications, review-pipeline]

# Dependency graph
requires:
  - phase: 33-notifications
    provides: "notification preferences, createNotification, sendEmail, render infrastructure"
  - phase: 37-review-notifications
    plan: 01
    provides: "reviewNotificationsInApp/reviewNotificationsEmail preference fields"
provides:
  - "ReviewNotificationEmail template for 5 review event types"
  - "notifyReviewEvent dispatch function with preference checks"
affects: [37-review-notifications plan 03 (wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["conditional email template per event type", "review notification dispatch with fire-and-forget"]

key-files:
  created:
    - apps/web/emails/review-notification.tsx
  modified:
    - apps/web/lib/notifications.ts

key-decisions:
  - "Notes quote block shown for approved, rejected, and changes_requested types (not submitted or published)"
  - "Single toggle pair (reviewNotificationsInApp/reviewNotificationsEmail) controls all 5 review event types per RVNT-06"
  - "buildReviewActionUrl routes submitted to /admin/reviews, rejected/changes to /my-skills, approved/published to /skills/{slug}"

patterns-established:
  - "Review notification dispatch: same fire-and-forget pattern as grouping proposal"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 37 Plan 02: Email Template and Dispatch Summary

**ReviewNotificationEmail with conditional rendering for 5 event types and notifyReviewEvent fire-and-forget dispatch with preference-gated in-app and email channels**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T19:38:21Z
- **Completed:** 2026-02-08T19:40:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ReviewNotificationEmail renders conditionally for review_submitted, review_approved, review_rejected, review_changes_requested, and review_published
- notifyReviewEvent dispatches in-app and email notifications respecting reviewNotificationsInApp/reviewNotificationsEmail preferences
- Fire-and-forget pattern: catches all errors, never throws, matches existing notifyGroupingProposal

## Task Commits

Each task was committed atomically:

1. **Task 1: ReviewNotificationEmail template** - `0a1994d` (feat)
2. **Task 2: notifyReviewEvent dispatch function** - `2971075` (feat)

## Files Created/Modified
- `apps/web/emails/review-notification.tsx` - Email template with conditional rendering for 5 review event types, with headings, body text, optional notes block, and CTA buttons
- `apps/web/lib/notifications.ts` - Added notifyReviewEvent function, REVIEW_TITLES constant, buildReviewMessage and buildReviewActionUrl helpers

## Decisions Made
- Notes quote block displayed for approved, rejected, and changes_requested events (not for submitted or published)
- CTA routing: submitted -> /admin/reviews, rejected/changes_requested -> /my-skills, approved/published -> /skills/{slug}
- Preview text per event type for email client previews

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Email template and dispatch function ready for Plan 03 (wiring into server actions)
- Depends on Plan 01 completing to add reviewNotificationsInApp/reviewNotificationsEmail preference fields to schema (TypeScript compiles cleanly with optional chaining)

## Self-Check: PASSED

- [x] apps/web/emails/review-notification.tsx exists
- [x] apps/web/lib/notifications.ts exists
- [x] Commit 0a1994d found
- [x] Commit 2971075 found

---
*Phase: 37-review-notifications*
*Completed: 2026-02-08*
