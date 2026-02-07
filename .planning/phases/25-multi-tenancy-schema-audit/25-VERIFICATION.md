---
phase: 25-multi-tenancy-schema-audit
verified: 2026-02-07T17:30:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "PostgreSQL RLS policies are active on all tenant-scoped tables, preventing cross-tenant reads/writes at the database level"
    status: partial
    reason: "RLS is enabled and policies exist, but application queries are NOT using withTenant() wrapper - RLS blocks all queries because app.current_tenant_id is never set"
    artifacts:
      - path: "packages/db/src/tenant-context.ts"
        issue: "withTenant() helper exists but is NEVER used in application code (only imported, never called)"
      - path: "apps/web/app/actions/*.ts"
        issue: "All action files use hardcoded DEFAULT_TENANT_ID for inserts but don't wrap queries in withTenant()"
    missing:
      - "Wrap all database queries in withTenant() to set app.current_tenant_id session variable"
      - "Update all server actions, API routes, and services to use withTenant()"
      - "Integrate withTenant() into Auth.js callbacks and middleware for session-based tenant resolution"
  - truth: "An append-only audit_logs table records all security events (auth, admin actions, data modifications)"
    status: failed
    reason: "audit_logs table exists with append-only protection, but writeAuditLog() is NEVER called in application code"
    artifacts:
      - path: "packages/db/src/services/audit.ts"
        issue: "writeAuditLog() and writeAuditLogs() functions exist but are NOT used anywhere in apps/"
    missing:
      - "Add writeAuditLog() calls for auth events (login, logout, failed auth)"
      - "Add writeAuditLog() calls for admin actions (skill delete, merge, user management)"
      - "Add writeAuditLog() calls for data modifications (skill create, update, delete)"
      - "Add writeAuditLog() for cross-tenant access attempts (RLS violations)"
---

# Phase 25: Multi-Tenancy Schema & Audit Foundation Verification Report

**Phase Goal:** Every database query is tenant-isolated, with an append-only audit trail capturing all security events
**Verified:** 2026-02-07T17:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `tenants` table exists with id, name, slug, domain, logo, isActive, and plan columns | ✓ VERIFIED | Table exists with all 9 required columns (id, name, slug, domain, logo, is_active, plan, created_at, updated_at). Default tenant seeded. |
| 2 | Every data table has a NOT NULL tenant_id column with foreign key to tenants | ✓ VERIFIED | All 9 tables (skills, usage_events, ratings, skill_versions, skill_embeddings, skill_reviews, api_keys, site_settings, users) have tenant_id NOT NULL with FK to tenants.id |
| 3 | Skills table has a composite unique constraint on (tenant_id, slug) | ✓ VERIFIED | Unique index `skills_tenant_slug_unique` exists on (tenant_id, slug) |
| 4 | PostgreSQL RLS policies are active on all tenant-scoped tables, preventing cross-tenant reads/writes at the database level | ⚠️ PARTIAL | RLS enabled (FORCE RLS = true) on all 9 tables with RESTRICTIVE policies. BUT: withTenant() wrapper is NEVER used in application code, so app.current_tenant_id is never set, blocking ALL queries. Infrastructure exists but is NOT wired to application. |
| 5 | An append-only audit_logs table records all security events | ✗ FAILED | audit_logs table exists with append-only trigger protection (UPDATE/DELETE blocked). BUT: writeAuditLog() is NEVER called in application code - no events are being logged. |

