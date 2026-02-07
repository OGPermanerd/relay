---
phase: 21-employee-usage-tracking
plan: 01
subsystem: mcp-auth
tags: [mcp, auth, api-key, usage-tracking, anonymous-nudge]
dependency_graph:
  requires: [20-api-key-management]
  provides: [mcp-userId-resolution, anonymous-nudge, first-auth-message]
  affects: [21-02, 21-03, 21-04, 21-05, 21-06]
tech_stack:
  added: []
  patterns: [module-scoped-cache, resolve-once-pattern, anonymous-nudge-counter]
key_files:
  created:
    - apps/mcp/src/auth.ts
  modified:
    - apps/mcp/src/index.ts
    - apps/mcp/src/tools/search.ts
    - apps/mcp/src/tools/list.ts
    - apps/mcp/src/tools/deploy.ts
decisions: []
metrics:
  duration: 102s
  completed: 2026-02-05
---

# Phase 21 Plan 01: MCP Auth Module + Tool Wiring Summary

MCP auth module resolving userId from EVERYSKILL_API_KEY via validateApiKey service, with anonymous nudge every 5th call and one-time auth confirmation.

## What Was Done

### Task 1: Create MCP auth module and wire userId into tools

Created `apps/mcp/src/auth.ts` with five exported functions:
- `resolveUserId()` -- async, reads EVERYSKILL_API_KEY, calls validateApiKey, caches result with resolved-once flag
- `getUserId()` -- sync getter returning cached userId (string | null)
- `incrementAnonymousCount()` -- increments and returns anonymous call counter
- `shouldNudge()` -- returns true every 5th anonymous call
- `getFirstAuthMessage()` -- returns one-time confirmation message on first authenticated use

Updated `apps/mcp/src/index.ts`:
- Calls `await resolveUserId()` before `server.connect(transport)` so userId is ready for first tool call

Updated all three tool handlers (search.ts, list.ts, deploy.ts):
- Import auth functions from `../auth.js`
- Increment anonymous counter when `getUserId()` is null
- Pass `userId: getUserId() ?? undefined` to existing `trackUsage()` calls
- Append first-auth confirmation message if applicable
- Append nudge message when `shouldNudge()` returns true

## Verification Results

- TypeScript compilation: PASS (zero errors)
- No console.log in auth.ts: PASS (all logging uses console.error)
- getUserId() present in search.ts: PASS
- getUserId() present in list.ts: PASS
- getUserId() present in deploy.ts: PASS

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | ab2a5b6 | feat(21-01): create MCP auth module and wire userId into tools |
