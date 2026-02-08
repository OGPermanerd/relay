---
phase: 34-review-pipeline-foundation
plan: 04
subsystem: ui, api
tags: [access-control, status-badges, server-actions, state-machine, review-pipeline]

# Dependency graph
requires:
  - phase: 34-01
    provides: skill status column and state machine (canTransition, SkillStatus)
provides:
  - skill detail page access control (404 for non-author/non-admin on unpublished)
  - status badges on My Skills page with color-coded labels
  - submitForReview server action with state machine validation
affects: [34-05, 35-review-pipeline-ai]

# Tech tracking
tech-stack:
  added: []
  patterns: [parallel session+data fetch for access control, status color/label mapping pattern]

key-files:
  created:
    - apps/web/app/actions/submit-for-review.ts
  modified:
    - apps/web/app/(protected)/skills/[slug]/page.tsx
    - apps/web/app/(protected)/my-skills/page.tsx
    - apps/web/components/my-skills-list.tsx

key-decisions:
  - "Parallel fetch of skill + session for access control avoids waterfall"
  - "Status badge uses separate STATUS_COLORS and STATUS_LABELS maps for all 7 pipeline states"
  - "Submit for Review button only shown for draft status skills"

patterns-established:
  - "Access control pattern: isPublished || isAuthor || isAdmin, else notFound()"
  - "Status badge pattern: STATUS_COLORS + STATUS_LABELS maps with fallback styling"

# Metrics
duration: 7min
completed: 2026-02-08
---

# Phase 34 Plan 04: Access Control, Status Badges, and Submit-for-Review Summary

**Skill detail page 404s non-author/non-admin visitors on unpublished skills, My Skills shows status badges, and draft skills can be submitted for review via state machine**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-08T17:10:29Z
- **Completed:** 2026-02-08T17:17:44Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Skill detail page enforces access control: non-published skills return 404 for non-author/non-admin users (RVPL-09)
- My Skills page displays color-coded status badges for all 7 review pipeline states (RVPL-12)
- submitForReview server action validates ownership, checks canTransition state machine, and transitions draft to pending_review (RVPL-02, RVPL-05)
- Session and skill data fetched in parallel to avoid waterfall on access control check

## Task Commits

Each task was committed atomically:

1. **Task 1: Skill detail access control + submit-for-review action** - `90d22bd` (feat)
2. **Task 2: My Skills page with status badges and submit button** - `15fa29e` (feat)

## Files Created/Modified
- `apps/web/app/actions/submit-for-review.ts` - Server action: validates auth, ownership, state machine transition, updates status
- `apps/web/app/(protected)/skills/[slug]/page.tsx` - Added parallel session fetch, access control gating for unpublished skills
- `apps/web/app/(protected)/my-skills/page.tsx` - Added status column to query, updated subtitle
- `apps/web/components/my-skills-list.tsx` - Status badges with 7-state color/label maps, Submit for Review button for drafts

## Decisions Made
- Parallel fetch of skill + session avoids waterfall while enabling early access control
- Status badge maps cover all 7 states (draft, pending_review, ai_reviewed, approved, rejected, changes_requested, published) with distinct colors
- Submit for Review button uses router.refresh() after success for immediate UI update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Next.js Turbopack build failed with ENOENT on _buildManifest.js.tmp - resolved by adding NODE_OPTIONS="--max-old-space-size=4096" to the build command

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Access control, status badges, and submit-for-review are in place
- Ready for 34-05 (admin review queue) which depends on skills having non-published statuses
- AI review integration (Phase 35) can hook into the pending_review -> ai_reviewed transition

---
*Phase: 34-review-pipeline-foundation*
*Completed: 2026-02-08*
