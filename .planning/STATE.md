# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 25 — Multi-Tenancy Schema & Audit Foundation

## Current Position

Phase: 25 of 33 (Multi-Tenancy Schema & Audit Foundation)
Plan: 5 of 9 in current phase
Status: In progress
Last activity: 2026-02-07 — Completed 25-05-PLAN.md (tenant migration files)

Progress: [███░░░░░░░░░░░░░░░░░░░░░] ~5% (v1.5 — 5 of ~TBD plans)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production, Multi-Tenancy & Reliable Usage Tracking - 9 phases (25-33) - in progress

## Performance Metrics

**Velocity:**
- Total plans completed: 97
- Average duration: ~5 min (across milestones)
- Total execution time: ~7 hours

**Cumulative:**
- 97 plans across 25 phases and 5 milestones
- ~13,500 LOC TypeScript
- 6 days total development time

*Updated after each plan completion*

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

| Plan | Decision | Rationale |
|------|----------|-----------|
| 25-01 | uuid PK for audit_logs, text PK for tenants | uuid better for high-volume append-only; text consistent with existing schema |
| 25-01 | withTimezone: true on audit_logs.createdAt | SOC2 compliance requires precise timezone tracking |
| 25-01 | Nullable tenantId/actorId on audit_logs | Supports system-level and cross-tenant events |
| 25-02 | set_config() over SET LOCAL | SET LOCAL does not support parameterized values; set_config() with is_local=true is equivalent and works with Drizzle sql templates |
| 25-02 | Cast tx to typeof db in withTenant | Gives callers full Drizzle query builder API without narrower transaction type |
| 25-03 | Skills slug unique replaced with composite (tenantId, slug) | Allows same slug across different tenants |
| 25-03 | Users email stays globally unique | Email is login identity via Auth.js, not tenant-scoped |
| 25-03 | Seed script creates default tenant for all seed data | Required for FK integrity after adding notNull tenantId columns |
| 25-05 | Deterministic default tenant UUID | Avoids subqueries in backfill migration; well-known ID referenceable across migrations |
| 25-05 | Idempotent migration guards | IF NOT EXISTS, ON CONFLICT, WHERE IS NULL make all 3 migrations safe to re-run |

### Pending Todos

None.

### Blockers/Concerns

- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- [Research]: PostgreSQL query performance at 100k+ usage_events — add indexes if slow
- [Note]: apps/mcp tsc --noEmit has pre-existing errors from packages/db module resolution — not blocking
- [v1.5]: Hetzner server: Ubuntu 24.04, 8 CPU, 30GB RAM, Docker+Compose ready, Tailscale on :443, no native PostgreSQL
- [v1.5]: User has domain ready to point, needs DNS A record setup
- [v1.5]: REQUIREMENTS.md says 55 but actually contains 62 requirements — roadmap maps all 62

## Session Continuity

Last session: 2026-02-07T16:37:00Z
Stopped at: Backfilled 25-03-SUMMARY.md (tenantId on first 5 data tables)
Resume file: None
