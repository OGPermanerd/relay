# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 25 complete -- ready for Phase 26

## Current Position

Phase: 25 of 33 (Multi-Tenancy Schema & Audit Foundation)
Plan: 9 of 9 in current phase
Status: Phase complete
Last activity: 2026-02-07 -- Completed 25-09-PLAN.md (run migrations and verify)

Progress: [█████░░░░░░░░░░░░░░░░░░░] ~8% (v1.5 -- 9 of ~TBD plans)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production, Multi-Tenancy & Reliable Usage Tracking - 9 phases (25-33) - in progress

## Performance Metrics

**Velocity:**
- Total plans completed: 99
- Average duration: ~5 min (across milestones)
- Total execution time: ~7.25 hours

**Cumulative:**
- 99 plans across 25 phases and 5 milestones
- ~13,600 LOC TypeScript
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
| 25-04 | site-settings unique tenantId (one row per tenant) | Replaces global singleton with per-tenant settings rows |
| 25-04 | api-keys key_hash globally unique | Auth identity lookup by hash must work cross-tenant |
| 25-04 | Service files updated with tenantId immediately | Prevents compilation errors rather than deferring to later plans |
| 25-05 | Deterministic default tenant UUID | Avoids subqueries in backfill migration; well-known ID referenceable across migrations |
| 25-05 | Idempotent migration guards | IF NOT EXISTS, ON CONFLICT, WHERE IS NULL make all 3 migrations safe to re-run |
| 25-06 | RLS uses current_setting('app.current_tenant_id', true) | Missing setting returns NULL = zero rows (secure default) |
| 25-06 | FORCE RLS on all tenant tables | Even superuser/table-owner connections see filtered rows |
| 25-06 | audit_logs NOT RLS-protected | Supports system-level and cross-tenant audit events |
| 25-06 | Trigger-based append-only over REVOKE | Works regardless of DB role setup; REVOKE deferred to deployment |
| 25-07 | Upgrade drizzle-orm 0.38.4 -> 0.42.0 | Required for pgPolicy API support (not available in 0.38.x) |
| 25-07 | Restrictive pgPolicy without `to:` param | Applies to public role; combined with FORCE RLS covers all connections |
| 25-08 | Fire-and-forget audit pattern | Catch errors and log to console, never propagate to callers |
| 25-08 | Direct INSERT not transaction-scoped | audit_logs is append-only, no RLS needed |
| 25-09 | drizzle-kit push for table creation, manual SQL for RLS | Push handles CREATE TABLE/FK/indexes; manual SQL needed for FORCE RLS and policy clauses |
| 25-09 | users.tenantId gets .default() | Auth.js DrizzleAdapter createUser doesn't pass tenantId; default ensures OAuth login works |
| 25-09 | DEFAULT_TENANT_ID constant in action files | Blocking fix for build; each file gets hardcoded constant with TODO for dynamic resolution |

### Pending Todos

None.

### Blockers/Concerns

- [17-01]: ANTHROPIC_API_KEY must be configured in .env.local before AI review features work
- [Research]: PostgreSQL query performance at 100k+ usage_events -- add indexes if slow
- [Note]: apps/mcp tsc --noEmit has pre-existing errors from packages/db module resolution -- not blocking
- [v1.5]: Hetzner server: Ubuntu 24.04, 8 CPU, 30GB RAM, Docker+Compose ready, Tailscale on :443, no native PostgreSQL
- [v1.5]: User has domain ready to point, needs DNS A record setup
- [v1.5]: REQUIREMENTS.md says 55 but actually contains 62 requirements -- roadmap maps all 62
- [25-09]: RLS blocks ALL queries until app code wraps queries in withTenant() -- E2E tests fail at auth.setup
- [25-09]: drizzle-kit push with `entities: { roles: true }` requires CREATEROLE permission -- workaround documented

## Session Continuity

Last session: 2026-02-07T17:05:00Z
Stopped at: Completed 25-09-PLAN.md -- Phase 25 complete
Resume file: None
