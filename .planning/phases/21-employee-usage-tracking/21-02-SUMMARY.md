---
phase: 21-employee-usage-tracking
plan: 02
subsystem: api
tags: [next.js, route-handler, usage-events, middleware, api-key]

# Dependency graph
requires:
  - phase: 20-api-key-management
    provides: validateApiKey service, API key infrastructure
provides:
  - POST /api/install-callback route for recording install_confirmed events
  - Middleware exemption for unauthenticated install callbacks
affects: [22-mcp-server, 23-analytics-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anonymous-first API routes: validate key if present, proceed with null userId if not"
    - "Middleware path exemption pattern for public API routes"

key-files:
  created:
    - apps/web/app/api/install-callback/route.ts
  modified:
    - apps/web/middleware.ts

key-decisions:
  - "Anonymous installs valid: missing/invalid key records null userId, no error"
  - "toolName 'install_confirmed' distinguishes from 'deploy_skill' events"
  - "metadata.source = 'install-script' tags event origin for analytics filtering"

patterns-established:
  - "Public API route: middleware exemption + graceful key validation + anonymous fallback"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 21 Plan 02: Install Callback Route Summary

**POST /api/install-callback route with middleware exemption for anonymous install event tracking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T07:57:56Z
- **Completed:** 2026-02-05T07:59:48Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created POST /api/install-callback route that records install_confirmed usage events
- Added middleware exemption so install callbacks work without Auth.js session
- API key validation gracefully falls back to null userId for anonymous installs
- Increments skill usage counter via incrementSkillUses when skillId provided

## Task Commits

Each task was committed atomically:

1. **Task 1: Create install-callback route and middleware exemption** - `58ea11f` (feat)

## Files Created/Modified
- `apps/web/app/api/install-callback/route.ts` - POST handler recording install_confirmed events with optional API key resolution
- `apps/web/middleware.ts` - Added /api/install-callback to auth exemption list

## Decisions Made
- Anonymous installs are valid: missing or invalid API key records event with null userId (no 401 error)
- Used toolName "install_confirmed" to distinguish from "deploy_skill" events in usage_events table
- Added metadata.source = "install-script" to tag event origin for future analytics filtering
- Input fields typed defensively with typeof checks (not trusting client input)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Install callback endpoint ready for integration with install scripts
- Usage events table will receive install_confirmed records
- Ready for analytics dashboard to query install events

---
*Phase: 21-employee-usage-tracking*
*Completed: 2026-02-05*
