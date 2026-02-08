---
phase: 31-skills-upload-enhancements
plan: 05
subsystem: ui
tags: [react, similarity, embeddings, upload, tailwind]

# Dependency graph
requires:
  - phase: 31-03
    provides: autoGenerateReview function and AI review pipeline
provides:
  - SimilarityPane component with rich skill cards and two-column upload layout
  - Hidden matchType labels across all similarity displays
  - AI review summary enrichment for future similarity embeddings
affects: [31-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-column responsive form layout with side panel, fire-and-forget embedding enrichment]

key-files:
  created:
    - apps/web/components/similarity-pane.tsx
  modified:
    - apps/web/components/similar-skills-warning.tsx
    - apps/web/components/similar-skills-section.tsx
    - apps/web/components/skill-upload-form.tsx
    - apps/web/app/(protected)/skills/new/page.tsx
    - apps/web/app/actions/skills.ts
    - apps/web/tests/e2e/duplicate-check.spec.ts

key-decisions:
  - "Form visible alongside SimilarityPane (not hidden) for better UX"
  - "messageTarget state prefixed with underscore (_messageTarget) to satisfy ESLint until Plan 06 wires it"
  - "Enriched embedding fires after AI review completes (benefits future uploads, not current)"

patterns-established:
  - "Two-column responsive layout: flex-col on mobile, flex-row on lg breakpoint"
  - "Fire-and-forget embedding re-generation after review with .catch(() => {})"

# Metrics
duration: 15min
completed: 2026-02-08
---

# Phase 31 Plan 05: Similarity Pane and Embedding Enrichment Summary

**Rich SimilarityPane with two-column upload layout, hidden match labels, and AI-review-enriched embeddings for future matching**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-08T06:54:59Z
- **Completed:** 2026-02-08T07:10:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created SimilarityPane component with skill cards showing name, description, category, usage stats, and colored similarity bars
- Replaced SimilarSkillsWarning with SimilarityPane in upload form, showing form + pane side-by-side
- Removed all "Semantic match" / "Name match" labels from user-facing UI (SKILL-03)
- Added AI review summary to embedding regeneration for better future similarity detection (SKILL-07)
- Updated E2E tests to match new SimilarityPane UI structure

## Task Commits

Each task was committed atomically:

1. **Task 1: Hide matchType labels and create SimilarityPane component** - `96a0b21` (feat)
2. **Task 2: Wire SimilarityPane into upload form and enrich embeddings** - `a79c580` (feat)

## Files Created/Modified
- `apps/web/components/similarity-pane.tsx` - New rich SimilarityPane with colored progress bars, action buttons, responsive layout
- `apps/web/components/similar-skills-warning.tsx` - Removed matchType label spans
- `apps/web/components/similar-skills-section.tsx` - Removed matchType label spans
- `apps/web/components/skill-upload-form.tsx` - Replaced SimilarSkillsWarning with SimilarityPane, two-column flex layout
- `apps/web/app/(protected)/skills/new/page.tsx` - Widened container from max-w-2xl to max-w-5xl
- `apps/web/app/actions/skills.ts` - Added enriched embedding regeneration after AI review
- `apps/web/tests/e2e/duplicate-check.spec.ts` - Updated assertions for new SimilarityPane UI

## Decisions Made
- Form stays visible alongside the SimilarityPane (not hidden) -- better UX for editing while reviewing matches
- messageTarget state uses underscore prefix (_messageTarget) to pass ESLint until Plan 06 wires messaging
- Enriched embedding regeneration is fire-and-forget after AI review, benefits future uploads only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated duplicate-check E2E tests for new UI**
- **Found during:** Task 2 (verification step)
- **Issue:** Tests referenced removed "Semantic match"/"Name match" labels and `li.group` hover popup selectors that no longer exist
- **Fix:** Updated test assertions to match SimilarityPane card structure (inline descriptions, flexible skill name matching, category badge CSS selector)
- **Files modified:** apps/web/tests/e2e/duplicate-check.spec.ts
- **Verification:** All 3 duplicate-check tests pass
- **Committed in:** a79c580 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed unused variable ESLint error for messageTarget**
- **Found during:** Task 2 (commit pre-hook)
- **Issue:** messageTarget variable assigned but never read (placeholder for Plan 06)
- **Fix:** Prefixed with underscore: `const [_messageTarget, setMessageTarget]`
- **Files modified:** apps/web/components/skill-upload-form.tsx
- **Verification:** ESLint passes, commit succeeds
- **Committed in:** a79c580 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for test/lint compliance. No scope creep.

## Issues Encountered
- Next.js 16.1.6 build had intermittent ENOENT errors on `_buildManifest.js.tmp` files -- resolved by removing `.next` directory and rebuilding fresh
- lint-staged during Task 1 commit reformatted unrelated files -- restored via `git checkout`

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SimilarityPane ready for Plan 06 to wire the Message Author button
- messageTarget state already in place with setter passed to SimilarityPane
- Enriched embeddings will improve similarity detection quality over time as skills get reviewed

---
*Phase: 31-skills-upload-enhancements*
*Completed: 2026-02-08*
