---
phase: 20-api-key-management
plan: 03
subsystem: api, auth
tags: [api-keys, server-actions, validation-endpoint, next.js, drizzle]

# Dependency graph
requires:
  - phase: 20-01
    provides: api-key-crypto utilities (generateRawApiKey, hashApiKey, extractPrefix), isAdmin helper
  - phase: 20-02
    provides: DB service layer (validateApiKey, listUserKeys, revokeApiKey, setKeyExpiry)
provides:
  - POST /api/auth/validate-key endpoint for API key validation without session
  - Server actions for generate, revoke, rotate, list, listAll API keys
affects: [20-04, 20-05, 20-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public API route under /api/auth/* bypasses middleware auth"
    - "Server actions with auth() + isAdmin() gating pattern"
    - "Raw key returned exactly once from generate/rotate actions"

key-files:
  created:
    - apps/web/app/api/auth/validate-key/route.ts
    - apps/web/app/actions/api-keys.ts
  modified: []

key-decisions:
  - "leftJoin makes userEmail nullable in listAllApiKeysAction return type"
  - "rotateApiKey always generates for self (no forUserId), unlike generateApiKey"

patterns-established:
  - "API key validation: public POST route, no session, returns userId+keyId or 401"
  - "Server actions return { data, error } pattern consistent with existing actions"

# Metrics
duration: 2min
completed: 2026-02-05
---

# Phase 20 Plan 03: Validation Endpoint & Server Actions Summary

**POST /api/auth/validate-key public endpoint plus five server actions (generate, revoke, rotate, list, listAll) with session and admin gating**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-05T06:17:16Z
- **Completed:** 2026-02-05T06:19:09Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Public validation endpoint at /api/auth/validate-key accepts raw API key, returns userId/keyId or 401
- Five auth-guarded server actions covering full API key lifecycle
- Admin-only listAll action with user join for management dashboard
- Key rotation with 24h grace period on existing keys

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validate-key route handler** - `b22de5c` (feat)
2. **Task 2: Create api-keys server actions** - `beb7de8` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `apps/web/app/api/auth/validate-key/route.ts` - Public POST endpoint for API key validation
- `apps/web/app/actions/api-keys.ts` - Five server actions: generateApiKey, revokeApiKeyAction, rotateApiKey, listApiKeysAction, listAllApiKeysAction

## Decisions Made
- `userEmail` typed as `string | null` in listAllApiKeysAction since leftJoin makes joined columns nullable
- rotateApiKey always targets current user (no forUserId param), unlike generateApiKey which supports admin generating for others

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript error on leftJoin return type: `userEmail` becomes `string | null` due to left join semantics. Fixed by updating return type annotation. Minor type adjustment, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validation endpoint and server actions ready for UI integration in plan 20-04
- All five exported actions match the plan specification for downstream consumption
- No blockers

---
*Phase: 20-api-key-management*
*Completed: 2026-02-05*
