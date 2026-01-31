---
phase: 06-discovery
plan: 03
subsystem: ui
tags: [nuqs, url-state, nextjs, react, search, filters]

# Dependency graph
requires:
  - phase: 06-01
    provides: Full-text search infrastructure with searchSkills function
provides:
  - URL-synchronized search and filter components using nuqs
  - NuqsAdapter wrapper for application-wide URL state management
  - SearchInput with debounced URL parameter updates
  - CategoryFilter and TagFilter with instant URL synchronization
  - Tag filtering placeholder ready for metadata column addition
affects: [06-04, future-search, discovery-features]

# Tech tracking
tech-stack:
  added: [nuqs]
  patterns: [nuqs URL state management, debounced search input, parseAsString/parseAsStringEnum/parseAsArrayOf parsers]

key-files:
  created: []
  modified:
    - apps/web/components/providers.tsx
    - apps/web/components/search-input.tsx
    - apps/web/components/category-filter.tsx
    - apps/web/components/tag-filter.tsx
    - apps/web/lib/search-skills.ts
    - apps/web/package.json

key-decisions:
  - "Use nuqs over direct Next.js useRouter/useSearchParams for cleaner URL state management"
  - "300ms debounce on search input to prevent excessive URL updates"
  - "Tag filtering implemented as placeholder until metadata JSONB column added to skills table"

patterns-established:
  - "nuqs parsers: parseAsString for query, parseAsStringEnum for category, parseAsArrayOf for tags"
  - "startTransition for non-blocking URL updates with pending states"
  - "defaultValue pattern for controlled inputs with URL state"

# Metrics
duration: 7min
completed: 2026-01-31
---

# Phase 6 Plan 3: URL-Synced Filters Summary

**nuqs-powered search and filter components with debounced input, category tabs, and tag chips - all synchronized to shareable URL parameters**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-31T18:56:18Z
- **Completed:** 2026-01-31T19:04:09Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Installed nuqs library and wrapped application with NuqsAdapter
- Refactored all filter components to use nuqs URL state management
- SearchInput debounces user input before updating URL 'q' parameter
- CategoryFilter syncs active category to URL 'category' parameter
- TagFilter syncs selected tags to URL 'tags' parameter as comma-separated array
- Added tag filtering placeholder to searchSkills function for future implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install nuqs and add NuqsAdapter to providers** - `eeeb1bf` (feat)
2. **Task 2: Refactor filter components to use nuqs** - `338af8c` (feat)
3. **Task 3: Add tag filtering placeholder to searchSkills** - `42cc706` (feat)

## Files Created/Modified
- `apps/web/package.json` - Added nuqs dependency
- `apps/web/components/providers.tsx` - Wrapped SessionProvider with NuqsAdapter
- `apps/web/components/search-input.tsx` - Refactored to use useQueryState with parseAsString and 300ms debounce
- `apps/web/components/category-filter.tsx` - Refactored to use useQueryState with parseAsStringEnum
- `apps/web/components/tag-filter.tsx` - Refactored to use useQueryState with parseAsArrayOf
- `apps/web/lib/search-skills.ts` - Added tag filtering placeholder with commented JSONB query implementation

## Decisions Made

**1. Use nuqs over Next.js primitives**
- Cleaner API than manual URLSearchParams manipulation
- Built-in type-safe parsers (parseAsString, parseAsStringEnum, parseAsArrayOf)
- Automatic history state management and SSR hydration
- Better developer experience with withDefault() chaining

**2. 300ms debounce for search input**
- Balances UX (responsive typing) with performance (reduced navigation events)
- Uses setTimeout cleanup pattern to cancel pending updates
- startTransition prevents blocking during debounce period

**3. Tag filtering as placeholder**
- Skills table doesn't have metadata JSONB column yet
- Implemented conditional logic with commented-out query
- Ready to uncomment when metadata column is added
- getAvailableTags() already exported for future use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. Build error with pnpm not found**
- **Issue:** Direct `pnpm` command failed in sandbox environment
- **Solution:** Used `npx pnpm` to run pnpm commands via corepack
- **Impact:** No impact on deliverables, just execution method

**2. Commit message correction**
- **Issue:** Linter auto-committed filter components with wrong plan number (06-04)
- **Solution:** Amended commit to correct plan number (06-03)
- **Impact:** Clean git history with correct phase/plan attribution

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for implementation:
- URL state infrastructure complete and tested
- All filter components refactored to use nuqs
- SearchInput, CategoryFilter, and TagFilter ready for use on /skills page
- Tag filtering placeholder ready for activation when metadata column added

Future work needed:
- Add metadata JSONB column to skills table
- Uncomment tag filtering logic in searchSkills
- Implement getAvailableTags() to extract distinct tags from metadata

---
*Phase: 06-discovery*
*Completed: 2026-01-31*
