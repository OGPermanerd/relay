---
phase: 49-tenant-resolution-cleanup
plan: 03
subsystem: api, mcp
tags: [tenant-resolution, mcp, api-key, multi-tenancy, default-tenant-id]

requires:
  - phase: 49-tenant-resolution-cleanup
    provides: "JWT tenantId in session + utility function tenantId params (Plan 01)"
provides:
  - "MCP stdio tools with strict tenant resolution via getTenantId()"
  - "MCP HTTP route with tenant from API key validation via extra.tenantId"
  - "MCP tracking (events.ts) skips tracking when no tenant resolved"
  - "install-callback documented anonymous fallback (only legitimate DEFAULT_TENANT_ID)"
affects: [mcp-tools, api-routes, usage-tracking]

tech-stack:
  added: []
  patterns:
    - "Strict tenant guard: getTenantId() with early return error for MCP tools"
    - "HTTP MCP: extractTenantId(extra) pattern parallel to extractUserId(extra)"
    - "trackUsage skips silently when no tenantId (non-critical tracking)"

key-files:
  created: []
  modified:
    - apps/mcp/src/tools/create.ts
    - apps/mcp/src/tools/update-skill.ts
    - apps/mcp/src/tools/review-skill.ts
    - apps/mcp/src/tools/submit-for-review.ts
    - apps/mcp/src/tracking/events.ts
    - apps/web/app/api/mcp/[transport]/route.ts
    - apps/web/app/api/install-callback/route.ts

key-decisions:
  - "MCP tools return isError with clear message when tenant not resolved (not silent skip)"
  - "Tracking (events.ts and HTTP trackUsage) silently skip when no tenant -- tracking is non-critical"
  - "install-callback keeps DEFAULT_TENANT_ID as only legitimate anonymous fallback"

patterns-established:
  - "MCP strict tenant guard: getTenantId() + if (!tenantId) return error"
  - "HTTP MCP tenantId flow: validateApiKey -> extra.tenantId -> extractTenantId -> trackUsage"

duration: 3min
completed: 2026-02-14
---

# Phase 49 Plan 03: MCP & API Route Tenant Resolution Summary

**Strict tenant resolution for MCP stdio tools, HTTP MCP route, and tracking -- eliminates DEFAULT_TENANT_ID from all authenticated code paths**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T13:01:07Z
- **Completed:** 2026-02-14T13:04:04Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All 4 MCP stdio tools (create, update-skill, review-skill, submit-for-review) return clear error when getTenantId() returns null
- MCP tracking (events.ts) silently skips tracking when no tenant resolved instead of using hardcoded fallback
- HTTP MCP route derives tenantId from API key validation via extra.tenantId and passes through all 5 trackUsage calls
- install-callback keeps DEFAULT_TENANT_ID only for anonymous installs with documentation explaining it as the sole legitimate runtime use

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace DEFAULT_TENANT_ID in MCP stdio tools and tracking** - `63f9dcf` (feat)
2. **Task 2: Replace DEFAULT_TENANT_ID in HTTP MCP route and install-callback** - `c2df9e0` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/create.ts` - Strict tenant guard before skill insert
- `apps/mcp/src/tools/update-skill.ts` - Strict tenant guard before skill update/fork
- `apps/mcp/src/tools/review-skill.ts` - Strict tenant guard before review insert
- `apps/mcp/src/tools/submit-for-review.ts` - Strict tenant guard before review pipeline
- `apps/mcp/src/tracking/events.ts` - Removed DEFAULT_TENANT_ID, skip tracking when no tenant
- `apps/web/app/api/mcp/[transport]/route.ts` - Added extractTenantId, pass tenantId through all trackUsage/writeAuditLog calls
- `apps/web/app/api/install-callback/route.ts` - Added documentation comment for intentional anonymous fallback

## Decisions Made
- MCP tool errors on missing tenant are explicit with actionable message ("re-generate your API key") rather than silent fallback
- Tracking functions (fire-and-forget) silently skip when no tenant -- failing to track is acceptable, failing to scope data is not
- install-callback's DEFAULT_TENANT_ID is the only remaining legitimate use -- anonymous installs have no API key to derive tenant from

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (server actions and web app pages) can proceed independently -- different file set
- After all 3 plans complete, only install-callback will contain DEFAULT_TENANT_ID in runtime code

## Self-Check: PASSED

- All 7 modified files exist on disk
- Commit `63f9dcf` (Task 1) verified in git log
- Commit `c2df9e0` (Task 2) verified in git log
- Zero DEFAULT_TENANT_ID in apps/mcp/src/ (verified)
- Zero DEFAULT_TENANT_ID in apps/web/app/api/mcp/ (verified)
- 3 DEFAULT_TENANT_ID in install-callback (comment + const + usage -- all intentional)

---
*Phase: 49-tenant-resolution-cleanup*
*Completed: 2026-02-14*
