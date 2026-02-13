---
phase: 41-loom-video
plan: 01
subsystem: database, api, ui
tags: [loom, oembed, drizzle, zod, form-validation]

requires:
  - phase: 40-visibility
    provides: visibility column on skills table (loomUrl placed after it)
provides:
  - loom_url nullable TEXT column on skills table
  - Loom URL validation library (isValidLoomUrl, extractLoomVideoId, fetchLoomOEmbed)
  - Zod validation for Loom URLs in skill creation
  - Loom URL input field on skill creation form
affects: [41-02 (display), skill-detail, skills-table-row]

tech-stack:
  added: []
  patterns: [oEmbed fetcher with Next.js revalidate caching]

key-files:
  created:
    - apps/web/lib/loom.ts
    - packages/db/src/migrations/0020_add_loom_url.sql
  modified:
    - packages/db/src/schema/skills.ts
    - apps/web/app/actions/skills.ts
    - apps/web/components/skill-upload-form.tsx

key-decisions:
  - "Accept /share/, /embed/, and /i/ Loom URL patterns for flexibility"
  - "loomUrl field is optional with .or(z.literal('')) for empty string handling"

patterns-established:
  - "oEmbed fetch with 1-hour revalidation for external metadata"

duration: 3min
completed: 2026-02-13
---

# Phase 41 Plan 01: Loom Video Schema + Backend Summary

**Nullable loom_url column on skills table with Loom URL regex validation in Zod schema and form input field on skill creation page**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T21:36:39Z
- **Completed:** 2026-02-13T21:40:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `loom_url` nullable TEXT column to skills table via migration 0020
- Created `apps/web/lib/loom.ts` with URL validation, video ID extraction, and oEmbed fetcher
- Added Loom URL regex validation to Zod `createSkillSchema` (accepts share/embed/i patterns)
- Added "Demo Video (Loom)" input field to skill creation form between Hours Saved and Content
- Updated all three server action functions (checkAndCreateSkill, checkSimilarity, createSkill) to parse and insert loomUrl

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, migration, and Loom utility library** - `5b3dd1c` (feat)
2. **Task 2: Zod validation and form field for Loom URL** - `d6b9bec` (feat)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added loomUrl column after visibility field
- `packages/db/src/migrations/0020_add_loom_url.sql` - ALTER TABLE ADD COLUMN IF NOT EXISTS
- `apps/web/lib/loom.ts` - Loom URL validation, video ID extraction, oEmbed fetcher
- `apps/web/app/actions/skills.ts` - Zod loomUrl field + safeParse/insert in all 3 action functions
- `apps/web/components/skill-upload-form.tsx` - Demo Video (Loom) input field with error display

## Decisions Made
- Accepted `/share/`, `/embed/`, and `/i/` URL patterns (users may copy any variant)
- Used `.optional().or(z.literal(""))` for Zod to handle both missing and empty string cases
- No index on loom_url column (only read on individual skill pages, never queried/filtered)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- DATABASE_URL environment variable not set in shell; resolved by sourcing from `apps/web/.env.local`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema and backend ready for Plan 02 (frontend display: embed component, detail page integration, browse indicators)
- `loom_url` column populated on new skill creation; existing skills have NULL
- `fetchLoomOEmbed()` ready for server-side use on skill detail page

---
*Phase: 41-loom-video*
*Completed: 2026-02-13*
