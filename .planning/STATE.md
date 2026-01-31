# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-31)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v1.0 MILESTONE COMPLETE - all 8 phases delivered

## Current Position

Phase: 8 of 8 (Metrics & Analytics)
Plan: 5 of 5
Status: MILESTONE COMPLETE
Last activity: 2026-01-31 - Completed 08-02-PLAN.md

Progress: [##########################] 100% (32 of 32 total plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 32
- Average duration: 4 min
- Total execution time: 120 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-project-foundation | 4/4 | 16 min | 4 min |
| 02-authentication | 3/3 | 15 min | 5 min |
| 03-mcp-integration | 6/6 | 18 min | 3 min |
| 04-data-model-storage | 5/5 | 16 min | 3 min |
| 05-skill-publishing | 3/3 | 18 min | 6 min |
| 06-discovery | 4/4 | 20 min | 5 min |
| 07-ratings-reviews | 3/3 | 7 min | 2.3 min |
| 08-metrics-analytics | 6/6 | 11 min | 1.8 min |

**Recent Trend:**
- Last 5 plans: 08-01 (2 min), 08-03 (2 min), 08-04 (2 min), 08-05 (3 min), 08-02 (2 min)
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
- Use RETURNING clause with upsert to get actual IDs for downstream inserts (seed script).
- Use denormalized totalUses for display performance - query skill.totalUses rather than counting usageEvents.
- FTE Days Saved formula: (totalUses * hoursSaved) / 8, rounded to 1 decimal.
- Statistics services return default values (zeros/nulls) when db is null for graceful degradation.
- Web Crypto API for SHA-256 hashing - compatible with both Node.js and Edge runtime.
- Store R2 objectKey (not full URL) in skillVersions.contentUrl.
- Insert skill → version → update skill pattern to avoid circular FK constraint.
- Keep content in both skills.content (MCP backward compat) and R2 (versioning).
- Custom tsvector type via customType - drizzle-orm doesn't export tsvector directly.
- Weight A for name, Weight B for description - name matches rank higher in FTS.
- websearch_to_tsquery over plainto_tsquery - supports quotes and boolean operators.
- Fallback to totalUses ordering when no query - optimized browse mode.
- react-sparklines for usage trend visualization - lightweight, simple API for inline charts.
- Batch query with date_trunc for sparkline data - single query for all skills to avoid N+1.
- 14-day lookback for sparklines - balances detail vs. performance.
- Fill missing days with zeros - ensures continuous sparkline visualization.
- SearchInput uses debounced input with 300ms delay to avoid excessive navigation.
- CategoryFilter provides All option to clear category filter.
- EmptyState type determined server-side based on query/category/tags context.
- getAvailableTags returns empty array stub until tags are implemented.
- ClearFiltersButton navigates to /skills (no params) to reset all filters.
- Use nuqs over Next.js useRouter/useSearchParams for cleaner URL state management.
- nuqs parsers: parseAsString for query, parseAsStringEnum for category, parseAsArrayOf for tags.
- Tag filtering implemented as placeholder until metadata JSONB column added to skills table.
- skillSlug passed in formData for rating submission to enable proper path revalidation.
- Upsert pattern for ratings: check for existing rating by skillId + userId, update if exists, insert if not.
- hoursSavedEstimate uses step=1 (integer only) to match database INTEGER column constraint.
- Star rating input uses hidden radio buttons for accessibility with hover preview for visual feedback.
- Exclude current user from reviews: Use sql template to exclude current user's review from reviews list to avoid duplication.
- Pre-populate rating form with existing rating for update functionality using existingRating prop.
- Dynamic heading based on rating existence: "Update Your Rating" vs "Rate This Skill".
- Visual separator in SkillDetail: border-t divider at bottom for clean section boundaries.
- Use user estimates when at least one rating has hoursSavedEstimate, otherwise creator estimate.
- avg() returns string in drizzle-orm - parse with parseFloat.
- Track estimate source ('user' | 'creator') in SkillStats for UI transparency.
- Display source indicator in usage section with count of user estimates.
- Promise.all for parallel queries in platform aggregation - run skill aggregation and user count simultaneously.
- COALESCE in SQL for platform stats - handle NULL values at database level for cleaner code.
- Hacker News time-decay formula for trending: (recent_uses - 1) / (age_hours + 2)^1.8.
- Type-safe mapping from raw SQL results using explicit String() and Number() conversions.
- Use RANK() over DENSE_RANK() - gaps in ranking (1, 1, 3) acceptable for leaderboards.
- Cast db.execute result to Record<string,unknown>[] - RowList type incompatible with map.
- Updated StatCard with icon support rather than creating new component for backward compatibility.
- Inline SVG icon components for Heroicons - no external icon library needed.
- Parallel data fetching pattern in Server Components: const [a, b, c] = await Promise.all([...]).

### Pending Todos

None yet.

### Blockers/Concerns

- Node.js version warning (v20 vs required v22) - works but shows warning on pnpm commands.
- Docker not available in sandbox - database container must be started manually when Docker is available.
- Database schema push requires interactive confirmation - run `pnpm --filter @relay/db db:push` manually when database is available.
- ESM/CJS type conflicts in monorepo - drizzle operators have type issues across package boundaries with different moduleResolution settings.
- R2 requires manual setup - env vars (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) and Cloudflare dashboard config before storage features work.

## Session Continuity

Last session: 2026-01-31T21:00:00Z
Stopped at: MILESTONE COMPLETE - v1.0 delivered
Resume file: None
