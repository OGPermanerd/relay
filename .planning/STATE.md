# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Protect and grow your IP. Fast. Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v7.0 Algorithm & Architecture Rewrite — Phase 74 (Adaptive Query Routing)

## Current Position

Phase: 74 of 75 (Adaptive Query Routing)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-02-16 — Completed 74-01 (Query Classification & Search Routing)

Progress: [████████████████████████░░░░░░] 6/7 phases

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
- Total plans completed: 263
- Average duration: ~5 min (across milestones)
- Total execution time: ~12.5 hours

**Cumulative:**
- 263 plans across 74 phases and 11 milestones
- ~64,000 LOC TypeScript across 470+ files
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
- PREFERENCE_BOOST = 1.3 matches web UI discover.ts multiplier for consistency
- Stable sort for text search preference reranking (preserves relevance within groups)
- All preference loading wrapped in try/catch — failures never break core MCP tools
- List tool always applies orderBy (desc hoursSaved default) for deterministic ordering

Phase 71 decisions:
- UPSERT targets unique (tenant_id, user_id, skill_id) composite index for conflict resolution
- getUserViewsForSkills returns Map<string, UserSkillView> for O(1) badge lookups per skill
- getWhatsNewForUser uses 30-day rolling window with published-only filter via INNER JOIN
- countFeedbackSince uses gt() on createdAt for precise post-view change detection
- Changes computed BEFORE recording view to preserve comparison baseline (pitfall TEMP-03)
- View recording is fire-and-forget with .catch(() => {}) — never blocks page render
- ChangeSummary placed after SkillDetail, before action buttons in skill detail page
- Pass updatedSkillIds as string[] across RSC boundary (Set not serializable), reconstruct with useMemo
- WhatsNewFeed returns null when empty (hidden, not empty state)

Phase 72 decisions (plan 01):
- REAL type for modularity (not NUMERIC) — sufficient precision for 0.0-1.0 quality score
- run_id TEXT column (nullable) for correlating detection batches across tenants
- Composite index on (tenant_id, community_id) for cluster membership queries
- UNIQUE on (tenant_id, skill_id) enables UPSERT on re-detection

Phase 72 decisions (plan 02):
- K=10 nearest neighbors, MIN_SIMILARITY=0.3 edge threshold, RESOLUTION=1.0 Louvain parameter
- MIN_SKILLS_FOR_DETECTION=5 as lower bound for graceful fallback
- Atomic refresh via db.transaction (delete + insert) not per-row UPSERT -- simpler and guarantees clean state
- Console.warn for low-quality partitions (modularity < 0.1) but still persist results
- CRON_SECRET added to dev env for live testing (gitignored)

Phase 73 decisions (plan 01):
- TEXT columns for community_label and community_description (not separate metadata table)
- Claude Haiku (claude-haiku-4-5-20251001) for label generation -- cost-efficient for short outputs
- Labels generated automatically in cron after detection, not on page load
- pgvector AVG() for centroid similarity in getCommunityDetail -- no JS vector math
- Per-community try/catch in label generation -- one failure doesn't block others

Phase 73 decisions (plan 02):
- CommunityCard as full-card Link (click anywhere) matching existing card patterns
- Detail page uses flex div layout (not HTML table) for responsive mobile support
- Dashboard limited to 3 communities max with "View all" overflow to /communities
- Similarity color coding: green >= 80%, yellow >= 60%, gray < 60%

Phase 74 decisions (plan 01):
- Pure-function classifier with zero dependencies -- deterministic, testable, no async
- Centralized embedding generation in router to avoid double-generation on fallback (Pitfall 2)
- Optional routeType in SearchQueryEntry for backward compatibility with MCP callers
- Semantic/hybrid routes auto-downgrade to keyword when semanticSimilarityEnabled is false (Pitfall 4)
- RouteResult<T> carries fellBack flag and classificationReason for analytics transparency

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

None. Phase 74 plan 01 complete. Query classifier and search router ready for wiring.

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 74-01 (Query Classification & Search Routing)
Resume file: .planning/phases/74-adaptive-query-routing/74-01-SUMMARY.md
