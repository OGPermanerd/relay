---
phase: 39-fork-detection
plan: 04
subsystem: ui
tags: [drift-detection, fork, diff, comparison, tailwind]

requires:
  - phase: 39-fork-detection
    provides: forkedAtContentHash column on skills schema (plan 01)
provides:
  - DriftIndicator badge component for fork divergence status
  - Side-by-side comparison page at /skills/[slug]/compare
affects: [fork-detection, skill-detail]

tech-stack:
  added: []
  patterns: [frontmatter-stripped body hashing for drift detection, ReviewDiffView reuse for fork comparison]

key-files:
  created:
    - apps/web/components/drift-indicator.tsx
    - apps/web/app/(protected)/skills/[slug]/compare/page.tsx
  modified:
    - apps/web/components/skill-detail.tsx
    - apps/web/app/(protected)/skills/[slug]/page.tsx

key-decisions:
  - "Drift status computed server-side on skill detail page load -- no client-side hash computation"
  - "DriftIndicator is a stateless server component (no use client) for zero JS overhead"
  - "Compare page reuses ReviewDiffView client component for consistent diff rendering"
  - "Frontmatter stripped from both fork and parent before diff to avoid noise"

patterns-established:
  - "stripFm helper: regex-based frontmatter removal for body-only hash comparison"
  - "Drift indicator placement: after ForkAttribution, before QualityBreakdown"

duration: 3min
completed: 2026-02-08
---

# Phase 39 Plan 04: Fork Drift UI Summary

**DriftIndicator badge on fork detail pages with three states (current/diverged/unknown) and side-by-side comparison page reusing ReviewDiffView**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T21:28:54Z
- **Completed:** 2026-02-08T21:32:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DriftIndicator component with color-coded badges: green (in sync), amber (diverged + compare link), gray (unknown)
- Drift status computation on skill detail page using body-hash comparison against forkedAtContentHash
- Side-by-side comparison page at /skills/[slug]/compare with access control, non-fork guard, and deleted parent handling
- All 45 Playwright tests pass, full build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DriftIndicator component and wire into skill detail page** - `b82bfef` (feat)
2. **Task 2: Create side-by-side comparison page** - `b23c594` (feat)

## Files Created/Modified
- `apps/web/components/drift-indicator.tsx` - DriftIndicator badge component with current/diverged/unknown states
- `apps/web/app/(protected)/skills/[slug]/compare/page.tsx` - Side-by-side comparison page using ReviewDiffView
- `apps/web/components/skill-detail.tsx` - Added driftStatus and compareSlug props, renders DriftIndicator
- `apps/web/app/(protected)/skills/[slug]/page.tsx` - Computes drift status from forkedAtContentHash comparison

## Decisions Made
- Drift status computed server-side by stripping frontmatter and hashing the body, comparing against forkedAtContentHash
- DriftIndicator is a plain server component (no "use client") since it's purely presentational
- Compare page fetches parent separately (not in parallel with fork) because forkedFromId is needed first
- Frontmatter stripped from both sides in diff view to avoid noisy YAML differences

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 39 complete: all 4 plans shipped (schema, MCP check_skill_status, MCP update_skill, drift UI + compare page)
- Fork detection system fully operational: hash at fork time, drift indicator, side-by-side comparison, MCP tooling

## Self-Check: PASSED

- FOUND: apps/web/components/drift-indicator.tsx
- FOUND: apps/web/app/(protected)/skills/[slug]/compare/page.tsx
- FOUND: commit b82bfef (Task 1)
- FOUND: commit b23c594 (Task 2)

---
*Phase: 39-fork-detection*
*Completed: 2026-02-08*
