---
phase: 22-web-remote-mcp
plan: 01
subsystem: api
tags: [mcp, mcp-handler, streamable-http, middleware, tool-handlers]

# Dependency graph
requires:
  - phase: 21-employee-usage-tracking
    provides: "Tool handlers with userId tracking via auth.ts"
  - phase: 20-api-key-management
    provides: "API key validation for bearer token auth"
provides:
  - "mcp-handler dependency installed in apps/web"
  - "MCP SDK upgraded to ^1.25.3 in both apps/web and apps/mcp"
  - "Middleware exempts /api/mcp from session auth"
  - "Tool handlers accept userId param for dual-transport support"
  - "Deploy handler returns transport-aware responses (stdio vs http)"
affects: [22-02-PLAN, 22-03-PLAN]

# Tech tracking
tech-stack:
  added: ["mcp-handler ^1.0.7", "@modelcontextprotocol/sdk ^1.25.3 (apps/web)"]
  patterns: ["userId parameter injection for dual-transport handlers", "skipNudge flag for HTTP transport", "transport-aware response formatting"]

key-files:
  created: []
  modified:
    - "apps/web/package.json"
    - "apps/mcp/package.json"
    - "apps/web/middleware.ts"
    - "apps/mcp/src/tools/list.ts"
    - "apps/mcp/src/tools/search.ts"
    - "apps/mcp/src/tools/deploy.ts"
    - "apps/web/tests/e2e/install-callback.spec.ts"
    - "pnpm-lock.yaml"

key-decisions:
  - "SDK resolved to 1.25.3 (satisfies ^1.25.2 requirement)"
  - "skipNudge parameter suppresses anonymous nudge logic for HTTP transport (auth required, nudge meaningless)"
  - "transport param on deploy handler controls response format: http returns message, stdio returns instructions array"

patterns-established:
  - "Dual-transport handler pattern: export handler accepting userId+skipNudge, stdio registration passes getUserId()"
  - "Transport-aware response: deploy handler checks transport param for output format"

# Metrics
duration: 4min
completed: 2026-02-05
---

# Phase 22 Plan 01: Foundation for HTTP MCP Transport Summary

**mcp-handler installed, SDK upgraded, middleware exempted /api/mcp, tool handlers refactored to accept userId param for dual stdio/HTTP transport**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T19:43:09Z
- **Completed:** 2026-02-05T19:47:08Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed mcp-handler ^1.0.7 and @modelcontextprotocol/sdk ^1.25.2 in apps/web for HTTP MCP route
- Upgraded @modelcontextprotocol/sdk to ^1.25.3 in apps/mcp (security patch)
- Added /api/mcp middleware exemption so MCP HTTP requests use bearer token auth instead of session cookies
- Refactored handleListSkills, handleSearchSkills, handleDeploySkill to accept userId and skipNudge params
- Added transport-aware response formatting to handleDeploySkill (http vs stdio)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install mcp-handler, upgrade SDK, exempt middleware** - `02e06b9` (feat)
2. **Task 2: Refactor tool handlers to accept userId parameter** - `ae6a1cf` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `apps/web/package.json` - Added mcp-handler and @modelcontextprotocol/sdk dependencies
- `apps/mcp/package.json` - Upgraded @modelcontextprotocol/sdk to ^1.25.3
- `apps/web/middleware.ts` - Added isMcpApi exemption for /api/mcp paths
- `apps/mcp/src/tools/list.ts` - handleListSkills accepts userId, skipNudge params
- `apps/mcp/src/tools/search.ts` - handleSearchSkills accepts userId, skipNudge params
- `apps/mcp/src/tools/deploy.ts` - handleDeploySkill accepts userId, skipNudge, transport params
- `apps/web/tests/e2e/install-callback.spec.ts` - Fixed pre-existing TS error (baseURL assertion)
- `pnpm-lock.yaml` - Updated lockfile with new dependencies

## Decisions Made
- SDK resolved to 1.25.3 (satisfies ^1.25.2 requirement, minor peer dep warning acceptable)
- skipNudge parameter suppresses anonymous nudge logic for HTTP transport since bearer token auth is required
- transport param on deploy handler controls response format: "http" returns a message, "stdio" (default) returns instructions array
- Pre-existing TS error in install-callback.spec.ts fixed inline with non-null assertion on baseURL

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TS error in install-callback e2e test**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** `page.evaluate(async (url: string) => {...}, baseURL)` failed because baseURL is `string | undefined`
- **Fix:** Changed to `page.evaluate(async (url) => {...}, baseURL!)` with non-null assertion
- **Files modified:** apps/web/tests/e2e/install-callback.spec.ts
- **Verification:** `npx tsc --noEmit` passes cleanly in apps/web
- **Committed in:** 02e06b9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Pre-existing type error unrelated to this plan. Fixed to ensure clean verification. No scope creep.

## Issues Encountered
- apps/mcp `tsc --noEmit` has pre-existing errors from packages/db module resolution (node16/nodenext import paths) and implicit any types in filter callbacks. These are not caused by this plan's changes and exist on the base branch. The tool handler refactoring introduces no new errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- mcp-handler is ready for use in the HTTP MCP route (22-02)
- All three tool handlers are ready to be called with per-request userId from bearer token auth
- Middleware will pass /api/mcp requests through to the route handler without session checks

---
*Phase: 22-web-remote-mcp*
*Completed: 2026-02-05*
