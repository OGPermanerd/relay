---
phase: 13
plan: 04
subsystem: skills-page
tags: [nuqs, url-state, author-filter, leaderboard, filtering]
depends_on:
  requires: [13-01]
  provides: [author-filter-url-state, leaderboard-click-to-filter, author-filter-chip]
  affects: []
tech-stack:
  added: []
  patterns: [nuqs-url-state, toggle-filter-pattern]
key-files:
  created:
    - apps/web/hooks/use-author-filter.ts
    - apps/web/components/author-filter-chip.tsx
  modified:
    - apps/web/components/leaderboard-table.tsx
    - apps/web/lib/search-skills.ts
    - apps/web/app/(protected)/skills/page.tsx
decisions:
  - decision: "Toggle pattern for author filter"
    rationale: "Clicking same author clears filter; consistent with chip X behavior"
metrics:
  duration: "~3 min"
  completed: "2026-02-01"
---

# Phase 13 Plan 04: Author Filtering from Leaderboard Summary

**One-liner:** Click-to-filter leaderboard rows with URL-synced author filtering and removable chip.

## What Was Built

### useAuthorFilter Hook (`apps/web/hooks/use-author-filter.ts`)
- URL state management via nuqs with `?author=` parameter
- `filterByAuthor(authorId)` toggle function - clicking same author clears filter
- `clearAuthor()` function for chip X button
- `isPending` state for transition feedback

### AuthorFilterChip (`apps/web/components/author-filter-chip.tsx`)
- Displays "Author: {name}" with blue pill styling
- X button to clear filter with hover state
- Disabled state during URL transitions
- Only renders when author filter is active

### LeaderboardTable Updates (`apps/web/components/leaderboard-table.tsx`)
- Converted to client component with "use client"
- Added onClick handler to contributor rows
- Active author row highlighted with `ring-2 ring-blue-500 bg-blue-50`
- Clicking highlighted row toggles filter off
- cursor-pointer for interactivity cue

### Search & Page Integration
- Added `authorId` to `SearchParams` interface
- Added `eq(skills.authorId, authorId)` filter condition
- Skills page reads `?author=` param from URL
- Resolves author name from leaderboard for chip display
- Author filter included in `hasFilters` check

## Technical Decisions

1. **Toggle pattern for author filter:** Clicking same author in leaderboard clears filter (same as clicking chip X). This provides two clear ways to exit the filter state.

2. **Name resolution from leaderboard:** Instead of a separate query, author name is resolved from the already-fetched leaderboard data. Falls back to "Unknown" if author not in top 10.

## Commits

| Hash | Description |
|------|-------------|
| 635ad1c | feat(13-04): add author filter hook and chip component |
| 4a612c5 | feat(13-04): convert LeaderboardTable to client component with click handling |
| 59f0233 | feat(13-04): add author filter to searchSkills and wire to page |

## Verification Results

- TypeScript compiles without errors
- LeaderboardTable has "use client" directive
- useAuthorFilter imported in leaderboard-table and author-filter-chip
- Author filter stacks with existing filters (search, category, tags, quality)

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

**Created:**
- `apps/web/hooks/use-author-filter.ts` - Author filter URL state hook
- `apps/web/components/author-filter-chip.tsx` - Removable filter chip

**Modified:**
- `apps/web/components/leaderboard-table.tsx` - Client component with click handling
- `apps/web/lib/search-skills.ts` - Added authorId filter
- `apps/web/app/(protected)/skills/page.tsx` - Wire author param and chip

## Next Phase Readiness

Author filtering complete. Skills page now supports:
- Full-text search
- Category filtering
- Tag filtering
- Quality tier filtering
- Author filtering (from leaderboard click)
- Multiple sort options

All filters stack and persist in URL.
