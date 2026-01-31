# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 4 - Data Model & Storage

## Current Position

Phase: 4 of 8 (Data Model & Storage)
Plan: 4 of 5
Status: In progress
Last activity: 2026-01-31 - Completed 04-04-PLAN.md (Skill Format Validation)

Progress: [################] 63% (17 of 27 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 4 min
- Total execution time: 60 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-project-foundation | 4/4 | 16 min | 4 min |
| 02-authentication | 3/3 | 15 min | 5 min |
| 03-mcp-integration | 6/6 | 18 min | 3 min |
| 04-data-model-storage | 4/5 | 11 min | 3 min |

**Recent Trend:**
- Last 5 plans: 03-06 (0 min), 04-01 (2 min), 04-02 (4 min), 04-03 (3 min), 04-04 (2 min)
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
- No FK from skills to skillVersions due to circular reference - enforce in app layer.
- Keep existing content field on skills for backward compatibility with MCP tools.
- Use integer * 100 for averageRating to preserve decimal precision without floats.
- Graceful null-handling for @relay/storage - functions return null when R2 not configured.
- Lazy-initialized S3Client singleton for R2 - created on first use, reused thereafter.
- Object key pattern for R2: skills/{skillId}/v{version}/content.
- Named relations for multiple FK to same table (publishedVersion, draftVersion).
- Merge schema and relations in drizzle config: { schema: { ...schema, ...relations } }.
- Discriminated union on format field for type-safe validation branching.
- Typed result pattern (success/error) instead of throwing for validation.

### Pending Todos

None yet.

### Blockers/Concerns

- Node.js version warning (v20 vs required v22) - works but shows warning on pnpm commands.
- Docker not available in sandbox - database container must be started manually when Docker is available.
- Database schema push requires interactive confirmation - run `pnpm --filter @relay/db db:push` manually when database is available.
- ESM/CJS type conflicts in monorepo - drizzle operators have type issues across package boundaries with different moduleResolution settings.
- R2 requires manual setup - env vars (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) and Cloudflare dashboard config before storage features work.

## Session Continuity

Last session: 2026-01-31T17:42:38Z
Stopped at: Completed 04-04-PLAN.md (Skill Format Validation)
Resume file: None
