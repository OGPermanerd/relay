---
phase: 36-admin-review-ui
plan: 01
subsystem: database
tags: [drizzle, postgres, rls, review-decisions, query-functions]

# Dependency graph
requires:
  - phase: 35-ai-review
    provides: "skill_reviews table, AI review service, skill status state machine"
  - phase: 34-skill-lifecycle
    provides: "skill status column, status filtering patterns"
provides:
  - "review_decisions immutable audit trail table with RLS"
  - "createReviewDecision and getDecisionsForSkill service functions"
  - "getReviewQueue, getReviewDetail, getPendingReviewCount query functions"
affects: [36-admin-review-ui, 37-review-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: ["insert-only immutable table for SOC2 audit trail", "parallel data+count queries for pagination"]

key-files:
  created:
    - "packages/db/src/schema/review-decisions.ts"
    - "packages/db/src/services/review-decisions.ts"
    - "packages/db/src/migrations/0015_create_review_decisions.sql"
    - "apps/web/lib/review-queries.ts"
  modified:
    - "packages/db/src/schema/index.ts"
    - "packages/db/src/relations/index.ts"
    - "packages/db/src/services/index.ts"

key-decisions:
  - "review_decisions table is insert-only (no updatedAt) for SOC2 immutable audit trail"
  - "AI scores snapshot stored as JSONB for point-in-time record of review state"
  - "Default queue status filter is ai_reviewed (skills awaiting human review)"
  - "All dates serialized as ISO strings before returning to client for hydration safety"

patterns-established:
  - "Immutable audit table: no updatedAt, insert-only, never UPDATE or DELETE"
  - "Parallel pagination: Promise.all for data rows + count in same query set"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 36 Plan 01: Review Data Layer Summary

**Immutable review_decisions table with RLS + server-side query functions for review queue, detail, and pending count**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08T18:43:17Z
- **Completed:** 2026-02-08T18:47:43Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created review_decisions table with immutable insert-only design (no updatedAt) for SOC2 compliance
- Added 3 indexes (skill_id, tenant_id, reviewer_id) and RLS tenant isolation policy
- Built createReviewDecision and getDecisionsForSkill service functions with proper DB guard
- Created getReviewQueue with pagination, status/category/date filtering, and parallel count query
- Created getReviewDetail combining skill + AI review + decision history
- Created getPendingReviewCount for admin badge counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create review_decisions schema, migration, service, and relations** - `56410e5` (feat)
2. **Task 2: Create review query functions for queue, detail, and pending count** - `13e706c` (feat)

## Files Created/Modified
- `packages/db/src/schema/review-decisions.ts` - Immutable review_decisions table schema with RLS
- `packages/db/src/migrations/0015_create_review_decisions.sql` - SQL migration with table, indexes, RLS
- `packages/db/src/services/review-decisions.ts` - createReviewDecision + getDecisionsForSkill
- `packages/db/src/schema/index.ts` - Added review-decisions re-export
- `packages/db/src/relations/index.ts` - Added reviewDecisionsRelations + many refs from skills/users/tenants
- `packages/db/src/services/index.ts` - Added review-decisions service re-exports
- `apps/web/lib/review-queries.ts` - getReviewQueue, getReviewDetail, getPendingReviewCount

## Decisions Made
- review_decisions table is insert-only with no updatedAt column for SOC2 immutable audit compliance
- AI scores snapshot stored as JSONB to capture point-in-time state at decision time
- previousContent column captures skill content at decision time for future diff view
- Default status filter in getReviewQueue is "ai_reviewed" (the standard pending-review state)
- All dates serialized as ISO strings before returning to prevent React hydration mismatches

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete and ready for Plan 02 (server actions for approve/reject/changes_requested)
- Query functions ready for Plan 03 (review queue UI and detail page)
- review_decisions table deployed and verified in database with all indexes and RLS

---
*Phase: 36-admin-review-ui*
*Completed: 2026-02-08*
