---
phase: 67-skills-resume
plan: 01
subsystem: database, api
tags: [drizzle, postgres, resume, share-tokens, server-actions, quality-score]

# Dependency graph
requires:
  - phase: 66-impact-measurement
    provides: portfolio-queries patterns, quality-score calculation, ip-valuation HOURLY_RATE
provides:
  - resume_shares table with token-based public access
  - getResumeData() aggregated resume query with quality badges
  - getResumeByToken() public token resolution
  - createResumeShare/revokeResumeShare/getActiveShare server actions
  - /r/ middleware exemption for public resume pages
affects: [67-skills-resume plans 02-03 (UI and public page)]

# Tech tracking
tech-stack:
  added: []
  patterns: [revoke-and-replace share tokens, parallel SQL queries with visibility filtering, quality tier computation per-skill]

key-files:
  created:
    - packages/db/src/schema/resume-shares.ts
    - packages/db/src/migrations/0036_add_resume_shares.sql
    - apps/web/lib/resume-queries.ts
    - apps/web/app/actions/resume-share.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/relations/index.ts
    - apps/web/middleware.ts

key-decisions:
  - "Revoke-and-replace pattern: creating a new share revokes all previous active shares"
  - "Visibility filter uses drizzle sql template composition (empty sql`` vs AND clause)"
  - "Quality tier computed per-skill using calculateQualityScore with total_ratings subquery"
  - "RLS tenant_isolation policy on resume_shares following api-keys pattern"

patterns-established:
  - "Token-based public access: resume_shares token validated against revoked_at + expires_at"
  - "Visibility-filtered queries: includeCompanySkills toggles personal-only vs all skills"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 67 Plan 01: Skills Resume Data Layer Summary

**resume_shares schema with token-based public access, aggregated resume queries with quality badges, and revoke-and-replace share management server actions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T11:54:10Z
- **Completed:** 2026-02-16T11:57:44Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created resume_shares table with migration 0036, including token uniqueness, user/tenant FKs, and RLS policy
- Built getResumeData() with 4 parallel SQL queries computing quality tiers via calculateQualityScore per-skill
- Implemented revoke-and-replace server actions (createResumeShare, revokeResumeShare, getActiveShare)
- Added /r/ path exemption in middleware for unauthenticated public resume access

## Task Commits

Each task was committed atomically:

1. **Task 1: resume_shares schema, migration, and middleware exemption** - `225bc14` (feat)
2. **Task 2: Resume data queries and share server actions** - `d1a7fa3` (feat)

## Files Created/Modified
- `packages/db/src/schema/resume-shares.ts` - resume_shares table definition with RLS policy
- `packages/db/src/migrations/0036_add_resume_shares.sql` - CREATE TABLE + indexes on token, user_id
- `packages/db/src/schema/index.ts` - Added resume-shares export
- `packages/db/src/relations/index.ts` - Added resumeShares relations (user, tenant) + back-relations
- `apps/web/middleware.ts` - Added /r/ path exemption from auth
- `apps/web/lib/resume-queries.ts` - getResumeData + getResumeByToken queries
- `apps/web/app/actions/resume-share.ts` - createResumeShare, revokeResumeShare, getActiveShare server actions

## Decisions Made
- Revoke-and-replace pattern ensures only one active share per user (simplifies UI state)
- Visibility filter uses drizzle sql template composition rather than string interpolation
- Quality tier computed per-skill using existing calculateQualityScore with a total_ratings correlated subquery
- ON DELETE CASCADE on user FK to clean up shares when user deleted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- DATABASE_URL not available via turbo runner; ran migration directly in packages/db with explicit env var

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema, queries, and server actions ready for 67-02 (resume UI page)
- /r/ path exempted for 67-03 (public resume viewer)
- getResumeByToken ready for public page server component

## Self-Check: PASSED

- All 4 created files verified present
- Both task commits (225bc14, d1a7fa3) verified in git log
- TypeScript compiles clean (tsc --noEmit)
- Migration 0036 applied successfully

---
*Phase: 67-skills-resume*
*Completed: 2026-02-16*
