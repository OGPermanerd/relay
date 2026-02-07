# SOC2 Compliance Research for Relay Multi-Tenant SaaS

**Domain:** SOC2 Trust Service Criteria for multi-tenant skill marketplace
**Researched:** 2026-02-07
**Overall confidence:** MEDIUM-HIGH (well-established compliance framework; implementation specifics verified against current docs)

---

## Executive Summary

SOC2 compliance for a multi-tenant SaaS requires controls across five Trust Service Criteria: Security (mandatory), Availability, Processing Integrity, Confidentiality, and Privacy. For Relay's architecture -- Next.js 16.1.6, PostgreSQL 16, Drizzle ORM, Auth.js v5, Docker Compose on Hetzner -- the most impactful requirements are tenant data isolation, comprehensive audit logging, encryption at rest and in transit, session management with timeouts, and change management controls.

The current codebase has significant gaps: no tenant_id on any table, no audit logging, no encryption at rest, 30-day default JWT session lifetime, and no formal access control roles beyond "authenticated user." However, many of these are straightforward to address during the multi-tenancy buildout. The critical architectural decision -- row-level isolation via tenant_id columns with PostgreSQL RLS versus schema-per-tenant -- is resolved below in favor of **row-level security with database-enforced RLS policies**, which meets SOC2 requirements when combined with proper application-layer controls and testing.

This document provides prescriptive recommendations for each SOC2 control area, mapped to specific implementation tasks for Relay's v1.5 milestone.

---

## Table of Contents

