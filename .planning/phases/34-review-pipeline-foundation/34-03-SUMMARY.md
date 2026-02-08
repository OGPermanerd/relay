---
phase: 34-review-pipeline-foundation
plan: 03
subsystem: api, database, mcp
tags: [drizzle, sql, status-filter, published, search, mcp]

requires:
  - phase: 34-01
    provides: skills.status column with default 'published'
provides:
  - All public-facing skill queries gated by status='published'
  - MCP list_skills and deploy_skill enforce published-only access
  - Fork counts and search results exclude non-published skills
affects: [34-04, 34-05, 35-mcp-review-tools]

tech-stack:
  added: []
  patterns: [status-filter-on-all-public-queries]

key-files:
  modified:
    - apps/web/lib/search-skills.ts
    - apps/web/lib/similar-skills.ts
    - apps/web/lib/trending.ts
    - apps/web/lib/leaderboard.ts
    - apps/web/lib/platform-stats.ts
    - apps/web/lib/user-stats.ts
    - apps/web/lib/my-leverage.ts
    - apps/web/lib/total-stats.ts
    - packages/db/src/services/search-skills.ts
    - packages/db/src/services/skill-forks.ts
    - apps/mcp/src/tools/list.ts
    - apps/mcp/src/tools/deploy.ts

key-decisions:
  - "Used eq(skills.status, 'published') for Drizzle queries and AND s.status = 'published' for raw SQL"
  - "MCP list uses in-memory filter (status === 'published' || !status) to handle legacy null-status skills"
  - "MCP deploy returns isError with descriptive message for non-published skills"

patterns-established:
  - "Status filter pattern: every public-facing query must include status='published' condition"

duration: 6min
completed: 2026-02-08
---

# Phase 34 Plan 03: Published Status Filter Summary

**Added status='published' filter to all 18 public-facing skill query paths across 12 files (web lib, DB services, MCP tools)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T17:10:08Z
- **Completed:** 2026-02-08T17:16:29Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Gated all 8 web lib query files (search, similar, trending, leaderboard, platform-stats, user-stats, my-leverage, total-stats) by status='published'
- Gated DB service search and fork queries by status='published'
- Added published-only filtering to MCP list_skills and deployment blocking to MCP deploy_skill
- Ensured draft/pending/rejected skills never leak to non-author users in any public query path

## Task Commits

Each task was committed atomically:

1. **Task 1: Add status filter to web app query files (8 files)** - `d5a5502` (feat)
2. **Task 2: Add status filter to DB services and MCP tools (4 files)** - `402b0b6` (feat)

## Files Created/Modified

- `apps/web/lib/search-skills.ts` - Added published filter to searchSkills() and getAvailableTags()
- `apps/web/lib/similar-skills.ts` - Added published filter to 5 SQL query paths (3 semantic + 2 ILIKE)
- `apps/web/lib/trending.ts` - Added published filter to CTE skill join
- `apps/web/lib/leaderboard.ts` - Added published filter to LEFT JOIN condition
- `apps/web/lib/platform-stats.ts` - Added published filter to both platform stat queries
- `apps/web/lib/user-stats.ts` - Added published filter to user stats query
- `apps/web/lib/my-leverage.ts` - Added published filter to getSkillsCreated and getSkillsCreatedStats
- `apps/web/lib/total-stats.ts` - Added published filter to total and daily trend queries
- `packages/db/src/services/search-skills.ts` - Added published filter to searchSkillsByQuery()
- `packages/db/src/services/skill-forks.ts` - Added published filter to getForkCount() and getTopForks()
- `apps/mcp/src/tools/list.ts` - Added in-memory published filter before tenant/category filtering
- `apps/mcp/src/tools/deploy.ts` - Added deployment blocking for non-published skills

## Decisions Made

- Used `eq(skills.status, "published")` for Drizzle ORM queries and `AND s.status = 'published'` for raw SQL
- MCP list uses in-memory filter with fallback (`status === "published" || !status`) to handle any legacy skills without status
- MCP deploy returns a structured error response (isError: true) for non-published skills

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Next.js 16 Turbopack build fails with ENOENT on `_buildManifest.js.tmp` and `pages-manifest.json` -- pre-existing issue unrelated to changes. Verified correctness via `tsc --noEmit` (zero errors for both web and db packages) and successful MCP build via tsup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All public query paths now enforce status='published' filter
- Ready for Phase 34 plans 04/05 which build on the review pipeline
- Pattern established: any new public-facing query must include status filter

## Self-Check: PASSED

- All 12 modified files verified present
- Both commits (d5a5502, 402b0b6) verified in git log
- 51 "published" filter occurrences across all 12 files
