---
phase: 31-skills-upload-enhancements
plan: 03
subsystem: ai, api
tags: [anthropic, structured-outputs, ai-review, fire-and-forget, zod]

# Dependency graph
requires:
  - phase: 17-ai-review
    provides: AI review infrastructure (ai-review.ts, skill-reviews schema/service)
provides:
  - suggestedDescription field in AI review output and skill_reviews table
  - Auto-triggered AI review on skill upload (fire-and-forget)
  - Structured outputs via json_schema output_config for guaranteed JSON compliance
affects: [31-04, 31-05, 31-06, skill-detail-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [json_schema structured outputs, fire-and-forget background processing]

key-files:
  created:
    - packages/db/src/migrations/0009_add_suggested_description.sql
  modified:
    - apps/web/lib/ai-review.ts
    - apps/web/app/actions/skills.ts
    - apps/web/app/actions/ai-review.ts
    - packages/db/src/schema/skill-reviews.ts
    - packages/db/src/services/skill-reviews.ts

key-decisions:
  - "json_schema output_config over zodOutputFormat -- zod 3.25.x lacks toJSONSchema export required by SDK helper"
  - "tenant_id added to upsert SQL for ON CONFLICT (tenant_id, skill_id) correctness"

patterns-established:
  - "Structured outputs: use json_schema output_config with explicit JSON schema constant"
  - "Auto-review: fire-and-forget autoGenerateReview after skill creation"

# Metrics
duration: 6min
completed: 2026-02-08
---

# Phase 31 Plan 03: AI Review Enhancement Summary

**Structured output AI review with suggestedDescription field and automatic fire-and-forget trigger on skill upload**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T06:45:55Z
- **Completed:** 2026-02-08T06:51:55Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `suggested_description` nullable column to `skill_reviews` table (migration 0009)
- Enhanced AI review to produce `suggestedDescription` via structured outputs (json_schema)
- Auto-trigger AI review on both `checkAndCreateSkill` and `createSkill` server actions
- Fixed existing on-demand review action to pass `suggestedDescription` through
- Fixed upsert SQL to include `tenant_id` for proper ON CONFLICT behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Add suggestedDescription to AI review schema and output** - `9ba7a0e` (feat)
2. **Task 2: Auto-trigger AI review on upload** - `1275ab6` (feat)

## Files Created/Modified
- `packages/db/src/migrations/0009_add_suggested_description.sql` - ALTER TABLE migration
- `packages/db/src/schema/skill-reviews.ts` - Added suggestedDescription column
- `packages/db/src/services/skill-reviews.ts` - Added tenantId + suggestedDescription to upsert
- `apps/web/lib/ai-review.ts` - Structured outputs, suggestedDescription in schema
- `apps/web/app/actions/skills.ts` - autoGenerateReview helper + fire-and-forget calls
- `apps/web/app/actions/ai-review.ts` - Fixed to pass suggestedDescription through

## Decisions Made
- Used `json_schema` output_config with explicit JSON schema instead of `zodOutputFormat` -- the SDK's zod helper requires `toJSONSchema` which only exists in zod 4.x, while the project uses zod 3.25.76
- Added `tenant_id` to the upsert INSERT and updated ON CONFLICT to `(tenant_id, skill_id)` to match the unique index

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed on-demand review action not passing suggestedDescription**
- **Found during:** Task 1 (schema enhancement)
- **Issue:** `apps/web/app/actions/ai-review.ts` destructured `const { summary, ...categories } = reviewOutput` which would include `suggestedDescription` in `categories` JSONB
- **Fix:** Updated destructuring to `const { summary, suggestedDescription, ...categories } = reviewOutput` and passed `suggestedDescription` to `upsertSkillReview`
- **Files modified:** apps/web/app/actions/ai-review.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 9ba7a0e (Task 1 commit)

**2. [Rule 3 - Blocking] Replaced zodOutputFormat with json_schema output_config**
- **Found during:** Task 2 (build verification)
- **Issue:** Turbopack build failed -- `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` imports `toJSONSchema` from zod which doesn't exist in zod 3.25.x
- **Fix:** Removed `zodOutputFormat` import, created explicit `REVIEW_JSON_SCHEMA` constant, used `output_config: { format: { type: "json_schema", schema: REVIEW_JSON_SCHEMA } }`
- **Files modified:** apps/web/lib/ai-review.ts
- **Verification:** `pnpm build` succeeds
- **Committed in:** 1275ab6 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed upsert SQL missing tenant_id**
- **Found during:** Task 1 (service update)
- **Issue:** The existing upsert SQL did not include `tenant_id` in INSERT, but ON CONFLICT unique index is on `(tenant_id, skill_id)` -- would fail for any non-default tenant
- **Fix:** Added `tenant_id` to INSERT columns/values, updated ON CONFLICT to `(tenant_id, skill_id)`, added `tenantId` to `UpsertSkillReviewParams`
- **Files modified:** packages/db/src/services/skill-reviews.ts
- **Verification:** TypeScript compiles, builds succeed
- **Committed in:** 9ba7a0e (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and build success. No scope creep.

## Issues Encountered
- Turbopack build failure due to zod version incompatibility with Anthropic SDK helper -- resolved by using raw json_schema format directly

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AI review now auto-triggers on upload and includes suggestedDescription
- The suggestedDescription field is ready to be displayed in skill detail UI (future plan)
- On-demand re-review button continues to work alongside auto-review

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (9ba7a0e, 1275ab6) found in git log.

---
*Phase: 31-skills-upload-enhancements*
*Completed: 2026-02-08*
