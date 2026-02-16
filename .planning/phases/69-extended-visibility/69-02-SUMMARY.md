---
phase: 69-extended-visibility
plan: 02
subsystem: api
tags: [visibility, zod, mcp, admin-gate, drizzle, server-actions]

# Dependency graph
requires:
  - phase: 69-01
    provides: 4-level visibility helpers (VISIBILITY_LEVELS, isOrgVisible, orgVisibleSQL)
provides:
  - All inline visibility queries updated to include global_approved alongside tenant
  - Server action Zod schema accepting 4 visibility levels with admin gate
  - MCP tools accepting 4 visibility levels with global_approved rejection
  - Platform stats and category counts include global_approved skills
affects: [69-03, skill-upload, skill-browse, marketplace, mcp-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [admin gate pattern for global_approved, MCP rejection pattern for privileged operations]

key-files:
  modified:
    - apps/web/app/actions/skills.ts
    - apps/mcp/src/tools/everyskill.ts
    - apps/mcp/src/tools/create.ts
    - apps/mcp/src/tools/update-skill.ts
    - apps/mcp/src/tools/legacy.ts

key-decisions:
  - "Admin gate uses isAdmin(session) check inline, not middleware -- server actions already have session"
  - "MCP tools reject global_approved at handler level (not Zod) -- cleaner error messages and matches MCP convention"
  - "Legacy MCP tools get same Zod update for consistency even though they delegate to same handlers"

patterns-established:
  - "Admin gate: if (visibility === 'global_approved' && !isAdmin(session)) return error"
  - "MCP rejection: early return with isError:true before DB operations for privileged visibility levels"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 69 Plan 02: Inline Visibility Queries & Validation Summary

**Updated 12+ inline visibility queries across 7 lib files, server action Zod schemas with admin gate, and 4 MCP tools to support global_approved/tenant/personal/private**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-16T19:45:25Z
- **Completed:** 2026-02-16T19:50:35Z
- **Tasks:** 2
- **Files modified:** 5 (Task 2), 7 lib files already committed in 9befc5b (Task 1)

## Accomplishments
- Server action Zod schema accepts all 4 visibility levels with admin gate blocking non-admins from global_approved
- MCP everyskill tool, create tool, update-skill tool, and legacy tools all accept 4 levels in Zod but reject global_approved at handler level
- Trending, leaderboard, portfolio stats, contribution ranking, tag aggregation, company-approved, platform stats, and category counts all include global_approved alongside tenant
- Resume queries intentionally left unchanged (personal-only filter for portable skills)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update inline visibility queries in lib files** - `9befc5b` (already committed by prior executor as part of 69-03)
2. **Task 2: Update validation schemas and admin gate** - `eada973` (feat)

## Files Created/Modified
- `apps/web/lib/trending.ts` - Include global_approved in trending skills query
- `apps/web/lib/leaderboard.ts` - Include global_approved in contributor rankings
- `apps/web/lib/portfolio-queries.ts` - Include global_approved in company bucket stats and contribution ranking (4 locations)
- `apps/web/lib/search-skills.ts` - Include global_approved in tag aggregation
- `apps/web/lib/company-approved.ts` - Use inArray for global_approved + tenant filter
- `apps/web/lib/platform-stats.ts` - Include global_approved in platform-wide aggregations
- `apps/web/lib/category-counts.ts` - Include global_approved in category counts
- `apps/web/app/actions/skills.ts` - 4-level Zod schema, isAdmin import, admin gate in checkAndCreateSkill and createSkill
- `apps/mcp/src/tools/everyskill.ts` - 4-level Zod enum and type annotation with updated description
- `apps/mcp/src/tools/create.ts` - 4-level type, global_approved rejection guard
- `apps/mcp/src/tools/update-skill.ts` - 4-level type, global_approved rejection guard
- `apps/mcp/src/tools/legacy.ts` - 4-level Zod enums and descriptions for create_skill and update_skill

## Decisions Made
- Admin gate placed after Zod parsing and before DB insert -- catches invalid visibility early with clear error
- MCP rejection happens before any DB interaction -- fail fast with descriptive error
- Both `checkAndCreateSkill` and `createSkill` server actions get admin gate (both code paths)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated platform-stats.ts and category-counts.ts**
- **Found during:** Task 1 (grep verification revealed additional inline visibility filters)
- **Issue:** platform-stats.ts (2 locations) and category-counts.ts (1 location) used `eq(skills.visibility, "tenant")` which would exclude global_approved skills from platform statistics and category counts
- **Fix:** Changed to `inArray(skills.visibility, ["global_approved", "tenant"])` with import update
- **Files modified:** apps/web/lib/platform-stats.ts, apps/web/lib/category-counts.ts
- **Verification:** Typecheck passes, grep confirms no remaining `eq(skills.visibility, "tenant")` in lib files
- **Committed in:** 9befc5b (already committed by prior executor)

**2. [Note] Task 1 lib file changes were already committed**
- **Found during:** Task 1 commit attempt (empty commit prevented)
- **Issue:** Commit 9befc5b (69-03) already included all 7 lib file changes from Task 1
- **Resolution:** Acknowledged prior commit, proceeded to Task 2 which was not yet done
- **Impact:** Task 1 commit credit goes to 9befc5b instead of a new commit

---

**Total deviations:** 1 auto-fixed (1 missing critical), 1 note (prior commit overlap)
**Impact on plan:** Auto-fix essential for correctness -- global_approved skills would have been invisible in platform stats. No scope creep.

## Issues Encountered
- Task 1 changes were already committed by a prior executor agent in commit 9befc5b (labeled as 69-03). This is because the 69-03 plan executor bundled inline query updates alongside UI changes. Verified all changes present and proceeded to Task 2.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All visibility queries updated across the codebase
- Server actions and MCP tools accept 4 visibility levels
- Ready for Plan 03 (if additional UI/UX work remains)
- Migration 0038 from Plan 01 still needs to be applied (`pnpm db:migrate`)

## Self-Check

Verified via automated checks:
- `pnpm turbo typecheck` -- 6/6 packages pass (0 errors)
- `pnpm lint` -- 0 errors (74 pre-existing warnings)
- `grep eq(skills.visibility, "tenant")` in lib files -- 0 results
- `grep visibility = 'tenant'` in lib files -- 0 results
- Admin gate present in both server action functions (lines 155, 366)
- MCP global_approved rejection in create.ts and update-skill.ts

---
*Phase: 69-extended-visibility*
*Completed: 2026-02-16*
