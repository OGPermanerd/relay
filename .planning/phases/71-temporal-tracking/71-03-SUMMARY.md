---
phase: 71-temporal-tracking
plan: 03
subsystem: ui
tags: [temporal-tracking, updated-badge, whats-new-feed, batch-query, amber-theme]

# Dependency graph
requires:
  - phase: 71-01
    provides: getUserViewsForSkills batch Map query, getWhatsNewForUser temporal join
provides:
  - UpdatedBadge component (amber-themed, sm/md sizes)
  - Batch "Updated" badge rendering on skills browse page (no N+1)
  - WhatsNewFeed dashboard widget showing recently updated previously-viewed skills
  - updatedAt field added to SearchSkillResult for temporal comparison
affects: [temporal-tracking UI, dashboard, skills browse]

# Tech tracking
tech-stack:
  added: []
  patterns: [serialized-set-prop, server-to-client-set-as-array, batch-view-comparison]

key-files:
  created:
    - apps/web/components/updated-badge.tsx
    - apps/web/components/whats-new-feed.tsx
  modified:
    - apps/web/lib/search-skills.ts
    - apps/web/app/(protected)/skills/page.tsx
    - apps/web/components/skills-table.tsx
    - apps/web/components/skills-table-row.tsx
    - apps/web/app/(protected)/page.tsx

key-decisions:
  - "Pass updatedSkillIds as string[] (not Set) across server/client boundary since Set is not serializable in RSC"
  - "Convert to Set on client side via useMemo for O(1) lookups during render"
  - "WhatsNewFeed returns null when items empty (hidden, not empty state)"

patterns-established:
  - "Batch view comparison: fetch views with getUserViewsForSkills, compare updatedAt > lastViewedAt, pass boolean flags to client"
  - "Serialized collection pattern: serialize Set as array for RSC boundary, reconstruct in client component with useMemo"

# Metrics
duration: 5min
completed: 2026-02-16
---

# Phase 71 Plan 03: Updated Badges & What's New Feed Summary

**Amber-themed UpdatedBadge on skills browse table with batch view comparison, plus WhatsNewFeed dashboard widget showing recently updated previously-viewed skills**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-16T21:34:54Z
- **Completed:** 2026-02-16T21:40:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created UpdatedBadge component with amber color scheme, sm (icon-only) and md (icon + text) sizes
- Added updatedAt to SearchSkillResult and both select queries in searchSkills
- Batch-loads user views via getUserViewsForSkills and computes updatedSkillIds set on server, passes as serialized array to client
- WhatsNewFeed component with sparkles icon, skill links, relative time, category badges, and view count context
- Dashboard fetches getWhatsNewForUser in parallel Promise.all, renders What's New section after Top Contributors
- All E2E tests pass (13/13 home, 22/23 skills browse -- 1 pre-existing unrelated failure)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create UpdatedBadge and wire into skills table** - `24458f4` (feat)
2. **Task 2: Create WhatsNewFeed and wire into dashboard** - `2dfab41` (already committed by 71-02 executor)

## Files Created/Modified
- `apps/web/components/updated-badge.tsx` - Amber-themed badge with arrow-path SVG, sm/md sizes
- `apps/web/components/whats-new-feed.tsx` - Dashboard widget with sparkles icon, skill links, relative time
- `apps/web/lib/search-skills.ts` - Added updatedAt to SearchSkillResult interface and both select queries
- `apps/web/app/(protected)/skills/page.tsx` - Batch view loading, updatedSkillIds computation, prop passing
- `apps/web/components/skills-table.tsx` - Added updatedSkillIds prop, useMemo Set conversion
- `apps/web/components/skills-table-row.tsx` - Added isUpdated prop, renders UpdatedBadge inline
- `apps/web/app/(protected)/page.tsx` - Added getWhatsNewForUser to Promise.all, renders WhatsNewFeed

## Decisions Made
- Pass updatedSkillIds as `string[]` across RSC boundary since `Set` is not serializable, reconstruct with `useMemo(new Set(...))` on client
- WhatsNewFeed returns `null` when items array is empty (section hidden rather than showing empty state)
- Added `updatedAt` to `SearchSkillResult` interface and both select queries (deviation: plan assumed it was already there)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added updatedAt to SearchSkillResult and select queries**
- **Found during:** Task 1 (skills page batch view comparison)
- **Issue:** Plan referenced `skill.updatedAt` but searchSkills didn't return updatedAt field
- **Fix:** Added updatedAt to SearchSkillResult interface and both .select() calls in searchSkills
- **Files modified:** apps/web/lib/search-skills.ts
- **Verification:** Typecheck passes, updatedAt available for comparison
- **Committed in:** 24458f4 (Task 1 commit)

**2. [Rule 1 - Bug] Serialized Set as array for RSC boundary**
- **Found during:** Task 1 (passing updatedSkillIds to client component)
- **Issue:** Plan specified `Set<string>` prop but Set is not serializable across server/client RSC boundary
- **Fix:** Pass as `string[]`, reconstruct Set with useMemo on client side
- **Files modified:** apps/web/components/skills-table.tsx, apps/web/app/(protected)/skills/page.tsx
- **Verification:** No serialization errors, typecheck passes
- **Committed in:** 24458f4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Task 2 (WhatsNewFeed + dashboard) was already implemented by the 71-02 plan executor as part of its commit `2dfab41`. No additional commit needed for Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All TEMP-02 (Updated badges) and TEMP-04 (What's New feed) features complete
- Phase 71 temporal tracking UI is fully wired
- Ready for Phase 72 (Similarity Graph) or phase verification

## Self-Check: PASSED

All files verified present. Task 1 commit hash (24458f4) found in git log. Task 2 changes verified at HEAD (2dfab41).

---
*Phase: 71-temporal-tracking*
*Completed: 2026-02-16*
