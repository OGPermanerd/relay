---
phase: 25-multi-tenancy-schema-audit
plan: 04
subsystem: database
tags: [drizzle, multi-tenancy, schema, relations, postgres]

# Dependency graph
requires:
  - phase: 25-01
    provides: tenants and audit_logs table definitions
  - phase: 25-03
    provides: tenantId on skills, users, ratings, usage-events, skill-versions tables
provides:
  - tenantId column on skill-embeddings, skill-reviews, api-keys, site-settings
  - Composite unique constraints for tenant-scoped uniqueness
  - Drizzle relations with tenant back-references
affects: [25-05 migration generation, 25-06 seed/data migration, service-level tenant refactoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite unique indexes for tenant-scoped uniqueness (tenantId + skillId)"
    - "Per-tenant settings via unique tenantId on site_settings (replaces global singleton)"
    - "Globally unique key_hash on api_keys preserved across tenants"

key-files:
  created: []
  modified:
    - packages/db/src/schema/skill-embeddings.ts
    - packages/db/src/schema/skill-reviews.ts
    - packages/db/src/schema/api-keys.ts
    - packages/db/src/schema/site-settings.ts
    - packages/db/src/relations/index.ts
    - packages/db/src/services/site-settings.ts
    - packages/db/src/services/skill-embeddings.ts

key-decisions:
  - "site-settings uses unique tenantId instead of composite (tenantId, id) since one settings row per tenant is the intended pattern"
  - "api-keys key_hash remains globally unique (cross-tenant) since it is an auth identity used for API key lookup"
  - "Service files updated with tenantId params for type safety rather than deferring to later plans"

patterns-established:
  - "Composite unique: uniqueIndex('table_tenant_field_unique').on(table.tenantId, table.fieldId)"
  - "Tenant back-references: one(tenants, { fields: [table.tenantId], references: [tenants.id] })"
  - "tenantsRelations: many() for users, skills, apiKeys"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 25 Plan 04: Remaining Schema tenantId + Relations Summary

**Added tenant_id FK to skill-embeddings, skill-reviews, api-keys, site-settings with composite uniques and wired Drizzle relations for tenant ownership**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-07T16:33:02Z
- **Completed:** 2026-02-07T16:37:43Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All 4 remaining data tables now have tenantId column with FK to tenants.id
- skill-embeddings and skill-reviews use composite unique (tenantId, skillId) replacing single-field unique
- site-settings transitions from global singleton to per-tenant settings pattern
- api-keys keeps key_hash globally unique for auth lookup while adding tenant isolation
- Drizzle relations fully wired: tenantsRelations, plus tenant back-refs on skills and users
- Service files updated to accept tenantId for type-safe compilation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tenantId to skill-embeddings, skill-reviews, api-keys, site-settings** - `9a93706` (feat)
2. **Task 2: Update relations to include tenant references** - `521a8a2` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `packages/db/src/schema/skill-embeddings.ts` - Added tenantId FK, composite unique (tenantId, skillId)
- `packages/db/src/schema/skill-reviews.ts` - Added tenantId FK, composite unique (tenantId, skillId)
- `packages/db/src/schema/api-keys.ts` - Added tenantId FK, tenant_id index
- `packages/db/src/schema/site-settings.ts` - Added tenantId FK, unique tenantId constraint
- `packages/db/src/relations/index.ts` - Added tenantsRelations, auditLogsRelations, tenant refs on skills/users
- `packages/db/src/services/site-settings.ts` - Updated to accept optional tenantId param with legacy compat
- `packages/db/src/services/skill-embeddings.ts` - Updated to require tenantId and use composite conflict target

## Decisions Made
- **site-settings unique pattern:** Used unique tenantId (one settings row per tenant) rather than composite (tenantId, id). The id="default" pattern means one row per tenant is the design intent.
- **api-keys key_hash globally unique:** Preserved cross-tenant uniqueness on key_hash since API key validation looks up by hash without knowing the tenant first.
- **Service files updated immediately:** Fixed site-settings and skill-embeddings services to accept tenantId rather than deferring, preventing compilation errors in packages/db.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated skill-embeddings service for tenantId**
- **Found during:** Task 1 (schema update)
- **Issue:** Adding notNull tenantId to skill-embeddings broke the upsertSkillEmbedding service (missing required field)
- **Fix:** Added tenantId to UpsertSkillEmbeddingParams interface and .values() call; changed onConflict target from single skillId to composite [tenantId, skillId]
- **Files modified:** packages/db/src/services/skill-embeddings.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 9a93706 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated site-settings service for tenantId**
- **Found during:** Task 1 (schema update)
- **Issue:** Adding notNull tenantId to site-settings broke the updateSiteSettings service (missing required field in insert)
- **Fix:** Added optional tenantId parameter to getSiteSettings and updateSiteSettings; updated cache from single object to Map keyed by tenantId; added legacy fallback for backward compat
- **Files modified:** packages/db/src/services/site-settings.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 9a93706 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Task 1 commit included staged files from parallel plan 25-03 execution (skills.ts, users.ts, etc. were already staged). Net effect is benign since those changes were correct and intended.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 9 schema definitions now have tenantId columns (skills, users, ratings, usage-events, skill-versions from 25-03; skill-embeddings, skill-reviews, api-keys, site-settings from 25-04)
- Relations fully wired with tenant ownership graph
- Ready for migration generation (25-05) and service-level tenant scoping
- Callers of embedding-generator.ts in apps/web will need tenantId passed through in future service plans

## Self-Check: PASSED

---
*Phase: 25-multi-tenancy-schema-audit*
*Completed: 2026-02-07*
