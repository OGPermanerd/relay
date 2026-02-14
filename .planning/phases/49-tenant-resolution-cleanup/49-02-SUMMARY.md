---
phase: 49-tenant-resolution-cleanup
plan: 02
subsystem: auth, api, database
tags: [multi-tenancy, tenant-resolution, session, server-actions, drizzle]

# Dependency graph
requires:
  - phase: 49-tenant-resolution-cleanup
    plan: 01
    provides: JWT tenantId claim, utility functions accept tenantId parameter
provides:
  - All server actions derive tenantId from session.user.tenantId (no DEFAULT_TENANT_ID)
  - All admin/protected server components derive tenantId from session (no fallback)
  - upsertSkillReview requires tenantId (not optional)
  - Strict error handling for missing tenantId across all authenticated code paths
affects: [49-03, admin-settings, mcp-auth]

# Tech tracking
tech-stack:
  added: []
  patterns: [session-derived-tenantId, strict-tenant-guard]

key-files:
  modified:
    - apps/web/app/actions/skills.ts
    - apps/web/app/actions/ratings.ts
    - apps/web/app/actions/fork-skill.ts
    - apps/web/app/actions/api-keys.ts
    - apps/web/app/actions/user-preferences.ts
    - apps/web/app/actions/notification-preferences.ts
    - apps/web/app/actions/export-claude-md.ts
    - apps/web/app/actions/skill-messages.ts
    - apps/web/app/actions/discover.ts
    - apps/web/app/actions/get-skill-content.ts
    - apps/web/app/actions/ai-review.ts
    - apps/web/app/actions/submit-for-review.ts
    - apps/web/app/(protected)/page.tsx
    - apps/web/app/(protected)/admin/layout.tsx
    - apps/web/app/(protected)/admin/reviews/page.tsx
    - apps/web/app/(protected)/admin/reviews/[skillId]/page.tsx
    - apps/web/app/(protected)/admin/search/page.tsx
    - apps/web/app/(protected)/skills/page.tsx
    - packages/db/src/services/skill-reviews.ts

key-decisions:
  - "Server actions return error objects (matching existing pattern per file) when tenantId missing"
  - "Server components redirect('/') when tenantId missing (page renders cannot return errors)"
  - "discover.ts returns empty results for unauthenticated users (requires session for tenant)"
  - "get-skill-content.ts skips usage tracking silently when tenantId missing (read-only, non-critical)"
  - "skills/page.tsx only logs search when tenantId present (non-blocking, analytics only)"

patterns-established:
  - "Strict tenant guard: const tenantId = session.user.tenantId; if (!tenantId) return error/redirect"
  - "Server actions: error return shape matches existing file pattern (errors, message, or error)"
  - "Server components: redirect('/') on missing tenantId"

# Metrics
duration: 7min
completed: 2026-02-14
---

# Phase 49 Plan 02: Server Actions & Components Tenant Resolution Summary

**Replaced DEFAULT_TENANT_ID with strict session-derived tenantId in 19 files across server actions, admin pages, and skill-reviews service**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-14T13:00:22Z
- **Completed:** 2026-02-14T13:07:49Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Removed DEFAULT_TENANT_ID constant/import from 12 server action files, 5 admin/protected server components, and the homepage
- Added strict tenantId guards (error return for actions, redirect for components) in all authenticated code paths
- Made UpsertSkillReviewParams.tenantId required, eliminating the inline fallback in the SQL upsert
- All 3 callers of upsertSkillReview (skills.ts, ai-review.ts, submit-for-review.ts) now pass tenantId from session

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace DEFAULT_TENANT_ID in all server action files and homepage** - `70cdfde` (feat)
2. **Task 2: Replace DEFAULT_TENANT_ID in 5 server components and skill-reviews DB service** - `f294b9f` (feat)

## Files Modified
- `apps/web/app/actions/skills.ts` - Removed DEFAULT_TENANT_ID, added tenant guard in checkAndCreateSkill and createSkill, replaced 6 usages
- `apps/web/app/actions/ratings.ts` - Removed DEFAULT_TENANT_ID, added tenant guard, replaced 2 usages
- `apps/web/app/actions/fork-skill.ts` - Removed DEFAULT_TENANT_ID, added tenant guard, replaced 3 usages
- `apps/web/app/actions/api-keys.ts` - Removed DEFAULT_TENANT_ID, added tenant guard in generateApiKey and rotateApiKey, replaced 2 usages
- `apps/web/app/actions/user-preferences.ts` - Removed DEFAULT_TENANT_ID, strict tenant check returns null
- `apps/web/app/actions/notification-preferences.ts` - Removed DEFAULT_TENANT_ID, strict tenant check returns null
- `apps/web/app/actions/export-claude-md.ts` - Removed DEFAULT_TENANT_ID and type cast, added tenant guard
- `apps/web/app/actions/skill-messages.ts` - Removed DEFAULT_TENANT_ID, added tenant guard before try block
- `apps/web/app/actions/discover.ts` - Removed DEFAULT_TENANT_ID, requires auth + tenant for search
- `apps/web/app/actions/get-skill-content.ts` - Removed DEFAULT_TENANT_ID import, skips tracking when no tenant
- `apps/web/app/actions/ai-review.ts` - Added tenant guard, passes tenantId to upsertSkillReview
- `apps/web/app/actions/submit-for-review.ts` - Added tenant guard, passes tenantId to upsertSkillReview, removed inline fallback
- `apps/web/app/(protected)/page.tsx` - Removed DEFAULT_TENANT_ID import, strict tenant with redirect
- `apps/web/app/(protected)/admin/layout.tsx` - Removed DEFAULT_TENANT_ID import, strict tenant with redirect
- `apps/web/app/(protected)/admin/reviews/page.tsx` - Removed DEFAULT_TENANT_ID import, strict tenant with redirect
- `apps/web/app/(protected)/admin/reviews/[skillId]/page.tsx` - Removed DEFAULT_TENANT_ID import, strict tenant with redirect
- `apps/web/app/(protected)/admin/search/page.tsx` - Removed local const, strict tenant with redirect
- `apps/web/app/(protected)/skills/page.tsx` - Removed local const, conditional search logging
- `packages/db/src/services/skill-reviews.ts` - Made tenantId required in UpsertSkillReviewParams, removed inline fallback

## Decisions Made
- Server actions return error objects matching existing pattern per file (some use `{ error }`, some `{ message }`, some `{ errors: { _form } }`)
- Server components redirect to "/" when tenantId missing (cannot return error from page render)
- `discover.ts` returns empty array for unauthenticated users (search requires tenant context)
- `get-skill-content.ts` silently skips download tracking when tenantId missing (non-critical analytics)
- `skills/page.tsx` only logs search when both userId and tenantId present (non-blocking)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 targets remaining DEFAULT_TENANT_ID usages in API routes, MCP handlers, and other modules
- `admin-settings.ts` still has DEFAULT_TENANT_ID (out of scope for this plan, will be in Plan 03)
- All server actions and protected pages now consistently derive tenantId from session

## Self-Check: PASSED

- All 19 modified files verified present
- Both task commits (70cdfde, f294b9f) verified in git log
- TypeScript compilation: zero errors
- DEFAULT_TENANT_ID grep: zero hits in all target files

---
*Phase: 49-tenant-resolution-cleanup*
*Plan: 02*
*Completed: 2026-02-14*
