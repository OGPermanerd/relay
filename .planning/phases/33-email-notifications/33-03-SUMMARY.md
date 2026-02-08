---
phase: 33-email-notifications
plan: 03
subsystem: database
tags: [drizzle, notifications, preferences, crud, pagination]

# Dependency graph
requires:
  - phase: 33-01
    provides: notifications and notification_preferences schema tables
provides:
  - Notification CRUD service (create, list, unread count, mark read)
  - Notification preferences service (get-or-create, update)
  - Re-exports from packages/db/src/services/index.ts
affects: [33-04, 33-05, 33-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [on-conflict-do-nothing for upsert safety, count() aggregate for unread queries]

key-files:
  created:
    - packages/db/src/services/notifications.ts
    - packages/db/src/services/notification-preferences.ts
  modified:
    - packages/db/src/services/index.ts

key-decisions:
  - "count() aggregate over results.length for getUnreadNotificationCount — uses composite index efficiently"
  - "ON CONFLICT DO NOTHING + re-fetch in getOrCreatePreferences — handles race conditions without upsert"

patterns-established:
  - "Notification service null-guard pattern: if (!db) return null/0/[] consistent with existing services"
  - "Preference upsert: select-first, insert-on-missing with conflict guard, re-fetch for consistency"

# Metrics
duration: 1min
completed: 2026-02-08
---

# Phase 33 Plan 03: Notification Services Summary

**Notification and preference CRUD services with paginated queries, count aggregation on composite index, and race-safe upsert for preferences**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-08T12:06:52Z
- **Completed:** 2026-02-08T12:08:10Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- createNotification inserts tenant-scoped notification with JSON-stringified metadata
- getUserNotifications returns paginated list ordered by createdAt desc with limit/offset
- getUnreadNotificationCount uses count() aggregate leveraging composite (userId, isRead) index
- markNotificationAsRead and markAllNotificationsAsRead update isRead flag and readAt timestamp
- getOrCreatePreferences with ON CONFLICT DO NOTHING for concurrent insert safety
- updatePreferences saves partial user preference changes with updatedAt refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notification and preference service functions** - `2ab4d76` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `packages/db/src/services/notifications.ts` - Notification CRUD operations (create, list, unread count, mark read)
- `packages/db/src/services/notification-preferences.ts` - Preference get-or-create and update operations
- `packages/db/src/services/index.ts` - Re-exports for all notification service functions and types

## Decisions Made
- Used `count()` aggregate from drizzle-orm instead of fetching rows and counting `.length` for unread count -- leverages the composite (userId, isRead) index efficiently
- Used ON CONFLICT DO NOTHING + re-fetch pattern in getOrCreatePreferences instead of upsert -- handles race conditions cleanly when two requests create preferences simultaneously
- trendingDigest type uses string literal union matching the pgEnum values ("none" | "daily" | "weekly")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused sql import**
- **Found during:** Task 1 (commit attempt)
- **Issue:** ESLint caught unused `sql` import from drizzle-orm in notifications.ts
- **Fix:** Removed `sql` from the import statement
- **Files modified:** packages/db/src/services/notifications.ts
- **Verification:** Pre-commit hook passed on retry
- **Committed in:** 2ab4d76 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial lint fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification services ready for server actions (Plan 04) to wire into Next.js
- Preference service ready for settings UI (Plan 05)
- All exports available from @everyskill/db package

---
*Phase: 33-email-notifications*
*Completed: 2026-02-08*
