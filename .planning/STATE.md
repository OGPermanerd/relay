# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Protect and grow your IP. Fast. Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v7.0 Algorithm & Architecture Rewrite — Phase 69 (Extended Visibility)

## Current Position

Phase: 69 of 75 (Extended Visibility)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-02-16 — v7.0 roadmap created (7 phases, 25 requirements)

Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%

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
- Total plans completed: 246
- Average duration: ~5 min (across milestones)
- Total execution time: ~12.3 hours

**Cumulative:**
- 246 plans across 68 phases and 11 milestones
- ~64,000 LOC TypeScript across 469 files
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

None. Ready for Phase 69 planning.

## Session Continuity

Last session: 2026-02-16
Stopped at: v7.0 roadmap created, ready for Phase 69 planning
Resume file: N/A
