---
phase: 26-auth-subdomain-routing
plan: 02
subsystem: auth
tags: [multi-tenancy, auth, tenant-resolution, jwt, session, redirect]
depends_on:
  requires: [25, 26-01]
  provides: [multi-tenant-auth-callbacks, tenant-aware-session, cross-subdomain-redirect]
  affects: [26-03, 27]
tech_stack:
  added: []
  patterns: [email-domain-tenant-resolution, jwt-tenant-injection, db-user-tenant-sync]
key_files:
  created: []
  modified:
    - apps/web/auth.ts
    - apps/web/app/(auth)/login/page.tsx
decisions:
  - id: tenant-auth-by-email-domain
    decision: Resolve tenant from email domain via getTenantByDomain at sign-in
    rationale: Email domain is natural tenant identifier for Google OAuth; each org has distinct domain
  - id: jwt-tenant-sync
    decision: Update user.tenantId in DB during jwt callback on initial sign-in
    rationale: DrizzleAdapter creates user with default tenant; first sign-in corrects to real tenant
metrics:
  duration: 4m
  completed: 2026-02-07
---

# Phase 26 Plan 02: Rewrite auth.ts Callbacks Summary

**Multi-tenant email-domain auth with JWT tenant injection and DB user sync**

## What Was Done

### Task 1: Rewrite auth.ts callbacks (auto)

Rewrote `apps/web/auth.ts` to replace single-domain hardcoded auth with multi-tenant email-domain-based authentication.

**Changes to auth.ts:**
- Removed `ALLOWED_DOMAIN` constant and all `AUTH_ALLOWED_DOMAIN` env var usage
- Added `rootDomain` constant for cross-subdomain redirect support
- Added imports: `eq` from `drizzle-orm`, `getTenantByDomain` from tenant service
- Removed `trustHost: true` (now in auth.config.ts via spread)
- Removed `session: { strategy: "jwt" }` (now in auth.config.ts via spread)

**New callbacks:**

1. **signIn** -- Validates Google OAuth, checks email_verified, resolves email domain against tenants table via `getTenantByDomain()`. Rejects users whose email domain has no matching active tenant.

2. **jwt** -- On initial sign-in (when `account` is present), resolves tenant from email domain and injects `tenantId` into JWT token. Also updates `user.tenantId` in DB to correct the default tenant assigned by DrizzleAdapter during user creation.

3. **session** -- Exposes `tenantId` from JWT token as `session.user.tenantId`, making it available to all server components and actions.

4. **redirect** -- Allows redirects to any subdomain of `rootDomain` (e.g., `acme.everyskill.ai`). Falls back to baseUrl for unknown hosts. Supports relative URLs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Committed orphaned login page changes from 26-01**
- **Found during:** Task 1 (git status showed uncommitted changes)
- **Issue:** Login page updates for multi-tenant messaging were made during 26-01 but not committed
- **Fix:** Committed as separate fix commit with multi-tenant login messaging updates
- **Files modified:** `apps/web/app/(auth)/login/page.tsx`
- **Commit:** a50f39f

## Verification

1. TypeScript compilation: PASSED (no errors)
2. No `AUTH_ALLOWED_DOMAIN` or `ALLOWED_DOMAIN` references remain
3. `getTenantByDomain` and `token.tenantId` present in auth.ts
4. Next.js build: PASSED (all routes compile)
5. Playwright E2E: 85/86 pass (pre-existing Ollama test failure only)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite auth.ts callbacks | 5915bcd | apps/web/auth.ts |
| 1+ | Login page multi-tenant messaging | a50f39f | apps/web/app/(auth)/login/page.tsx |

## Next Phase Readiness

Plan 26-02 delivers the core authentication callbacks that Plan 26-03 (middleware subdomain routing) depends on. The `session.user.tenantId` is now available for all downstream code. The redirect callback enables cross-subdomain navigation after auth.

## Self-Check: PASSED
