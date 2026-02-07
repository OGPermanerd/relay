---
phase: 26-auth-subdomain-routing
plan: "03"
subsystem: auth
tags: [middleware, subdomain, multi-tenant, nextjs, cookies]

# Dependency graph
requires:
  - phase: 25-multi-tenancy
    provides: tenant schema, RLS policies, tenant_id on all tables
  - phase: 26-auth-subdomain-routing plan 01
    provides: tenant service, auth type augmentation, CSRF config
  - phase: 26-auth-subdomain-routing plan 02
    provides: auth callbacks with email domain lookup, login page text updates
provides:
  - Subdomain extraction middleware (localhost + production)
  - x-tenant-slug header injection for downstream routes
  - Cookie-based auth check (no auth() wrapper)
  - Updated login page with tenant context display
affects: [27-tenant-onboarding, 28-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain NextResponse middleware (no auth() wrapper) to avoid Auth.js v5 subdomain bugs"
    - "Cookie-based auth check: __Secure-authjs.session-token (prod) / authjs.session-token (dev)"
    - "x-tenant-slug header pattern for server components to read tenant context"

key-files:
  created: []
  modified:
    - apps/web/middleware.ts

key-decisions:
  - "Removed auth() wrapper entirely -- Auth.js v5 beta.30 rewrites req.url, breaking subdomain routing"
  - "Cookie presence check instead of auth() session validation -- lightweight, no Auth.js dependency in middleware"
  - "Login page updates already applied by plan 26-02 -- no duplicate commit needed"

patterns-established:
  - "Subdomain extraction: extractSubdomain(host, rootDomain) handles localhost dev and production domains"
  - "Tenant header injection: middleware sets x-tenant-slug, server components read via headers()"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 26 Plan 03: Middleware Rewrite & Login Page Summary

**Plain NextResponse middleware with subdomain extraction, x-tenant-slug header injection, and cookie-based auth -- no Auth.js wrapper**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-07T18:42:39Z
- **Completed:** 2026-02-07T18:47:49Z
- **Tasks:** 2
- **Files modified:** 1 (login page already updated by 26-02)

## Accomplishments
- Completely rewrote middleware.ts to plain NextResponse middleware (removed auth() wrapper)
- extractSubdomain handles both localhost (dev) and everyskill.ai (prod) domains
- x-tenant-slug header injected for all subdomain requests
- Cookie-based auth check redirects unauthenticated users to /login
- All existing exempt paths preserved, added /api/validate-key
- Build passes, 85/86 E2E tests pass (same as before -- no regression)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite middleware with subdomain extraction** - `e1a1d69` (feat)
2. **Task 2: Update login page for multi-tenant context** - Already applied by `a50f39f` (26-02) -- no duplicate commit

## Files Created/Modified
- `apps/web/middleware.ts` - Complete rewrite: plain NextResponse middleware with subdomain extraction, x-tenant-slug header, cookie-based auth

## Decisions Made
- **Removed auth() wrapper entirely:** Auth.js v5 beta.30 has bugs where auth() rewrites req.url, breaking subdomain routing (GitHub #9631, #10915, #11450). Plain middleware avoids this.
- **Cookie presence check:** Checking for session-token cookie is lightweight and sufficient for redirect logic. Full session validation still happens in server components/actions via auth().
- **Login page already updated:** Plan 26-02 already applied all the login page text changes (Skills Marketplace, organization messaging, tenant slug display). No duplicate commit needed.

## Deviations from Plan

None - plan executed exactly as written. Task 2 (login page) was a no-op because plan 26-02 had already applied identical changes.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 26 Auth & Subdomain Routing is now complete (3/3 plans done)
- Middleware extracts subdomain and injects x-tenant-slug header
- Auth callbacks resolve tenant from email domain
- Ready for Phase 27: Tenant Onboarding (tenant creation, domain configuration)

## Self-Check: PASSED

---
*Phase: 26-auth-subdomain-routing*
*Completed: 2026-02-07*
