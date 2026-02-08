---
phase: 33-email-notifications
plan: 07
subsystem: api
tags: [cron, digest, email, notifications, admin, trending-skills]

# Dependency graph
requires:
  - phase: 33-02
    provides: sendEmail function, TrendingDigestEmail and PlatformUpdateEmail templates
  - phase: 33-03
    provides: createNotification and getOrCreatePreferences service functions
provides:
  - Daily and weekly cron digest endpoints with CRON_SECRET auth
  - Admin sendPlatformUpdate server action with per-user preference checks
  - Middleware exemption for /api/cron paths
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [cron-secret-auth, fire-and-forget-error-accumulation, per-user-preference-gating]

key-files:
  created:
    - apps/web/app/api/cron/daily-digest/route.ts
    - apps/web/app/api/cron/weekly-digest/route.ts
    - apps/web/app/actions/admin-notifications.ts
  modified:
    - apps/web/middleware.ts

key-decisions:
  - "CRON_SECRET graceful skip: returns 200 with skipped=true when not configured instead of erroring"
  - "Per-user preference gating in platform update: checks getOrCreatePreferences before each send"

patterns-established:
  - "Cron auth pattern: Bearer CRON_SECRET header verification, 401 on mismatch, 200 skip if unset"
  - "Digest loop pattern: query trending skills once, iterate subscribed users, accumulate errors"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 33 Plan 07: Cron Digests and Admin Notifications Summary

**Daily/weekly cron digest endpoints with CRON_SECRET auth and admin platform update action with per-user preference gating**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T12:10:42Z
- **Completed:** 2026-02-08T12:13:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created daily-digest cron endpoint querying top 10 skills by totalUses, sending to users with daily preference
- Created weekly-digest cron endpoint with identical structure for weekly subscribers
- Added /api/cron middleware exemption so cron endpoints bypass auth cookie checks
- Created admin sendPlatformUpdate server action that checks per-user platformUpdatesInApp and platformUpdatesEmail preferences before sending

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cron digest endpoints + middleware exemption** - `cb1e4ea` (feat)
2. **Task 2: Create admin platform update notification action** - `1963f98` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `apps/web/app/api/cron/daily-digest/route.ts` - Cron endpoint: trending skills digest for daily subscribers
- `apps/web/app/api/cron/weekly-digest/route.ts` - Cron endpoint: trending skills digest for weekly subscribers
- `apps/web/app/actions/admin-notifications.ts` - Admin server action to send platform update notifications
- `apps/web/middleware.ts` - Added /api/cron to exempt paths

## Decisions Made
- CRON_SECRET graceful skip: returns 200 with `{ skipped: true, reason: "CRON_SECRET not configured" }` instead of erroring when env var is missing -- allows safe deployment without cron setup
- Per-user preference gating: each user's preferences are checked individually via getOrCreatePreferences before sending in-app notification or email -- respects user opt-out choices

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

To enable cron digests in production:
1. Set `CRON_SECRET` environment variable to a secure random string
2. Configure cron job: `curl -H "Authorization: Bearer $CRON_SECRET" https://everyskill.ai/api/cron/daily-digest` (daily)
3. Configure cron job: `curl -H "Authorization: Bearer $CRON_SECRET" https://everyskill.ai/api/cron/weekly-digest` (weekly)

## Next Phase Readiness
- All Phase 33 notification infrastructure complete (plans 01-07)
- Cron endpoints ready for external scheduler integration
- Admin notification action ready for admin UI wiring

## Self-Check: PASSED

- All 3 created files verified present
- Commit cb1e4ea (Task 1) verified in git log
- Commit 1963f98 (Task 2) verified in git log
- TypeScript compilation: 0 errors

---
*Phase: 33-email-notifications*
*Completed: 2026-02-08*
