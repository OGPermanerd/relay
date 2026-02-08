---
phase: 34-review-pipeline-foundation
plan: 02
subsystem: api
tags: [skills, draft-status, creation-paths, mcp]

# Dependency graph
requires:
  - phase: 34-01
    provides: "status column on skills table with state machine"
provides:
  - "All 4 skill creation paths explicitly set status='draft'"
  - "New skills are invisible to non-authors until reviewed"
affects: [34-03, 34-04, 34-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Explicit status override on every INSERT -- never rely on column DEFAULT"]

key-files:
  created: []
  modified:
    - "apps/web/app/actions/skills.ts"
    - "apps/web/app/actions/fork-skill.ts"
    - "apps/mcp/src/tools/create.ts"

key-decisions:
  - "Keep redirect to /skills/${slug} after creation -- plan 04 will add access control allowing authors to view own drafts"

patterns-established:
  - "Every skill INSERT must include status='draft' explicitly -- column DEFAULT is 'published' for backward compat"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 34 Plan 02: Draft Status on Creation Paths Summary

**All 4 skill creation paths (checkAndCreateSkill, createSkill, forkSkill, MCP handleCreateSkill) now explicitly set status='draft' so new skills are invisible until reviewed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T17:09:39Z
- **Completed:** 2026-02-08T17:11:23Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- checkAndCreateSkill() in skills.ts sets status: "draft" on insert
- createSkill() in skills.ts sets status: "draft" on insert
- forkSkill() in fork-skill.ts sets status: "draft" on insert
- MCP handleCreateSkill() includes status='draft' in raw SQL INSERT column/value list
- MCP response message updated from "created and published!" to "created as a draft. It will be visible after review and approval."

## Task Commits

Each task was committed atomically:

1. **Task 1: Set status='draft' on all web and MCP creation paths** - `526a671` (feat)

## Files Created/Modified
- `apps/web/app/actions/skills.ts` - Added status: "draft" to both checkAndCreateSkill and createSkill insert values
- `apps/web/app/actions/fork-skill.ts` - Added status: "draft" to forkSkill insert values
- `apps/mcp/src/tools/create.ts` - Added status column and 'draft' value to raw SQL INSERT; updated response message

## Decisions Made
- Kept existing redirect to `/skills/${slug}` after creation -- plan 04 will add author-visible-draft access control

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
- MCP package filter name is `@everyskill/mcp` not `mcp` -- minor build verification adjustment, no impact

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- All creation paths produce draft skills, ready for plan 03 (status-aware queries) and plan 04 (access control)
- Column DEFAULT remains 'published' for backward compat with any direct SQL inserts (migration safety)

---
*Phase: 34-review-pipeline-foundation*
*Completed: 2026-02-08*
