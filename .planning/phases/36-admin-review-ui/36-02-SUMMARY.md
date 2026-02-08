---
phase: 36-admin-review-ui
plan: 02
subsystem: ui, api
tags: [server-actions, admin, review-queue, pagination, drizzle, next.js, playwright]

# Dependency graph
requires:
  - phase: 36-admin-review-ui
    plan: 01
    provides: review_decisions schema, review-queries library, review-decisions service
provides:
  - approveSkillAction server action (ai_reviewed -> approved -> published in transaction)
  - rejectSkillAction server action (with required notes and immutable audit trail)
  - requestChangesAction server action (with required feedback notes)
  - /admin/reviews page with server-side data fetching and pagination (20/page)
  - AdminReviewQueue client component with status/category/date range filters
  - Admin layout Reviews nav tab with red pending count badge
  - Playwright E2E tests for review queue page
affects: [36-03-admin-review-detail, admin-nav]

# Tech tracking
tech-stack:
  added: []
  patterns: [transactional admin actions with immutable audit trail, filter bar with URL search params]

key-files:
  created:
    - apps/web/app/actions/admin-reviews.ts
    - apps/web/app/(protected)/admin/reviews/page.tsx
    - apps/web/components/admin-review-queue.tsx
    - apps/web/tests/e2e/admin-reviews.spec.ts
  modified:
    - apps/web/app/(protected)/admin/layout.tsx

key-decisions:
  - "reviewerId captured before transaction closure to avoid TS narrowing loss inside async callback"
  - "Raw tx.insert used inside transactions instead of createReviewDecision service to maintain transaction context"
  - "Status filter defaults to ai_reviewed (awaiting human review) matching Plan 01 default"
  - "Reviews nav tab positioned first in admin nav for prominence"

patterns-established:
  - "Transactional admin actions: decision record + status update in single transaction"
  - "URL-based filter state: filters stored in searchParams, Apply button navigates with updated params"
  - "Manual UTC date formatting in client components for hydration safety"

# Metrics
duration: 6min
completed: 2026-02-08
---

# Phase 36 Plan 02: Admin Review Server Actions, Queue Page, and Nav Badge Summary

**Three admin review server actions (approve/reject/request-changes) with transactional audit trail, paginated review queue page with status/category/date filters, and admin nav badge showing pending count**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-08T18:50:10Z
- **Completed:** 2026-02-08T18:56:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Three server actions (approve, reject, request-changes) each validate admin role, check state machine transitions, and write immutable review_decisions record in a database transaction
- Review queue page at /admin/reviews with server-side data fetching, 20-per-page pagination, and filter bar for status/category/date range
- Admin layout updated with Reviews nav tab (positioned first) showing red badge with pending review count
- Playwright E2E tests verify page load, filter elements, nav presence, and dropdown options

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin review server actions** - `cafd8de` (feat)
2. **Task 2: Build review queue page, client table component, and admin nav badge** - `6907d33` (feat)

## Files Created/Modified
- `apps/web/app/actions/admin-reviews.ts` - Server actions for approve, reject, request-changes with transactional audit trail
- `apps/web/app/(protected)/admin/reviews/page.tsx` - Review queue page with server-side data fetching and pagination
- `apps/web/components/admin-review-queue.tsx` - Client component with filter bar, table, and pagination controls
- `apps/web/app/(protected)/admin/layout.tsx` - Added Reviews nav tab with pending count badge
- `apps/web/tests/e2e/admin-reviews.spec.ts` - Playwright E2E tests for review queue

## Decisions Made
- Used `reviewerId` captured before transaction to avoid TypeScript narrowing loss inside async closures
- Used raw `tx.insert` inside transactions instead of `createReviewDecision` service (service has its own db reference, not transaction context)
- Approve action chains `ai_reviewed -> approved -> published` in a single transaction matching submit-for-review auto-approve pattern
- Status filter defaults to `ai_reviewed` (awaiting human review) matching the Plan 01 query default

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript narrowing in transaction closures**
- **Found during:** Task 1 (Server actions)
- **Issue:** `session.user!.id` lost type narrowing inside `db.transaction()` async callback, causing `string | undefined` type error
- **Fix:** Captured `const reviewerId = session.user.id` before the transaction closure
- **Files modified:** apps/web/app/actions/admin-reviews.ts
- **Verification:** `pnpm build` passes with no type errors
- **Committed in:** cafd8de (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for TypeScript compilation. No scope creep.

## Issues Encountered
None - both tasks executed smoothly after the TypeScript narrowing fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Review queue page and server actions are ready for Plan 03 (admin review detail page)
- The detail page at `/admin/reviews/[skillId]` will use the server actions from this plan for approve/reject/request-changes buttons
- All query functions from Plan 01 (getReviewDetail) are available for the detail page

---
*Phase: 36-admin-review-ui*
*Completed: 2026-02-08*
