# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 2 - Authentication

## Current Position

Phase: 2 of 8 (Authentication)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-31 - Completed 02-02-PLAN.md (Route Protection and Login)

Progress: [######----] 22% (6 of 27 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3.8 min
- Total execution time: 23 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-project-foundation | 4/4 | 16 min | 4 min |
| 02-authentication | 2/3 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 01-03 (2 min), 01-02 (3 min), 01-04 (4 min), 02-01 (5 min), 02-02 (2 min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- Node.js version warning (v20 vs required v22) - works but shows warning on pnpm commands.
- Docker not available in sandbox - database container must be started manually when Docker is available.

## Session Continuity

Last session: 2026-01-31T14:02:36Z
Stopped at: Completed 02-02-PLAN.md (Route Protection and Login)
Resume file: None
