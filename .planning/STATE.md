# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 19 complete — Cross-Platform Install (all plans done). v1.3 milestone complete.

## Current Position

Phase: 19 of 19 (Cross-Platform Install)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-04 - Completed 19-02-PLAN.md (install modal integration + E2E tests)

Progress: [████████████████████████████████████████████] 69/69 plans (v1.0-v1.3 complete)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 5 phases, 15 plans - shipped 2026-02-04

## Performance Metrics

**Cumulative (v1.0-v1.2):**
- Total plans completed: 54
- Total time: ~203 min
- Average: 3.8 min/plan

**v1.3:**
- Plans completed: 15 (4 in phase 15, 2 in phase 16, 3 in phase 17, 2 in phase 18, 2 in phase 19)
- Phases 15-16 implemented via bulk commits

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3 Research]: Use Voyage AI for embeddings (Anthropic-recommended, voyage-code-3 model)
- [v1.3 Research]: Use pgvector extension (stays within PostgreSQL, no new infrastructure)
- [v1.3 Research]: Advisory-only similarity detection (never blocking, high threshold 0.85+)
- [v1.3 Research]: On-demand AI review (not auto-trigger, manages costs)
- [15-01]: 1024 dimensions for voyage-code-3 model, HNSW index with cosine similarity
- [15]: Voyage AI embedding service, publish hook integration, backfill script
- [16]: SimilarSkillsWarning component, two-step upload flow, Similar Skills section on detail page
- [17-01]: Raw SQL for upsert/toggle due to Drizzle type inference limitation with boolean/timestamp default columns
- [17-02]: Manual JSON schema for output_config.format (zodOutputFormat requires Zod v4, project uses v3)
- [17-03]: Simplified from 6 to 3 review categories (quality, clarity, completeness) with overall score
- [18]: Self-referential forkedFromId on skills table, fork confirmation modal, pre-fill publish as draft
- [18]: Fork attribution as subtitle under title with linked parent skill and author names
- [18]: Top 5 forks sorted by highest rating in Forks section on parent detail page
- [19-01]: All 4 platforms share identical MCP config (npx -y @relay/mcp), differ only in file path and instructions
- [19-01]: Claude Desktop pre-selected as default platform for all OS; install script download only for claude-desktop
- [19-02]: InstallButton self-contained with internal modal state (no props drilling needed)
- [19-02]: Removed swipe-to-install in favor of modal-based cross-platform install flow
- [19-02]: Install button available to all users on detail page (not just authenticated)

### Pending Todos

None.

### Blockers/Concerns

- [Research]: Similarity threshold needs empirical tuning (start at 0.85)
- [Research]: Voyage AI is relatively new — store model version for future migration
- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work

## Session Continuity

Last session: 2026-02-04
Stopped at: Completed 19-02-PLAN.md, v1.3 milestone complete
Resume file: None
