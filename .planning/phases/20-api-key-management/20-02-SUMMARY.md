---
phase: 20-api-key-management
plan: 02
subsystem: database
tags: [drizzle, sha256, timing-safe, api-keys, crypto]

# Dependency graph
requires:
  - phase: 20-api-key-management
    provides: api_keys schema, relations, migration (plan 01 partial + schema work)
provides:
  - validateApiKey service (raw key to userId resolution)
  - listUserKeys service (safe metadata listing)
  - revokeApiKey service (key revocation)
  - setKeyExpiry service (grace period expiry)
affects: [20-03 (API route layer), 20-04 (MCP auth middleware), 20-05 (settings UI)]

# Tech tracking
tech-stack:
  added: []
  patterns: [timing-safe hash comparison, fire-and-forget DB updates, explicit column selection for security]

key-files:
  created: [packages/db/src/services/api-keys.ts]
  modified: [packages/db/src/services/index.ts]

key-decisions:
  - "Timing-safe comparison via crypto.timingSafeEqual prevents timing attacks on hash lookup"
  - "Fire-and-forget lastUsedAt update avoids blocking validation response"
  - "Explicit column selection in listUserKeys ensures keyHash never leaks"

patterns-established:
  - "Security pattern: never return keyHash from list queries, only use in validate"
  - "Performance pattern: fire-and-forget for non-critical updates (lastUsedAt)"

# Metrics
duration: 1min
completed: 2026-02-05
---

# Phase 20 Plan 02: API Keys DB Service Layer Summary

**SHA-256 validated api-keys service with timing-safe comparison, fire-and-forget lastUsedAt, and secure column exclusion**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-05T06:05:07Z
- **Completed:** 2026-02-05T06:06:33Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- validateApiKey resolves raw key to userId via SHA-256 hash with timing-safe comparison
- listUserKeys returns key metadata without ever exposing keyHash
- revokeApiKey marks keys as revoked, returns boolean success
- setKeyExpiry sets grace period on all active keys for a user
- Fire-and-forget lastUsedAt update on successful validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create api-keys service** - `0453a55` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/db/src/services/api-keys.ts` - Service layer with validate, list, revoke, setExpiry functions
- `packages/db/src/services/index.ts` - Re-exports for validateApiKey, listUserKeys, revokeApiKey, setKeyExpiry

## Decisions Made
- Used timing-safe comparison (crypto.timingSafeEqual) even though DB query already filters by hash -- defense in depth against timing attacks
- Fire-and-forget pattern for lastUsedAt to avoid adding latency to key validation path
- Explicit column selection in listUserKeys rather than column exclusion -- safer default, new columns won't accidentally leak

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - pre-existing seed.ts type errors confirmed unrelated to this work.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Service layer complete, ready for API route layer (plan 03)
- All four functions exported from packages/db barrel file
- No blockers or concerns

---
*Phase: 20-api-key-management*
*Completed: 2026-02-05*
