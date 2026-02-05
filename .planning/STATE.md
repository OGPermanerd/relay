# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v1.4 Phase 21 - Employee Usage Tracking

## Current Position

Phase: 21 (Employee Usage Tracking) - second of 5 in v1.4
Plan: 21-01 + 21-02 + 21-04 complete (wave 1 complete)
Status: In progress
Last activity: 2026-02-05 — Completed 21-02-PLAN.md (Install callback route)

Completed in phase 21:
- apps/mcp/src/auth.ts — DONE (21-01, userId resolution + nudge counter)
- apps/mcp/src/index.ts — DONE (21-01, resolveUserId at startup)
- apps/mcp/src/tools/search.ts — DONE (21-01, auth wiring)
- apps/mcp/src/tools/list.ts — DONE (21-01, auth wiring)
- apps/mcp/src/tools/deploy.ts — DONE (21-01, auth wiring)
- apps/web/app/api/install-callback/route.ts — DONE (21-02, install_confirmed events)
- apps/web/middleware.ts — DONE (21-02, /api/install-callback exemption)
- apps/web/lib/my-leverage.ts — DONE (21-04, 4 aggregation query functions)

Progress: [██████████░] ~33% (v1.4 - 10 of ~30 plans)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 5 phases planned

## Performance Metrics

**Velocity:**
- Total plans completed: 79
- Average duration: ~5 min (across milestones)
- Total execution time: ~5.8 hours

**Recent Trend (v1.3):**
- 15 plans across 5 phases
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
- [21-04]: COALESCE fallback chain for FTE hours: rating estimate -> creator estimate -> 1

### Pending Todos

None.

### Blockers/Concerns

- [Resolved]: MCP userId field now populated via auth.ts resolveUserId() when RELAY_API_KEY is set (21-01)
- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- [Research]: Exact CORS headers for Claude.ai need empirical testing during Phase 22
- [Research]: PostgreSQL query performance at 100k+ usage_events — add indexes if slow

## Session Continuity

Last session: 2026-02-05
Stopped at: Completed 21-02-PLAN.md (Install callback route)
Resume file: None
