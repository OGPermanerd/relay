---
phase: 26-auth-subdomain-routing
plan: 01
subsystem: auth
tags: [multi-tenancy, auth, cookies, session, tenant-lookup]
depends_on:
  requires: [25]
  provides: [tenant-service, session-types, edge-auth-config]
  affects: [26-02, 26-03]
tech_stack:
  added: []
  patterns: [domain-scoped-cookies, jwt-session-strategy, tenant-lookup-service]
key_files:
  created:
    - packages/db/src/services/tenant.ts
    - apps/web/types/next-auth.d.ts
  modified:
    - packages/db/src/services/index.ts
    - apps/web/auth.config.ts
decisions:
  - id: 26-01-01
    description: "CSRF token without __Secure- prefix"
    rationale: "CSRF tokens must be readable by client-side JavaScript; __Secure- forces httpOnly which breaks CSRF validation"
  - id: 26-01-02
    description: "Domain scoping only in production"
    rationale: "localhost does not support domain cookies; undefined domain allows local dev to work naturally"
metrics:
  duration: "3m 12s"
  completed: "2026-02-07"
---

# Phase 26 Plan 01: Auth Foundation Layer Summary

**Tenant lookup service, NextAuth type augmentation, and Edge-compatible auth config with domain-scoped cookies and SOC2-compliant 8h session timeout.**

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create tenant lookup service and NextAuth type augmentation | 751892b | packages/db/src/services/tenant.ts, apps/web/types/next-auth.d.ts |
| 2 | Update auth.config.ts with domain-scoped cookies and 8h session | ed9ca78 | apps/web/auth.config.ts |

## What Was Built

### Tenant Lookup Service (`packages/db/src/services/tenant.ts`)
- `getTenantBySlug(slug)` -- queries tenants table with active filter, returns tenant or null
- `getTenantByDomain(domain)` -- queries tenants table with active filter, returns tenant or null
- Both functions follow existing service patterns: `!db` guard, try/catch returning null
- Re-exports `Tenant` and `NewTenant` types for downstream convenience
- Added to services index barrel export

### NextAuth Type Augmentation (`apps/web/types/next-auth.d.ts`)
- Module augmentation for `next-auth`: adds `tenantId?: string` to `Session.user`
- Module augmentation for `next-auth/jwt`: adds `id?: string` and `tenantId?: string` to `JWT`
- Enables type-safe access to `session.user.tenantId` and `token.tenantId` throughout the app

### Auth Config Update (`apps/web/auth.config.ts`)
- **Removed** Google `hd` parameter -- multi-tenant supports any email domain
- **Added** `trustHost: true` for header-based host derivation behind reverse proxy
- **Added** JWT session strategy with `maxAge: 28800` (8 hours, SOC2-04 compliance)
- **Added** cross-subdomain cookie configuration:
  - `sessionToken`: `__Secure-` prefix in production, `.everyskill.ai` domain scoping
  - `callbackUrl`: same pattern as sessionToken
  - `csrfToken`: no `__Secure-` prefix (must be readable by client JS), same domain scoping
- **Zero database imports** -- remains Edge-compatible for middleware

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 26-01-01 | CSRF token without `__Secure-` prefix | CSRF tokens must be readable by client-side JavaScript; `__Secure-` forces httpOnly which breaks CSRF validation |
| 26-01-02 | Domain scoping only in production | localhost does not support domain cookies; undefined domain allows local dev to work naturally |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. TypeScript compilation passes for both apps/web and packages/db -- PASS
2. auth.config.ts contains no DB imports (Edge-safe) -- PASS
3. Tenant service exports getTenantBySlug and getTenantByDomain -- PASS
4. next-auth.d.ts augments Session.user and JWT with tenantId -- PASS
5. Session maxAge is 28800 (8 hours) -- PASS
6. E2E tests: 85/86 pass (same pre-existing Ollama failure) -- PASS

## Next Phase Readiness

Plan 02 (auth callbacks) can now:
- Use `getTenantBySlug` and `getTenantByDomain` for tenant resolution in signIn callback
- Access `token.tenantId` and `session.user.tenantId` with full type safety
- Build on the JWT session strategy and cookie config

Plan 03 (middleware) can now:
- Rely on domain-scoped cookies for cross-subdomain session sharing
- Use trustHost for proper host derivation behind Traefik proxy

## Self-Check: PASSED
