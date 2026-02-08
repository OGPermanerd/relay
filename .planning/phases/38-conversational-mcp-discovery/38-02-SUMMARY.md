---
phase: 38-conversational-mcp-discovery
plan: 02
subsystem: api
tags: [mcp, semantic-search, ollama, pgvector, ilike-fallback, discovery]

requires:
  - phase: 38-conversational-mcp-discovery
    plan: 01
    provides: semanticSearchSkills() service and generateEmbedding() Ollama client
provides:
  - recommend_skills MCP tool with semantic search + ILIKE fallback
  - handleRecommendSkills() exported function for reuse
affects: [38-03-describe-skill]

tech-stack:
  added: []
  patterns: [semantic-first-with-text-fallback, searchMethod-transparency]

key-files:
  created:
    - apps/mcp/src/tools/recommend.ts
  modified:
    - apps/mcp/src/tools/index.ts

key-decisions:
  - "Semantic search tried first, ILIKE fallback only when embedding null or zero results"
  - "searchMethod field in response JSON for client transparency (semantic vs text)"
  - "Explicit results type annotation to unify SemanticSearchResult and SearchSkillResult shapes"

patterns-established:
  - "Dual-search pattern: generateEmbedding -> semanticSearchSkills -> fallback searchSkillsByQuery"
  - "Always include searchMethod in discovery tool responses for observability"

duration: 3min
completed: 2026-02-08
---

# Phase 38 Plan 02: Recommend Skills Tool Summary

**recommend_skills MCP tool with semantic-first search via Ollama embeddings and ILIKE text fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T20:43:12Z
- **Completed:** 2026-02-08T20:46:28Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created recommend_skills MCP tool with semantic search via Ollama embeddings
- Implemented graceful ILIKE fallback when Ollama is unavailable or returns no results
- Response includes searchMethod field ("semantic" or "text") for transparency
- Published-only filter enforced through both search service functions (DISC-06)
- Auth nudge and usage tracking follow existing search.ts patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recommend_skills MCP tool** - `6eb1d39` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/recommend.ts` - recommend_skills tool with dual search strategy, auth nudge, usage tracking
- `apps/mcp/src/tools/index.ts` - Added recommend.js import for tool registration

## Decisions Made
- Semantic search attempted first; fallback to ILIKE only when embedding generation fails (null) or semantic results are empty
- searchMethod field included in JSON response so clients/LLMs know which search path was used
- Explicit union type annotation for results array to bridge SemanticSearchResult (with similarity) and SearchSkillResult shapes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Web build had transient ENOENT errors (corrupted .next cache + parallel agent contention) -- unrelated to MCP changes; MCP package builds cleanly

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- recommend_skills tool registered and compilable
- Addresses DISC-01 (semantic search), DISC-05 (graceful fallback), DISC-06 (published-only filter)
- Ready for integration testing once Ollama is available

## Self-Check: PASSED

- All created files exist (recommend.ts)
- Commit 6eb1d39 verified
- recommend.js import present in index.ts

---
*Phase: 38-conversational-mcp-discovery*
*Completed: 2026-02-08*
