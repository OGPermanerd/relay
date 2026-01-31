# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 3 - MCP Integration (Gap Closure)

## Current Position

Phase: 3 of 8 (MCP Integration)
Plan: 5 of 6 (gap closure plans)
Status: Gap closure in progress
Last activity: 2026-01-31 - Completed 03-05-PLAN.md (MCP Documentation)

Progress: [############] 44% (12 of 27 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 4.1 min
- Total execution time: 49 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-project-foundation | 4/4 | 16 min | 4 min |
| 02-authentication | 3/3 | 15 min | 5 min |
| 03-mcp-integration | 5/6 | 18 min | 4 min |

**Recent Trend:**
- Last 5 plans: 03-01 (4 min), 03-02 (8 min), 03-03 (2 min), 03-04 (3 min), 03-05 (1 min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- MCP Integration moved to Phase 3 (from Phase 8) to enable usage tracking from day one. Core metric (FTE Days Saved = uses x hours) requires real usage data.
- E2E testing with Playwright added to Phase 1 to ensure served pages can be validated automatically from the start.
- Inlined Tailwind theme in apps/web/globals.css - CSS imports from workspace packages not supported by Next.js build.
- 15-minute CI timeout - balanced between allowing E2E tests and preventing runaway builds.
- PostgreSQL 16 Alpine for CI service container - matches production, minimal image size.
- drizzle-kit push for development, migrations for production workflow.
- Schema-based drizzle client for type-safe relation queries.
- JWT session strategy for Auth.js - required for Edge middleware compatibility.
- Split auth config pattern - auth.config.ts (Edge) + auth.ts (Node with adapter).
- Text ID for users table - Auth.js DrizzleAdapter requires text primary keys.
- Graceful null-db handling - allows builds without DATABASE_URL.
- Route group (auth) for auth pages - organizes login/etc without affecting URLs.
- Server action form for sign-in - simpler than client component, works without JS.
- Protected route group (protected) for authenticated pages with shared layout.
- Contribution statistics placeholder with 4 metrics: Skills Shared, Total Uses, Avg Rating, FTE Days Saved.
- Use McpServer from @modelcontextprotocol/sdk for official SDK compatibility.
- stdio transport for universal MCP client support.
- usageEvents with text skillId to match upcoming skills table.
- In-memory filtering for MCP tools to avoid drizzle ESM/CJS type conflicts.
- Split @relay/db imports for ESM contexts - main export for db, direct path for schema tables.
- Return skill content + instructions from deploy_skill (Claude Code handles file ops).
- Use skill.slug for deploy filename (filesystem-safe).
- Mock @relay/db at module level for isolated MCP tool testing.

### Pending Todos

None yet.

### Blockers/Concerns

- Node.js version warning (v20 vs required v22) - works but shows warning on pnpm commands.
- Docker not available in sandbox - database container must be started manually when Docker is available.
- Database schema push requires interactive confirmation - run `pnpm --filter @relay/db db:push` manually when database is available.
- ESM/CJS type conflicts in monorepo - drizzle operators have type issues across package boundaries with different moduleResolution settings.

## Session Continuity

Last session: 2026-01-31T16:58:48Z
Stopped at: Completed 03-05-PLAN.md (MCP Documentation)
Resume file: None
