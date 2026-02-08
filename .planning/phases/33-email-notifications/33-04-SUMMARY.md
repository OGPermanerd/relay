---
phase: 33-email-notifications
plan: 04
subsystem: ui
tags: [react, notifications, server-actions, dropdown, optimistic-ui]

# Dependency graph
requires:
  - phase: 33-01
    provides: notifications schema and migration
  - phase: 33-03
    provides: notification service functions (CRUD, count, mark-read)
provides:
  - NotificationBell component with unread badge and dropdown
  - NotificationList component with scrollable notification display
  - Server actions for notification operations (get, mark-read)
  - Layout integration with notification bell in header
affects: [33-05, 33-06, 33-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimistic-ui-updates, server-action-wrapper, outside-click-close]

key-files:
  created:
    - apps/web/app/actions/notifications.ts
    - apps/web/components/notification-bell.tsx
    - apps/web/components/notification-list.tsx
  modified:
    - apps/web/app/(protected)/layout.tsx

key-decisions:
  - "Optimistic UI updates for mark-read with server-side count reconciliation"
  - "useTransition for non-blocking server action calls"
  - "Parallel fetch of unread count and recent notifications in layout"

patterns-established:
  - "Notification dropdown: outside-click-close with useRef + mousedown listener"
  - "Server action wrappers: auth guard + date serialization + no type re-exports"

# Metrics
duration: 6min
completed: 2026-02-08
---

# Phase 33 Plan 04: Notification Bell UI Summary

**In-app notification center with bell icon, unread badge, dropdown list, and optimistic mark-read actions in the protected layout header**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T12:10:09Z
- **Completed:** 2026-02-08T12:16:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Bell icon with red unread count badge (supports "99+" overflow) in the protected layout header
- Dropdown notification list with scrollable container, read/unread visual states, and relative timestamps
- Optimistic UI updates for mark-as-read and mark-all-as-read with server-side count reconciliation
- Footer link to notification settings page (created in Plan 05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server actions and notification bell component** - `0b286aa` (feat)
2. **Task 2: Wire notification bell into protected layout header** - `bd22bdb` (feat)

## Files Created/Modified
- `apps/web/app/actions/notifications.ts` - Server actions wrapping DB notification services with auth guards and date serialization
- `apps/web/components/notification-bell.tsx` - Bell icon with unread badge, dropdown toggle, outside-click-close, optimistic updates
- `apps/web/components/notification-list.tsx` - Scrollable notification list with read/unread states, mark-read callbacks, settings link
- `apps/web/app/(protected)/layout.tsx` - Added NotificationBell with server-side data fetch between GreetingArea and profile avatar

## Decisions Made
- Optimistic UI updates for mark-read: decrement count immediately, reconcile with server response
- useTransition for server action calls to keep UI responsive during network requests
- Parallel Promise.all fetch for unread count and recent notifications in layout (avoids waterfall)
- Prefixed unused isPending as _isPending for ESLint compliance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESLint unused variable error**
- **Found during:** Task 1 (notification bell component)
- **Issue:** `isPending` from useTransition was assigned but not consumed in JSX (no loading spinner in plan)
- **Fix:** Prefixed as `_isPending` to satisfy ESLint no-unused-vars rule
- **Files modified:** apps/web/components/notification-bell.tsx
- **Verification:** ESLint passes, pre-commit hook succeeds
- **Committed in:** 0b286aa (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor naming adjustment for lint compliance. No scope creep.

## Issues Encountered
- Next.js build (`pnpm build`) fails with ENOENT race condition on `_buildManifest.js.tmp` -- pre-existing Turbopack issue unrelated to notification changes. TypeScript compilation (`tsc --noEmit`) passes cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification bell renders in header, ready for end-to-end testing
- Settings link points to `/settings/notifications` (Plan 05 creates that page)
- Server actions ready for Plan 06 (email dispatch triggers) and Plan 07 (testing)

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (0b286aa, bd22bdb) confirmed in git log.

---
*Phase: 33-email-notifications*
*Completed: 2026-02-08*