1. [Trust Service Criteria Analysis](#1-trust-service-criteria-analysis)
2. [Tenant Isolation Strategy](#2-tenant-isolation-strategy)
3. [Audit Logging Requirements](#3-audit-logging-requirements)
4. [Encryption Requirements](#4-encryption-requirements)
5. [Authentication and Session Management](#5-authentication-and-session-management)
6. [API Key Management](#6-api-key-management)
7. [Hook Callback Security](#7-hook-callback-security)
8. [Data Retention and Tenant Offboarding](#8-data-retention-and-tenant-offboarding)
9. [Backup and Disaster Recovery](#9-backup-and-disaster-recovery)
10. [Monitoring and Alerting](#10-monitoring-and-alerting)
11. [Change Management](#11-change-management)
12. [Vulnerability Management](#12-vulnerability-management)
13. [Incident Response](#13-incident-response)
14. [Access Control and RBAC](#14-access-control-and-rbac)
15. [Implementation Priority Matrix](#15-implementation-priority-matrix)
16. [What an Auditor Would Look For](#16-what-an-auditor-would-look-for)
17. [Common SOC2 Failures in Multi-Tenant SaaS](#17-common-soc2-failures-in-multi-tenant-saas)

---

## 1. Trust Service Criteria Analysis

SOC2 evaluates five Trust Service Criteria (TSC). Security is mandatory; the others are selected based on customer expectations. **For Relay, all five are relevant** given that tenants process employee usage data and skill content constitutes organizational intellectual property.

### 1.1 Security (CC Series -- MANDATORY)

**What it covers:** Protection against unauthorized access (both physical and logical).

**Relay-specific controls needed:**

| Control | Current State | Gap | Priority |
|---------|--------------|-----|----------|
| Logical access controls | Google SSO only, single domain | Need per-tenant RBAC (admin/member) | CRITICAL |
| Network security | No firewall config, Docker exposed | Caddy reverse proxy + firewall rules | CRITICAL |
| Encryption in transit | HTTP in dev, no TLS | TLS everywhere via Caddy + Let's Encrypt | CRITICAL |
| Encryption at rest | None | LUKS volume encryption on Hetzner | HIGH |
| Tenant isolation | No tenant_id anywhere | RLS + application-layer tenant scoping | CRITICAL |
| Audit logging | None | Append-only audit_logs table | CRITICAL |
| Change management | Git, no branch protection | PR reviews, deployment approvals | HIGH |
| Vulnerability scanning | None | Docker image scanning, dependency audit | MEDIUM |

### 1.2 Availability (A Series)

**What it covers:** System uptime, disaster recovery, backup/restore.

| Control | Current State | Gap | Priority |
|---------|--------------|-----|----------|
| Uptime monitoring | None | Health checks + alerting | HIGH |
| Backup strategy | Docker volume only | Automated pg_dump + off-site backup | CRITICAL |
| Disaster recovery plan | None | Documented DR runbook | HIGH |
| RPO/RTO targets | Undefined | Define and test | HIGH |

### 1.3 Processing Integrity (PI Series)

**What it covers:** System processing is complete, accurate, timely, and authorized.

| Control | Current State | Gap | Priority |
|---------|--------------|-----|----------|
| Usage tracking accuracy | Hook-based callbacks planned | Validation and reconciliation of hook data | HIGH |
| Data consistency | Denormalized counters | Periodic reconciliation jobs | MEDIUM |
| Input validation | Basic form validation | Server-side validation on all inputs | MEDIUM |

### 1.4 Confidentiality (C Series)

**What it covers:** Data designated as confidential is protected.

| Control | Current State | Gap | Priority |
|---------|--------------|-----|----------|
| Cross-tenant data leakage | No tenant boundaries | RLS + application checks | CRITICAL |
| Skill content protection | All skills visible to all users | Tenant-scoped skill visibility | CRITICAL |
| API key secrecy | SHA-256 hashed, prefix shown | Good -- maintain this pattern | OK |
| Data classification | None | Classify data types by sensitivity | MEDIUM |

### 1.5 Privacy (P Series)

**What it covers:** Personal information collection, use, retention, and disposal.

| Control | Current State | Gap | Priority |
|---------|--------------|-----|----------|
| Employee consent | No consent mechanisms | Privacy notice + consent for usage tracking | HIGH |
| Data minimization | usage_events has metadata JSONB | Document what is collected and why | MEDIUM |
| Right to deletion | No deletion mechanism | Tenant/user data purge capability | HIGH |
| Privacy notice | None | In-app privacy policy per tenant | MEDIUM |

**Confidence: HIGH** -- TSC framework is well-documented by AICPA, and the gap analysis is based on direct code inspection.

---

## 2. Tenant Isolation Strategy

### Recommendation: Row-Level Security (RLS) with Database-Enforced Policies

**Use row-level tenant_id isolation with PostgreSQL RLS. Do NOT use schema-per-tenant or DB-per-tenant.**

#### Why RLS Over Schema/DB Isolation

| Factor | Row-Level (RLS) | Schema-Per-Tenant | DB-Per-Tenant |
|--------|-----------------|-------------------|---------------|
| SOC2 compliant | YES (with RLS policies) | YES | YES |
| Migration complexity | LOW (add column) | HIGH (duplicate schema) | VERY HIGH |
| Drizzle ORM support | YES (native RLS) | Poor (schema switching) | Poor (connection switching) |
| Operational cost | LOW (single DB) | MEDIUM (N schemas) | HIGH (N databases) |
| Backup/restore | Single backup | Per-schema possible | Per-DB |
| Query performance | Good (indexed tenant_id) | Good | Good |
| Risk of cross-tenant leak | Medium (RLS mitigates) | Low | Very low |
| Tenant count scalability | Excellent (1000+ tenants) | Good (100s) | Poor (10s) |

**The decisive factors for Relay:**

1. **Drizzle ORM has native RLS support** as of current versions. Policies are defined declaratively alongside schema definitions. This eliminates the "hoping WHERE clauses are correct" concern.
2. **Schema-per-tenant breaks Drizzle migrations** -- you would need to run migrations N times across N schemas, and Drizzle's migration tooling does not natively support this.
3. **Relay targets 500+ users in year one across multiple tenants** -- DB-per-tenant is operationally expensive at this scale on a single Hetzner server.
4. **SOC2 auditors accept RLS** when you can demonstrate: (a) database-enforced policies exist, (b) application never bypasses RLS, (c) penetration testing confirms isolation, (d) audit logs capture cross-tenant access attempts.

#### Implementation Architecture

```
Application Layer (Next.js)
  |
  v
Middleware: Extract tenant from subdomain -> set tenant context
  |
  v
Server Actions / API Routes: All queries go through tenant-scoped service layer
  |
  v
Drizzle ORM: RLS policies on every tenant-scoped table
  |
  v
PostgreSQL: RLS enforced at database level via session variable
```

#### Drizzle RLS Implementation Pattern

```typescript
// Schema definition with RLS
import { pgTable, text, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const skills = pgTable('skills', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  // ... other columns
}, (table) => [
  pgPolicy('tenant_isolation_policy', {
    as: 'restrictive',
    for: 'all',
    using: sql`tenant_id = current_setting('app.tenant_id', true)`,
    withCheck: sql`tenant_id = current_setting('app.tenant_id', true)`,
  }),
]);
```

```typescript
// Setting tenant context per request
async function withTenantContext<T>(
  tenantId: string,
  operation: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    );
    return operation(tx);
  });
}
```

#### Tables Requiring tenant_id

Every table that stores tenant-specific data needs a `tenant_id` column:

| Table | Needs tenant_id | Notes |
|-------|----------------|-------|
| users | YES | User belongs to a tenant |
| skills | YES | Skills are tenant-scoped |
| skill_versions | YES | Inherited from skill |
| skill_embeddings | YES | Inherited from skill |
| skill_reviews | YES | Inherited from skill |
| ratings | YES | Inherited from skill |
| usage_events | YES | Usage is per-tenant |
| api_keys | YES | Keys are per-tenant |
| site_settings | YES | Settings are per-tenant |
| accounts | NO | Auth.js managed, user-level |
| sessions | NO | Auth.js managed, user-level |
| verification_tokens | NO | Auth.js managed, system-level |

#### New Table Required: tenants

```typescript
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // subdomain
  domain: text('domain').notNull().unique(), // Google SSO domain
  plan: text('plan').notNull().default('standard'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

**Confidence: HIGH** -- Drizzle RLS documentation verified via official docs. PostgreSQL RLS is well-established. AWS and multiple SOC2 compliance sources confirm RLS is acceptable for SOC2.

---

## 3. Audit Logging Requirements

### What Must Be Logged

SOC2 requires a complete, immutable record of security-relevant events. For Relay, this means:

#### Critical Events (MUST log)

| Event Category | Specific Events | Fields Required |
|----------------|-----------------|-----------------|
| Authentication | Login success, login failure, logout | userId, tenantId, ip, userAgent, timestamp, method |
| Authorization | Permission denied, role change | userId, tenantId, resource, action, reason |
| Data Access | Cross-tenant access attempt (blocked) | userId, tenantId, targetTenantId, resource |
| Data Modification | Skill create/update/delete | userId, tenantId, resourceType, resourceId, action, before, after |
| API Key Events | Key created, revoked, expired, used | userId, tenantId, keyId (NOT keyHash), action |
| Admin Actions | User added/removed, settings changed | actorId, tenantId, action, target, before, after |
| System Events | Backup completed, migration run | systemActor, action, result |

#### Important Events (SHOULD log)

| Event Category | Specific Events |
|----------------|-----------------|
| Skill Deployment | Skill installed via MCP, hook registered |
| Usage Tracking | Hook callback received, usage event recorded |
| Search Activity | Search queries (for audit trail, not analytics) |
| Session Events | Session created, expired, refreshed |

### Audit Log Schema

```typescript
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Who
  actorId: text('actor_id'),          // userId or 'system'
  actorType: text('actor_type').notNull(), // 'user', 'api_key', 'system', 'hook'
  tenantId: text('tenant_id'),        // Tenant context

  // What
  action: text('action').notNull(),    // 'auth.login', 'skill.create', 'admin.user.remove'
  resourceType: text('resource_type'), // 'skill', 'user', 'api_key', 'setting'
  resourceId: text('resource_id'),     // ID of affected resource

  // Context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'),       // Correlation ID for request tracing

  // Details
  metadata: jsonb('metadata'),         // Action-specific details
  previousState: jsonb('previous_state'), // Before state for modifications
  newState: jsonb('new_state'),        // After state for modifications

  // Result
  outcome: text('outcome').notNull(),  // 'success', 'failure', 'denied'
  errorMessage: text('error_message'), // If outcome is failure/denied

  // Timestamp
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Immutability Requirements

**The audit_logs table MUST be append-only:**

1. **No UPDATE or DELETE** on audit_logs -- enforce via PostgreSQL REVOKE:
   ```sql
   REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
   GRANT INSERT, SELECT ON audit_logs TO app_user;
   ```

2. **No RLS on audit_logs** -- audit logs should NOT be filtered by tenant_id in the database. The application layer controls access (admins see their tenant's logs), but the database preserves all logs globally for forensic analysis.

3. **Retention policy**: Keep audit logs for minimum 12 months (SOC2 Type II audit window is typically 3-12 months). Archive to cold storage after 12 months.

4. **Tamper detection** (recommended but not required for initial SOC2): Hash chain where each log entry includes SHA-256 of previous entry.

### Implementation Pattern

```typescript
// Centralized audit logging service
async function auditLog(event: {
  actorId: string | null;
  actorType: 'user' | 'api_key' | 'system' | 'hook';
  tenantId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'denied';
  errorMessage?: string;
}): Promise<void> {
  // Fire-and-forget with error logging, never block the request
  db.insert(auditLogs).values(event)
    .catch(err => console.error('AUDIT LOG FAILURE:', err));
}
```

**Confidence: HIGH** -- Audit logging requirements are the most consistently documented SOC2 requirement across all sources. The schema design follows industry patterns.

---

## 4. Encryption Requirements

### 4.1 Encryption in Transit (MANDATORY)

**Requirement:** All data in motion must be encrypted with TLS 1.2 or higher.

| Connection | Current State | Required State |
|-----------|--------------|----------------|
| Browser to App | HTTP (dev) | TLS 1.3 via Caddy auto-HTTPS |
| App to PostgreSQL | Unencrypted localhost | TLS if DB is remote; localhost is acceptable |
| Hook callbacks (user machines to server) | Not implemented | HTTPS mandatory, reject HTTP |
| MCP connections (stdio) | Local pipe | N/A (local) |
| MCP connections (Streamable HTTP) | HTTP (dev) | TLS via Caddy |
| Backup transfers | N/A | Encrypted transfer to off-site |

**Implementation:**
- Caddy reverse proxy handles TLS termination with automatic Let's Encrypt certificates
- Force HSTS headers: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Hook callback endpoint must reject non-HTTPS connections
- Configure `NEXTAUTH_URL` with HTTPS scheme

### 4.2 Encryption at Rest (REQUIRED)

**Requirement:** Stored data must be encrypted when at rest on disk.

SOC2 does not prescribe a specific encryption method, but you must document your approach and demonstrate it works.

**Recommended approach for Hetzner Docker deployment: LUKS full-disk encryption.**

| Approach | Complexity | Performance Impact | SOC2 Sufficient |
|----------|-----------|-------------------|----------------|
| LUKS volume encryption | MEDIUM | 2-5% | YES |
| pgcrypto column-level | HIGH | 10-30% per query | YES (overkill) |
| Percona pg_tde | HIGH (experimental) | 5-10% | YES |
| Application-level encryption | HIGH | Varies | YES |

**Why LUKS:** It encrypts the entire disk/partition transparently. PostgreSQL data files, WAL logs, temp files, and Docker volumes are all encrypted without application changes. This is the standard approach for SOC2 on bare metal / VPS.

**Implementation:**
```bash
# On Hetzner Ubuntu 24.04 during server provisioning:
# 1. Create encrypted partition for Docker volumes
cryptsetup luksFormat /dev/sdb
cryptsetup luksOpen /dev/sdb encrypted_data
mkfs.ext4 /dev/mapper/encrypted_data
mount /dev/mapper/encrypted_data /var/lib/docker/volumes

# 2. Configure auto-unlock with a key file (stored securely)
# Or use Hetzner's built-in encryption if available
```

**Column-level encryption (pgcrypto) for sensitive fields:**

In addition to LUKS, use pgcrypto for specific high-sensitivity columns:
- OAuth tokens in `accounts` table (access_token, refresh_token, id_token)
- These are already stored by Auth.js and contain bearer credentials

This is a defense-in-depth measure. LUKS alone satisfies SOC2, but encrypting bearer tokens at the column level provides additional protection against SQL injection or database dump scenarios.

### 4.3 Key Management

| Requirement | Implementation |
|-------------|---------------|
| Key generation | Use `openssl rand` or system CSPRNG |
| Key storage | LUKS key in hardware (Hetzner Rescue) or env-injected secret |
| Key rotation | LUKS allows adding new keys without re-encrypting |
| Emergency revocation | LUKS header backup + destroy procedure |
| Documentation | Document key custodians and rotation schedule |

**Confidence: HIGH** -- PostgreSQL encryption options are well-documented. LUKS is the standard Linux approach. SOC2 encryption requirements are confirmed across multiple sources.

---

## 5. Authentication and Session Management

### Current State Assessment

| Aspect | Current Implementation | SOC2 Gap |
|--------|----------------------|----------|
| Authentication method | Google Workspace SSO (OAuth) | Acceptable -- SSO is preferred |
| Domain restriction | `AUTH_ALLOWED_DOMAIN` env var | Need per-tenant domain mapping |
| Session strategy | JWT (Edge-compatible) | Need timeout configuration |
| Session lifetime | Auth.js default: 30 days | Too long -- reduce to 8-24 hours |
| Idle timeout | None | Need 15-30 minute idle timeout |
| MFA | Delegated to Google | Acceptable if Google enforces |
| Re-authentication | None for sensitive actions | Need for admin operations |

### Required Changes

#### 5.1 Session Timeout (CRITICAL)

Auth.js JWT session must be configured with SOC2-appropriate lifetimes:

```typescript
// auth.ts
session: {
  strategy: "jwt",
  maxAge: 8 * 60 * 60, // 8 hours absolute maximum (was 30 days)
},
jwt: {
  maxAge: 8 * 60 * 60, // 8 hours
},
```

**Why 8 hours:** Matches a workday. Employees re-authenticate daily. This balances usability with security. OWASP recommends 15-30 minutes for high-risk, but skill marketplace is moderate risk. 8 hours with idle detection is appropriate.

#### 5.2 Idle Session Timeout (HIGH)

Implement client-side idle detection that triggers re-authentication after 30 minutes of inactivity:

```typescript
// Client-side idle detection hook
// After 30 minutes of no mouse/keyboard activity -> signOut()
```

#### 5.3 Per-Tenant Domain Mapping

Replace single `AUTH_ALLOWED_DOMAIN` with tenant-domain lookup:

```typescript
async signIn({ account, profile }) {
  if (account?.provider === "google") {
    const emailDomain = profile?.email?.split('@')[1];
    const tenant = await findTenantByDomain(emailDomain);
    if (!tenant || !tenant.isActive) return false;
    if (!profile?.email_verified) return false;
    return true;
  }
  return false;
},
```

#### 5.4 Tenant Context in JWT

Add tenant_id to JWT token so every request carries tenant context:

```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.tenantId = user.tenantId; // Added
  }
  return token;
},
```

#### 5.5 MFA Considerations

Google Workspace SSO delegates MFA to the identity provider. This is acceptable for SOC2 **if the tenant's Google Workspace enforces MFA**. Document this as a shared responsibility:

- Relay's responsibility: Enforce Google SSO, no password-based login
- Tenant's responsibility: Enable MFA in Google Workspace admin

**Confidence: HIGH** -- Auth.js configuration verified via official docs and search results. Session timeout recommendations align with OWASP and SOC2 guidance.

---

## 6. API Key Management

### Current State Assessment

The existing API key implementation is already well-designed for security:

| Aspect | Current State | SOC2 Assessment |
|--------|--------------|-----------------|
| Storage | SHA-256 hashed | GOOD -- raw key never stored |
| Prefix | `rlk_` prefix for identification | GOOD |
| Comparison | Timing-safe | GOOD -- prevents timing attacks |
| Revocation | `revokedAt` timestamp | GOOD |
| Expiration | `expiresAt` support | GOOD -- but no default expiry |
| Key display | Shown once at creation | GOOD |
| Last used tracking | `lastUsedAt` updated | GOOD |

### Required Enhancements

| Enhancement | Priority | Rationale |
|-------------|----------|-----------|
| Default expiration (90 days) | CRITICAL | SOC2 requires rotation policy |
| tenant_id on api_keys | CRITICAL | Tenant-scoped keys |
| Key creation audit log | CRITICAL | Track who created what key |
| Rotation reminder | HIGH | Notify before expiration |
| Max keys per user | MEDIUM | Prevent key sprawl |
| Rate limiting per key | HIGH | Prevent abuse |

#### Mandatory Key Rotation Policy

SOC2 requires documented key rotation. Implement:

1. **Default expiration:** All new keys expire after 90 days
2. **Maximum lifetime:** No key can exist longer than 365 days
3. **Rotation notification:** Email/UI warning at 14 days before expiry
4. **Emergency revocation:** Admin can revoke any key in their tenant instantly
5. **Documentation:** Key rotation policy in security documentation

#### Key Scoping to Tenant

```typescript
// api_keys table addition
tenantId: text('tenant_id').notNull().references(() => tenants.id),
```

API key validation must verify the key belongs to the expected tenant:

```typescript
async function validateApiKey(rawKey: string, expectedTenantId: string) {
  const result = await /* existing validation */;
  if (result && result.tenantId !== expectedTenantId) {
    await auditLog({
      action: 'api_key.cross_tenant_attempt',
      outcome: 'denied',
      metadata: { keyTenantId: result.tenantId, requestTenantId: expectedTenantId }
    });
    return null;
  }
  return result;
}
```

**Confidence: HIGH** -- Current implementation is strong. Enhancements are straightforward.

---

## 7. Hook Callback Security

### Context

Relay v1.5 introduces Claude Code hooks that fire HTTP callbacks from user machines to the Relay server for usage tracking. This is a network-transmitted data flow that SOC2 scrutinizes.

### Security Requirements

| Requirement | Implementation | Priority |
|-------------|---------------|----------|
| TLS for all callbacks | HTTPS-only endpoint, reject HTTP | CRITICAL |
| Authentication | API key in callback header | CRITICAL |
| Payload signing | HMAC-SHA256 signature on payload | HIGH |
| Data minimization | Only send event type + skill ID + timestamp | HIGH |
| Rate limiting | Per-key rate limit (e.g., 100/min) | HIGH |
| Input validation | Strict schema validation on callback payload | HIGH |
| IP allowlisting | Optional per-tenant allowlist | MEDIUM |

### Hook Callback Authentication Pattern

```typescript
// Hook sends:
POST /api/hooks/usage HTTP/1.1
Host: tenant1.relay.example.com
Authorization: Bearer rlk_xxxx
X-Hook-Signature: sha256=<HMAC of body with shared secret>
Content-Type: application/json

{
  "event": "tool_use",
  "skillId": "abc-123",
  "timestamp": "2026-02-07T10:30:00Z"
}
```

```typescript
// Server validates:
// 1. TLS (handled by Caddy)
// 2. API key valid for this tenant
// 3. HMAC signature matches
// 4. Payload schema valid
// 5. Timestamp within acceptable window (prevent replay)
// 6. Rate limit not exceeded
```

### Data Minimization

Hook callbacks should transmit the **minimum necessary data**:

| Include | Exclude |
|---------|---------|
| Event type (tool_use, install) | Skill content |
| Skill ID | User prompts |
| Timestamp | AI responses |
| API key (for auth) | File paths |
| Tool name | Environment variables |

**SOC2 Privacy criteria (P Series) specifically requires data minimization.** Document exactly what the hook transmits and why each field is necessary.

### Replay Attack Prevention

Include a timestamp in the signed payload and reject callbacks older than 5 minutes:

```typescript
const callbackAge = Date.now() - new Date(payload.timestamp).getTime();
if (callbackAge > 5 * 60 * 1000) {
  return NextResponse.json({ error: 'Expired callback' }, { status: 400 });
}
```

**Confidence: HIGH** -- Webhook security patterns are well-established. HMAC signing + TLS + API key auth is standard.

---

## 8. Data Retention and Tenant Offboarding

### Data Retention Policy

SOC2 requires a documented data retention policy. Recommended retention periods for Relay:

| Data Type | Retention Period | Rationale |
|-----------|-----------------|-----------|
| Audit logs | 13 months minimum | SOC2 Type II audit window + buffer |
| Usage events | 24 months | Business analytics value |
| Skills and versions | Until tenant deletion | Business data |
| User accounts | Until user/tenant deletion | Active data |
| API keys (revoked) | 90 days after revocation | Forensic reference |
| Session data | 30 days | Short-lived, auto-expires |
| Backup data | 90 days | Rolling retention |

### Tenant Offboarding (CRITICAL)

When a tenant leaves Relay, all their data must be deleted. This is both a SOC2 Confidentiality and Privacy requirement.

**Required capability: Complete tenant data purge**

```typescript
async function offboardTenant(tenantId: string): Promise<void> {
  // 1. Deactivate tenant immediately
  await db.update(tenants).set({ isActive: false }).where(eq(tenants.id, tenantId));

  // 2. Revoke all API keys immediately
  await db.update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)));

  // 3. Schedule data deletion (30-day grace period)
  await scheduleDataDeletion(tenantId, 30);

  // 4. After grace period: CASCADE delete all tenant data
  // Delete order matters for foreign keys:
  //   usage_events -> skill_reviews -> ratings -> skill_embeddings
  //   -> skill_versions -> skills -> api_keys -> users -> tenant

  // 5. Log the deletion in audit_logs (audit logs are NOT deleted)
  await auditLog({
    action: 'tenant.offboard.complete',
    tenantId,
    actorType: 'system',
    outcome: 'success',
    metadata: { deletedAt: new Date().toISOString() }
  });

  // 6. Generate deletion certificate
  // Document what was deleted for compliance records
}
```

**Key principle:** Audit logs are NEVER deleted during offboarding. They are the forensic record that deletion occurred.

### User Data Deletion

Individual user deletion within a tenant must also be supported:

1. Anonymize or delete user's personal data (name, email, image)
2. Reassign or anonymize their skills (configurable per tenant policy)
3. Expire their API keys with grace period
4. Log the deletion in audit trail
5. Retain anonymized usage events for analytics

**Confidence: MEDIUM-HIGH** -- Data retention requirements are well-documented in SOC2 guidance. Implementation specifics are Relay-specific design decisions.

---

## 9. Backup and Disaster Recovery

### Backup Requirements

SOC2 Availability criteria requires:

1. **Regular automated backups** with documented schedule
2. **Tested restore capability** (quarterly restore tests minimum)
3. **Off-site backup storage** (not on the same server)
4. **Encrypted backups** (backups must also be encrypted)
5. **Documented RPO/RTO**

### Recommended Configuration for Hetzner

| Metric | Target | Rationale |
|--------|--------|-----------|
| RPO | 1 hour | Acceptable data loss window for skill marketplace |
| RTO | 4 hours | Maximum acceptable downtime |
| Backup frequency | Hourly incremental, daily full | Matches RPO |
| Retention | 90 days | Rolling retention |
| Off-site storage | Hetzner Storage Box or S3 | Different physical location |

### Implementation

```bash
# Automated backup script (cron: hourly)
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/relay_${TIMESTAMP}.sql.gz"

# Dump and compress
docker exec relay-postgres pg_dump -U postgres relay | gzip > "$BACKUP_FILE"

# Encrypt the backup
gpg --encrypt --recipient backup@company.com "$BACKUP_FILE"

# Upload to off-site storage
rclone copy "${BACKUP_FILE}.gpg" hetzner-storage:/relay-backups/

# Clean up local backups older than 7 days
find /backups -name "*.sql.gz.gpg" -mtime +7 -delete

# Log backup completion
echo "$(date): Backup complete: ${BACKUP_FILE}" >> /var/log/relay-backups.log
```

### Restore Testing

**Quarterly restore test procedure:**
1. Spin up test PostgreSQL container
2. Restore from most recent backup
3. Verify row counts match production
4. Verify tenant data isolation intact
5. Document results with timestamps
6. Store test results as SOC2 evidence

### 3-2-1 Backup Rule

- **3** copies of data: Production DB + local backup + off-site
- **2** different storage types: Docker volume + encrypted file
- **1** off-site: Hetzner Storage Box (different datacenter)

**Confidence: HIGH** -- Backup requirements are well-documented. Implementation is standard pg_dump + off-site pattern.

---

## 10. Monitoring and Alerting

### Required Monitoring

SOC2 requires real-time monitoring and alerting for security events.

| Monitor | Alert Condition | Response |
|---------|----------------|----------|
| Failed login attempts | > 5 failures in 10 minutes from same IP | Temporary IP block, investigate |
| Cross-tenant access attempts | Any occurrence | Immediate investigation |
| API key abuse | > 1000 requests/minute per key | Rate limit + alert |
| System availability | Health check fails 3 consecutive times | Page on-call |
| Backup failure | Any backup job fails | Alert + retry |
| Disk space | > 80% utilization | Alert for capacity planning |
| Certificate expiry | < 14 days until expiry | Alert (Caddy auto-renews) |
| Database connections | > 80% pool exhaustion | Alert |
| Error rate | > 5% of requests returning 5xx | Investigate |

### Implementation Stack

For a single-server Docker Compose deployment on Hetzner:

| Component | Recommendation | Why |
|-----------|---------------|-----|
| Health checks | Docker HEALTHCHECK + custom /api/health | Built-in |
| Log aggregation | Docker logging driver -> file + rotation | Simple, no external deps |
| Alerting | Simple cron-based checks + email/Slack webhook | Appropriate for scale |
| Uptime monitoring | External: UptimeRobot or BetterUptime (free tier) | External verification |

**A full SIEM (Splunk, ELK) is NOT required for initial SOC2.** What is required is: (1) centralized logs, (2) anomaly detection, (3) alerting, (4) evidence that you reviewed alerts. A simple cron job that queries audit_logs for anomalies and sends Slack alerts is sufficient for an early-stage SOC2 audit.

### Application Health Endpoint

```typescript
// /api/health (excluded from auth middleware)
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    diskSpace: await checkDiskSpace(),
    timestamp: new Date().toISOString(),
  };

  const healthy = Object.values(checks).every(c =>
    typeof c === 'string' || c === true
  );

  return NextResponse.json(checks, { status: healthy ? 200 : 503 });
}
```

**Confidence: MEDIUM** -- Monitoring requirements are clear, but the right level of tooling for a single-server deployment is a judgment call. Starting simple and scaling up is appropriate.

---

## 11. Change Management

### SOC2 CC8.1 Requirements

SOC2 requires documented change management for all production changes.

| Requirement | Implementation |
|-------------|---------------|
| Version control | Git (already in use) |
| Branch protection | Require PR reviews on main/master |
| Code review | At least one reviewer before merge |
| Separate environments | Dev/staging/production |
| Testing before deployment | Playwright + vitest + manual QA |
| Deployment approval | Documented approval before production deploy |
| Rollback capability | Docker image tags, database migrations reversible |
| Change logging | Git log + deployment log |
| Emergency change procedure | Document fast-track process with post-hoc review |

### Implementation for Relay

1. **Enable GitHub branch protection on master:**
   - Require PR reviews (1 reviewer minimum)
   - Require status checks to pass (tests)
   - No direct pushes to master

2. **Deployment pipeline:**
   ```
   Feature branch -> PR -> Review -> Merge -> CI tests -> Build Docker image -> Deploy
   ```

3. **Deployment log:** Maintain a `DEPLOYMENTS.md` or use Git tags:
   ```bash
   git tag -a v1.5.0 -m "v1.5: Multi-tenancy + SOC2 controls"
   ```

4. **Database migration tracking:** Drizzle already tracks migrations in `drizzle/` folder. Ensure migrations are reviewed as part of PRs.

**Confidence: HIGH** -- Change management requirements are well-documented and straightforward to implement with Git-based workflows.

---

## 12. Vulnerability Management

### Requirements

| Requirement | Implementation | Frequency |
|-------------|---------------|-----------|
| Dependency scanning | `npm audit` + Dependabot/Renovate | Weekly automated |
| Docker image scanning | `docker scout` or Trivy | On each build |
| Code scanning | ESLint security rules | On each PR |
| Penetration testing | Annual third-party pentest | Annual |
| Patching SLAs | Critical: 48h, High: 7d, Medium: 30d | Per severity |

### Docker-Specific Controls

```yaml
# docker-compose.yml security hardening
services:
  web:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL

  postgres:
    security_opt:
      - no-new-privileges:true
    # Don't expose port externally in production
    # Only expose to internal Docker network
    expose:
      - "5432"
    # Remove ports: mapping in production!
```

**Critical Docker security fix:** The current `docker-compose.yml` exposes PostgreSQL on port 5432 to the host. In production, PostgreSQL must only be accessible via Docker internal network.

**Confidence: HIGH** -- Container security best practices are well-established.

---

## 13. Incident Response

### Required Plan Components

SOC2 requires a documented, tested incident response plan:

1. **Incident classification:**
   - P1 (Critical): Data breach, cross-tenant leak, full outage
   - P2 (High): Partial outage, suspected unauthorized access
   - P3 (Medium): Performance degradation, failed backups
   - P4 (Low): Non-security bugs, minor issues

2. **Response procedures for each level:**
   - P1: Immediate containment (< 15 min), investigation (< 1 hour), notification (< 24 hours)
   - P2: Investigation within 4 hours
   - P3: Investigation within 24 hours
   - P4: Normal ticketing process

3. **Roles and responsibilities:**
   - Incident commander: Who coordinates the response
   - Technical responder: Who investigates and remediates
   - Communications: Who notifies affected tenants

4. **Post-incident review:**
   - Root cause analysis
   - Timeline of events
   - What worked, what didn't
   - Preventive measures

5. **Tenant notification:**
   - Cross-tenant data exposure: Notify affected tenants within 72 hours
   - Service outage: Status page update within 1 hour

### Cross-Tenant Data Breach Specific Procedure

This is the most critical incident type for multi-tenant SaaS:

1. **Detect:** Audit log alert on cross-tenant access
2. **Contain:** Immediately disable affected tenant access
3. **Assess:** Determine scope -- which tenants, what data
4. **Notify:** Contact affected tenants within 72 hours
5. **Remediate:** Fix the isolation vulnerability
6. **Review:** Post-incident analysis and prevention

**Confidence: HIGH** -- Incident response requirements are well-documented in SOC2 guidance.

---

## 14. Access Control and RBAC

### Current Gap

Relay currently has a single role: "authenticated user." SOC2 requires role-based access with least privilege.

### Required Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| Super Admin | Platform-wide | Manage tenants, view all audit logs |
| Tenant Admin | Per-tenant | Manage users, settings, API keys, view tenant audit logs |
| Tenant Member | Per-tenant | CRUD skills, view analytics, manage own API keys |
| API Key (System) | Per-tenant | MCP operations only (search, install, usage tracking) |

### Implementation

Add `role` column to users table (or a separate tenant_memberships table):

```typescript
export const tenantMemberships = pgTable('tenant_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'admin' | 'member'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Least Privilege Enforcement

| Action | Required Role |
|--------|---------------|
| View skills | member |
| Create/edit skills | member |
| Delete skills | admin |
| View analytics | member |
| Export analytics | admin |
| Manage API keys (own) | member |
| Manage API keys (all) | admin |
| Add/remove users | admin |
| Change tenant settings | admin |
| View audit logs | admin |
| Manage tenant | super_admin |

### Re-Authentication for Sensitive Actions

SOC2 recommends re-authentication for high-privilege operations:

- Deleting a skill
- Revoking another user's API key
- Changing tenant settings
- Removing a user from tenant

Implementation: Prompt for Google re-authentication before these actions.

**Confidence: HIGH** -- RBAC requirements are universally documented in SOC2 guidance.

---

## 15. Implementation Priority Matrix

Ordered by SOC2 audit risk -- items that would cause immediate audit failure listed first.

### Phase 1: Foundation (Must have before SOC2 audit engagement)

| Control | Effort | Impact if Missing |
|---------|--------|-------------------|
| Tenant isolation (tenant_id + RLS) | HIGH | Audit failure -- no data isolation |
| Audit logging table + core events | HIGH | Audit failure -- no accountability |
| TLS everywhere (Caddy) | LOW | Audit failure -- data in transit |
| Session timeout (8h max) | LOW | Audit finding |
| RBAC (admin/member) | MEDIUM | Audit failure -- no access control |
| Encrypted backups | MEDIUM | Audit failure -- no data protection |

### Phase 2: Hardening (Must have before Type II observation period)

| Control | Effort | Impact if Missing |
|---------|--------|-------------------|
| Encryption at rest (LUKS) | MEDIUM | Audit finding |
| API key rotation (90-day default) | LOW | Audit finding |
| Hook callback authentication (HMAC) | MEDIUM | Security weakness |
| Docker security hardening | LOW | Audit finding |
| Health monitoring + alerting | MEDIUM | Availability concern |
| Change management (branch protection) | LOW | Audit finding |

### Phase 3: Documentation (Must have before audit report)

| Control | Effort | Impact if Missing |
|---------|--------|-------------------|
| Incident response plan | MEDIUM | Audit failure |
| Data retention policy | LOW | Audit finding |
| Tenant offboarding procedure | MEDIUM | Privacy concern |
| Backup restore testing | LOW | Audit failure |
| Vulnerability scanning | LOW | Audit finding |
| Privacy notice / consent | LOW | Privacy concern |
| System description document | MEDIUM | Required for audit |

**Confidence: HIGH** -- Priority ordering based on multiple SOC2 audit guidance sources and common failure documentation.

---

## 16. What an Auditor Would Look For

Based on common SOC2 Type II audit procedures for multi-tenant SaaS:

### Day 1: System Walkthrough

1. **System description:** Architecture diagram showing data flow, components, trust boundaries
2. **Tenant isolation demo:** Show that Tenant A cannot access Tenant B's data
3. **Authentication flow:** Demonstrate SSO, session management, timeouts
4. **Access control:** Show RBAC enforcement, demonstrate least privilege

### Evidence Requests

| Evidence | What They Want | How to Provide |
|----------|---------------|----------------|
| Access reviews | Quarterly review of who has access to what | Audit log query + documented review |
| Change management | PRs with reviews for all production changes | Git log + GitHub PR history |
| Backup testing | Quarterly restore test results | Documented restore tests with screenshots |
| Incident response | Evidence of incident response testing | Tabletop exercise documentation |
| Monitoring | Evidence that alerts are reviewed and acted on | Alert history + response actions |
| Vulnerability scans | Recent scan results + remediation evidence | npm audit + Docker scan results |
| Key rotation | Evidence that keys are rotated per policy | API key creation/expiry audit logs |
| Encryption | Evidence of TLS configuration + at-rest encryption | Certificate config + LUKS setup docs |

### Critical Questions Auditors Ask

1. "Walk me through how you would detect a cross-tenant data access." -- Need audit logs + alerting + response procedure
2. "Show me your backup restore test from the last quarter." -- Need documented restore test
3. "How do you handle an employee leaving a tenant?" -- Need offboarding procedure + evidence
4. "What happens when an API key is compromised?" -- Need emergency revocation procedure + communication plan
5. "Show me all changes to production in the last 3 months." -- Need Git history + deployment logs

**Confidence: HIGH** -- Based on well-documented SOC2 audit procedures from multiple auditor guidance publications.

---

## 17. Common SOC2 Failures in Multi-Tenant SaaS

These are the most common audit failures. Build controls to prevent each one.

### 1. Cross-Tenant Data Leakage (CRITICAL)

**What happens:** A bug in a WHERE clause or API endpoint allows Tenant A to see Tenant B's data.
**Prevention:** RLS at database level (not just application WHERE clauses), automated cross-tenant penetration tests, audit logging of all data access with tenant context.
**Relay-specific risk:** Background jobs (embedding generation, usage aggregation) that process data across tenants must maintain tenant context.

### 2. Insufficient Audit Logging (CRITICAL)

**What happens:** Auditor asks "show me who accessed this data" and you cannot.
**Prevention:** Log all authentication, authorization, data modification, and admin events. Make logs immutable.
**Relay-specific risk:** Hook callbacks and MCP tool invocations must be logged, not just web UI actions.

### 3. Backup Without Tested Restore (HIGH)

**What happens:** Backups exist but have never been tested. Auditor asks for restore test evidence.
**Prevention:** Quarterly restore tests with documented results.

### 4. Overly Permissive Access (HIGH)

**What happens:** All users have admin access. No role differentiation.
**Prevention:** RBAC with admin/member distinction. Quarterly access reviews.
**Relay-specific risk:** Current system has no role concept -- every authenticated user can do everything.

### 5. Missing Session Timeouts (MEDIUM)

**What happens:** Sessions last 30 days (Auth.js default). Stolen laptop = 30-day access window.
**Prevention:** 8-hour maximum session, 30-minute idle timeout.

### 6. Unencrypted Data at Rest (MEDIUM)

**What happens:** Server is compromised or decommissioned, database is readable.
**Prevention:** LUKS encryption, documented key management.

### 7. No Incident Response Testing (MEDIUM)

**What happens:** Incident response plan exists on paper but has never been tested.
**Prevention:** Annual tabletop exercise, documented results.

### 8. Orphaned Accounts After Offboarding (MEDIUM)

**What happens:** Employee leaves but their account, API keys, and access remain active.
**Prevention:** Offboarding checklist, automated key expiry, quarterly access review.
**Relay-specific risk:** API keys embedded in Claude Code configurations on employee machines persist after offboarding. Need 90-day key expiry to handle this.

---

## Sources

### SOC2 Framework and Requirements
- [SOC 2 Compliance in 2026 - Venn](https://www.venn.com/learn/soc2-compliance/)
- [SOC 2 Compliance Checklist for SaaS - SecureLeap](https://www.secureleap.tech/blog/soc-2-compliance-checklist-saas)
- [Trust Services Criteria - Secureframe](https://secureframe.com/hub/soc-2/trust-services-criteria)
- [SOC 2 Controls Explained - dsalta](https://www.dsalta.com/resources/articles/soc-2-controls-explained-20-real-world-examples-for-saas-ai-and-cloud-teams)
- [SOC 2 Compliance Requirements - Onspring](https://onspring.com/resources/guide/soc-2-compliance-requirements-and-how-to-meet-them/)

### Multi-Tenant Isolation
- [Multi-tenant data isolation with PostgreSQL RLS - AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [SaaS Tenant Isolation Strategies - Medium](https://kodekx-solutions.medium.com/saas-tenant-isolation-database-schema-and-row-level-security-strategies-7337d2159066)
- [Drizzle ORM RLS Documentation](https://orm.drizzle.team/docs/rls)
- [Tenant Data Isolation Patterns - Propelius](https://propelius.ai/blogs/tenant-data-isolation-patterns-and-anti-patterns)

### Audit Logging
- [Ultimate Guide to SOC 2 Audit Logs - MarutiTech](https://marutitech.com/ultimate-soc2-audit-logs-tech-guide/)
- [Immutable Audit Log Architecture - EmergentMind](https://www.emergentmind.com/topics/immutable-audit-log)
- [SaaS Log Management Compliance - Mezmo](https://www.mezmo.com/learn-log-management/using-logs-to-meet-soc-2-and-pci-dss-requirements-for-your-saas-application)

### Encryption
- [SOC 2 Encryption Requirements - Copla](https://copla.com/blog/compliance-regulations/soc-2-encryption-requirements-key-guidelines-for-data-security/)
- [PostgreSQL Compliance - EDB](https://www.enterprisedb.com/postgresql-compliance-gdpr-soc-2-data-privacy-security)
- [PostgreSQL Encryption Options - Official Docs](https://www.postgresql.org/docs/current/encryption-options.html)
- [Encrypting PostgreSQL with LUKS - Medium](https://ozwizard.medium.com/encrypting-postgresql-data-directory-with-luks-on-linux-cabcbca119a1)

### Session Management
- [SOC 2 Software Timeout Requirements - Compyl](https://compyl.com/blog/soc-2-software-timeout-requirements/)
- [Session Management - OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### API Key Management
- [Key Rotation Best Practices - Natoma](https://nhimg.org/the-ultimate-guide-to-key-rotation-best-practices)
- [Key Management for SOC 2 - Hoop.dev](https://hoop.dev/blog/the-essential-guide-to-key-management-for-soc-2-compliance/)

### Webhook/Callback Security
- [Complete Guide to Webhook Security - Hookdeck](https://hookdeck.com/webhooks/guides/complete-guide-to-webhook-security)
- [Webhook Security - Webflow](https://webflow.com/blog/webhook-security)

### Data Retention
- [SOC 2 Data Retention Guide - Konfirmity](https://www.konfirmity.com/blog/soc-2-data-retention-guide)
- [Data Retention Policy SOC 2 - Linford](https://linfordco.com/blog/data-retention-policy-soc-2/)

### Backup and Recovery
- [SOC 2 Backup Requirements - PUN Group](https://pungroup.cpa/blog/soc-2-backup-requirements/)
- [SOC 2 Backup Testing - Konfirmity](https://www.konfirmity.com/blog/soc-2-backup-testing)
- [Backup Strategy for SOC 2 Type II - SecureLayer7](https://blog.securelayer7.net/backup-strategy-for-soc2-type-ii-compliance/)

### Change Management
- [SOC 2 Change Management - Sprinto](https://sprinto.com/blog/soc-2-change-management/)
- [SOC 2 CC8.1 Change Management - ISMS.online](https://www.isms.online/soc-2/controls/change-management-cc8-1-explained/)

### Container Security
- [Docker Compliance - Docker Blog](https://www.docker.com/blog/empowering-developers-with-docker-simplifying-compliance-and-enhancing-security-for-soc-2-iso-27001-fedramp-and-more/)
- [SOC 2 Compliance in Container Environments - StackRox](https://www.stackrox.io/blog/soc-2-compliance-in-container-and-kubernetes-environments/)

### Common Failures
- [SOC Audit Failure: Common Mistakes - Linford](https://linfordco.com/blog/soc-audit-failure-common-mistakes/)
- [Most Common SaaS Vulnerabilities 2025 - AppSecure](https://www.appsecure.security/blog/saas-security-vulnerabilities-2025)
- [SOC 2 Compliance Challenges - Scrut](https://www.scrut.io/hub/soc-2/soc-2-compliance-challenges)

### Access Control
- [SOC2 and Least Privilege - ConductorOne](https://www.conductorone.com/blog/soc2-and-least-privilege-access-control/)
- [SOC 2 RBAC - Konfirmity](https://www.konfirmity.com/blog/soc-2-role-based-access-control-for-soc-2)

### Incident Response
- [SOC 2 Incident Response - FractionalCISO](https://fractionalciso.com/soc-2-incident-response-whats-required-for-compliance/)
- [SOC 2 Policies and Procedures - Secureframe](https://secureframe.com/hub/soc-2/policies-and-procedures)
