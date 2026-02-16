---
phase: 72-community-detection
plan: 02
subsystem: database
tags: [graphology, louvain, pgvector, community-detection, lateral-join, cron]

# Dependency graph
requires:
  - phase: 72-01
    provides: "skill_communities table schema, graphology packages installed"
provides:
  - "detectCommunities() service: KNN edge extraction + Louvain clustering + atomic persist"
  - "GET /api/cron/community-detection endpoint with CRON_SECRET auth"
  - "CommunityDetectionResult type exported from @everyskill/db"
affects: [community-ui, skill-detail, discover-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [LATERAL JOIN KNN for pgvector edge extraction, graphology UndirectedGraph + Louvain, atomic community refresh via transaction]

key-files:
  created:
    - packages/db/src/services/community-detection.ts
    - apps/web/app/api/cron/community-detection/route.ts
  modified:
    - packages/db/src/services/index.ts

key-decisions:
  - "K=10 nearest neighbors, MIN_SIMILARITY=0.3 edge threshold, RESOLUTION=1.0 Louvain parameter"
  - "MIN_SKILLS_FOR_DETECTION=5 as lower bound for graceful fallback"
  - "Atomic refresh via db.transaction (delete + insert) -- not UPSERT -- for simplicity and correctness"
  - "Console.warn for low-quality partitions (modularity < 0.1) but still persist results"

patterns-established:
  - "LATERAL JOIN KNN: pgvector edge extraction pattern for graph construction"
  - "Cron endpoint with optional tenantId query param and DEFAULT_TENANT_ID fallback"

# Metrics
duration: 11min
completed: 2026-02-16
---

# Phase 72 Plan 02: Community Detection Service Summary

**KNN edge extraction via pgvector LATERAL JOIN, Louvain clustering via graphology, atomic persist to skill_communities, cron trigger at /api/cron/community-detection**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-16T22:05:04Z
- **Completed:** 2026-02-16T22:16:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Community detection service extracts KNN edges (K=10) from pgvector via LATERAL JOIN, builds in-memory graph with graphology UndirectedGraph, runs Louvain clustering, and persists atomically
- Cron endpoint at /api/cron/community-detection with CRON_SECRET Bearer auth and optional tenantId param
- Live test: 4 communities detected from 91 skills (609 edges), modularity 0.697 (excellent quality)
- Graceful fallback for small datasets (< 5 skills), sparse graphs (no edges above threshold), and trivial graphs (< 3 nodes)
- Idempotent: re-running produces consistent results with atomic replace (91 rows after both runs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Community detection service with KNN + Louvain + atomic persist** - `b24b8ac` (feat)
2. **Task 2: Cron endpoint and live verification** - `8f41f5b` (feat)

## Files Created/Modified
- `packages/db/src/services/community-detection.ts` - Core detection service: KNN edge extraction, graph construction, Louvain clustering, atomic persist
- `packages/db/src/services/index.ts` - Added detectCommunities and CommunityDetectionResult exports
- `apps/web/app/api/cron/community-detection/route.ts` - Cron GET endpoint with CRON_SECRET auth and tenantId param

## Decisions Made
- K=10 nearest neighbors, MIN_SIMILARITY=0.3 edge threshold -- produced 4 well-separated communities from 91 skills
- RESOLUTION=1.0 (Louvain default) -- modularity 0.697 indicates strong community structure
- Atomic refresh via transaction (delete all + insert) rather than per-row UPSERT -- simpler and guarantees clean state
- Added CRON_SECRET to apps/web/.env.local for dev testing (not committed -- gitignored)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added CRON_SECRET to dev env for live testing**
- **Found during:** Task 2
- **Issue:** CRON_SECRET not configured in any env file, preventing live endpoint testing
- **Fix:** Added `CRON_SECRET=dev-cron-secret-2026` to `apps/web/.env.local` (gitignored)
- **Files modified:** apps/web/.env.local (not committed)
- **Verification:** Endpoint returns 200 with community results after restart

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for live verification. No scope creep.

## Issues Encountered
None -- LATERAL JOIN query, graphology imports, and Louvain execution all worked correctly on first attempt.

## Live Test Results

```
GET /api/cron/community-detection (with Bearer auth)
Response: {"communities":4,"modularity":0.6971101808503208,"skills":91,"edges":609}

Community distribution:
  community_id | members
  0            | 20
  1            | 19
  2            | 15
  3            | 37

Idempotent re-run: Same 91 rows, consistent community assignments
Unauthorized request: Returns 401
```

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Community detection complete and persisted in database
- Community data ready for UI consumption (Phase 73+ if planned)
- Endpoint can be scheduled via external cron or called on-demand
- Community labels (communityLabel column) available for future LLM-generated names

## Self-Check: PASSED

- [x] packages/db/src/services/community-detection.ts exists
- [x] apps/web/app/api/cron/community-detection/route.ts exists
- [x] Commit b24b8ac exists (Task 1)
- [x] Commit 8f41f5b exists (Task 2)

---
*Phase: 72-community-detection*
*Completed: 2026-02-16*