**Score:** 3/5 truths verified (2 partial/failed due to missing application integration)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/tenants.ts` | Tenants table schema with 9 columns | ✓ VERIFIED | 26 lines, exports Tenant/NewTenant types, has all required fields |
| `packages/db/src/schema/audit-logs.ts` | Audit logs table schema | ✓ VERIFIED | 24 lines, exports AuditLog/NewAuditLog types, uuid PK, jsonb metadata, withTimezone |
| `packages/db/src/schema/skills.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, uniqueIndex on (tenantId, slug), pgPolicy tenant_isolation |
| `packages/db/src/schema/users.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with .default() for Auth.js, FK to tenants, pgPolicy |
| `packages/db/src/schema/ratings.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, pgPolicy tenant_isolation |
| `packages/db/src/schema/usage-events.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, pgPolicy tenant_isolation |
| `packages/db/src/schema/skill-versions.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, pgPolicy tenant_isolation |
| `packages/db/src/schema/skill-embeddings.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, uniqueIndex on (tenantId, skillId), pgPolicy |
| `packages/db/src/schema/skill-reviews.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, uniqueIndex on (tenantId, skillId), pgPolicy |
| `packages/db/src/schema/api-keys.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, pgPolicy tenant_isolation |
| `packages/db/src/schema/site-settings.ts` | tenant_id column + pgPolicy | ✓ VERIFIED | tenantId NOT NULL with FK, uniqueIndex on tenantId, pgPolicy |
| `packages/db/src/tenant-context.ts` | withTenant() helper function | ⚠️ ORPHANED | 27 lines, exports withTenant(), uses transaction + set_config(). BUT: Imported but NEVER called in application code. |
| `packages/db/src/services/audit.ts` | writeAuditLog() functions | ⚠️ ORPHANED | 39 lines, exports writeAuditLog/writeAuditLogs. BUT: NEVER called in application code. |
| Database: tenants table | Actual table in PostgreSQL | ✓ VERIFIED | Table exists with 1 row (default tenant), all columns match schema |
| Database: audit_logs table | Actual table in PostgreSQL | ✓ VERIFIED | Table exists with append-only trigger, indexes on (tenant_id, created_at), (actor_id, created_at), (action, created_at) |
| Database: RLS policies | FORCE RLS + RESTRICTIVE policies on 9 tables | ✓ VERIFIED | All 9 tables have rowsecurity=true, force_rls=true, tenant_isolation RESTRICTIVE policy with USING/WITH CHECK clauses |
| Database: Foreign keys | tenant_id → tenants.id on 9 tables | ✓ VERIFIED | All 9 tables have FK constraints verified via pg_constraint |
| Database: Composite unique | skills(tenant_id, slug) | ✓ VERIFIED | skills_tenant_slug_unique index exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Application queries | withTenant() wrapper | Import + call | ✗ NOT_WIRED | withTenant exported from packages/db and imported nowhere in apps/. All action files and API routes execute direct db queries without tenant context. |
| withTenant() | RLS policies | set_config('app.current_tenant_id') | ⚠️ ORPHANED | withTenant() correctly sets app.current_tenant_id via set_config(), and RLS policies correctly check current_setting('app.current_tenant_id'). BUT: withTenant() is never called, so RLS blocks all queries. |
| Auth events | writeAuditLog() | Function call | ✗ NOT_WIRED | No calls to writeAuditLog() in Auth.js callbacks or any API routes |
| Admin actions | writeAuditLog() | Function call | ✗ NOT_WIRED | No calls to writeAuditLog() in skill delete, merge, or admin actions |
| Data modifications | writeAuditLog() | Function call | ✗ NOT_WIRED | No calls to writeAuditLog() in create/update/delete actions |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| TENANT-01: Tenants table | ✓ SATISFIED | None |
| TENANT-02: tenant_id on all tables | ✓ SATISFIED | None |
| TENANT-03: Composite unique constraints | ✓ SATISFIED | None |
| TENANT-04: PostgreSQL RLS policies | ⚠️ PARTIAL | RLS infrastructure exists but withTenant() not used in application |
| TENANT-05: Tenant-scoped query helper | ⚠️ PARTIAL | withTenant() exists but is orphaned (never called) |
| SOC2-01: Append-only audit_logs table | ✓ SATISFIED | None (table structure is correct) |
| SOC2-02: Audit logging on security events | ✗ BLOCKED | writeAuditLog() exists but is never called |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/web/app/actions/*.ts | Multiple | Direct db queries without withTenant() | 🛑 Blocker | All queries return 0 rows due to RLS blocking without tenant context |
| apps/web/app/api/*/route.ts | Multiple | Direct db queries without withTenant() | 🛑 Blocker | API routes fail to fetch data due to RLS |
| packages/db/src/tenant-context.ts | N/A | Exported but never imported/used | ⚠️ Warning | Dead code - infrastructure ready but not integrated |
| packages/db/src/services/audit.ts | N/A | Exported but never called | ⚠️ Warning | Dead code - no audit events being logged |
| apps/web/app/actions/skills.ts | 5 | const DEFAULT_TENANT_ID = "default-tenant..." | ℹ️ Info | Hardcoded tenant ID with TODO comment (acceptable for single-tenant phase) |

### Human Verification Required

#### 1. Test RLS with Real User Session

**Test:** 
1. Log in via Auth.js (Google SSO or dev login)
2. Try to create a skill via the UI
3. Try to view the skills list page

**Expected:** 
- Skill creation should work IF the session middleware/callback uses withTenant()
- Skills list should display existing skills IF the data fetching uses withTenant()
- Currently EXPECTED TO FAIL because withTenant() is not wired to the application

**Why human:** 
RLS behavior in production requires end-to-end testing with real auth sessions. Cannot verify programmatically without running the app and inspecting query results.

#### 2. Verify Audit Log Trigger Protection

**Test:**
1. Connect to database as superuser
2. Try to UPDATE an existing audit_logs row
3. Try to DELETE an audit_logs row

**Expected:**
Both operations should fail with "Direct modification of audit_logs is forbidden" error

**Why human:**
Already verified programmatically (UPDATE/DELETE both fail), but human verification ensures the error message is clear and the protection is absolute even for superusers.

### Gaps Summary

**Critical Gap 1: withTenant() Not Used in Application Code**

The RLS infrastructure is complete and correct at the database level:
- All 9 tables have FORCE RLS enabled
- RESTRICTIVE policies check app.current_tenant_id
- withTenant() helper correctly sets app.current_tenant_id via set_config()

BUT: withTenant() is never called anywhere in the application. This means:
- All database queries execute without tenant context
- RLS policies block ALL queries (return 0 rows)
- The application is currently NON-FUNCTIONAL for data access

Missing integration points:
- Server actions (apps/web/app/actions/*.ts) - 5 files
- API routes (apps/web/app/api/*/route.ts) - 3 files
- Services (packages/db/src/services/*.ts) - 8 files
- Auth.js callbacks (apps/web/auth.ts) - session/signIn callbacks need withTenant()

**Critical Gap 2: Audit Logging Not Implemented**

The audit_logs table and writeAuditLog() function exist and are correct:
- append-only protection works (UPDATE/DELETE blocked)
- Indexes on tenant_id, actor_id, action, created_at
- writeAuditLog() is fire-and-forget safe (try/catch)

BUT: writeAuditLog() is never called. No events are being logged.

Missing audit events:
- Auth events: login, logout, failed auth attempts
- Admin actions: skill delete, skill merge, user management
- Data modifications: skill create, update, delete, rating create
- Security events: cross-tenant access attempts, RLS violations

**Infrastructure vs Integration:**

The phase delivered 100% of the DATABASE INFRASTRUCTURE:
- Schema files with tenant_id columns ✓
- Database tables created with RLS ✓
- Helper functions and services ✓

But 0% of the APPLICATION INTEGRATION:
- No queries use withTenant() ✗
- No events call writeAuditLog() ✗

This is a classic "task completion vs goal achievement" gap. All tasks in the 9 plans were completed (schema files created, migrations run, functions exported), but the GOAL "Every database query is tenant-isolated, with an append-only audit trail capturing all security events" is NOT achieved because the infrastructure is not wired to the application.

---

_Verified: 2026-02-07T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
