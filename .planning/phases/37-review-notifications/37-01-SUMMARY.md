---
phase: 37-review-notifications
plan: 01
subsystem: database
tags: [drizzle, postgres, notifications, review, schema, migration]

# Dependency graph
requires:
  - phase: 33-notifications
    provides: notification_preferences table, notifications service, CreateNotificationParams type
  - phase: 36-review-dashboard
    provides: review_decisions table, admin review workflow
provides:
  - review_notifications_email and review_notifications_in_app schema columns
  - 5 review notification types in CreateNotificationParams union
  - getAdminsInTenant function for notification dispatch
  - expanded updatePreferences accepting review notification fields
affects: [37-02 dispatch, 37-03 wiring, 37-04 UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [boolean preference columns with default true, admin discovery query]

key-files:
  created:
    - packages/db/src/migrations/0016_add_review_notification_prefs.sql
  modified:
    - packages/db/src/schema/notification-preferences.ts
    - packages/db/src/services/notifications.ts
    - packages/db/src/services/user.ts
    - packages/db/src/services/index.ts
    - packages/db/src/services/notification-preferences.ts

key-decisions:
  - "Applied migration via psql directly — drizzle-kit push prompted about unrelated vanity_domain constraint"
  - "getAdminsInTenant returns id, email, name — minimal projection for notification dispatch"

patterns-established:
  - "Review notification preference columns: boolean NOT NULL DEFAULT true — opt-out model"
  - "Admin discovery query: filter users by tenantId AND role=admin"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 37 Plan 01: Review Notification DB Infrastructure Summary

**Review notification schema columns, migration, 5-type union expansion, getAdminsInTenant query, and preference service updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T19:38:19Z
- **Completed:** 2026-02-08T19:41:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added reviewNotificationsEmail and reviewNotificationsInApp boolean columns to notification_preferences (default true)
- Expanded CreateNotificationParams type union with 5 review notification types (submitted, approved, rejected, changes_requested, published)
- Created getAdminsInTenant(tenantId) function for notification dispatch to admin users
- Expanded updatePreferences to accept the two new review notification fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, migration, and type union expansion** - `513b112` (feat)
2. **Task 2: getAdminsInTenant and preference service expansion** - `3818fc1` (feat)

## Files Created/Modified
- `packages/db/src/migrations/0016_add_review_notification_prefs.sql` - Migration adding 2 boolean columns to notification_preferences
- `packages/db/src/schema/notification-preferences.ts` - Added reviewNotificationsEmail and reviewNotificationsInApp columns
- `packages/db/src/services/notifications.ts` - Expanded CreateNotificationParams type union with 5 review types
- `packages/db/src/services/user.ts` - Added getAdminsInTenant function
- `packages/db/src/services/index.ts` - Exported getAdminsInTenant from barrel
- `packages/db/src/services/notification-preferences.ts` - Expanded updatePreferences parameter type

## Decisions Made
- Applied migration via psql directly instead of drizzle-kit push, which prompted about an unrelated vanity_domain constraint
- getAdminsInTenant returns minimal projection (id, email, name) for notification dispatch use case

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used psql instead of drizzle-kit push for migration**
- **Found during:** Task 1 (migration application)
- **Issue:** drizzle-kit push prompted interactively about an unrelated tenants_vanity_domain_unique constraint, blocking the migration
- **Fix:** Applied the migration SQL directly via psql, which succeeded cleanly
- **Files modified:** None (runtime change only)
- **Verification:** psql column query confirmed both columns exist
- **Committed in:** 513b112 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Migration applied correctly via alternate method. No scope change.

## Issues Encountered
None beyond the drizzle-kit push interactive prompt handled above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All DB-layer changes for review notifications are in place
- Schema columns, migration, expanded types, admin query, and preference service ready
- Downstream plans (37-02 dispatch, 37-03 wiring, 37-04 UI) can proceed

## Self-Check: PASSED

All artifacts verified:
- FOUND: packages/db/src/migrations/0016_add_review_notification_prefs.sql
- FOUND: packages/db/src/services/user.ts (getAdminsInTenant)
- FOUND: 37-01-SUMMARY.md
- FOUND: commit 513b112 (Task 1)
- FOUND: commit 3818fc1 (Task 2)

---
*Phase: 37-review-notifications*
*Completed: 2026-02-08*
