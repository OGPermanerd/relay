---
phase: 38-conversational-mcp-discovery
plan: 03
subsystem: api
tags: [mcp, describe-skill, guide-skill, quality-tier, category-guidance, semantic-similarity]

requires:
  - phase: 38-conversational-mcp-discovery
    provides: semanticSearchSkills() for similar skills lookup, getSkillEmbedding() for vector retrieval
provides:
  - describe_skill MCP tool with rich metadata aggregation (AI review, ratings, forks, similar skills)
  - guide_skill MCP tool with category-specific usage guidance and skill content
affects: [38-conversational-mcp-discovery]

tech-stack:
  added: []
  patterns: [multi-service-aggregation, category-specific-guidance, quality-tier-derivation]

key-files:
  created:
    - apps/mcp/src/tools/describe.ts
    - apps/mcp/src/tools/guide.ts
  modified:
    - apps/mcp/src/tools/index.ts

key-decisions:
  - "Quality tier derived from averageRating + totalUses: gold (>=400,>=10), silver (>=300,>=5), bronze (>=200)"
  - "describe_skill aggregates 4 services in parallel: skill review, fork count, rating count, embedding"
  - "Similar skills capped at 3 results, excludes current skill from embedding search"
  - "guide_skill returns category-specific guidance text for prompt/workflow/agent/mcp categories"

patterns-established:
  - "MCP tool pattern: published-only guard, parallel data fetch, JSON response, trackUsage call"
  - "Category guidance: switch-based text lookup for usage instructions per skill type"

duration: 3min
completed: 2026-02-08
---

# Phase 38 Plan 03: Describe & Guide Skill Tools Summary

**describe_skill and guide_skill MCP tools for comprehensive skill details with AI review scores, similarity recommendations, and category-specific usage guidance**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T20:43:06Z
- **Completed:** 2026-02-08T20:47:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created describe_skill tool aggregating data from 4+ services (skill, review, forks, embeddings) with quality tier derivation
- Created guide_skill tool providing category-specific usage guidance for prompt, workflow, agent, and MCP skill types
- Both tools enforce published-only status guard and return isError for missing/non-published skills
- DISC-02 (rich skill details) and DISC-03 (usage guidance) requirements delivered

## Task Commits

Each task was committed atomically:

1. **Task 1: Create describe_skill MCP tool** - `3dce056` (feat)
2. **Task 2: Create guide_skill MCP tool** - `6eb1d39` (feat, co-committed with 38-02 via lint-staged)

## Files Created/Modified
- `apps/mcp/src/tools/describe.ts` - describe_skill tool: skill details, AI review scores, ratings, fork count, similar skills, install instructions, quality tier
- `apps/mcp/src/tools/guide.ts` - guide_skill tool: category-specific usage guidance, skill content, tips, estimated time saved
- `apps/mcp/src/tools/index.ts` - Added describe.js and guide.js imports

## Decisions Made
- Quality tier derivation uses stored integer ratings (gold: >=400 AND >=10 uses, silver: >=300 AND >=5 uses, bronze: >=200)
- Similar skills limited to 3 results from embedding cosine similarity, excluding the described skill itself
- Category guidance uses switch statement for 4 known categories with a default fallback
- guide_skill adds tenant filter when authenticated, describe_skill does not (relies on published status guard)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] guide.ts co-committed with parallel 38-02 agent**
- **Found during:** Task 2 commit
- **Issue:** lint-staged in the parallel 38-02 agent's commit picked up guide.ts and index.ts changes from the working tree
- **Fix:** Verified the committed content is correct -- guide.ts and index.ts guide import are present and accurate in commit 6eb1d39
- **Files modified:** apps/mcp/src/tools/guide.ts, apps/mcp/src/tools/index.ts
- **Verification:** Full pnpm build passes, tsc --noEmit shows no guide-related errors
- **Committed in:** 6eb1d39 (co-committed with 38-02 recommend tool)

---

**Total deviations:** 1 (parallel agent commit artifact)
**Impact on plan:** No code impact -- all files are correct and in place. Build passes.

## Issues Encountered
None - both tools compiled and built successfully on first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 discovery tools (recommend_skills, describe_skill, guide_skill) are registered and functional
- Full MCP tool suite now includes 12 tools
- DISC-01 through DISC-03 requirements complete
- Ready for Phase 39 (Fork Detection) or additional discovery enhancements

---
*Phase: 38-conversational-mcp-discovery*
*Completed: 2026-02-08*
