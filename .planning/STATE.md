# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v1.4 Phase 23 - Analytics Dashboard

## Current Position

Phase: 23 (Analytics Dashboard) - fourth of 5 in v1.4
Plan: 01 of 6
Status: In progress
Last activity: 2026-02-06 — Completed 23-01-PLAN.md (Analytics Queries)

Progress: [████████████████░] ~56% (v1.4 - 17 of ~30 plans)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 5 phases planned

## Performance Metrics

**Velocity:**
- Total plans completed: 86
- Average duration: ~5 min (across milestones)
- Total execution time: ~6.0 hours

**Recent Trend (v1.4):**
- 17 plans across 4 phases (20, 21, 22, 23)
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

### Pending Todos

1. Test usage tracking E2E with Corporate Document Branding skill (testing)

### Blockers/Concerns

- [Resolved]: MCP userId field now populated via auth.ts resolveUserId() when RELAY_API_KEY is set (21-01)
- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- [Resolved]: CORS headers for Claude.ai tested and working — allow-origin, expose Mcp-Session-Id, max-age 86400 (22-02)
- [Research]: PostgreSQL query performance at 100k+ usage_events — add indexes if slow
- [Note]: apps/mcp tsc --noEmit has pre-existing errors from packages/db module resolution — not blocking

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed 23-01-PLAN.md (Analytics Queries)
Resume file: None
