---
phase: 35-ai-review-integration
plan: 03
subsystem: mcp
tags: [mcp, anthropic-sdk, ai-review, skill-pipeline, tool-registration]

# Dependency graph
requires:
  - phase: 35-01
    provides: skill_reviews schema, skill-status state machine, checkAutoApprove function
provides:
  - review_skill MCP tool (advisory AI review)
  - submit_for_review MCP tool (full pipeline with auto-approve)
  - check_review_status MCP tool (pipeline status inquiry)
affects: [36-admin-review-ui, 38-mcp-discovery]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk (apps/mcp)"]
  patterns: ["Self-contained MCP tools with duplicated state machine logic to avoid tsup DTS resolution issues"]

key-files:
  created:
    - apps/mcp/src/tools/review-skill.ts
    - apps/mcp/src/tools/check-review-status.ts
    - apps/mcp/src/tools/submit-for-review.ts
  modified:
    - apps/mcp/src/tools/index.ts
    - apps/mcp/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Duplicated state machine (canTransition, checkAutoApprove) into submit-for-review.ts to avoid tsup DTS build failures from @everyskill/db service exports"
  - "review_skill does NOT require ownership — any authenticated user can review any visible skill"
  - "submit_for_review checks ANTHROPIC_API_KEY before any status transitions to prevent stuck states"
  - "Exported generateSkillReview, hashContent, REVIEW_MODEL from review-skill.ts for reuse by submit-for-review.ts"

patterns-established:
  - "MCP review tools: auth -> db -> API key -> fetch -> business logic -> respond pattern"
  - "Self-contained state machine duplication in MCP server avoids cross-package DTS issues"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 35 Plan 03: MCP Review Tools Summary

**Three MCP tools (review_skill, submit_for_review, check_review_status) with @anthropic-ai/sdk enabling AI review from Claude Code**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08T17:55:53Z
- **Completed:** 2026-02-08T18:00:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- review_skill: advisory-only AI review returning quality/clarity/completeness scores (1-10) with suggestions
- submit_for_review: full pipeline — transitions skill to pending_review, runs AI review, auto-approves if all scores >= 7/10
- check_review_status: returns pipeline status and scores for user's skills (all in pipeline or specific skill)
- All three tools require EVERYSKILL_API_KEY authentication
- review_skill and submit_for_review require ANTHROPIC_API_KEY (checked before any state changes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install SDK + create review_skill and check_review_status tools** - `324bcb5` (feat)
2. **Task 2: Create submit_for_review MCP tool with full pipeline** - `8043360` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/review-skill.ts` - Advisory AI review tool with exported generateSkillReview, hashContent, REVIEW_MODEL
- `apps/mcp/src/tools/check-review-status.ts` - Pipeline status inquiry tool with LEFT JOIN to skill_reviews
- `apps/mcp/src/tools/submit-for-review.ts` - Full pipeline tool with state machine, auto-approve logic, error recovery
- `apps/mcp/src/tools/index.ts` - Added imports for all three new tools
- `apps/mcp/package.json` - Added @anthropic-ai/sdk dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Duplicated canTransition/checkAutoApprove into submit-for-review.ts rather than importing from @everyskill/db — tsup DTS build fails resolving those service exports due to pre-existing module resolution issues in apps/mcp
- review_skill is advisory-only and does NOT require skill ownership — any authenticated user can review any visible skill, matching the plan's must_haves
- ANTHROPIC_API_KEY checked before any status transitions in submit_for_review to prevent skills stuck in pending_review

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Duplicated state machine functions instead of importing from @everyskill/db**
- **Found during:** Task 2 (submit_for_review build)
- **Issue:** `canTransition`, `checkAutoApprove`, and `SkillStatus` imports from `@everyskill/db` cause tsup DTS build failure (TS2305: Module has no exported member)
- **Fix:** Duplicated the small state machine functions (~30 lines) directly into submit-for-review.ts
- **Files modified:** apps/mcp/src/tools/submit-for-review.ts
- **Verification:** `pnpm build` succeeds with both CJS and DTS output
- **Committed in:** 8043360 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary workaround for pre-existing tsup DTS resolution issue. No scope creep.

## Issues Encountered
None beyond the documented deviation.

## User Setup Required
None - ANTHROPIC_API_KEY requirement was already documented in 35-01. No new external service configuration needed.

## Next Phase Readiness
- All three MCP review tools registered and building successfully
- Phase 35 (AI Review Integration) is now complete: schema, auto-approve logic, web UI submit action, and MCP tools all shipped
- Ready for Phase 36 (Admin Review UI) which uses the ai_reviewed status set by these tools

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (324bcb5, 8043360) confirmed in git log.

---
*Phase: 35-ai-review-integration*
*Completed: 2026-02-08*
