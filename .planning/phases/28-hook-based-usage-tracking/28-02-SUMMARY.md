---
phase: 28-hook-based-usage-tracking
plan: 02
subsystem: api
tags: [rate-limiting, hmac, crypto, security, usage-tracking]

# Dependency graph
requires:
  - phase: none
    provides: standalone utilities with no dependencies
provides:
  - "In-memory sliding window rate limiter (100 req/min per API key)"
  - "HMAC-SHA256 signing and verification with timing-safe comparison"
affects: [28-04-track-endpoint, 28-05-hook-endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sliding window rate limiting via in-memory Map with timestamp arrays"
    - "Timing-safe HMAC verification with Buffer.from hex encoding"

key-files:
  created:
    - apps/web/lib/rate-limiter.ts
    - apps/web/lib/hmac.ts
  modified: []

key-decisions:
  - "In-memory Map rate limiter sufficient for single-server deployment"
  - "timingSafeEqual with Buffer.from hex for constant-time comparison"

patterns-established:
  - "Rate limiter: sliding window with periodic cleanup (5min interval, 2x window prune)"
  - "HMAC: compute + verify pair with length guard before timingSafeEqual"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 28 Plan 02: Rate Limiter and HMAC Utilities Summary

**In-memory sliding window rate limiter (100 req/min) and HMAC-SHA256 signing/verification with timing-safe comparison**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T02:59:47Z
- **Completed:** 2026-02-08T03:01:19Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created rate limiter with sliding window using Map-based timestamp arrays, 100 req/min per API key
- Created HMAC-SHA256 utilities with crypto.timingSafeEqual for constant-time signature verification
- Both modules have zero external dependencies (Node.js crypto only)
- Automatic cleanup of stale rate limiter entries every 5 minutes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create in-memory rate limiter** - `f7661fd` (feat) -- included in parallel plan commit due to concurrent execution
2. **Task 2: Create HMAC signing and verification utilities** - `cfd0f92` (feat)

## Files Created/Modified
- `apps/web/lib/rate-limiter.ts` - Sliding window rate limiter: checkRateLimit(keyId) enforces 100 req/min with auto-cleanup
- `apps/web/lib/hmac.ts` - HMAC-SHA256: computeHmac for signing, verifyHmac with timing-safe comparison

## Decisions Made
- In-memory Map rate limiter chosen over Redis -- sufficient for single LXC container deployment
- Buffer.from(sig, "hex") for both sides of timingSafeEqual to prevent timing leaks on string comparison
- setInterval with .unref() for cleanup so it does not prevent process exit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Rate limiter file (Task 1) was included in a concurrent plan's commit (28-03) due to parallel wave execution and lint-staged stash/restore. File content is correct and tracked.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both utility modules ready for import by /api/track endpoint (Plan 28-04)
- checkRateLimit and verifyHmac exports available for the hook endpoint (Plan 28-05)

## Self-Check: PASSED

---
*Phase: 28-hook-based-usage-tracking*
*Completed: 2026-02-08*
