---
phase: 32-admin-panel
plan: 02
subsystem: auth
tags: [jwt, session, rbac, next-auth, admin]

# Dependency graph
requires:
  - phase: 32-admin-panel
    plan: 01
    provides: userRoleEnum, role column on users, isFirstUserInTenant, getUserRole, setUserRole
provides:
  - role claim in JWT token (auto-assigned on first sign-in)
  - role exposed on session.user.role
  - session-based isAdmin(session) helper
affects: [32-03, 32-04, 32-05, 32-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-load JWT claims for backward-compatible session migration, first-user-admin auto-promotion]

key-files:
  modified:
    - apps/web/auth.ts
    - apps/web/types/next-auth.d.ts
    - apps/web/lib/admin.ts

key-decisions:
  - "First-user-admin check runs after tenantId update in jwt callback"
  - "Lazy-load role for existing sessions via getUserRole fallback"
  - "isAdmin signature change intentionally breaks callers (fixed in 32-06)"

patterns-established:
  - "Lazy JWT claim migration: check if claim missing, fetch from DB, set on token"
  - "Session-based authorization: pass session object to auth helpers, not email strings"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 32 Plan 02: Auth Role Wiring Summary

**JWT callback assigns admin/member role on first sign-in with lazy-load fallback; isAdmin() rewritten to check session.user.role**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T11:11:37Z
- **Completed:** 2026-02-08T11:13:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- JWT callback auto-assigns role on initial sign-in (first user in tenant gets admin, others get member)
- Existing sessions without role claim get lazy-loaded from DB on next request
- Session callback exposes `session.user.role` for downstream components
- `isAdmin()` now takes `Session | null` instead of email string, checking role claim

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth callback role assignment + type augmentation** - `2be2cc5` (feat)
2. **Task 2: Rewrite isAdmin to session-based check** - `211b6ce` (feat)

## Files Created/Modified
- `apps/web/types/next-auth.d.ts` - Added `role?: "admin" | "member"` to Session.user and JWT interfaces
- `apps/web/auth.ts` - JWT callback: first-user-admin logic + lazy role load; session callback: expose role
- `apps/web/lib/admin.ts` - Replaced ADMIN_EMAILS env var check with `session.user.role === "admin"`

## Decisions Made
- First-user-admin check runs after the tenantId DB update so the user record has the correct tenant before `isFirstUserInTenant` is called
- Lazy-load role for existing sessions (same pattern as tenantId lazy migration) to avoid forcing re-login
- `isAdmin` signature break is intentional and documented -- callers migrated in plan 32-06

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Role is available on `session.user.role` for all auth flows
- `isAdmin()` ready for caller migration in plan 32-06
- Admin page guards, user management UI, and role management can proceed (plans 32-03 through 32-06)
- Build will have type errors until 32-06 migrates all `isAdmin()` callers

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 32-admin-panel*
*Completed: 2026-02-08*
