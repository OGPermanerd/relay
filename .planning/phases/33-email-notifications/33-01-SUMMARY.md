---
phase: 33-email-notifications
plan: 01
subsystem: database
tags: [drizzle, postgres, notifications, rls, pgPolicy, pgEnum]

# Dependency graph
requires:
  - phase: 25-multi-tenancy
    provides: tenants table, RLS patterns, tenant isolation
provides:
  - notifications table with tenant-scoped RLS
  - notification_preferences table with digest frequency enum
  - Drizzle relations for notifications and notificationPreferences
affects: [33-email-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns: [notification preferences with per-type in-app/email toggles, digest frequency enum]

key-files:
  created:
    - packages/db/src/schema/notifications.ts
    - packages/db/src/schema/notification-preferences.ts
    - packages/db/src/migrations/0012_create_notifications.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/relations/index.ts

key-decisions:
  - "Idempotent migration with DO blocks for enum/policy creation"
  - "Composite (userId, isRead) index for unread count optimization"

patterns-established:
  - "digest_frequency pgEnum for notification cadence control"
  - "Per-type email + in-app boolean toggles on notification_preferences"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 33 Plan 01: Notifications Schema Summary

**Drizzle notifications and notification_preferences tables with RLS tenant isolation, digest frequency enum, and unread-optimized composite index**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T12:01:48Z
- **Completed:** 2026-02-08T12:03:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created notifications table with tenant/user FKs, type/title/message/metadata columns, isRead tracking, and RLS policy
- Created notification_preferences table with per-type email/in-app toggles, digest frequency enum, unique user constraint
- Both tables have tenant_isolation RLS policies matching the established skill-messages pattern
- Migration 0012 creates both tables idempotently with all indexes and policies

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notifications and notification_preferences schemas** - `d86f062` (feat)
2. **Task 2: Create migration 0012 for notifications tables** - `f4cfeed` (feat)

## Files Created/Modified
- `packages/db/src/schema/notifications.ts` - Notifications table definition with RLS, types
- `packages/db/src/schema/notification-preferences.ts` - Notification preferences with digest enum, RLS, types
- `packages/db/src/schema/index.ts` - Re-exports for both new schemas
- `packages/db/src/relations/index.ts` - Relations for notifications/notificationPreferences to users/tenants
- `packages/db/src/migrations/0012_create_notifications.sql` - SQL migration for both tables

## Decisions Made
- Used idempotent DO blocks with EXCEPTION handlers for enum and policy creation (safe to re-run)
- Added composite (userId, isRead) index specifically for unread count query optimization
- Unique constraint on notification_preferences.user_id enforces one preferences row per user

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for notification service layer (33-02)
- Both tables created and verified in database
- All exports and relations wired for Drizzle query builder usage

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (d86f062, f4cfeed) confirmed in git log.

---
*Phase: 33-email-notifications*
*Completed: 2026-02-08*
