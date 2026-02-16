---
phase: 70-mcp-preference-sync
plan: 01
subsystem: mcp
tags: [mcp, preferences, user-preferences, zod, unified-tool]

# Dependency graph
requires:
  - phase: 54-user-preferences
    provides: userPreferences schema, getOrCreateUserPreferences, updateUserPreferences services
provides:
  - handleGetPreferences and handleSetPreferences MCP action handlers
  - get_preferences and set_preferences actions in unified everyskill tool
affects: [70-02-PLAN, mcp-recommend, mcp-search]

# Tech tracking
tech-stack:
  added: []
  patterns: [read-modify-write for JSONB preferences, auth guard pattern for MCP preference tools]

key-files:
  created:
    - apps/mcp/src/tools/preferences.ts
  modified:
    - apps/mcp/src/tools/everyskill.ts

key-decisions:
  - "Read-modify-write pattern preserves claudeMdWorkflowNotes and trainingDataConsent when setting preferences via MCP"
  - "Auth guard checks both userId and tenantId before allowing preference access"
  - "Usage tracking fires as non-critical fire-and-forget for both get and set operations"

patterns-established:
  - "MCP preference handler: auth guard -> DB read -> merge -> DB write -> track -> respond"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 70 Plan 01: MCP Preference Sync - Handlers Summary

**get_preferences and set_preferences MCP actions with read-modify-write pattern preserving existing JSONB fields**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T21:02:33Z
- **Completed:** 2026-02-16T21:05:20Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created preferences.ts handler with handleGetPreferences and handleSetPreferences
- Wired both actions into the unified everyskill tool (ACTIONS, schema, types, switch cases, descriptions)
- Read-modify-write pattern ensures claudeMdWorkflowNotes and trainingDataConsent are never overwritten
- Auth guard returns clear "Set EVERYSKILL_API_KEY" error for unauthenticated users

## Task Commits

Each task was committed atomically:

1. **Task 1: Create preferences handler and wire into unified tool** - `829a687` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/preferences.ts` - New handler with handleGetPreferences and handleSetPreferences
- `apps/mcp/src/tools/everyskill.ts` - Added imports, ACTIONS, schema fields, type fields, switch cases, updated descriptions

## Decisions Made
- Used read-modify-write pattern (not partial update) to safely preserve claudeMdWorkflowNotes and trainingDataConsent fields
- Auth guard checks both userId AND tenantId (matching feedback.ts pattern)
- Usage tracking is fire-and-forget with `.catch(() => {})` (non-critical)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Preference handlers are registered and ready for MCP clients
- Plan 02 (preference-aware reranking in search/recommend) can proceed
- search.ts already has unstaged preference reranking changes (likely from plan 02 prep)

---
*Phase: 70-mcp-preference-sync*
*Completed: 2026-02-16*
