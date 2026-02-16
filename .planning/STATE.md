# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Protect and grow your IP. Fast. Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v7.0 Algorithm & Architecture Rewrite — Phase 70 (MCP Preference Sync)

## Current Position

Phase: 70 of 75 (MCP Preference Sync)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-16 — Completed 70-01-PLAN.md (MCP preference handlers)

Progress: [████░░░░░░░░░░░░░░░░░░░░░░░░░░] 1/7 phases

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production & Multi-Tenancy - 55 plans - shipped 2026-02-08
- v2.0 Skill Ecosystem - 23 plans - shipped 2026-02-08
- v3.0 AI Discovery & Workflow Intelligence - 21 plans - shipped 2026-02-13
- v4.0 Gmail Workflow Diagnostic - 17 plans - shipped 2026-02-14
- v5.0 Feedback, Training & Benchmarking - 18 plans - shipped 2026-02-15
- v6.0 IP Dashboard & Skills Portfolio - 15 plans - shipped 2026-02-16
- v7.0 Algorithm & Architecture Rewrite - 7 phases planned

## Performance Metrics

**Velocity:**
- Total plans completed: 250
- Average duration: ~5 min (across milestones)
- Total execution time: ~12.5 hours

**Cumulative:**
- 250 plans across 69 phases and 11 milestones
- ~64,000 LOC TypeScript across 470 files
- 17 days total development time

## Accumulated Context

### Decisions

All prior decisions archived in PROJECT.md Key Decisions table and milestone archives.

v7.0 research decisions (from research/SUMMARY.md):
- PostgreSQL adjacency lists for graphs, no graph DB (scale too small for Neo4j)
- Louvain/Leiden in JS, no Python sidecar (graphology-communities-louvain or vendor ~300 lines)
- Rule-based query classification, no LLM per-query (handles 90%+ correctly)
- RAGAS as TypeScript judge prompt adaptation, no Python RAGAS library
- Direct SDKs with dynamic import, no Vercel AI SDK (project already has direct Anthropic SDK)

Phase 69 decisions:
- CHECK constraint (not enum) for 4 visibility values -- easy to extend without migration
- RLS cross-tenant reads for global_approved via OR in USING clause, writes restricted to own tenant
- Vitest added to @everyskill/db as first test framework for that package
- Server-side admin resolution via auth() + isAdmin() passed as boolean prop to client components
- VisibilityBadge color scheme: Global=purple, Company=blue, Portable=green, Private=gray
- Admin gate in server actions uses isAdmin(session) inline check, not middleware
- MCP tools reject global_approved at handler level with descriptive error (no role info available)

Phase 70 decisions:
- Read-modify-write pattern for MCP set_preferences to preserve claudeMdWorkflowNotes and trainingDataConsent
- Auth guard checks both userId AND tenantId before allowing preference access

### Pending Todos

- Skill visibility: expose all 4 levels in upload form (addressed by Phase 69)
- Default skill visibility scope to company-visible (tenant) (addressed by Phase 69)
- Portfolio PDF download (backlogged)
- OAuth re-link / user migration tool (backlogged)

### Research Flags

- MEDIUM confidence: Leiden npm package API needs verification at implementation time (Phase 72)
- MEDIUM confidence: @google/genai SDK token counting API needs verification (Phase 75 if multi-model added)
- Critical pitfall: Visibility touches 15+ files in 2 patterns (centralized helper vs inline SQL)
- Critical pitfall: Similarity graph CROSS JOIN is quadratic — must use KNN approach

### Blockers/Concerns

None. Plan 70-01 complete. Ready for 70-02.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 70-01-PLAN.md, ready for 70-02
Resume file: .planning/phases/70-mcp-preference-sync/70-02-PLAN.md
