---
phase: 42-mcp-unification
plan: 02
subsystem: mcp
tags: [mcp, legacy-tools, deprecation, backward-compat, testing, strap-pattern]

# Dependency graph
requires:
  - phase: 42-mcp-unification-01
    provides: unified everyskill tool with 12-action STRAP router and extracted handlers
provides:
  - Centralized legacy.ts with 13 deprecated tool registrations
  - Clean handler-only modules (no registration side effects)
  - Test coverage for unified tool routing and param validation
affects: [future removal of legacy tool registrations]

# Tech tracking
tech-stack:
  added: []
  patterns: [legacy wrapper centralization, exported router function for testability]

key-files:
  created:
    - apps/mcp/src/tools/legacy.ts
  modified:
    - apps/mcp/src/tools/everyskill.ts
    - apps/mcp/src/tools/index.ts
    - apps/mcp/src/tools/search.ts
    - apps/mcp/src/tools/list.ts
    - apps/mcp/src/tools/recommend.ts
    - apps/mcp/src/tools/describe.ts
    - apps/mcp/src/tools/deploy.ts
    - apps/mcp/src/tools/guide.ts
    - apps/mcp/src/tools/create.ts
    - apps/mcp/src/tools/update-skill.ts
    - apps/mcp/src/tools/check-skill-status.ts
    - apps/mcp/src/tools/confirm-install.ts
    - apps/mcp/src/tools/check-review-status.ts
    - apps/mcp/src/tools/review-skill.ts
    - apps/mcp/src/tools/submit-for-review.ts
    - apps/mcp/test/tools.test.ts
    - apps/mcp/test/setup.ts

key-decisions:
  - "confirm_install gets deprecation notice pointing to everyskill(action:'install') even though it has no direct unified equivalent (internal follow-up tool)"
  - "Extracted routeEveryskillAction() as exported function for testability rather than testing through MCP server dispatch"
  - "Fixed pre-existing list_skills test failures by adding db.select chain mock to test setup"

patterns-established:
  - "Legacy wrapper pattern: centralize all deprecated registrations in one file, each delegating to same handler as unified tool"
  - "Handler-only module pattern: tool files export only handler functions, no registration side effects"

# Metrics
duration: 7min
completed: 2026-02-13
---

# Phase 42 Plan 02: Legacy Tool Migration & Test Coverage Summary

**Centralized 13 deprecated tool registrations in legacy.ts, cleaned 13 handler files to pure modules, and added 10 test cases for unified everyskill tool routing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-13T21:43:35Z
- **Completed:** 2026-02-13T21:51:02Z
- **Tasks:** 2
- **Files modified:** 18 (1 created, 17 modified)

## Accomplishments
- Created `legacy.ts` with all 13 deprecated tool registrations, each prefixed with `[DEPRECATED - use everyskill(action: '...') instead]`
- Removed `server.registerTool()` calls and `server`/`zod` imports from all 13 individual handler files
- Cleaned unused `getUserId` imports from 5 handler files that receive userId as a parameter
- Reduced `index.ts` from 14 imports to 2 (`everyskill.js` + `legacy.js`)
- Extracted `routeEveryskillAction()` as exported function for direct unit testing
- Added 10 test cases covering action dispatch, param validation, optional params, and defaults
- Fixed 4 pre-existing `list_skills` test failures by adding `db.select()` chain mock

## Task Commits

Each task was committed atomically:

1. **Task 1: Centralize legacy tool registrations and clean handler files** - `79eda18` (refactor)
2. **Task 2: Add tests for unified tool action routing** - `facca33` (test)

