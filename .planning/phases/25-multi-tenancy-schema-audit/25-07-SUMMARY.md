---
phase: 25-multi-tenancy-schema-audit
plan: 07
subsystem: database
tags: [drizzle, pgPolicy, rls, row-level-security, multi-tenancy, postgres]

# Dependency graph
requires:
  - phase: 25-03
    provides: tenantId columns and indexes on skills, users, ratings, usage-events, skill-versions, skill-embeddings
  - phase: 25-04
    provides: tenantId columns and indexes on skill-reviews, api-keys, site-settings
provides:
  - pgPolicy tenant_isolation declarations on all 9 tenant-scoped tables
  - drizzle.config.ts entities.roles support for RLS migration generation
affects: [25-08, 25-09, future migration generation]

# Tech tracking
tech-stack:
  added: [drizzle-orm@0.42.0]
  patterns: [pgPolicy restrictive policy with current_setting for tenant isolation]

key-files:
  modified:
    - packages/db/src/schema/skills.ts
    - packages/db/src/schema/users.ts
    - packages/db/src/schema/ratings.ts
    - packages/db/src/schema/usage-events.ts
    - packages/db/src/schema/skill-versions.ts
    - packages/db/src/schema/skill-embeddings.ts
    - packages/db/src/schema/skill-reviews.ts
    - packages/db/src/schema/api-keys.ts
    - packages/db/src/schema/site-settings.ts
    - packages/db/drizzle.config.ts
    - packages/db/package.json
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Upgraded drizzle-orm 0.38.4 -> 0.42.0 for pgPolicy support (was not available in 0.38.x)"
  - "Omitted `to:` in pgPolicy — applies to public role, combined with FORCE ROW LEVEL SECURITY covers all connections"
  - "Used restrictive policy type for defense-in-depth isolation"

patterns-established:
  - "pgPolicy pattern: pgPolicy('tenant_isolation', { as: 'restrictive', for: 'all', using/withCheck: current_setting('app.current_tenant_id', true) })"

# Metrics
duration: 6min
completed: 2026-02-07
---

# Phase 25 Plan 07: Drizzle pgPolicy RLS Declarations Summary

**Restrictive pgPolicy tenant_isolation on all 9 schema tables using current_setting, with drizzle-orm 0.42.0 upgrade for pgPolicy support**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-07T16:41:14Z
- **Completed:** 2026-02-07T16:47:47Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Added pgPolicy("tenant_isolation") with restrictive USING and WITH CHECK to all 9 tenant-scoped tables
- Updated drizzle.config.ts with entities.roles: true for RLS-aware migration generation
- Upgraded drizzle-orm from 0.38.4 to 0.42.0 across packages/db and apps/web (required for pgPolicy API)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pgPolicy to all 9 schema files** - `d88b720` (feat)
2. **Task 2: Update drizzle.config.ts for RLS support** - `bff6329` (chore)

## Files Created/Modified
- `packages/db/src/schema/skills.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/users.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/ratings.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/usage-events.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/skill-versions.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/skill-embeddings.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/skill-reviews.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/api-keys.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/src/schema/site-settings.ts` - Added pgPolicy import and tenant_isolation policy
- `packages/db/drizzle.config.ts` - Added entities.roles: true
- `packages/db/package.json` - drizzle-orm version bump to 0.42.0
- `apps/web/package.json` - drizzle-orm version bump to 0.42.0
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- **Upgraded drizzle-orm 0.38.4 -> 0.42.0**: pgPolicy was not available in 0.38.x. The 0.42.0 release includes full pgPolicy support via `drizzle-orm/pg-core`. This was a blocking dependency upgrade.
- **Omitted `to:` parameter**: Without `to:`, the policy applies to the `public` role (all users). Combined with FORCE ROW LEVEL SECURITY (set via SQL migrations in plan 25-06), this ensures the policy applies even to the table owner.
- **Restrictive policy type**: Uses `as: "restrictive"` for defense-in-depth. Restrictive policies must ALL pass (AND logic), while permissive policies use OR logic. This prevents accidental bypass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Upgraded drizzle-orm 0.38.4 -> 0.42.0**
- **Found during:** Task 1 (Add pgPolicy to schema files)
- **Issue:** pgPolicy function does not exist in drizzle-orm 0.38.4. It was introduced in later versions and is available in 0.42.0.
- **Fix:** Upgraded drizzle-orm to 0.42.0 in both packages/db and apps/web
- **Files modified:** packages/db/package.json, apps/web/package.json, pnpm-lock.yaml
- **Verification:** `import { pgPolicy } from "drizzle-orm/pg-core"` resolves, TypeScript compiles clean
- **Committed in:** d88b720 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Dependency upgrade was necessary; pgPolicy API unavailable in prior version. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in apps/web (31 errors) from tenantId being required but not yet passed in server actions. These were introduced by Plans 25-03/25-04 and will be resolved by later plans. Not related to this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 9 Drizzle schema files now declare pgPolicy matching the database-level RLS policies from plan 25-06
- Drizzle Kit configured with entities.roles for future RLS-aware migration generation
- Ready for plan 25-08 (verification/testing) and 25-09 (integration)

## Self-Check: PASSED

---
*Phase: 25-multi-tenancy-schema-audit*
*Completed: 2026-02-07*
