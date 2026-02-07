---
phase: 24-extended-mcp-search
plan: 01
subsystem: database
tags: [drizzle, ilike, search, sql, scoring]

# Dependency graph
requires:
  - phase: 20-api-key-management
    provides: API key infrastructure for MCP authentication
provides:
  - searchSkillsByQuery service with ILIKE matching and field-weighted scoring
  - SearchSkillsParams and SearchSkillResult type exports
affects: [24-02 MCP tool integration, web search parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ILIKE field-weighted scoring pattern for relevance ranking"
    - "escapeLike helper for SQL injection prevention in LIKE patterns"

key-files:
  created:
    - packages/db/src/services/search-skills.ts
  modified:
    - packages/db/src/services/index.ts

key-decisions:
  - "ILIKE-only search (no full-text/embedding) — MCP stdio lacks VOYAGE_API_KEY so ILIKE is the practical default"
  - "Minimal result shape (id, name, description, category, hoursSaved) — lighter than web search for MCP needs"

patterns-established:
  - "Field-weighted ILIKE scoring: title(4) > description(3) > author(2) > tags(1)"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 24 Plan 01: Search Skills Service Summary

**SQL-based skill search service with ILIKE matching across 4 fields and field-weighted relevance scoring for MCP tool integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T15:27:22Z
- **Completed:** 2026-02-06T15:28:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created searchSkillsByQuery service matching name, description, author name, and tags via ILIKE
- Field-weighted relevance scoring orders results by match quality (title=4, desc=3, author=2, tags=1)
- escapeLike helper prevents SQL injection via % and _ characters in user input
- LEFT JOIN on users ensures skills without authors still appear in results

## Task Commits

Each task was committed atomically:

1. **Task 1: Create searchSkillsByQuery service** - `6a6d38a` (feat)
2. **Task 2: Export from services index** - `7bae1fd` (feat)

## Files Created/Modified
- `packages/db/src/services/search-skills.ts` - ILIKE search service with field-weighted scoring, escapeLike helper, and LEFT JOIN on users
- `packages/db/src/services/index.ts` - Re-exports searchSkillsByQuery, SearchSkillsParams, SearchSkillResult

## Decisions Made
- Used ILIKE-only search (no full-text search vectors, no embeddings) since MCP stdio environments lack VOYAGE_API_KEY
- Kept result shape minimal (id, name, description, category, hoursSaved) compared to web search which includes slug, tags, author, ratings, etc.
- Followed existing service patterns: import from `../schema/*`, guard with `if (!db) return []`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- searchSkillsByQuery is ready for MCP tool integration in plan 24-02
- Service exports are accessible via `@everyskill/db` package

---
*Phase: 24-extended-mcp-search*
*Completed: 2026-02-06*