## Files Created/Modified
- `apps/mcp/src/tools/legacy.ts` - All 13 deprecated tool registrations in one file
- `apps/mcp/src/tools/everyskill.ts` - Extracted routeEveryskillAction() for testability
- `apps/mcp/src/tools/index.ts` - Reduced to 2 imports
- `apps/mcp/src/tools/search.ts` - Handler-only (removed registerTool, server, z, getUserId)
- `apps/mcp/src/tools/list.ts` - Handler-only (removed registerTool, server, z, getUserId)
- `apps/mcp/src/tools/recommend.ts` - Handler-only (removed registerTool, server, z, getUserId)
- `apps/mcp/src/tools/describe.ts` - Handler-only (removed registerTool, server, z)
- `apps/mcp/src/tools/deploy.ts` - Handler-only (removed registerTool, server, z, getUserId)
- `apps/mcp/src/tools/guide.ts` - Handler-only (removed registerTool, server, z)
- `apps/mcp/src/tools/create.ts` - Handler-only (removed registerTool, server, z, getUserId)
- `apps/mcp/src/tools/update-skill.ts` - Handler-only (removed registerTool, server, z)
- `apps/mcp/src/tools/check-skill-status.ts` - Handler-only (removed registerTool, server, z)
- `apps/mcp/src/tools/confirm-install.ts` - Handler-only (removed registerTool, server, z)
- `apps/mcp/src/tools/check-review-status.ts` - Handler-only (removed registerTool, server, z)
- `apps/mcp/src/tools/review-skill.ts` - Handler-only (removed registerTool, server; kept z for ReviewOutputSchema)
- `apps/mcp/src/tools/submit-for-review.ts` - Handler-only (removed registerTool, server, z)
- `apps/mcp/test/tools.test.ts` - Added 10 unified tool tests, fixed list mock
- `apps/mcp/test/setup.ts` - Added db.select chain mock and DEFAULT_TENANT_ID

## Decisions Made
- `confirm_install` deprecation notice points to `everyskill(action: 'install')` for simplicity, even though the two tools serve different purposes (install vs confirm)
- Used exported `routeEveryskillAction()` for direct testing rather than testing through the MCP server dispatch layer, keeping tests fast and isolated
- `review-skill.ts` retains its `z` (zod) import because it uses zod schemas for `ReviewOutputSchema` in the handler itself, not just for tool registration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused imports after removing registerTool calls**
- **Found during:** Task 1
- **Issue:** After removing `server.registerTool()` callbacks, `getUserId` imports became unused in 5 handler files (search, list, recommend, deploy, create) since the handlers receive `userId` as a parameter
- **Fix:** Removed unused `getUserId` from import statements; also removed unused `z` (zod) imports
- **Files modified:** search.ts, list.ts, recommend.ts, deploy.ts, create.ts
- **Commit:** 79eda18

**2. [Rule 1 - Bug] review-skill.ts lost `z` import needed for ReviewOutputSchema**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** Removing `import { z } from "zod"` along with server import broke the `ReviewOutputSchema` and `ReviewCategorySchema` which use `z.object()`, `z.number()`, etc.
- **Fix:** Re-added `z` import to review-skill.ts since it uses zod in handler logic, not just registration
- **Files modified:** review-skill.ts
- **Commit:** 79eda18

**3. [Rule 3 - Blocking] Pre-existing list_skills test failures (db.select not mocked)**
- **Found during:** Task 2 test execution
- **Issue:** `handleListSkills` was previously refactored from `db.query.skills.findMany()` to `db.select().from().where().limit()` but the test setup only mocked `db.query`
- **Fix:** Added `db.select()` chain mock to `test/setup.ts` and updated list tests to use `mockSelectChain()` helper
- **Files modified:** test/setup.ts, test/tools.test.ts
- **Commit:** facca33

## Issues Encountered
- 1 pre-existing test failure remains: `deploy_skill > includes save instructions` - the deploy handler response format changed (no longer includes `instructions` field for non-stdio transport) but the test was not updated. This is not related to Plan 02 changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 42 (MCP Unification) is now complete
- Total registered tools: 14 (1 unified `everyskill` + 13 deprecated legacy wrappers)
- Legacy tools can be removed in a future phase once all MCP clients have migrated to the unified tool
- All handler files are clean pure modules, ready for any future refactoring

## Self-Check: PASSED

All files verified present, both commits found in git log.

---
*Phase: 42-mcp-unification*
*Completed: 2026-02-13*
