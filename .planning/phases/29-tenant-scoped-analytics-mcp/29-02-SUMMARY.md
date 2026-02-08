---
phase: 29-tenant-scoped-analytics-mcp
plan: 02
subsystem: mcp, api
tags: [multi-tenancy, mcp, tenant-isolation, security, drizzle]

# Dependency graph
requires:
  - phase: 25-multi-tenant-schema
    provides: "tenantId columns on all tables, RLS policies"
  - phase: 28-hook-based-usage-tracking
    provides: "MCP auth module, tracking events, tool handlers"
provides:
  - "Tenant-scoped MCP auth caching (getTenantId)"
  - "Tenant-aware usage tracking with anonymous fallback"
  - "Tenant-filtered search, list, deploy MCP tools"
  - "Tenant-filtered searchSkillsByQuery service"
affects: [29-tenant-scoped-analytics-mcp]

# Tech tracking
tech-stack:
  added: []
  patterns: ["in-memory tenant filtering for MCP tools (avoids drizzle-orm direct import)", "cached tenant context from API key validation"]

key-files:
  created: []
  modified:
    - "apps/mcp/src/auth.ts"
    - "apps/mcp/src/tracking/events.ts"
    - "apps/mcp/src/tools/search.ts"
    - "apps/mcp/src/tools/list.ts"
    - "apps/mcp/src/tools/deploy.ts"
    - "packages/db/src/services/search-skills.ts"

key-decisions:
  - "In-memory tenant filtering in MCP tools to avoid drizzle-orm module resolution issues"
  - "Three-tier tenantId resolution: explicit event > cached auth > DEFAULT_TENANT_ID"

patterns-established:
  - "getTenantId() cached singleton pattern mirrors getUserId() for MCP auth context"
  - "Anonymous MCP users always fall back to DEFAULT_TENANT_ID (no breakage)"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 29 Plan 02: MCP Tenant Scoping Summary

**Tenant-isolated MCP tools with cached tenantId from API key validation, in-memory filtering for search/list/deploy, and anonymous fallback to default tenant**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08T03:35:53Z
- **Completed:** 2026-02-08T03:41:10Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- MCP auth module caches tenantId alongside userId from validateApiKey, exposed via getTenantId()
- Usage tracking resolves tenantId via three-tier fallback: explicit event tenantId, cached auth tenantId, DEFAULT_TENANT_ID for anonymous
- All 3 MCP tools (search_skills, list_skills, deploy_skill) filter results by authenticated user's tenant
- Anonymous users (no API key) retain full access to default-tenant skills with no filtering
- searchSkillsByQuery service accepts optional tenantId parameter for SQL-level tenant filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tenantId caching to MCP auth and tracking** - `286226c` (feat)
2. **Task 2: Add tenant filtering to MCP tools and search service** - `89888b1` (feat)

## Files Created/Modified
- `apps/mcp/src/auth.ts` - Added cachedTenantId, getTenantId() export, tenant logging in resolveUserId
- `apps/mcp/src/tracking/events.ts` - Three-tier tenantId resolution with getTenantId import
- `apps/mcp/src/tools/search.ts` - Pass tenantId to searchSkillsByQuery
- `apps/mcp/src/tools/list.ts` - In-memory tenant filtering before category filtering
- `apps/mcp/src/tools/deploy.ts` - In-memory tenant + ID filtering to prevent cross-tenant deploy
- `packages/db/src/services/search-skills.ts` - Optional tenantId param with SQL eq condition

## Decisions Made
- **In-memory tenant filtering for MCP tools:** The MCP app doesn't have drizzle-orm as a direct dependency (only through @everyskill/db), so TypeScript can't resolve drizzle-orm imports. Used in-memory filtering pattern consistent with existing code (matching existing comments about "TypeScript module resolution issues").
- **Three-tier tenantId resolution in tracking:** event.tenantId || getTenantId() || DEFAULT_TENANT_ID allows explicit override, uses cached auth tenant by default, and falls back for anonymous users.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched from drizzle-orm SQL imports to in-memory filtering for list.ts and deploy.ts**
- **Found during:** Task 2
- **Issue:** Plan specified importing `eq`, `and` from `drizzle-orm` and `skills` from `@everyskill/db/schema/skills` directly in list.ts and deploy.ts. However, drizzle-orm is not a direct dependency of the MCP app and TypeScript cannot resolve the module.
- **Fix:** Used in-memory filtering pattern consistent with existing codebase approach (the original code already had comments about "avoid TypeScript module resolution issues")
- **Files modified:** apps/mcp/src/tools/list.ts, apps/mcp/src/tools/deploy.ts
- **Verification:** `tsc --noEmit` shows no errors in apps/mcp/src/ files, full build passes
- **Committed in:** 89888b1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix aligns with existing codebase pattern. Same tenant isolation behavior, different implementation approach. No scope creep.

## Issues Encountered
- Next.js build had transient ENOENT errors on _buildManifest.js temp files (Turbopack race condition). Resolved by clearing .next cache directory. Unrelated to plan changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MCP tools are now tenant-isolated for authenticated users
- Ready for Phase 29-03 (analytics queries with tenant scoping)
- search-skills.ts tenantId parameter available for any future tenant-scoped search callers

## Self-Check: PASSED

- All 6 modified files exist
- Commit 286226c (Task 1) found in git log
- Commit 89888b1 (Task 2) found in git log
- MCP build passes (tsup CJS + DTS)
- Full Next.js build passes

---
*Phase: 29-tenant-scoped-analytics-mcp*
*Completed: 2026-02-08*
