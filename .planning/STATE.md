# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-03)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 17 - AI Review Pipeline

## Current Position

Phase: 17 of 19 (AI Review Pipeline)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-03 - Completed 17-01-PLAN.md (schema, service layer, SDK)

Progress: [█████████████████████████████████████░░░] 61/~67 plans (v1.0-v1.2 complete, v1.3 in progress)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 5 phases, TBD plans - in progress (2/5 phases complete, phase 17 started)

## Performance Metrics

**Cumulative (v1.0-v1.2):**
- Total plans completed: 54
- Total time: ~203 min
- Average: 3.8 min/plan

**v1.3:**
- Plans completed: 7 (4 in phase 15, 2 in phase 16, 1 in phase 17)
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
- [UI]: User profile pages at /users/[id] with linked navigation from leaderboard, skill detail, and skills table
- [UI]: Homepage search bar, ThankYouButton component, hours saved rounding fix
- [17-01]: Raw SQL for upsert/toggle due to Drizzle type inference limitation with boolean/timestamp default columns
- [17-01]: UpsertSkillReviewParams interface instead of NewSkillReview for clearer service API

### Pending Todos

None.

### Blockers/Concerns

- [Research]: AI review prompt engineering may require iteration
- [Research]: Similarity threshold needs empirical tuning (start at 0.85)
- [Research]: Voyage AI is relatively new — store model version for future migration
- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work

## Session Continuity

Last session: 2026-02-03
Stopped at: Completed 17-01-PLAN.md, ready for 17-02-PLAN.md (server action + AI review logic)
Resume file: None
