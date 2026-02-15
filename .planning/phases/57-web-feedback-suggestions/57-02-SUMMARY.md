---
phase: 57-web-feedback-suggestions
plan: 02
subsystem: ui
tags: [react, useActionState, tailwind, tabs, forms, suggestions]

# Dependency graph
requires:
  - phase: 57-web-feedback-suggestions
    plan: 01
    provides: submitSuggestion server action, getSuggestionsForSkill DB service, SuggestionState type
provides:
  - SuggestionForm client component with category/severity/description/suggestedContent fields
  - SkillDetailTabs extended with "suggestions" tab key, suggestionsContent prop, and count badge
  - Skill detail page wired with suggestion fetching, pending count, and form rendering
affects: [57-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [useActionState for suggestion form (matches rating-form pattern), optional tab props for backward compatibility]

key-files:
  created:
    - apps/web/components/suggestion-form.tsx
  modified:
    - apps/web/components/skill-detail-tabs.tsx
    - apps/web/app/(protected)/skills/[slug]/page.tsx

key-decisions:
  - "Followed rating-form.tsx pattern exactly for useActionState integration, including SuggestionState type defined locally (not re-exported from 'use server' file)"
  - "Tab props suggestionsContent and suggestionCount are optional with defaults for backward compatibility"
  - "Character count for description textarea uses local useState (not form state) for real-time feedback"

patterns-established:
  - "Optional tab props: new tabs added with optional props and defaults so existing consumers are unaffected"
  - "Select elements use same Tailwind styling as text inputs for visual consistency"

# Metrics
duration: 5min
completed: 2026-02-15
---

# Phase 57 Plan 02: Suggestion Form UI & Tab Integration Summary

**Client-side suggestion form with category/severity selects and Suggestions tab on skill detail page with pending count badge**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-15T15:33:56Z
- **Completed:** 2026-02-15T15:39:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created SuggestionForm component with 5 category options, 3 severity levels, description with character count, and optional suggested content textarea
- Extended SkillDetailTabs with "Suggestions" tab showing pending count badge when suggestions exist
- Wired skill detail page to fetch suggestions in parallel and render form for authenticated users

## Task Commits

Each task was committed atomically:

1. **Task 1: Suggestion form component and tab extension** - `45381a9` (feat)
2. **Task 2: Wire suggestions into skill detail page** - `02b96e2` (feat, merged with parallel 60-03 agent commit)

## Files Created/Modified
- `apps/web/components/suggestion-form.tsx` - Client form with category select (5 options), severity select (3 options), description textarea with char count, optional suggested content, field-level error display, success/error feedback
- `apps/web/components/skill-detail-tabs.tsx` - Extended TabKey union with "suggestions", added suggestionsContent and suggestionCount optional props, renders badge as "Suggestions (N)" when count > 0
- `apps/web/app/(protected)/skills/[slug]/page.tsx` - Added getSuggestionsForSkill to parallel fetch, computed pendingSuggestionCount, passes SuggestionForm and count to tabs

## Decisions Made
- Defined SuggestionState type locally in the client component (not imported from server action) to avoid bundler issues with "use server" re-exports
- Used `useState` for real-time character count rather than reading from form state
- Made suggestionsContent default to `null` and suggestionCount optional for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `pnpm build` OOM-killed (exit 137) - pre-existing infrastructure issue with Next.js 16.1.6 Turbopack in this container. TypeScript compilation via tsc --noEmit passes with zero errors, confirming code correctness.
- Task 2 page.tsx changes were incorporated by a parallel agent (60-03) commit `02b96e2` that was editing the same file concurrently. The parallel commit includes all planned suggestion wiring changes.
- Skills listing page hydration test has pre-existing failure unrelated to these changes; skill detail page hydration test passes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Suggestion form is functional and wired to server action
- Plan 57-03 can now add the suggestion list component showing existing suggestions with status management
- getSuggestionsForSkill already fetches enriched data with user/reviewer joins ready for list display

## Self-Check: PASSED

All 3 files verified present. Both commits (45381a9, 02b96e2) verified in git log. All key content markers found in source files.

---
*Phase: 57-web-feedback-suggestions*
*Completed: 2026-02-15*
