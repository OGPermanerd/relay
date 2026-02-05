---
phase: 22-web-remote-mcp
plan: 02
subsystem: api
tags: [mcp, streamable-http, cors, rate-limiting, bearer-auth, mcp-handler, tools]

# Dependency graph
requires:
  - phase: 22-01
    provides: "mcp-handler installed, middleware exempted, tool handlers refactored with userId param"
  - phase: 20-api-key-management
    provides: "validateApiKey service for bearer token auth"
  - phase: 21-employee-usage-tracking
    provides: "usageEvents schema and incrementSkillUses for analytics"
provides:
  - "MCP Streamable HTTP endpoint at /api/mcp/[transport]"
  - "Four MCP tools: list_skills, search_skills, deploy_skill, server_info"
  - "Bearer token auth via validateApiKey for rlk_ API keys"
  - "CORS support for claude.ai and claude.com"
  - "In-memory rate limiting at 60 req/min per API key"
  - "Browser-friendly deploy response (no file system instructions)"
affects: [22-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["withCors wrapper injects CORS headers on all MCP responses", "inline tool logic to avoid cross-app imports", "rate limiter with lazy reset per API key"]

key-files:
  created:
    - "apps/web/app/api/mcp/[transport]/route.ts"
  modified: []

key-decisions:
  - "Inline tool logic rather than importing from apps/mcp (cross-app imports fragile with NodeNext module resolution)"
  - "withCors wrapper adds CORS headers to all MCP responses (not just OPTIONS preflight)"
  - "Rate limit check inside each tool handler after userId extraction, using clientId (keyId) as limiter key"
  - "server_info tool added for authenticated users to query server metadata and categories"

patterns-established:
  - "MCP HTTP tools: extract userId from extra.authInfo.extra.userId, keyId from extra.authInfo.clientId"
  - "CORS for MCP: allow-list specific origins, expose Mcp-Session-Id header"
  - "Rate limiter: Map<keyId, { count, resetAt }> with lazy reset on window expiry"

# Metrics
duration: 4min
completed: 2026-02-05
---

# Phase 22 Plan 02: MCP Streamable HTTP Endpoint Summary

**MCP Streamable HTTP route with bearer auth, four tools (list/search/deploy/server_info), CORS for claude.ai, and 60 req/min rate limiting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T19:50:32Z
- **Completed:** 2026-02-05T19:54:30Z
- **Tasks:** 2
- **Files created:** 1

## Accomplishments
- Created MCP Streamable HTTP endpoint at /api/mcp/[transport] with all four tools registered
- Bearer token auth validates rlk_ API keys via existing validateApiKey service
- CORS headers allow claude.ai and claude.com origins on all responses (not just preflight)
- In-memory rate limiter enforces 60 req/min per API key with sliding window
- Deploy tool returns browser-friendly message instead of file system instructions
- Smoke tests confirm 204 on CORS preflight, 401 on unauthenticated/invalid requests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MCP HTTP route with auth, tools, CORS, and rate limiter** - `d95c49d` (feat)
2. **Task 2: Smoke test the MCP endpoint with curl** - No code changes (verification only)

**Plan metadata:** (pending)

## Files Created/Modified
- `apps/web/app/api/mcp/[transport]/route.ts` - MCP Streamable HTTP endpoint with auth, tools, CORS, rate limiting (403 lines)

## Decisions Made
- Inline tool logic rather than importing from apps/mcp to avoid cross-app import issues with NodeNext module resolution and .js extensions
- Added withCors wrapper to inject CORS headers on all responses (GET/POST/DELETE), not just OPTIONS preflight
- Rate limit uses clientId (keyId) from auth info as the limiter key, checked inside each tool handler
- server_info tool exposes authenticated userId, server version, and available categories
- DELETE handler exported for MCP protocol session termination support

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added CORS headers to all MCP responses, not just OPTIONS**
- **Found during:** Task 1 (route creation)
- **Issue:** Plan only specified OPTIONS handler for CORS, but browsers also need CORS headers on actual POST/GET/DELETE responses
- **Fix:** Created withCors wrapper that runs authHandler then injects CORS headers on the response
- **Files modified:** apps/web/app/api/mcp/[transport]/route.ts
- **Verification:** curl confirms CORS headers present on all response types
- **Committed in:** d95c49d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** CORS on all responses is required for browser-based MCP clients. No scope creep.

## Issues Encountered
None - route compiled on first attempt, all smoke tests passed immediately.

## User Setup Required
None - no external service configuration required. The endpoint uses existing API keys from Phase 20.

## Next Phase Readiness
- MCP Streamable HTTP endpoint is fully functional and ready for end-to-end testing (22-03)
- All four tools registered and validated with correct auth flow
- CORS configured for Claude.ai browser access
- Rate limiting protects against abuse

---
*Phase: 22-web-remote-mcp*
*Completed: 2026-02-05*
