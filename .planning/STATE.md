# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v3.0 Phase 43 -- User Preferences (In progress)

## Current Position

Phase: 43 of 48 (User Preferences)
Plan: 2 of 3 in current phase (complete: 01, 02)
Status: In progress
Last activity: 2026-02-13 -- Completed 43-02-PLAN.md (settings UI and preferences form)

Progress: [█████████████████████░░░░░░░░░] 76% (187/~TBD total)

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
- Total plans completed: 187
- Average duration: ~5 min (across milestones)
- Total execution time: ~10 hours

**Cumulative:**
- 187 plans across 43 phases and 8 milestones
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

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future phase)
- DEFAULT_TENANT_ID cleanup -- new v3.0 code must ALWAYS resolve tenant from session

### Blockers/Concerns

- ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- DEFAULT_TENANT_ID hardcoded in 18+ files -- new v3.0 code must not continue this pattern
- Embedding model decision needed before Phase 45 (Ollama local vs Voyage AI cloud)
- Homepage performance budget: sub-400ms TTFB p95 with caching strategy needed for Phase 48

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed Phase 43 Plan 02 (settings UI and preferences form) -- ready for 43-03 (skill listing)
Resume file: .planning/phases/43-user-preferences/43-03-PLAN.md
