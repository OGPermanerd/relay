---
phase: 03-mcp-integration
plan: 03
subsystem: api
tags: [mcp, deploy, skills, claude-code]

# Dependency graph
requires:
  - phase: 03-02
    provides: skills table schema with content field, list_skills and search_skills tools
provides:
  - deploy_skill MCP tool for retrieving skill content
  - Complete MCP tool set (list, search, deploy)
  - Deployment tracking in usageEvents
affects: [04-data-model, 08-skill-execution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - In-memory filtering for drizzle query results (avoids ESM/CJS type conflicts)
    - MCP tool response format with success/error structure

key-files:
  created:
    - apps/mcp/src/tools/deploy.ts
  modified:
    - apps/mcp/src/tools/index.ts

key-decisions:
  - "Return skill content + instructions rather than writing files (Claude Code handles file ops)"
  - "Use skill.slug for filename (filesystem-safe)"
  - "Track deployment with skill metadata for analytics"

patterns-established:
  - "MCP tool error response: { success: false, error: string, message: string }"
  - "MCP tool success response: { success: true, ... }"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 03 Plan 03: Deploy Skill Tool Summary

**deploy_skill MCP tool that retrieves skill content and provides .claude/skills/ save instructions for Claude Code**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T15:16:29Z
- **Completed:** 2026-01-31T15:17:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented deploy_skill tool that fetches skill content by ID
- Returns skill metadata (name, category, filename, hoursSaved) with content
- Provides clear instructions for saving to .claude/skills/ directory
- Tracks deployments in usageEvents with skill metadata
- Handles invalid skillId with structured error response

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement deploy_skill tool** - `56d8096` (feat)
2. **Task 2: Register deploy tool and verify full tool set** - `9ebbf71` (feat)

## Files Created/Modified

- `apps/mcp/src/tools/deploy.ts` - deploy_skill MCP tool implementation
- `apps/mcp/src/tools/index.ts` - Added deploy.js import to register tool

## Decisions Made

- **Return content instead of writing files:** Claude Code handles file operations with user confirmation, so deploy_skill returns content + instructions rather than attempting direct filesystem access
- **Use slug for filename:** skill.slug is guaranteed filesystem-safe, avoids issues with special characters in skill names
- **In-memory ID lookup:** Used same pattern as list/search tools to avoid drizzle ESM/CJS type conflicts with where clause operators

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed drizzle where clause to in-memory filter**
- **Found during:** Task 1 (deploy_skill implementation)
- **Issue:** `where: (skills, { eq }) => eq(skills.id, skillId)` caused TypeScript ESM/CJS type conflicts
- **Fix:** Fetch all skills with `findMany()` and filter in-memory with `.find(s => s.id === skillId)`
- **Files modified:** apps/mcp/src/tools/deploy.ts
- **Verification:** `pnpm --filter @everyskill/mcp typecheck` passes
- **Committed in:** 56d8096 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Necessary workaround for known monorepo ESM/CJS type issue. Same pattern used in list.ts and search.ts.

## Issues Encountered

None - known workaround applied proactively based on existing patterns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three MCP tools complete: list_skills, search_skills, deploy_skill
- Ready for Phase 03-04 (MCP Installation/Testing)
- Core "one-click deploy" capability implemented

---
*Phase: 03-mcp-integration*
*Completed: 2026-01-31*
