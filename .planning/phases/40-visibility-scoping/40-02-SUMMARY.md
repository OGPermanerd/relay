---
phase: 40-visibility-scoping
plan: 02
subsystem: api
tags: [visibility, search, trending, leaderboard, platform-stats, access-control, drizzle, sql]

# Dependency graph
requires:
  - "40-01: visibility column on skills table and filter helper functions"
provides:
  - "Visibility-filtered searchSkills with userId threading"
  - "Visibility-filtered getAvailableTags (tenant-only)"
  - "Visibility-filtered similar skills (semantic + ILIKE paths)"
  - "Visibility-filtered trending, leaderboard, platform stats (tenant-only)"
  - "Visibility access control on skill detail page"
  - "Visibility access control on get-skill-content and fork-skill"
  - "Quick search threads userId from auth session"
affects: [40-03, 40-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["org-level aggregations always filter visibility=tenant inline", "user-facing queries use buildVisibilityFilter(userId) for tenant+own-personal"]

key-files:
  created: []
  modified:
    - apps/web/lib/search-skills.ts
    - apps/web/lib/similar-skills.ts
    - apps/web/lib/trending.ts
    - apps/web/lib/leaderboard.ts
    - apps/web/lib/platform-stats.ts
    - apps/web/app/actions/search.ts
    - apps/web/app/actions/get-skill-content.ts
    - apps/web/app/actions/fork-skill.ts
    - apps/web/app/actions/skills.ts
    - apps/web/app/(protected)/skills/[slug]/page.tsx
    - apps/web/app/(protected)/skills/page.tsx

key-decisions:
  - "Trending, leaderboard, and platform stats use inline visibility='tenant' (not the helper) since personal skills should never appear in org-level aggregations"
  - "Task 1 changes were committed by parallel 40-04 agent -- only Task 2 produced a new commit from this executor"

patterns-established:
  - "Org-level aggregation queries: always filter visibility = 'tenant' inline, no userId needed"
  - "User-facing browse/search queries: use buildVisibilityFilter(userId) to show tenant + own personal skills"
  - "Access control gates: check visibility === 'personal' && user !== author before returning content"

# Metrics
duration: 12min
completed: 2026-02-13
---

# Phase 40 Plan 02: Web Query Path Visibility Scoping Summary

**Visibility filtering applied to all 11 web query paths -- search, trending, leaderboard, platform stats, similar skills, skill detail, tags, quick search, content retrieval, and fork access**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-13T20:33:27Z
- **Completed:** 2026-02-13T20:46:09Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- searchSkills() accepts userId and applies buildVisibilityFilter so users only see tenant-visible + their own personal skills
- getAvailableTags() only returns tags from tenant-visible skills (personal skill tags excluded from org-level aggregation)
- Trending, leaderboard, and platform stats all filter to visibility='tenant' so personal skills never inflate org metrics
- Similar skills search (both semantic vector and ILIKE fallback) respects visibility filtering with userId threading
- Quick search threads userId from auth session for proper visibility scoping
- Skill detail page returns 404 for personal skills viewed by non-author/non-admin
- get-skill-content and fork-skill check visibility before proceeding
- Skills listing page threads userId from session to searchSkills

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply visibility to Drizzle query builder paths** - `9fa25ca` (feat, committed by parallel 40-04 agent)
2. **Task 2: Apply visibility to raw SQL paths (trending, leaderboard, platform stats)** - `c54a6fe` (feat)

## Files Created/Modified
- `apps/web/lib/search-skills.ts` - Added userId to SearchParams, buildVisibilityFilter to conditions, tenant-only tags
- `apps/web/lib/similar-skills.ts` - Added userId to all 4 functions, visibilitySQL to raw SQL paths, buildVisibilityFilter to Drizzle paths
- `apps/web/lib/trending.ts` - Added AND s.visibility = 'tenant' to CTE WHERE clause
- `apps/web/lib/leaderboard.ts` - Added AND s.visibility = 'tenant' to JOIN condition
- `apps/web/lib/platform-stats.ts` - Added eq(skills.visibility, "tenant") to both skill queries
- `apps/web/app/actions/search.ts` - Added auth() import, threads userId to searchSkills
- `apps/web/app/actions/get-skill-content.ts` - Added visibility + authorId columns, personal skill access check
- `apps/web/app/actions/fork-skill.ts` - Added visibility + authorId columns, blocks forking others' personal skills
- `apps/web/app/actions/skills.ts` - Threads userId to checkSimilarSkills calls
- `apps/web/app/(protected)/skills/[slug]/page.tsx` - Added visibility access check, threads userId to findSimilarSkillsByName
- `apps/web/app/(protected)/skills/page.tsx` - Added auth import, threads userId to searchSkills

## Decisions Made
- Trending, leaderboard, and platform stats use inline `visibility = 'tenant'` rather than the visibilitySQL helper, because personal skills should never appear in org-level aggregations regardless of who is viewing (per research pitfalls 3 and 4)
- Tags aggregation also filtered to tenant-only since tags are an org-level concept
- get-skill-content checks visibility lazily (only calls auth() when skill is personal) to avoid unnecessary auth overhead for tenant-visible skills

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 changes already committed by parallel 40-04 agent**
- **Found during:** Task 1 commit attempt
- **Issue:** The parallel 40-04 agent (running concurrently as wave 2) proactively committed all Task 1 file changes as part of its docs commit (9fa25ca), leaving nothing to commit for Task 1
- **Fix:** Verified all Task 1 changes are correctly applied and committed, proceeded to Task 2 which was not covered by the parallel agent
- **Files modified:** None additional -- all changes were in 9fa25ca
- **Verification:** git diff HEAD shows clean, all visibility conditions confirmed via grep

**2. [Rule 2 - Missing Critical] Added userId threading to skills page and checkSimilarSkills callers**
- **Found during:** Task 1 (searching for callers of modified functions)
- **Issue:** Plan didn't explicitly list skills/page.tsx or skills.ts action callers, but they call searchSkills and checkSimilarSkills which now need userId
- **Fix:** Added auth import to skills page, threaded userId to searchSkills; threaded session.user.id to both checkSimilarSkills calls in skills.ts
- **Files modified:** apps/web/app/(protected)/skills/page.tsx, apps/web/app/actions/skills.ts
- **Verification:** TypeScript check passes, build succeeds

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both deviations necessary for complete coverage. No scope creep.

## Issues Encountered
- Next.js 16.1.6 build infrastructure produced transient ENOENT errors on first several build attempts (missing pages-manifest.json and _buildManifest.js.tmp); resolved by cleaning .next directory and retrying. This is a known issue unrelated to code changes.
- Parallel agent (40-04) committed Task 1 changes before this executor could, resulting in no Task 1 commit from this agent. The work is still correct and verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All web query paths now respect visibility scoping
- Plans 40-03 and 40-04 were completed in parallel (UI form and MCP tools)
- Phase 40 is now complete across all 4 plans

## Self-Check: PASSED

- All 10 modified files exist
- Commit 9fa25ca (Task 1) found
- Commit c54a6fe (Task 2) found
- Summary file 40-02-SUMMARY.md exists

---
*Phase: 40-visibility-scoping*
*Completed: 2026-02-13*
