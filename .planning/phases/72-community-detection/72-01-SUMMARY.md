---
phase: 72-community-detection
plan: 01
subsystem: database
tags: [drizzle, postgres, graphology, louvain, community-detection, rls]

# Dependency graph
requires:
  - phase: 71-temporal-tracking
    provides: "Schema patterns (user-skill-views) and migration numbering (0039)"
provides:
  - "skill_communities table with RLS and tenant isolation"
  - "skillCommunities Drizzle schema, types (SkillCommunity, NewSkillCommunity)"
  - "skillCommunitiesRelations (skill, tenant)"
  - "graphology + graphology-communities-louvain packages in @everyskill/db"
affects: [72-community-detection plan 02, similarity-graph, skill-clustering]

# Tech tracking
tech-stack:
  added: [graphology, graphology-communities-louvain, graphology-types]
  patterns: [community-id integer column, modularity score per detection run, run_id for batch tracking]

key-files:
  created:
    - packages/db/src/schema/skill-communities.ts
    - packages/db/src/migrations/0040_create_skill_communities.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/relations/index.ts
    - packages/db/package.json
    - pnpm-lock.yaml

key-decisions:
  - "REAL type for modularity (not NUMERIC) — sufficient precision for 0.0-1.0 quality score"
  - "run_id TEXT column (nullable) for correlating detection batches across tenants"
  - "Composite index on (tenant_id, community_id) for cluster membership queries"
  - "UNIQUE constraint on (tenant_id, skill_id) enables UPSERT on re-detection"

patterns-established:
  - "Community detection tables: one row per (tenant, skill), UPSERT on re-run"
  - "Detection metadata (modularity, run_id, detected_at) stored alongside assignments"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 72 Plan 01: Skill Communities Schema Summary

**skill_communities table with Louvain community detection schema, RLS, graphology packages installed, migration 0040 applied**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T21:59:45Z
- **Completed:** 2026-02-16T22:02:41Z
- **Tasks:** 7
- **Files modified:** 6

## Accomplishments
- Installed graphology, graphology-communities-louvain, graphology-types in packages/db
- Created skill_communities Drizzle schema with 7 columns, 3 indexes, RLS tenant isolation
- Wired barrel exports and bidirectional relations (skills, tenants)
- Migration 0040 applied successfully to local database
- Full typecheck and lint pass across all 6 packages (0 errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install graphology packages** - `8dceec6` (chore)
2. **Task 2: Create skill-communities.ts schema** - `2466c63` (feat)
3. **Task 3: Add barrel export** - `8512b98` (feat)
4. **Task 4: Add relations** - `6ebc04e` (feat)
5. **Task 5: Create migration 0040** - `7f5df58` (feat)
6. **Task 6: Run migration** - (runtime, no commit)
7. **Task 7: Verify typecheck** - (verification, no commit)

## Files Created/Modified
- `packages/db/src/schema/skill-communities.ts` - Table definition with 7 columns, RLS policy
- `packages/db/src/migrations/0040_create_skill_communities.sql` - SQL migration with table, indexes, RLS
- `packages/db/src/schema/index.ts` - Added barrel export for skill-communities
- `packages/db/src/relations/index.ts` - Added skillCommunitiesRelations + many() refs on skills/tenants
- `packages/db/package.json` - Added graphology dependencies
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used REAL type for modularity (0.0-1.0 quality score, float precision sufficient)
- Added run_id TEXT column (nullable) for correlating detection batch runs
- Composite index on (tenant_id, community_id) instead of just community_id alone, since queries always scope by tenant
- UNIQUE on (tenant_id, skill_id) enables clean UPSERT pattern for re-detection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- DATABASE_URL not automatically available to turbo db:migrate; loaded from apps/web/.env.local and ran with pnpm --filter directly (standard pattern for this project)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema and types ready for Plan 02 (community detection service implementation)
- graphology packages available for building similarity graph and running Louvain algorithm
- Migration applied; table exists in dev database

---
*Phase: 72-community-detection*
*Completed: 2026-02-16*
