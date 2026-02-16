---
phase: 73-community-discovery-ui
plan: 01
subsystem: database, api, ai
tags: [anthropic, claude-haiku, community-detection, pgvector, drizzle, cron]

# Dependency graph
requires:
  - phase: 72-community-detection
    provides: "skill_communities table with Louvain community assignments"
provides:
  - "community_label and community_description columns on skill_communities"
  - "getCommunities query function for browse page data"
  - "getCommunityDetail query function with centroid similarity scores"
  - "AI label generator using Claude Haiku (cost-efficient)"
  - "Cron endpoint auto-generates labels after community detection"
affects: [73-02 community browse page, 73-03 community detail page, dashboard integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AI community labeling via Haiku with JSON schema output", "pgvector AVG() for centroid computation in SQL"]

key-files:
  created:
    - "packages/db/src/migrations/0041_add_community_labels.sql"
    - "packages/db/src/services/community-queries.ts"
    - "apps/web/lib/community-label-generator.ts"
  modified:
    - "packages/db/src/schema/skill-communities.ts"
    - "packages/db/src/services/index.ts"
    - "apps/web/app/api/cron/community-detection/route.ts"

key-decisions:
  - "TEXT columns for community_label and community_description (not separate metadata table)"
  - "Claude Haiku (claude-haiku-4-5-20251001) for label generation -- cost-efficient for short outputs"
  - "Labels generated automatically in cron after detection, not on page load"
  - "pgvector AVG() for centroid similarity in getCommunityDetail -- no JS vector math"

patterns-established:
  - "AI community labeling: Haiku + JSON schema + Zod validation + per-community try/catch"
  - "Community query pattern: GROUP BY community_id with json_agg for top skills"
  - "Centroid similarity pattern: CTE with AVG(embedding) CROSS JOINed to member skills"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 73 Plan 01: Community Backend Foundation Summary

**AI-generated community labels via Claude Haiku, query services with centroid similarity, and automated cron labeling after detection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T22:36:42Z
- **Completed:** 2026-02-16T22:40:02Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Migration 0041 adds community_label and community_description TEXT columns to skill_communities
- getCommunities returns community overview list with member counts, modularity, and top 3 skills (json_agg)
- getCommunityDetail computes centroid via pgvector AVG() and returns skills ranked by similarity percentage
- AI label generator uses Claude Haiku with JSON schema structured output and Zod validation
- Cron endpoint automatically generates labels for all communities after detection succeeds
- Live test: 4 communities labeled with descriptive names and summaries

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + query services** - `18abedb` (feat)
2. **Task 2: AI label generator + cron integration** - `e5530ba` (feat)

## Files Created/Modified
- `packages/db/src/migrations/0041_add_community_labels.sql` - ALTER TABLE adding two TEXT columns
- `packages/db/src/schema/skill-communities.ts` - Drizzle schema updated with communityLabel, communityDescription
- `packages/db/src/services/community-queries.ts` - getCommunities and getCommunityDetail query functions
- `packages/db/src/services/index.ts` - Barrel exports for new query functions and types
- `apps/web/lib/community-label-generator.ts` - AI label generation + batch persist function
- `apps/web/app/api/cron/community-detection/route.ts` - Wired label generation after detection

## Decisions Made
- TEXT columns (not separate table) for community metadata -- consistent with how modularity is stored per-row
- Claude Haiku for labels -- sufficient quality for 2-5 word names + 1-2 sentence descriptions, 10x cheaper than Sonnet
- Labels regenerated on every detection run -- Louvain IDs are unstable across runs, so labels must refresh
- Per-community try/catch in label generation -- one failure doesn't block labeling other communities

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Community query functions ready for browse page (73-02) and detail page (73-03)
- Labels already populated in dev DB for 4 communities
- getCommunities provides data for community cards (label, description, memberCount, topSkills)
- getCommunityDetail provides centroid similarity percentages for member skill ranking

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 73-community-discovery-ui*
*Completed: 2026-02-16*
