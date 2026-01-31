---
phase: 07-ratings-reviews
plan: 03
subsystem: api
tags: [drizzle-orm, sql-aggregation, skill-stats, fte-calculation]

# Dependency graph
requires:
  - phase: 07-01
    provides: ratings table with hoursSavedEstimate column
  - phase: 06-discovery
    provides: skill-stats.ts service for aggregated statistics
provides:
  - User-submitted time estimates override creator estimates for FTE calculation
  - SkillStats interface extended with hoursSavedSource and hoursSavedEstimate fields
  - UI indicator showing estimate source (user community vs creator)
affects: [skill-detail-page, skill-stats, fte-calculation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SQL avg() aggregation with parseFloat for drizzle-orm string results"
    - "Conditional estimate selection: user average if available, creator fallback"
    - "Source tracking pattern for displaying data provenance"

key-files:
  created: []
  modified:
    - apps/web/lib/skill-stats.ts
    - apps/web/components/skill-detail.tsx

key-decisions:
  - "Use user estimates when at least one rating has hoursSavedEstimate, otherwise creator estimate"
  - "avg() returns string in drizzle-orm - parse with parseFloat"
  - "Track estimate source ('user' | 'creator') in SkillStats for UI transparency"
  - "Display source indicator in usage section with count of user estimates"
  - "Always show usage section (removed conditional) since stats always has hoursSavedEstimate"

patterns-established:
  - "User estimate override pattern: Query avg + count, use if count > 0, else fallback"
  - "Effective value calculation pattern: effectiveHoursSaved = userAvg ?? creatorValue"
  - "Source tracking pattern: parallel field indicating data source for transparency"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 07 Plan 03: User Time Estimate Override Summary

**FTE Days Saved calculation now uses averaged user-submitted time estimates when available, with UI indicator showing estimate source (community vs creator)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T19:28:41Z
- **Completed:** 2026-01-31T19:31:12Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- getSkillStats queries avg(hoursSavedEstimate) from ratings table and uses user average when available
- SkillStats interface extended with hoursSavedSource and hoursSavedEstimate for transparency
- Skill detail page displays estimate source with user count or creator label
- FTE Days Saved calculation uses effective estimate (user community average or creator fallback)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SkillStats Interface and getSkillStats Function** - `2fb1a4e` (feat)
2. **Task 2: Update Skill Detail to Display Estimate Source** - `ee9964e` (feat)

## Files Created/Modified
- `apps/web/lib/skill-stats.ts` - Added Query 4 for user time estimates, extended SkillStats interface, implemented conditional estimate selection with source tracking
- `apps/web/components/skill-detail.tsx` - Updated usage section to display stats.hoursSavedEstimate with source indicator showing user count or creator label

## Decisions Made
- **Use parseFloat for avg() results:** drizzle-orm returns avg() as string, requires parseFloat to convert to number
- **Require at least one estimate:** Only use user average if countWithEstimate > 0 and userAvgHours !== null
- **Track source in SkillStats:** Added hoursSavedSource field to indicate whether estimate is from 'user' or 'creator'
- **Always show usage section:** Removed conditional on skill.hoursSaved since stats.hoursSavedEstimate always has a value (user or creator)
- **Display user estimate count:** Show "avg of N user estimates" when using user source for transparency

## Deviations from Plan

None - plan executed exactly as written.

## Task 3 Verification Note

**Task 3: Verify Rating Aggregation on Skill Cards**

The skill-card.tsx component was verified and already correctly displays aggregated ratings:

- Uses `skill.averageRating` field (denormalized for performance)
- Displays with `formatRating()` helper
- Shows "No ratings" fallback when null
- No changes needed - ratings are updated by `updateSkillRating` from plan 07-01

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

FTE Days Saved metric now reflects real user experience through averaged time estimates. The system:
- Uses community wisdom when available (user estimates)
- Falls back gracefully to creator estimates when no user data exists
- Provides transparency through source indicators
- Maintains backward compatibility with existing skills

Ready for Phase 8 (MCP Marketplace) - all Phase 7 ratings and reviews features complete.

**Blockers:** None

**Notes:**
- All TypeScript compilation and build checks pass
- Query 4 added to getSkillStats maintains existing performance characteristics
- User estimate averaging provides more accurate FTE calculation as skills gain reviews
- Source indicator helps users understand estimate reliability

---
*Phase: 07-ratings-reviews*
*Completed: 2026-01-31*
