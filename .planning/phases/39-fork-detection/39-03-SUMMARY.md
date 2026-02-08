---
phase: 39-fork-detection
plan: 03
subsystem: api
tags: [mcp, fork, versioning, sha256, drizzle]

# Dependency graph
requires:
  - phase: 39-fork-detection
    provides: forkedAtContentHash column in skills schema (39-01), check_skill_status tool (39-02)
provides:
  - update_skill MCP tool with author-update and non-author-fork code paths
  - Version creation for both author updates and forks
  - Fork creation with forkedAtContentHash and publishedVersionId
affects: [39-fork-detection, mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [author-vs-fork branching in MCP tool, conditional SQL updates for optional fields]

key-files:
  created:
    - apps/mcp/src/tools/update-skill.ts
  modified:
    - apps/mcp/src/tools/index.ts

key-decisions:
  - "Author updates set status=draft for re-review rather than staying published"
  - "Fork description defaults to parent description when not provided"
  - "forkedAtContentHash computed from stripped body (no frontmatter) matching check_skill_status pattern"
  - "Version record failure is non-fatal (try/catch) matching create.ts pattern"

patterns-established:
  - "Author-vs-fork branching: userId === skill.author_id determines update vs fork path"
  - "Conditional SQL updates: separate queries for with/without optional description field"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 39 Plan 03: Update Skill MCP Tool Summary

**update_skill MCP tool with author-update (new version, draft status) and non-author-fork (forkedAtContentHash, skill_versions, publishedVersionId) code paths**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T21:28:04Z
- **Completed:** 2026-02-08T21:29:27Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created update_skill MCP tool with dual code paths: author-update and non-author-fork
- Author path creates new skill_versions record and sets status to draft for re-review
- Non-author path creates full fork with forkedAtContentHash, version record, and publishedVersionId
- Authentication enforced for all modification operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create update_skill MCP tool** - `6835e99` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `apps/mcp/src/tools/update-skill.ts` - update_skill MCP tool with author-vs-fork branching, self-contained helpers
- `apps/mcp/src/tools/index.ts` - Added update-skill import for tool registration

## Decisions Made
- Author updates set status to 'draft' for re-review rather than keeping published -- ensures quality control on modifications
- forkedAtContentHash computed from stripped body (no frontmatter) matching the check_skill_status pattern from 39-02
- Used separate SQL UPDATE queries for with/without optional description to avoid template literal issues with conditional SQL fragments
- Fork description defaults to parent skill's description when not provided by caller

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- update_skill tool registered and ready for integration
- All three fork-detection MCP tools complete (check_skill_status, update_skill)
- Ready for 39-04 (fork tree display or remaining fork detection features)

## Self-Check: PASSED

- FOUND: apps/mcp/src/tools/update-skill.ts
- FOUND: commit 6835e99
- FOUND: update-skill import in index.ts
- FOUND: handleUpdateSkill export
- FOUND: forkedAtContentHash in tool
- FOUND: skill_versions in tool

---
*Phase: 39-fork-detection*
*Completed: 2026-02-08*
