---
phase: 37-review-notifications
plan: 04
subsystem: ui
tags: [react, notifications, preferences, svg-icons, server-actions]

requires:
  - phase: 37-01
    provides: reviewNotificationsEmail and reviewNotificationsInApp DB columns in notification_preferences schema
  - phase: 37-02
    provides: notifyReviewEvent dispatch function and review notification types
provides:
  - Review notification preference toggles in settings UI (RVNT-06)
  - Type-specific colored icons in notification bell dropdown (RVNT-07)
affects: [notification-preferences, notification-list]

tech-stack:
  added: []
  patterns: [type-specific-icon-helper, notification-section-pattern]

key-files:
  created: []
  modified:
    - apps/web/app/actions/notification-preferences.ts
    - apps/web/app/(protected)/settings/notifications/notification-preferences-form.tsx
    - apps/web/app/(protected)/settings/notifications/page.tsx
    - apps/web/components/notification-list.tsx

key-decisions:
  - "Review notification preferences default to true (email + in-app) matching other preference defaults"
  - "getNotificationIcon returns both color class and React SVG node for flexible rendering"

patterns-established:
  - "Icon helper pattern: getNotificationIcon(type) returns {icon, color} for per-type rendering"
  - "Section separator: each section except last gets border-b border-gray-200"

duration: 4min
completed: 2026-02-08
---

# Phase 37 Plan 04: Preferences UI and Notification Icons Summary

**Review notification email/in-app toggles in settings form plus type-specific colored SVG icons (clipboard, checkmark, x-circle, pencil, globe) in notification bell dropdown**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08T19:43:12Z
- **Completed:** 2026-02-08T19:47:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Preferences form now has 4 sections: Grouping, Trending, Platform, and Review Notifications
- Server action reads/writes reviewNotificationsEmail and reviewNotificationsInApp to database
- Notification bell shows colored icons per type: blue clipboard (submitted), green checkmark (approved), red x-circle (rejected), amber pencil (changes_requested), green globe (published), indigo link (grouping_proposal), gray bell (default)
- Unread dot appears below type icon instead of replacing it

## Task Commits

Each task was committed atomically:

1. **Task 1: Preferences server action and form UI** - `a00f7ab` (feat)
2. **Task 2: Type-specific icons in notification list** - `66dd39b` (feat)

## Files Created/Modified
- `apps/web/app/actions/notification-preferences.ts` - Added reviewNotificationsEmail/InApp to PreferencesResult type, getMyPreferences return, and saveMyPreferences updates
- `apps/web/app/(protected)/settings/notifications/notification-preferences-form.tsx` - Added Section 4: Review Notifications with email/in-app checkboxes
- `apps/web/app/(protected)/settings/notifications/page.tsx` - Added fallback defaults for new review notification fields
- `apps/web/components/notification-list.tsx` - Added getNotificationIcon helper and replaced blue dot with type-specific icon + smaller unread dot

## Decisions Made
- Review notification preferences default to true (enabled) to match behavior of other notification types
- Icon helper returns both `color` CSS class and `icon` ReactNode to keep rendering logic clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing review preference defaults in page.tsx**
- **Found during:** Task 1 (Preferences form UI)
- **Issue:** Page component passes fallback defaults when preferences are null, but was missing reviewNotificationsEmail and reviewNotificationsInApp -- TypeScript type mismatch
- **Fix:** Added both fields with default value `true` to the fallback object in page.tsx
- **Files modified:** apps/web/app/(protected)/settings/notifications/page.tsx
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** a00f7ab (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential type-safety fix. No scope creep.

## Issues Encountered
- Pre-existing build error in admin-reviews.ts (nullable authorId passed to eq()) was already fixed by prior plan's linter hooks -- no action needed in this plan

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RVNT-06 (preference toggles) and RVNT-07 (type-specific icons) are complete
- Phase 37 review notification work is ready for integration testing
- All review notification types render with distinguishable visual indicators

## Self-Check: PASSED

- All 4 modified files exist on disk
- Both task commits (a00f7ab, 66dd39b) found in git history
- tsc --noEmit passes cleanly
- pnpm build --filter web succeeds

---
*Phase: 37-review-notifications*
*Completed: 2026-02-08*
