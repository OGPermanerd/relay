---
phase: 40-visibility-scoping
plan: 04
subsystem: mcp
tags: [mcp, visibility, drizzle, search, filtering, security]

# Dependency graph
requires:
  - phase: 40-01
    provides: "buildVisibilityFilter and visibilitySQL helpers, visibility column on skills table"
provides:
  - "Visibility-filtered MCP search, recommend, list, describe, create, update_skill tools"
  - "DB services (searchSkillsByQuery, semanticSearchSkills, getForkCount, getTopForks) accept userId for visibility"
  - "MCP list tool uses DB-level WHERE instead of in-memory filtering"
  - "MCP update_skill fork path defaults to visibility='personal'"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["MCP tools thread userId from auth to DB services for visibility filtering", "Fork path always creates personal-visibility skills"]

key-files:
  created: []
  modified:
    - packages/db/src/services/search-skills.ts
    - packages/db/src/services/semantic-search.ts
    - packages/db/src/services/skill-forks.ts
    - apps/mcp/src/tools/search.ts
    - apps/mcp/src/tools/recommend.ts
    - apps/mcp/src/tools/list.ts
    - apps/mcp/src/tools/describe.ts
    - apps/mcp/src/tools/create.ts
    - apps/mcp/src/tools/update-skill.ts

key-decisions:
  - "Rewrote MCP list tool from in-memory filtering to proper DB-level WHERE clause with buildVisibilityFilter"
  - "Fork path always sets visibility='personal' regardless of original skill's visibility"
  - "Author update path conditionally sets visibility only when provided (4-branch approach for description x visibility combinations)"
  - "describe tool returns generic 'not found' for inaccessible personal skills to avoid information leakage"

patterns-established:
  - "MCP userId threading: all tools that query skills pass userId from auth module to DB services for visibility filtering"
  - "Fork visibility: forked skills are always personal to the forking user"

# Metrics
duration: 7min
completed: 2026-02-13
---

# Phase 40 Plan 04: MCP Visibility Scoping Summary

**All 6 MCP tools (search, recommend, list, describe, create, update_skill) filter by visibility using buildVisibilityFilter, with DB services accepting optional userId parameter**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-13T20:33:37Z
- **Completed:** 2026-02-13T20:40:45Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- DB service layer (searchSkillsByQuery, semanticSearchSkills, getForkCount, getTopForks) accepts optional userId and applies buildVisibilityFilter
- All 6 MCP tools thread userId from auth module through to DB queries for visibility-aware results
- MCP list tool rewritten from in-memory filtering to DB-level WHERE clause (performance improvement)
- MCP describe tool prevents access to other users' personal skills with generic "not found" response
- MCP create tool accepts optional visibility parameter (default: "tenant")
- MCP update_skill author path supports optional visibility change; fork path forces visibility='personal'

## Task Commits

Each task was committed atomically:

1. **Task 1: Add userId to DB service functions (search-skills, semantic-search, skill-forks)** - `4325952` (feat)
2. **Task 2: Thread userId through MCP tools and add visibility checks** - `853b241` (feat)

## Files Created/Modified
- `packages/db/src/services/search-skills.ts` - Added userId param and buildVisibilityFilter to conditions
- `packages/db/src/services/semantic-search.ts` - Added userId param and buildVisibilityFilter to conditions
- `packages/db/src/services/skill-forks.ts` - Added userId to getForkCount and getTopForks with visibility filtering
- `apps/mcp/src/tools/search.ts` - Passes userId to searchSkillsByQuery
- `apps/mcp/src/tools/recommend.ts` - Passes userId to both semanticSearchSkills and searchSkillsByQuery
- `apps/mcp/src/tools/list.ts` - Rewrote to use DB-level WHERE with buildVisibilityFilter instead of in-memory filter
- `apps/mcp/src/tools/describe.ts` - Added visibility check and userId to handler, getForkCount, semanticSearchSkills
- `apps/mcp/src/tools/create.ts` - Added optional visibility parameter to input schema and INSERT
- `apps/mcp/src/tools/update-skill.ts` - Added visibility to input schema, author UPDATE, fork INSERT (personal)

## Decisions Made
- Rewrote MCP list from in-memory to DB query: the original code fetched all skills then filtered in JS, which was both a performance problem and couldn't apply visibility filtering. Moved to Drizzle select with proper WHERE.
- Fork visibility is always personal: when a user forks a skill, the copy belongs to them privately. This is a security decision -- forks contain the user's modifications and shouldn't be visible to the org by default.
- Author update uses 4-branch SQL approach (description x visibility combinations) for clarity over dynamic SQL building.
- Describe returns generic "not found" for inaccessible personal skills to prevent user enumeration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Stale `.next` build cache caused ENOENT errors during monorepo build verification. Resolved by deleting `.next/` directory. Not related to plan changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All MCP tools now respect visibility scoping
- Combined with 40-01 (schema), 40-02 (web service layer), and 40-03 (UI controls), Phase 40 visibility scoping is complete
- No blockers for subsequent phases

## Self-Check: PASSED

- All 9 modified files exist on disk
- Commit 4325952 (Task 1) verified in git log
- Commit 853b241 (Task 2) verified in git log

---
*Phase: 40-visibility-scoping*
*Completed: 2026-02-13*
