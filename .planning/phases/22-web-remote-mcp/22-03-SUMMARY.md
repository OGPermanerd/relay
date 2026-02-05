---
phase: 22-web-remote-mcp
plan: 03
subsystem: ui
tags: [mcp, profile, clipboard, cors, playwright, e2e]

# Dependency graph
requires:
  - phase: 22-02
    provides: "MCP Streamable HTTP endpoint at /api/mcp/mcp with auth, CORS, rate limiting"
  - phase: 20-api-key-management
    provides: "API key management UI on profile page"
provides:
  - "McpConnectButton component with copy-to-clipboard and setup instructions"
  - "MCP Connection section on profile page"
  - "E2E tests for MCP HTTP endpoint (auth, CORS, invalid token)"
  - "E2E test for MCP Connect UI on profile page"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Playwright request API for CORS header testing (browser fetch cannot set Origin)", "page.evaluate for same-origin API endpoint tests"]

key-files:
  created:
    - "apps/web/components/mcp-connect-button.tsx"
    - "apps/web/tests/e2e/mcp-http.spec.ts"
  modified:
    - "apps/web/app/(protected)/profile/page.tsx"

key-decisions:
  - "Used Playwright request API (not page.evaluate) for CORS tests since browser fetch cannot set the Origin header"
  - "McpConnectButton uses navigator.clipboard.writeText with fallback to document.execCommand for older browsers"
  - "MCP server URL computed server-side from NEXT_PUBLIC_APP_URL env var with localhost:2000 fallback"

patterns-established:
  - "CORS E2E testing: use Playwright request fixture (APIRequestContext) to set Origin header, not page.evaluate"
  - "Copy-to-clipboard: useState for copied state, setTimeout reset after 2 seconds"

# Metrics
duration: 4min
completed: 2026-02-05
---

# Phase 22 Plan 03: MCP Connect UI & E2E Tests Summary

**McpConnectButton component on profile page with copyable MCP server URL, setup instructions, and 5 Playwright E2E tests for endpoint auth/CORS and Connect UI**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T19:57:53Z
- **Completed:** 2026-02-05T20:01:46Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 1

## Accomplishments
- Created McpConnectButton client component with clipboard copy and "Copied!" feedback
- Added MCP Connection section to profile page after API Keys section
- Created 5 E2E tests: unauthenticated 401, CORS headers for Claude.ai, CORS rejection for evil.com, invalid token 401, and profile UI rendering
- All tests pass with 0 regressions (1 pre-existing failure in skill-upload.spec.ts unrelated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MCP Connect component and add to profile page** - `ccfad62` (feat)
2. **Task 2: Create Playwright E2E tests for MCP HTTP endpoint and Connect UI** - `9ee8239` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `apps/web/components/mcp-connect-button.tsx` - Client component with server URL display, copy button, and setup instructions
- `apps/web/app/(protected)/profile/page.tsx` - Added McpConnectButton import, mcpServerUrl computation, MCP Connection section
- `apps/web/tests/e2e/mcp-http.spec.ts` - 5 E2E tests covering endpoint auth, CORS headers, and Connect UI rendering

## Decisions Made
- Used Playwright `request` fixture (APIRequestContext) for CORS tests instead of `page.evaluate` because browser fetch silently drops the Origin header (it's a forbidden header in the Fetch spec)
- McpConnectButton includes a clipboard fallback using `document.execCommand("copy")` for browsers without `navigator.clipboard`
- MCP server URL is computed server-side in the profile page component and passed as a prop to the client component

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched CORS tests from page.evaluate to Playwright request API**
- **Found during:** Task 2 (E2E test creation)
- **Issue:** Plan specified page.evaluate for all raw fetch calls, but browser fetch cannot set the Origin header (forbidden header per Fetch spec), causing CORS header assertions to fail
- **Fix:** Used Playwright `request` fixture (APIRequestContext) for the two CORS-specific tests, which operates at the network level and can set any headers
- **Files modified:** apps/web/tests/e2e/mcp-http.spec.ts
- **Verification:** All 5 tests pass including CORS header assertions
- **Committed in:** 9ee8239 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correct CORS testing. No scope creep.

## Issues Encountered
- Browser Fetch API forbids setting the `Origin` header, causing CORS preflight test to receive empty `Access-Control-Allow-Origin`. Resolved by using Playwright's `request` fixture which bypasses browser restrictions.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 22 (Web Remote MCP) is complete: SDK installed, tools refactored, HTTP endpoint with auth/CORS, and UI + E2E tests all in place
- Users can connect Claude.ai to Relay via the profile page MCP Connection section
- All E2E tests pass confirming endpoint security (401 on unauth, CORS for Claude.ai only) and UI rendering

---
*Phase: 22-web-remote-mcp*
*Completed: 2026-02-05*
