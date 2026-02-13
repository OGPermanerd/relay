---
phase: 42-mcp-unification
plan: 01
subsystem: mcp
tags: [mcp, tool-router, strap-pattern, zod, action-discriminator]

# Dependency graph
requires:
  - phase: 40-visibility-scoping
    provides: visibility-scoped handler functions with exported signatures
provides:
  - Unified "everyskill" tool with 12-action STRAP router
  - Extracted handler functions from 4 inline tool callbacks
  - Removed deprecated log_usage tool
affects: [42-mcp-unification plan 02 (legacy migration)]

# Tech tracking
tech-stack:
  added: []
  patterns: [action-discriminator router, handler extraction for unified tool dispatch]

key-files:
  created:
    - apps/mcp/src/tools/everyskill.ts
  modified:
    - apps/mcp/src/tools/confirm-install.ts
    - apps/mcp/src/tools/check-review-status.ts
    - apps/mcp/src/tools/review-skill.ts
    - apps/mcp/src/tools/submit-for-review.ts
    - apps/mcp/src/tools/index.ts

key-decisions:
  - "confirm_install excluded from unified tool (internal follow-up, not user-initiated)"
  - "skipNudge=true for all unified tool actions (unified tool IS the discovery surface)"
  - "Exhaustive switch with never default ensures compile-time safety for action coverage"

patterns-established:
  - "STRAP action router: flat Zod schema with action enum discriminator, per-action required param validation before handler delegation"
  - "Handler extraction pattern: export async function handleX(), registerTool callback delegates to handler"

# Metrics
duration: 5min
completed: 2026-02-13
---

# Phase 42 Plan 01: Unified Everyskill Tool Summary

**Unified MCP tool with 12-action STRAP router dispatching to extracted handler functions, replacing 14 separate tool definitions with 1 for AI client context efficiency**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-13T21:36:51Z
- **Completed:** 2026-02-13T21:41:31Z
- **Tasks:** 2
- **Files modified:** 7 (6 modified, 1 created, 1 deleted)

## Accomplishments
- Extracted 4 inline handler functions (handleConfirmInstall, handleCheckReviewStatus, handleReviewSkill, handleSubmitForReview) as exported async functions
- Created unified `everyskill` tool with action enum discriminator routing 12 actions to existing handlers
- Removed deprecated `log_skill_usage` tool that wasted context tokens as a no-op
- All 13 existing individual tools remain registered for backward compatibility (Plan 02 moves them to legacy)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract inline handlers and remove log_usage** - `8a4be13` (refactor)
2. **Task 2: Create unified everyskill tool with action router** - `6f6fe03` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/everyskill.ts` - Unified tool with 12-action STRAP router
- `apps/mcp/src/tools/confirm-install.ts` - Extracted handleConfirmInstall handler
- `apps/mcp/src/tools/check-review-status.ts` - Extracted handleCheckReviewStatus handler
- `apps/mcp/src/tools/review-skill.ts` - Extracted handleReviewSkill handler
- `apps/mcp/src/tools/submit-for-review.ts` - Extracted handleSubmitForReview handler
- `apps/mcp/src/tools/index.ts` - Added everyskill import, removed log-usage import
- `apps/mcp/src/tools/log-usage.ts` - DELETED (deprecated no-op)

## Decisions Made
- `confirm_install` excluded from unified tool because it is an internal follow-up tool called after install, not a user-initiated action
- All unified tool dispatches pass `skipNudge: true` since the unified tool itself is the discovery surface
- Used exhaustive switch with `never` default for compile-time safety ensuring all 12 actions are handled
- Default limits match individual tool defaults: search=10, list=20, recommend=5

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 12 handler functions are exported and importable, ready for Plan 02 to move individual registerTool calls to legacy.ts
- Unified tool is registered alongside individual tools for backward compatibility during migration

## Self-Check: PASSED

All files verified present, deleted file confirmed gone, both commits found in git log.

---
*Phase: 42-mcp-unification*
*Completed: 2026-02-13*
