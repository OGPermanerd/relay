---
phase: 17-ai-review-pipeline
plan: 01
subsystem: database
tags: [drizzle, postgres, jsonb, anthropic-sdk, ai-review, schema]

# Dependency graph
requires:
  - phase: 15-embeddings-foundation
    provides: Schema patterns (skill-embeddings.ts), service layer conventions
provides:
  - skill_reviews table with JSONB categories, unique skillId, content hash, visibility toggle
  - CRUD service functions (getSkillReview, upsertSkillReview, toggleReviewVisibility)
  - ReviewCategories and ReviewCategoryScore TypeScript interfaces
  - @anthropic-ai/sdk installed for Claude API integration
affects: [17-02 (server action uses service layer), 17-03 (UI reads review data)]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk ^0.72.1"]
  patterns: ["Raw SQL upsert for tables with boolean/timestamp defaults (Drizzle type inference workaround)", "JSONB typed column for structured review data"]

key-files:
  created:
    - packages/db/src/schema/skill-reviews.ts
    - packages/db/src/services/skill-reviews.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/services/index.ts
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Used raw SQL for upsert and toggle due to Drizzle ORM type inference limitation with boolean/timestamp default columns"
  - "Created UpsertSkillReviewParams interface instead of using NewSkillReview for service function parameter type"

patterns-established:
  - "Raw SQL fallback: When Drizzle ORM type inference excludes columns with .default() from update operations, use db.execute(sql`...`) as a clean workaround"

# Metrics
duration: 5min
completed: 2026-02-03
---

# Phase 17 Plan 01: Schema, Service Layer & SDK Summary

**skill_reviews table with JSONB six-category scores, content hash change detection, and @anthropic-ai/sdk for Claude API integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-03T20:57:44Z
- **Completed:** 2026-02-03T21:03:25Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `skill_reviews` table with all required columns: JSONB categories, unique skillId constraint, content hash for change detection, visibility toggle, model name tracking
- Implemented service layer with getSkillReview, upsertSkillReview (ON CONFLICT DO UPDATE), and toggleReviewVisibility functions
- Installed @anthropic-ai/sdk v0.72.1 in the web app for Claude API access
- Exported all TypeScript types (SkillReview, NewSkillReview, ReviewCategories, ReviewCategoryScore, UpsertSkillReviewParams)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skill_reviews schema and service layer** - `65a63c1` (feat)
2. **Task 2: Install Anthropic SDK** - `077fdd1` (chore)

## Files Created/Modified
- `packages/db/src/schema/skill-reviews.ts` - Table definition with JSONB categories, ReviewCategoryScore and ReviewCategories interfaces, type exports
- `packages/db/src/services/skill-reviews.ts` - getSkillReview, upsertSkillReview (raw SQL upsert), toggleReviewVisibility functions
- `packages/db/src/schema/index.ts` - Added skill-reviews re-export
- `packages/db/src/services/index.ts` - Added skill-reviews service re-exports
- `apps/web/package.json` - Added @anthropic-ai/sdk ^0.72.1 dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- **Raw SQL for upsert and toggle:** Drizzle ORM's type inference excludes columns with `.default()` (boolean `isVisible`, timestamp `createdAt`) from `onConflictDoUpdate` and `.update().set()` types. Used `db.execute(sql\`...\`)` as a clean workaround rather than type assertions.
- **UpsertSkillReviewParams interface:** Created a dedicated interface for the upsert function instead of using `NewSkillReview` (which excludes optional fields from its inferred type), making the API clearer and type-safe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle ORM type inference with default columns**
- **Found during:** Task 1 (service layer implementation)
- **Issue:** `onConflictDoUpdate` and `.update().set()` TypeScript types excluded `isVisible` (boolean with `.default(true)`) and `createdAt` (timestamp with `.defaultNow()`) from allowed set fields
- **Fix:** Used raw SQL via `db.execute(sql\`...\`)` for upsert and toggle operations; created explicit `UpsertSkillReviewParams` interface
- **Files modified:** `packages/db/src/services/skill-reviews.ts`
- **Verification:** TypeScript compiles without errors, database operations work correctly
- **Committed in:** 65a63c1

**2. [Rule 3 - Blocking] pnpm store permission issue**
- **Found during:** Task 2 (SDK installation)
- **Issue:** pnpm store at `/root/.local/share/pnpm/store/v3/` had permission issues preventing package installation
- **Fix:** Reconfigured pnpm store-dir to `/home/dev/.pnpm-store` (user-accessible path)
- **Files modified:** pnpm global config
- **Verification:** `pnpm ls @anthropic-ai/sdk --filter web` shows v0.72.1
- **Committed in:** 077fdd1

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `packages/db/src/seed.ts` (unrelated to this plan) -- did not affect our schema or service compilation.

## User Setup Required

**External services require manual configuration.** The `ANTHROPIC_API_KEY` environment variable must be added to `.env.local`:
- Source: Anthropic Console -> API Keys (https://console.anthropic.com/settings/keys)
- Add to `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...`

## Next Phase Readiness
- Schema and service layer ready for Plan 02 (server action + AI review generation logic)
- @anthropic-ai/sdk installed and ready for import in server actions
- Database table pushed and verified with all constraints

---
*Phase: 17-ai-review-pipeline*
*Completed: 2026-02-03*
