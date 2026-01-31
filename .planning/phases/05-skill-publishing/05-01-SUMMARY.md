---
phase: 05-skill-publishing
plan: 01
subsystem: api
tags: [next.js, server-actions, zod, form-validation, slug-generation]

# Dependency graph
requires:
  - phase: 04-data-model-storage
    provides: skills table schema with slug, content, category fields
  - phase: 02-authentication
    provides: auth() function for user session
provides:
  - Skill upload form with client-side pending/error states
  - Server Action with Zod validation for skill creation
  - URL-safe slug generation with database collision handling
  - Upload UI at /skills/new
affects: [06-skill-browsing, 07-skill-versioning]

# Tech tracking
tech-stack:
  added: [zod, drizzle-orm (web package)]
  patterns: [useActionState for forms, Server Actions with 'use server', slug generation with UUID suffix]

key-files:
  created:
    - apps/web/lib/slug.ts
    - apps/web/app/actions/skills.ts
    - apps/web/components/skill-upload-form.tsx
    - apps/web/app/(protected)/skills/new/page.tsx
  modified:
    - apps/web/app/(protected)/page.tsx
    - apps/web/package.json

key-decisions:
  - "Add drizzle-orm dependency to web package for type imports across package boundaries"
  - "Use NFD normalization for slug generation to handle diacritics properly"
  - "Append 8-char UUID suffix on slug collision instead of numeric counter"
  - "Validate but don't store tags/usageInstructions (schema future-proofing)"
  - "Graceful null-db handling in both slug utility and Server Action"

patterns-established:
  - "useActionState pattern: Client component + Server Action with typed state"
  - "Form validation: Zod schema with safeParse, return fieldErrors on failure"
  - "Slug generation: Base slug + collision check + UUID suffix for uniqueness"

# Metrics
duration: 8min
completed: 2026-01-31
---

# Phase 5 Plan 1: Skill Upload Form Summary

**Skill upload form with Zod-validated Server Action, URL-safe slug generation, and useActionState for pending/error states**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-31T18:18:04Z
- **Completed:** 2026-01-31T18:25:52Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- URL-safe slug generation with NFD normalization and UUID-suffix collision handling
- Server Action with comprehensive Zod validation for all skill fields
- Upload form with React 19 useActionState showing pending/error states
- Navigation from home page to /skills/new upload flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create slug generation utility** - `c5a58ae` (feat)
   - generateSlug(): URL-safe slug from name
   - generateUniqueSlug(): Database collision check with UUID suffix
   - Added drizzle-orm dependency to web package

2. **Task 2: Create skill upload Server Action** - `565e572` (feat)
   - Zod schema validating name, description, category, tags, usageInstructions, hoursSaved, content
   - createSkill() Server Action with auth check, validation, db insert, redirect
   - Added zod dependency to web package

3. **Task 3: Create upload form, page, and home page link** - `8a379d0` (feat)
   - SkillUploadForm client component with useActionState
   - /skills/new page with form
   - Home page "Share a Skill" navigation card

## Files Created/Modified

- `apps/web/lib/slug.ts` - URL-safe slug generation with uniqueness handling
- `apps/web/app/actions/skills.ts` - createSkill Server Action with Zod validation
- `apps/web/components/skill-upload-form.tsx` - Form component with useActionState
- `apps/web/app/(protected)/skills/new/page.tsx` - Upload page route
- `apps/web/app/(protected)/page.tsx` - Added "Share a Skill" navigation card
- `apps/web/package.json` - Added zod and drizzle-orm dependencies

## Decisions Made

1. **Add drizzle-orm to web package** - Pre-existing skill-stats.ts already imported drizzle-orm directly, but it wasn't in dependencies. Added explicitly for proper type resolution across package boundaries.

2. **NFD normalization for slug generation** - Use Unicode NFD (canonical decomposition) + diacritic removal regex for international character support in slugs.

3. **UUID suffix for collision handling** - Generate 8-char UUID suffix on collision instead of numeric counter for better distribution and no race conditions.

4. **Validate but don't store tags/usageInstructions** - Schema includes these fields for validation (future-proofing) but database insert doesn't use them yet. Will add tag storage in later plan.

5. **Graceful null-db handling** - Both slug utility and Server Action check for null db and return appropriate fallback/error instead of crashing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added drizzle-orm dependency to web package**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** TypeScript couldn't find drizzle-orm types when importing from slug.ts, even though @relay/db exports db instance
- **Fix:** Added drizzle-orm ^0.38.0 to apps/web/package.json dependencies
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compilation passed
- **Committed in:** c5a58ae (Task 1 commit)

**2. [Rule 3 - Blocking] Added zod dependency to web package**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** TypeScript couldn't find zod types when importing in Server Action, even though @relay/db has zod dependency
- **Fix:** Added zod ^3.25.0 to apps/web/package.json dependencies
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compilation passed
- **Committed in:** 565e572 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed unused variable linting errors**
- **Found during:** Task 2 (git pre-commit hook)
- **Issue:** tags and usageInstructions destructured from parsed.data but not used in db insert
- **Fix:** Removed unused variables from destructuring (schema still validates them)
- **Files modified:** apps/web/app/actions/skills.ts
- **Verification:** Linting passed
- **Committed in:** 565e572 (Task 2 commit)

**4. [Rule 2 - Missing Critical] Added skill detail page for redirect target**
- **Found during:** Task 3 (build verification)
- **Issue:** Server Action redirects to /skills/[slug] but page doesn't exist, causing build errors
- **Fix:** Created placeholder skill detail page at apps/web/app/(protected)/skills/[slug]/page.tsx
- **Files modified:** apps/web/app/(protected)/skills/[slug]/page.tsx
- **Verification:** Build passed
- **Committed in:** 8a379d0 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for compilation and functionality. No scope creep.

## Issues Encountered

- **Stale .next build cache** - Initial build failed with webpack runtime error, fixed by cleaning .next directory and rebuilding. Pre-existing issue, not related to changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Skill upload form complete and functional
- Ready for skill browsing (Phase 6)
- Ready for skill versioning (Phase 7)
- No blockers

---
*Phase: 05-skill-publishing*
*Completed: 2026-01-31*
