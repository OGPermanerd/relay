---
phase: 06-discovery
plan: 01
subsystem: database
tags: [postgresql, full-text-search, drizzle-orm, tsvector, gin-index]

# Dependency graph
requires:
  - phase: 04-data-model-storage
    provides: Skills table schema with basic columns
  - phase: 05-skill-publishing
    provides: Published skills with name and description fields
provides:
  - PostgreSQL full-text search infrastructure on skills table
  - searchVector generated column with weighted name (A) and description (B)
  - GIN index for fast FTS queries
  - searchSkills server function for relevance-ranked search
affects: [06-02, 06-03, browse-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom Drizzle column type for PostgreSQL tsvector"
    - "Generated column with setweight for multi-field FTS"
    - "websearch_to_tsquery for user-friendly search syntax"
    - "ts_rank for relevance ordering"

key-files:
  created:
    - apps/web/lib/search-skills.ts
  modified:
    - packages/db/src/schema/skills.ts

key-decisions:
  - "Custom tsvector type via customType - drizzle-orm doesn't export tsvector directly"
  - "Weight A for name, Weight B for description - name matches rank higher"
  - "websearch_to_tsquery over plainto_tsquery - supports quotes and boolean operators"
  - "Fallback to totalUses ordering when no query - optimized browse mode"

patterns-established:
  - "Generated column pattern: generatedAlwaysAs with SQL template literal"
  - "GIN index in third parameter of pgTable for specialized indexes"
  - "SearchParams interface for extensible filtering (category, tags)"
  - "Graceful null-db handling in search functions"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 6 Plan 1: Full-Text Search Infrastructure Summary

**PostgreSQL FTS with searchVector generated column, GIN index, and websearch_to_tsquery-based searchSkills function for relevance-ranked skill discovery**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T18:49:03Z
- **Completed:** 2026-01-31T18:51:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added searchVector generated column to skills table with weighted name (A) and description (B)
- Created GIN index (skills_search_idx) for fast full-text search queries
- Implemented searchSkills function with PostgreSQL FTS using websearch_to_tsquery and ts_rank
- Supports both search mode (relevance-ranked) and browse mode (totalUses-ordered)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add searchVector column with GIN index** - `54e2bb5` (feat)
2. **Task 2: Create searchSkills function with FTS query** - `a317cb3` (feat)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added custom tsvector type, searchVector generated column, and GIN index
- `apps/web/lib/search-skills.ts` - Server-side search function with PostgreSQL FTS, category filtering, and author relation

## Decisions Made

**1. Custom tsvector type via customType**
- Drizzle-orm 0.38.0 doesn't export tsvector as a native type
- Created custom column type with `customType<{ data: string }>({ dataType: "tsvector" })`
- Allows proper TypeScript typing while generating correct PostgreSQL schema

**2. Weighted search fields (name: A, description: B)**
- Name matches rank higher than description matches in search results
- Uses setweight in generated column: `setweight(to_tsvector('english', name), 'A')`
- Automatic updates when name or description changes (no triggers needed)

**3. websearch_to_tsquery over plainto_tsquery**
- Supports quoted phrases ("exact match")
- Supports boolean operators (AND, OR, NOT)
- More user-friendly than raw tsquery syntax
- Better for natural language search input

**4. Dual ordering strategy**
- Search mode (query present): Order by ts_rank for relevance
- Browse mode (empty query): Order by totalUses for popularity
- Optimizes for both use cases without separate functions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript error: tsvector not exported from drizzle-orm/pg-core**
- **Found during:** Task 1 typecheck
- **Root cause:** Drizzle-orm doesn't provide native tsvector type
- **Solution:** Used customType to define tsvector column type
- **Verification:** Typecheck passes, column definition correct
- **Impact:** None - customType is the recommended approach for PostgreSQL-specific types

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (Browse UI with search/filter)**
- searchSkills function available for server components
- Returns typed SearchSkillResult array with author relation
- Supports query, category parameters (tags TODO in Plan 03)

**Database schema changes:**
- New searchVector column requires `pnpm --filter @relay/db db:push` when database is available
- GIN index will be created automatically during schema push

**Note:** Database push is manual operation (requires confirmation). Not blocking for code development.

---
*Phase: 06-discovery*
*Completed: 2026-01-31*
