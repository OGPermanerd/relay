---
phase: 25-multi-tenancy-schema-audit
plan: 01
subsystem: database
tags: [drizzle, postgres, multi-tenancy, audit, soc2, schema]

# Dependency graph
requires:
  - phase: none
    provides: greenfield schema files
provides:
  - tenants table definition (id, name, slug, domain, logo, isActive, plan, timestamps)
  - audit_logs table definition (id, actorId, tenantId, action, resourceType, resourceId, ipAddress, metadata, createdAt)
  - Tenant, NewTenant, AuditLog, NewAuditLog type exports
affects: [25-03-schema-index-update, 25-04-migrations, 25-05-audit-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "uuid primary key for high-volume append-only tables (audit_logs)"
    - "withTimezone: true on audit log timestamps for compliance"
    - "jsonb metadata column for flexible audit context"

key-files:
  created:
    - packages/db/src/schema/tenants.ts
    - packages/db/src/schema/audit-logs.ts
  modified: []

key-decisions:
  - "Used uuid PK for audit_logs (high-volume, append-only) vs text PK for tenants (consistent with existing pattern)"
  - "audit_logs.createdAt uses withTimezone: true for SOC2 compliance accuracy"
  - "Nullable tenantId on audit_logs to support cross-tenant/system events"

patterns-established:
  - "Tenant schema pattern: text PK, slug unique, domain for email matching, plan for billing tier"
  - "Audit log pattern: uuid PK, jsonb metadata, withTimezone timestamps"

# Metrics
duration: 1min
completed: 2026-02-07
---

# Phase 25 Plan 01: Tenants & Audit Logs Schema Summary

**Drizzle schema definitions for tenants (9 columns, text PK) and audit_logs (9 columns, uuid PK with jsonb metadata) tables**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-07T16:27:10Z
- **Completed:** 2026-02-07T16:28:33Z
- **Tasks:** 1
- **Files created:** 2

## Accomplishments
- Created tenants table with id, name, slug, domain, logo, isActive, plan, createdAt, updatedAt columns
- Created audit_logs table with id, actorId, tenantId, action, resourceType, resourceId, ipAddress, metadata, createdAt columns
- Exported Tenant, NewTenant, AuditLog, NewAuditLog types for downstream consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tenants and audit_logs schema files** - `ac86593` (feat)

## Files Created/Modified
- `packages/db/src/schema/tenants.ts` - Tenants table definition with 9 columns and type exports
- `packages/db/src/schema/audit-logs.ts` - Audit logs table definition with 9 columns and type exports

## Decisions Made
- Used `uuid` PK with `defaultRandom()` for audit_logs (high-volume append-only table, better for distributed inserts) vs `text` PK for tenants (consistent with existing schema pattern)
- `audit_logs.createdAt` uses `{ withTimezone: true }` for SOC2 compliance (exact time zone tracking)
- Both `actorId` and `tenantId` on audit_logs are nullable to support system-level and cross-tenant events

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema files ready for Plan 03 (schema index update + tenant_id column additions)
- Schema files ready for Plan 04 (migration generation and execution)
- Note: Files are NOT yet exported from `packages/db/src/schema/index.ts` per plan instructions (Plan 03 handles this)

## Self-Check: PASSED

---
*Phase: 25-multi-tenancy-schema-audit*
*Completed: 2026-02-07*
