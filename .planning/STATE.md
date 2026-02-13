# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v3.0 Wave 3 in progress (Phase 48: 2/? plans complete)

## Current Position

Phase: 48 of 48 (Homepage Redesign)
Plan: 2 of TBD in Phase 48
Status: In progress
Last activity: 2026-02-13 -- Completed 48-02-PLAN.md (dedicated /my-leverage page)

Progress: [█████████████████████████░░░░░] 80% (197/~TBD total)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production & Multi-Tenancy - 55 plans - shipped 2026-02-08
- v2.0 Skill Ecosystem - 23 plans - shipped 2026-02-08
- v3.0 AI Discovery & Workflow Intelligence - 9 phases planned

## Performance Metrics

**Velocity:**
- Total plans completed: 197
- Average duration: ~5 min (across milestones)
- Total execution time: ~10 hours

**Cumulative:**
- 197 plans across 48 phases and 8 milestones
- ~17,000 LOC TypeScript
- 8 days total development time

## Accumulated Context

### Decisions

All decisions archived in PROJECT.md Key Decisions table and milestone archives.

- Applied migrations via psql directly (drizzle-kit migrate replays all migrations, fails on existing tables)
- Visibility helpers in packages/db/src/lib/ -- new pattern for reusable DB utilities
- Forked skills always default to personal visibility (never inherit parent) for privacy safety
- MCP list tool rewrote from in-memory to DB-level WHERE for visibility + performance
- MCP describe returns generic "not found" for inaccessible personal skills (no info leakage)
- Org-level aggregations (trending, leaderboard, platform stats) always filter visibility='tenant' inline, not via helper
- Tags aggregation filtered to tenant-only since tags are an org-level concept
- JSONB user_preferences with code-defined defaults merged at read time (not DB defaults)
- UserPreferencesData interface mirrored in packages/db and Zod schema in apps/web to avoid cross-package imports
- Loom URL accepts /share/, /embed/, /i/ patterns; no index needed (read-only on detail page)
- LoomEmbed is a server component; oEmbed fetch parallelized in detail page Promise.all
- Browse/trending pages show play icon indicator only (no oEmbed calls) to avoid N+1
- Unified everyskill tool uses STRAP action router pattern with exhaustive switch for compile-time safety
- confirm_install excluded from unified tool (internal follow-up, not user-initiated action)
- Legacy tool registrations centralized in legacy.ts with DEPRECATED notices; handler files are pure modules
- routeEveryskillAction() exported for testability; 10 test cases cover routing and param validation
- CLAUDE.md export uses hoursSaved column (plan-referenced avgHoursSaved does not exist)
- Blob + createObjectURL for client-side file download without server round-trip
- Settings layout is server component with client SettingsNav for active tab highlighting via usePathname
- Notifications page wrapper stripped to fit within shared settings layout
- Company approval uses per-row form toggle with hidden fields (same pattern as deleteSkillAdminAction)
- Unapproval clears both approvedAt and approvedBy to null (full audit reset)
- CompanyApprovedBadge: indigo shield-check, sm=icon only, md=icon+text; displayed on detail, browse, trending
- Homepage Company Recommended section hidden when no approved skills (renders null from empty array)
- Embedding backfill uses sequential direct Ollama fetch (10s timeout) to avoid overloading single-threaded model
- Two embedding generators coexist: embedding-generator.ts (skill create/fork) and generate-skill-embedding.ts (review/approval paths)
- Hybrid search: RRF k=60 with FULL OUTER JOIN, fetch limit+5 for post-preference-boost reranking
- visibilitySQL() for raw SQL template queries, buildVisibilityFilter() for Drizzle query builder
- Discovery UI uses useTransition + skeleton cards for server action loading (not streaming)
- Category badge colors: prompt=blue, workflow=purple, agent=green, mcp=orange (canonical in my-skills-list.tsx)
- Search analytics: normalized queries stored alongside raw for O(1) aggregation; browse only logs when query non-empty
- Admin search dashboard: h2 page title (admin layout provides h1), client-side tab state with useState, per-tab empty states
- Homepage redesign: MiniLeverageWidget defines interfaces inline to avoid pulling server code into client bundle
- CategoryTiles is a server component (zero client JS) with /skills?category=X links
- CompactStatsBar uses FTE_DAYS_PER_YEAR since platform stats store FTE days, not hours
- /my-leverage dedicated page: same container styling as homepage for visual consistency

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future phase)
- DEFAULT_TENANT_ID cleanup -- new v3.0 code must ALWAYS resolve tenant from session

### Blockers/Concerns

- ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- DEFAULT_TENANT_ID hardcoded in 18+ files -- new v3.0 code must not continue this pattern
- Embedding model: Ollama nomic-embed-text (768 dims) -- decision resolved in Phase 45
- Homepage performance budget: sub-400ms TTFB p95 with caching strategy needed for Phase 48

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 48-02-PLAN.md -- Phase 48 in progress
Resume file: .planning/phases/48-homepage-redesign/48-02-SUMMARY.md
