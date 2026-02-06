# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v1.4 Phase 24 - Extended MCP Search (In Progress)

## Current Position

Phase: 24 (Extended MCP Search) - fifth of 5 in v1.4
Plan: 01 of 2
Status: In progress
Last activity: 2026-02-06 — Completed 24-01-PLAN.md (Search Skills Service)

Progress: [██████████████████████░] ~80% (v1.4 - 24 of ~30 plans)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 5 phases planned

## Performance Metrics

**Velocity:**
- Total plans completed: 93
- Average duration: ~5 min (across milestones)
- Total execution time: ~6.4 hours

**Recent Trend (v1.4):**
- 24 plans across 5 phases (20, 21, 22, 23, 24)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Dual-transport MCP (stdio + Streamable HTTP) with shared tool handlers
- [Research]: API key format `rlk_` prefix + 32 random bytes, SHA-256 hash storage
- [Research]: Graceful degradation — anonymous tracking if no API key (backward compatible)
- [Research]: Only 2 new deps: mcp-handler ^1.0.7, recharts ^3.7.0
- [Replan]: Phase 20 split from 4 plans to 6 smaller plans to prevent context crashes
- [20-01]: Used Node.js built-in crypto only — zero external deps for key generation/hashing
- [20-02]: Timing-safe comparison + fire-and-forget lastUsedAt + explicit column exclusion of keyHash
- [20-03]: leftJoin makes userEmail nullable in admin listAll; rotateApiKey always targets self
- [20-04]: useState+useCallback over useActionState for multi-action component; amber show-once pattern
- [20-06]: Admin view uses table layout (vs card layout for user view); client-side text filter for instant search
- [21-02]: Anonymous installs valid: missing/invalid API key records null userId (graceful degradation)
- [21-03]: Non-blocking install callbacks with error suppression; extract API key from just-written config
- [21-04]: COALESCE fallback chain for FTE hours: rating estimate -> creator estimate -> 1
- [21-05]: nuqs URL state for tabs; serialize Date to ISO string across server-client boundary
- [21-06]: getByRole('heading') to disambiguate heading vs StatCard labels; page.evaluate for raw fetch in API tests
- [22-01]: SDK resolved to 1.25.3; skipNudge suppresses nudge for HTTP; transport param controls deploy response format
- [22-02]: Inline tool logic (no cross-app imports); withCors wrapper on all responses; rate limit keyed by clientId (keyId)
- [22-03]: Playwright request API for CORS testing (browser fetch cannot set Origin header); clipboard fallback for older browsers
- [23-01]: Org filtering via email domain matching; two queries for getSkillUsage to avoid N+1 on breakdown
- [23-02]: Blue #3b82f6 for charts; default 30d range; parseAsStringLiteral for type-safe URL enum
- [23-05]: Import shared types from analytics-queries instead of redefining; handle nullable ExportDataRow fields with fallbacks
- [23-06]: Used session.user.id as orgId (queries derive domain internally); narrowed auth guard to session?.user?.id for TS strict mode
- [23-07]: Date.toISOString() before passing to Drizzle sql templates; sql.raw() for date_trunc granularity; sql.join() for IN clauses; no type re-exports from "use server" files
- [24-01]: ILIKE-only search (no full-text/embedding) for MCP — practical default since MCP stdio lacks VOYAGE_API_KEY

### Pending Todos

1. Test usage tracking E2E with Corporate Document Branding skill (testing)

### Blockers/Concerns

- [Resolved]: MCP userId field now populated via auth.ts resolveUserId() when RELAY_API_KEY is set (21-01)
- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- [Resolved]: CORS headers for Claude.ai tested and working — allow-origin, expose Mcp-Session-Id, max-age 86400 (22-02)
- [Resolved]: Analytics SQL queries fixed — Date serialization, GROUP BY mismatch, IN clause type, type re-export (23-07)
- [Research]: PostgreSQL query performance at 100k+ usage_events — add indexes if slow
- [Note]: apps/mcp tsc --noEmit has pre-existing errors from packages/db module resolution — not blocking

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed 24-01-PLAN.md (Search Skills Service)
Resume file: None
