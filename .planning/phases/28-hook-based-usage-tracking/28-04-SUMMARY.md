---
plan: 28-04
phase: 28
status: complete
subsystem: api
tags: [tracking, endpoint, zod, hmac, rate-limiting]
dependency-graph:
  requires: [28-01, 28-02, 28-03]
  provides: [POST /api/track endpoint]
  affects: [28-05, 28-06]
tech-stack:
  added: []
  patterns: [bearer-auth, zod-validation, optional-hmac, fire-and-forget-insert]
key-files:
  created:
    - apps/web/app/api/track/route.ts
  modified:
    - apps/web/middleware.ts
metrics:
  duration: ~2.5 min
  completed: 2026-02-08
---

# Phase 28 Plan 04: POST /api/track Endpoint Summary

POST /api/track endpoint with Bearer token auth, Zod validation, rate limiting, optional HMAC signature verification, and middleware exemption.

## What Was Done

### Task 1: Create POST /api/track route
Created `apps/web/app/api/track/route.ts` implementing the tracking ingestion endpoint:

1. **Bearer token extraction** from Authorization header (401 on missing/malformed)
2. **API key validation** via `validateApiKey()` with soft expiry support (401 on invalid)
3. **Rate limiting** via `checkRateLimit(keyId)` (429 on exceeded)
4. **JSON body parsing** with try/catch (400 on invalid JSON)
5. **Zod schema validation** for payload fields: `skill_id`, `tool_name`, `ts` (ISO timestamp), optional `hook_event`, optional `tool_input_snippet` (max 1000), optional `tool_output_snippet` (max 1000)
6. **Optional HMAC verification** via `X-EverySkill-Signature` header -- graceful degradation (works with or without signature)
7. **Fire-and-forget insert** via `insertTrackingEvent()` with tenant/user context, skill name enrichment, and expired key tracking
8. **200 empty body response** on success

### Task 2: Exempt /api/track from middleware auth
Added `/api/track` to the exempt paths list in `apps/web/middleware.ts`. The tracking endpoint handles its own authentication via Bearer token and `validateApiKey`, so middleware session-based auth must be bypassed.

Note: This change was committed as part of the concurrent 28-05 plan execution which also modified the middleware file.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d7b590d | feat(28-04): create POST /api/track endpoint |
| 2 | fc5d838 | feat(28-05): included middleware exemption (concurrent agent) |

## Deviations from Plan

None -- plan executed exactly as written. The middleware exemption (Task 2) was committed by a concurrent 28-05 agent that also needed to modify middleware.ts, so it was included in that commit rather than a separate 28-04 commit.

## Verification

TypeScript compilation (`tsc --noEmit`): PASSED -- zero errors.

## Self-Check: PASSED
