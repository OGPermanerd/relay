---
plan: 28-01
phase: 28
subsystem: api-keys
status: complete
tags: [api-keys, soft-expiry, tenantId, multi-tenant]
tech-stack:
  patterns: [soft-expiry-flag]
key-files:
  modified:
    - packages/db/src/services/api-keys.ts
    - apps/mcp/src/auth.ts
    - apps/web/app/api/auth/validate-key/route.ts
    - apps/web/app/api/install-callback/route.ts
decisions:
  - id: 28-01-01
    decision: Soft expiry returns isExpired flag instead of rejecting expired keys
    rationale: Allows downstream hook-based usage tracking to decide how to handle expired keys
metrics:
  duration: ~2 min
  completed: 2026-02-08
---

# Phase 28 Plan 01: Modify validateApiKey for tenantId + Soft Expiry Summary

**One-liner:** validateApiKey now returns tenantId and isExpired flag, implementing soft expiry so expired (non-revoked) keys still authenticate but are flagged.

## What Was Done

### Task 1: Modify validateApiKey return type and query
- Updated return type from `{ userId, keyId }` to `{ userId, keyId, tenantId, isExpired }`
- Added `tenantId` and `expiresAt` to the query columns
- Removed the hard expiry WHERE clause (`or(isNull(expiresAt), gt(expiresAt, now))`) -- expired keys now pass validation with `isExpired: true`
- Added `isExpired` computation: `result.expiresAt ? result.expiresAt <= now : false`
- Removed unused `or` and `gt` imports from drizzle-orm

### Task 2: Update all 3 callers
- **apps/mcp/src/auth.ts**: Error message updated from "invalid or expired" to "invalid or revoked"
- **apps/web/app/api/auth/validate-key/route.ts**: Added `tenantId` and `isExpired` to response JSON; error message updated to "Invalid or revoked key"
- **apps/web/app/api/install-callback/route.ts**: Now extracts `tenantId` from validated API key result and uses it for the usage event insert instead of hardcoded `DEFAULT_TENANT_ID` (falls back to default for anonymous installs)

## Verification

- `npx tsc --noEmit -p packages/db/tsconfig.json` -- PASSED (zero errors)
- `npx tsc --noEmit -p apps/web/tsconfig.json` -- PASSED (zero errors)
- MCP app has pre-existing module resolution errors unrelated to this change

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | validateApiKey soft expiry + caller updates | c043ac1 | api-keys.ts, auth.ts, validate-key/route.ts, install-callback/route.ts |

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
