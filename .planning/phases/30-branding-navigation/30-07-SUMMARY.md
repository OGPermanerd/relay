---
phase: 30-branding-navigation
plan: 07
subsystem: infra
tags: [caddy, tls, vanity-domain, middleware, on-demand-tls]

# Dependency graph
requires:
  - phase: 30-06
    provides: "getTenantByVanityDomain service function and vanity_domain schema column"
provides:
  - "Middleware vanity domain detection via x-vanity-domain header"
  - "GET /api/check-domain endpoint for Caddy on-demand TLS validation"
  - "Caddyfile with on-demand TLS catch-all for vanity domains"
affects: [30-branding-navigation, deployment, tenant-resolution]

# Tech tracking
tech-stack:
  added: []
  patterns: ["x-vanity-domain header for downstream tenant resolution", "on-demand TLS with ask validation endpoint"]

key-files:
  created:
    - apps/web/app/api/check-domain/route.ts
  modified:
    - apps/web/middleware.ts
    - docker/Caddyfile

key-decisions:
  - "No DB lookup in middleware for vanity domains -- edge-compatible, lightweight header pass-through"
  - "Caddy ask endpoint validates domains before certificate issuance to prevent abuse"

patterns-established:
  - "Vanity domain detection: middleware sets x-vanity-domain header, downstream components resolve tenant"
  - "On-demand TLS: global ask block + https:// catch-all site block pattern"

# Metrics
duration: 1min
completed: 2026-02-08
---

# Phase 30 Plan 07: Vanity Domain Infrastructure Summary

**Middleware vanity domain detection with x-vanity-domain header, Caddy on-demand TLS validation via /api/check-domain, and Caddyfile catch-all for auto-provisioned vanity certificates**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-08T05:28:01Z
- **Completed:** 2026-02-08T05:29:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Middleware detects non-subdomain, non-root-domain hostnames and sets `x-vanity-domain` header for downstream tenant resolution
- `/api/check-domain` endpoint validates vanity domains against tenants table, returning 200/404 for Caddy's on-demand TLS ask flow
- Caddyfile updated with global `on_demand_tls` block and `https://` catch-all site block for auto-provisioned vanity domain certificates

## Task Commits

Each task was committed atomically:

1. **Task 1: Add vanity domain detection to middleware** - `703de0a` (feat)
2. **Task 2: Create check-domain API + update Caddyfile** - `4f783b5` (feat)

## Files Created/Modified
- `apps/web/middleware.ts` - Added `/api/check-domain` to exempt paths; added vanity domain detection block setting `x-vanity-domain` header
- `apps/web/app/api/check-domain/route.ts` - Caddy on-demand TLS validation endpoint; validates vanity domains via `getTenantByVanityDomain`
- `docker/Caddyfile` - Added global `on_demand_tls` ask block, preserved `*.everyskill.ai` block, added `https://` catch-all with `on_demand` TLS

## Decisions Made
- **No DB lookup in middleware for vanity domains** -- Middleware runs at the edge and must stay lightweight. It sets the `x-vanity-domain` header and defers tenant resolution to downstream server components.
- **Caddy ask endpoint prevents certificate abuse** -- Only domains registered as vanity domains in the tenants table will get TLS certificates issued, preventing attackers from triggering certificate requests for arbitrary domains.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vanity domain infrastructure complete: middleware detection, API validation, and Caddy TLS all wired
- Downstream components (e.g., TenantBranding, layout) will need to check `x-vanity-domain` header and resolve tenant from DB in a future iteration
- Caddy must be restarted/reloaded to pick up the new Caddyfile configuration on deployment

---
*Phase: 30-branding-navigation*
*Completed: 2026-02-08*
