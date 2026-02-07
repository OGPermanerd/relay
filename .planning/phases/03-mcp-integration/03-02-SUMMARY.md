---
phase: 03-mcp-integration
plan: 02
subsystem: mcp
tags: [mcp, drizzle, skills, search, usage-tracking, zod]

# Dependency graph
requires:
  - phase: 03-mcp-integration-01
    provides: MCP server scaffold, usageEvents schema
  - phase: 02-authentication
    provides: users table for author reference
provides:
  - Skills table schema for marketplace content
  - list_skills MCP tool for browsing skills
  - search_skills MCP tool for finding skills
  - trackUsage helper for analytics
affects: [03-03-skill-runner, 03-04-tool-generation, web-skill-pages, usage-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: ["in-memory filtering for small datasets", "callback-style where clauses avoided due to ESM/CJS type conflicts"]

key-files:
  created:
    - packages/db/src/schema/skills.ts
    - apps/mcp/src/tools/list.ts
    - apps/mcp/src/tools/search.ts
    - apps/mcp/src/tools/index.ts
    - apps/mcp/src/tracking/events.ts
  modified:
    - packages/db/src/schema/index.ts
    - apps/mcp/src/server.ts
    - apps/mcp/src/index.ts

key-decisions:
  - "In-memory filtering for list/search tools to avoid drizzle ESM/CJS type conflicts"
  - "Split @everyskill/db imports to avoid re-export resolution issues with ESM loaders"
  - "Non-critical tracking failures (logged, not thrown)"
  - "Tool imports in index.ts after server export to fix circular dependency"

patterns-established:
  - "Import @everyskill/db/schema/* directly for schema tables in ESM contexts"
  - "Filter in JavaScript for small datasets vs. complex SQL to avoid type system issues"

# Metrics
duration: 8min
completed: 2026-01-31
---

# Phase 3 Plan 2: Skills Schema & MCP Tools Summary

**list_skills and search_skills MCP tools with in-memory filtering, plus skills table schema and usage tracking helper**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-31T15:07:03Z
- **Completed:** 2026-01-31T15:14:43Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Created skills table schema with name, slug, description, category, content, hoursSaved
- Implemented list_skills tool with optional category filtering and pagination
- Implemented search_skills tool with query matching on name/description
- Added trackUsage helper that inserts usage events with graceful failure handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create minimal skills schema** - `465bc59` (feat)
2. **Task 2: Implement usage tracking helper** - `9908161` (feat)
3. **Task 3: Implement list_skills and search_skills tools** - `5d2a9d5` (feat)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Skills table with id, name, slug, description, category, content, hoursSaved, authorId
- `packages/db/src/schema/index.ts` - Added skills re-export
- `apps/mcp/src/tracking/events.ts` - trackUsage function for analytics
- `apps/mcp/src/tools/list.ts` - list_skills MCP tool implementation
- `apps/mcp/src/tools/search.ts` - search_skills MCP tool implementation
- `apps/mcp/src/tools/index.ts` - Tool registration barrel file
- `apps/mcp/src/server.ts` - Removed inline tool import (moved to index.ts)
- `apps/mcp/src/index.ts` - Added tool imports after server creation

## Decisions Made
- Used in-memory filtering for list/search instead of SQL where clauses - drizzle operators had type conflicts between ESM and CJS module resolution modes in the monorepo
- Split @everyskill/db imports: use main export for db client, direct path for schema tables - ESM re-export resolution was failing at runtime
- Moved tool registration imports from server.ts to index.ts to fix circular dependency issue (tools importing server before it was initialized)
- trackUsage gracefully handles failures - logging errors but not throwing, ensuring tool calls succeed even if analytics fail

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed drizzle ESM/CJS type conflicts**
- **Found during:** Task 3 (list_skills implementation)
- **Issue:** Importing drizzle operators (eq, ilike, or) caused type errors due to different module resolution between @everyskill/db (bundler) and @everyskill/mcp (NodeNext)
- **Fix:** Used in-memory filtering instead of SQL where clauses
- **Files modified:** apps/mcp/src/tools/list.ts, apps/mcp/src/tools/search.ts
- **Committed in:** 5d2a9d5 (Task 3 commit)

**2. [Rule 3 - Blocking] Fixed @everyskill/db import resolution**
- **Found during:** Task 3 (server startup)
- **Issue:** ESM named imports from @everyskill/db failed at runtime with "export not found" error despite working at typecheck time
- **Fix:** Split imports - use @everyskill/db for db client, @everyskill/db/schema/usage-events for schema
- **Files modified:** apps/mcp/src/tracking/events.ts
- **Committed in:** 5d2a9d5 (Task 3 commit)

**3. [Rule 3 - Blocking] Fixed circular dependency in tool registration**
- **Found during:** Task 3 (server startup)
- **Issue:** server.ts importing tools that reference server before it was initialized
- **Fix:** Moved tool imports to index.ts after server import
- **Files modified:** apps/mcp/src/server.ts, apps/mcp/src/index.ts
- **Committed in:** 5d2a9d5 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking issues)
**Impact on plan:** All auto-fixes necessary for runtime operation. No scope creep. In-memory filtering is correct approach for initial skill catalog size.

## Issues Encountered
- Database schema push requires interactive confirmation (expected - documented in 03-01-SUMMARY.md)
- pnpm command not in PATH - used `npm exec -- pnpm` workaround

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MCP tools registered and functional
- Skills table schema ready for db:push
- Ready for Plan 03 (deploy_skill tool) and Plan 04 (skill formatting)
- Test data seeding deferred to manual db:push execution

---
*Phase: 03-mcp-integration*
*Completed: 2026-01-31*
