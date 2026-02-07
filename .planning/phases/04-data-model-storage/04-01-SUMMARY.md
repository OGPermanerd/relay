---
phase: 04-data-model-storage
plan: 01
subsystem: database
tags: [drizzle, postgres, versioning, ratings, schema]

# Dependency graph
requires:
  - phase: 03-mcp-integration
    provides: skills table with basic fields
provides:
  - skillVersions table for immutable version records
  - ratings table for skill ratings
  - Extended skills table with version references and aggregates
affects: [04-02-PLAN, 05-r2-storage, skill-registry-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wiki-style versioning: new versions create records, never modify"
    - "Denormalized aggregates: totalUses, averageRating on skills table"
    - "Rating precision: store as integer * 100 (425 = 4.25 stars)"

key-files:
  created:
    - packages/db/src/schema/skill-versions.ts
    - packages/db/src/schema/ratings.ts
  modified:
    - packages/db/src/schema/skills.ts
    - packages/db/src/schema/index.ts

key-decisions:
  - "No FK from skills to skillVersions due to circular reference - enforce in app layer"
  - "Keep existing content field on skills for backward compatibility with MCP tools"
  - "Use integer * 100 for averageRating to preserve decimal precision without floats"

patterns-established:
  - "Immutable versions: skillVersions records never modified after creation"
  - "Content hash: SHA-256 for integrity verification of R2-stored content"
  - "Cascading deletes: skill deletion removes all versions and ratings"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 04 Plan 01: Versioned Data Model Summary

**Wiki-style skillVersions table with immutable records, ratings table with time-saved estimates, and extended skills table with version refs and denormalized aggregates**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T17:34:47Z
- **Completed:** 2026-01-31T17:36:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created skillVersions table for immutable version records with R2 content storage support
- Created ratings table with 1-5 star ratings, comments, and hoursSavedEstimate
- Extended skills table with publishedVersionId, draftVersionId, totalUses, averageRating
- Maintained backward compatibility by keeping content field for existing MCP tools

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skillVersions and ratings tables** - `b0fa976` (feat)
2. **Task 2: Extend skills table and update exports** - `1830e6c` (feat)

## Files Created/Modified
- `packages/db/src/schema/skill-versions.ts` - Immutable version records with contentUrl, contentHash, contentType, metadata
- `packages/db/src/schema/ratings.ts` - User ratings with optional comments and hoursSavedEstimate
- `packages/db/src/schema/skills.ts` - Added publishedVersionId, draftVersionId, totalUses, averageRating
- `packages/db/src/schema/index.ts` - Re-exports for skill-versions and ratings modules

## Decisions Made
- **Circular reference handling:** Cannot add FK from skills.publishedVersionId to skillVersions.id due to circular reference. Relationship integrity enforced at application layer.
- **Backward compatibility:** Kept existing `content` field on skills table (marked deprecated) since MCP tools currently use it. Will migrate in a later plan.
- **Rating precision:** Store averageRating as integer * 100 (e.g., 425 = 4.25 stars) to preserve decimal precision without floating point issues.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. Schema changes will be applied via `pnpm --filter @everyskill/db db:push` when database is available.

## Next Phase Readiness
- Schema ready for Plan 04-02 (Relations and Indexes)
- skillVersions table prepared for R2 storage integration (Phase 05)
- Denormalized aggregates ready for query optimization

---
*Phase: 04-data-model-storage*
*Completed: 2026-01-31*
