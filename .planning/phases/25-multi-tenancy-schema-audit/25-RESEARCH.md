# Phase 25: Multi-Tenancy Schema & Audit Foundation - Research

**Researched:** 2026-02-07
**Domain:** PostgreSQL multi-tenancy, Drizzle ORM RLS, append-only audit logging
**Confidence:** HIGH

## Summary

This phase adds a `tenants` table and a `tenant_id` foreign key to every data table in the Relay database, enforces tenant isolation via PostgreSQL Row-Level Security (RLS) policies, and introduces an append-only `audit_logs` table for SOC2 compliance.

The standard approach is:
1. Create a `tenants` table and a single "default" tenant row for backfilling existing data.
2. Add `tenant_id` as a nullable column to each data table, backfill with the default tenant, then add NOT NULL + FK constraints.
3. Replace the existing `slug` UNIQUE constraint on `skills` with a composite `(tenant_id, slug)` unique constraint.
4. Define RLS policies using `current_setting('app.current_tenant_id', true)` session variables, enforced via Drizzle's `pgPolicy` API.
5. Create an `audit_logs` table with REVOKE UPDATE/DELETE permissions and a protective trigger.

**Primary recommendation:** Use Drizzle `pgPolicy` declarative API in schema definitions, combined with `SET LOCAL` session variables inside `db.transaction()` wrappers for per-request tenant context. Use custom SQL migrations for the multi-step add-nullable/backfill/add-NOT-NULL column pattern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.38.0 | Schema definitions, pgPolicy, pgRole, migrations | Already in use; supports RLS natively via `pgPolicy` |
| drizzle-kit | ^0.31.8 | Migration generation and execution | Already in use; supports `entities.roles` config and custom SQL migrations |
| postgres | ^3.4.0 | PostgreSQL client (postgres.js) | Already in use; supports `SET LOCAL` via `sql` template |
| PostgreSQL | 15+ | RLS, current_setting, SET LOCAL | Already deployed; native RLS support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.25.0 | Validation of tenant context | Already in use; validate tenantId before setting session variable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Row-level tenant_id (chosen) | Schema-per-tenant | Schema-per-tenant has migration nightmare at scale; row-level is simpler with RLS |
| Session variable RLS | Database role per tenant | Role-per-tenant breaks connection pooling; session variables work with pools |
| Drizzle pgPolicy | Raw SQL policy files | pgPolicy keeps policies co-located with schema; better maintainability |
| Application-layer tenant filtering only | Pure RLS | Defense-in-depth: both app-level filtering AND RLS prevent cross-tenant leaks |

**Installation:** No new packages needed. All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/
    tenants.ts           # NEW: tenants table
    audit-logs.ts        # NEW: audit_logs table
    skills.ts            # MODIFIED: add tenant_id + pgPolicy
    users.ts             # MODIFIED: add tenant_id + pgPolicy
    ratings.ts           # MODIFIED: add tenant_id + pgPolicy
    api-keys.ts          # MODIFIED: add tenant_id + pgPolicy
    usage-events.ts      # MODIFIED: add tenant_id + pgPolicy
    skill-embeddings.ts  # MODIFIED: add tenant_id + pgPolicy
    skill-reviews.ts     # MODIFIED: add tenant_id + pgPolicy
    skill-versions.ts    # MODIFIED: add tenant_id + pgPolicy
    site-settings.ts     # MODIFIED: add tenant_id + pgPolicy (remove singleton pattern)
  migrations/
    0002_add_tenants.sql           # Custom: create tenants table + default tenant
    0003_add_tenant_id_columns.sql # Custom: add nullable tenant_id to all tables
    0004_backfill_tenant_id.sql    # Custom: UPDATE ... SET tenant_id = default
    0005_enforce_tenant_id.sql     # Custom: ALTER NOT NULL + FK + composite unique + RLS policies
    0006_create_audit_logs.sql     # Custom: audit_logs table + REVOKE + trigger
  client.ts              # MODIFIED: add withTenant() helper
  tenant-context.ts      # NEW: tenant session variable management
```

### Pattern 1: Tenant Context via SET LOCAL in Transactions
**What:** Set `app.current_tenant_id` session variable at the start of every DB transaction
**When to use:** Every database operation in a multi-tenant context
**Example:**
```typescript
// packages/db/src/tenant-context.ts
import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * Execute a callback within a tenant-scoped transaction.
 * Sets LOCAL session variable so RLS policies can read it.
 * SET LOCAL scoping means the variable is automatically cleared
 * when the transaction ends -- safe for connection pooling.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  if (!db) throw new Error("Database not configured");

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL app.current_tenant_id = ${tenantId}`
    );
    return callback(tx as unknown as typeof db);
  });
}
```

### Pattern 2: RLS Policy Definition in Drizzle Schema
**What:** Declare RLS policies alongside table definitions using `pgPolicy`
**When to use:** Every tenant-scoped table
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/rls
import { pgTable, text, pgPolicy, pgRole } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";

// Reference existing application role (not managed by Drizzle)
const appRole = pgRole("app_user").existing();

export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // ... other columns
  },
  (table) => [
    // Composite unique: same slug allowed across tenants
    uniqueIndex("skills_tenant_slug_unique").on(table.tenantId, table.slug),
    // RLS policy: tenant isolation
    pgPolicy("tenant_isolation_policy", {
      as: "restrictive",
      for: "all",
      to: appRole,
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Pattern 3: Multi-Step Migration for Adding NOT NULL Columns
**What:** Add tenant_id as nullable, backfill, then enforce NOT NULL
**When to use:** Adding tenant_id to existing tables with data
**Example:**
```sql
-- Step 1: Add nullable column (0003_add_tenant_id_columns.sql)
ALTER TABLE skills ADD COLUMN tenant_id text;
ALTER TABLE users ADD COLUMN tenant_id text;
-- ... repeat for all tables

-- Step 2: Backfill with default tenant (0004_backfill_tenant_id.sql)
UPDATE skills SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
UPDATE users SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default') WHERE tenant_id IS NULL;
-- ... repeat for all tables

-- Step 3: Enforce constraints (0005_enforce_tenant_id.sql)
ALTER TABLE skills ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE skills ADD CONSTRAINT skills_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE skills DROP CONSTRAINT skills_slug_unique;
ALTER TABLE skills ADD CONSTRAINT skills_tenant_slug_unique UNIQUE (tenant_id, slug);
-- ... repeat pattern for all tables

-- Step 4: Enable RLS + create policies
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills FORCE ROW LEVEL SECURITY; -- Ensures table owner also sees filtered rows
CREATE POLICY tenant_isolation ON skills
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

### Pattern 4: Append-Only Audit Logs
**What:** Create immutable audit trail with REVOKE + trigger protection
**When to use:** SOC2-01 and SOC2-02 compliance
**Example:**
```sql
-- Create audit_logs table
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,           -- User who performed the action (nullable for system events)
  tenant_id text,          -- Tenant context (nullable for cross-tenant events)
  action text NOT NULL,    -- e.g., 'auth.login', 'skill.create', 'admin.delete_skill'
  resource_type text,      -- e.g., 'skill', 'api_key', 'user', 'rating'
  resource_id text,        -- ID of the affected resource
  ip_address text,         -- Client IP address
  metadata jsonb,          -- Additional context (old/new values, request details)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Make append-only: revoke UPDATE and DELETE from application role
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

-- Trigger protection against modification attempts
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Direct modification of audit_logs is forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Index for efficient querying
CREATE INDEX audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, created_at DESC);
```

### Anti-Patterns to Avoid
- **Forgetting FORCE ROW LEVEL SECURITY:** Without it, table owners bypass RLS. Always use both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- **Using `current_user` for tenant isolation:** Breaks connection pooling. Use `current_setting('app.current_tenant_id', true)` instead.
- **Using SET instead of SET LOCAL:** `SET` persists for the entire connection session. With connection pooling, tenant context can leak to the next request. Always use `SET LOCAL` inside a transaction.
- **Using non-LEAKPROOF functions in RLS policies:** Prevents index usage, causes full table scans. Keep policies simple: `column = current_setting(...)`.
- **Relying solely on RLS without application-level checks:** Defense-in-depth. Application code should also pass `tenant_id` in WHERE clauses.
- **Running migrations as superuser without testing as app role:** Superusers bypass RLS. Always test RLS policies with a non-superuser role.
- **Modifying auth tables (accounts, sessions, verification_tokens) with tenant_id:** These are managed by Auth.js/NextAuth. Tenant context is derived from the user's `tenant_id` column, not duplicated on auth tables.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RLS policy definitions | Raw SQL files only | Drizzle `pgPolicy` in schema | Co-located with schema, type-safe, migrates automatically |
| Session variable management | Manual SET in every query | `withTenant()` wrapper function | Single source of truth, transaction-scoped, impossible to forget |
| Migration sequencing | Ad-hoc ALTER scripts | Drizzle-kit custom migrations with `--custom` flag | Tracked in migration journal, ordered execution guaranteed |
| Audit log immutability | Application-level INSERT-only checks | PostgreSQL REVOKE + trigger | Database-enforced, cannot be bypassed by application bugs |

**Key insight:** PostgreSQL's built-in REVOKE/trigger mechanism is strictly more secure than application-level audit protection. An application bug can bypass application-level checks, but cannot bypass database-level REVOKE.

## Common Pitfalls

### Pitfall 1: Connection Pool Context Leaking
**What goes wrong:** `SET app.current_tenant_id = 'X'` persists across connections reused from the pool, causing User A to see Tenant B's data.
**Why it happens:** `SET` (not `SET LOCAL`) modifies the session, which survives transaction boundaries. Connection poolers like postgres.js reuse sessions.
**How to avoid:** Always use `SET LOCAL` inside a `db.transaction()`. SET LOCAL automatically resets when the transaction completes.
**Warning signs:** Intermittent test failures where data from the wrong tenant appears; works in dev (single connection), fails in production (pooled connections).

### Pitfall 2: Unique Constraint Leaking Tenant Data
**What goes wrong:** A global UNIQUE constraint on `skills.slug` reveals that a slug exists in another tenant when an INSERT fails.
**Why it happens:** Unique constraints are enforced across ALL rows, not just those visible via RLS.
**How to avoid:** Replace global UNIQUE with composite UNIQUE `(tenant_id, slug)`. Two tenants can now have skills with the same slug.
**Warning signs:** Slug collision errors when tenants independently create skills with common names.

### Pitfall 3: Site Settings Singleton Pattern Breaks
**What goes wrong:** `site_settings` currently uses `id = 'default'` as a singleton. With multi-tenancy, each tenant needs its own settings row.
**Why it happens:** The singleton pattern assumes a single tenant.
**How to avoid:** Change the singleton key from `id = 'default'` to `(tenant_id, id = 'default')`. The cache in `getSiteSettings()` must be keyed by tenant_id.
**Warning signs:** All tenants sharing the same Ollama configuration, or settings from one tenant appearing in another.

### Pitfall 4: Analytics Queries Use Email Domain for Org Scoping
**What goes wrong:** The analytics queries in `apps/web/lib/analytics-queries.ts` use `u.email LIKE '%@' || split_part(...)` to derive org membership from email domain. This must be replaced with `tenant_id` filtering.
**Why it happens:** Before multi-tenancy, email domain was the only way to group users by organization.
**How to avoid:** Replace all email-domain-based org filtering with direct `tenant_id = ?` WHERE clauses. This is actually simpler and faster (indexed column vs LIKE pattern).
**Warning signs:** Analytics showing data from users who share an email domain but belong to different tenants.

### Pitfall 5: MCP Routes Skip Auth Session
**What goes wrong:** MCP API routes (`/api/mcp/[transport]`) authenticate via API key, not session. The tenant context must be derived from the API key's user's tenant_id.
**Why it happens:** MCP routes use bearer token auth, bypassing Auth.js session middleware.
**How to avoid:** After validating the API key, look up the user's tenant_id and set the session variable before executing queries.
**Warning signs:** MCP tool calls returning empty results or inserting usage events without tenant_id.

### Pitfall 6: Drizzle pgPolicy Default-Deny Behavior
**What goes wrong:** Once RLS is enabled on a table, ALL queries return zero rows unless a matching policy exists. If the `app.current_tenant_id` variable is not set, `current_setting()` returns empty string, and the policy fails closed.
**Why it happens:** PostgreSQL uses default-deny when RLS is enabled. `current_setting('app.current_tenant_id', true)` returns empty string (not NULL) when the variable is unset.
**How to avoid:** Ensure `withTenant()` is called for EVERY database operation. Add a guard: `if (!tenantId) throw new Error(...)` before the transaction. For public/unauthenticated queries (MCP search without auth), either bypass RLS with a superuser connection or use a special public-tenant context.
**Warning signs:** Empty query results in production; queries that worked before multi-tenancy suddenly return no rows.

## Code Examples

### Tenants Table Schema
```typescript
// packages/db/src/schema/tenants.ts
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),           // e.g., "company.com" for email-based matching
  logo: text("logo"),               // URL to tenant logo
  isActive: boolean("is_active").notNull().default(true),
  plan: text("plan").notNull().default("freemium"), // "freemium" | "paid"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
```

### Audit Logs Table Schema
```typescript
// packages/db/src/schema/audit-logs.ts
import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id"),      // User who performed the action
  tenantId: text("tenant_id"),    // Tenant context
  action: text("action").notNull(), // e.g., "auth.login", "skill.create"
  resourceType: text("resource_type"), // e.g., "skill", "api_key"
  resourceId: text("resource_id"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

### Adding tenant_id to Existing Table (Skills Example)
```typescript
// Modified packages/db/src/schema/skills.ts (after migration)
import { pgTable, text, timestamp, integer, index, uniqueIndex, customType, pgPolicy, pgRole } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { tenants } from "./tenants";

const appRole = pgRole("app_user").existing();

export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    // ... rest of columns unchanged
  },
  (table) => [
    index("skills_search_idx").using("gin", table.searchVector),
    uniqueIndex("skills_tenant_slug_unique").on(table.tenantId, table.slug),
    index("skills_tenant_id_idx").on(table.tenantId),
    pgPolicy("skills_tenant_isolation", {
      as: "restrictive",
      for: "all",
      to: appRole,
      using: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`${table.tenantId} = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);
```

### Audit Log Write Helper
```typescript
// packages/db/src/services/audit.ts
import { db } from "../client";
import { auditLogs } from "../schema/audit-logs";

export interface AuditEntry {
  actorId?: string | null;
  tenantId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit log entry. Fire-and-forget safe.
 * Uses direct INSERT (not transaction-scoped) because audit_logs
 * is append-only and doesn't need RLS tenant filtering.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  if (!db) return;
  try {
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Schema-per-tenant | Row-level tenant_id + RLS | PostgreSQL 9.5+ (2016) | Simpler migrations, connection pooling works |
| Database role per tenant | Session variables (`SET LOCAL`) | Connection pooling era | Compatible with pgBouncer/postgres.js pooling |
| Application-only filtering | Application + RLS defense-in-depth | SOC2/compliance era | Database-enforced isolation prevents app-layer bugs from leaking data |
| Drizzle raw SQL policies | Drizzle `pgPolicy` declarative API | drizzle-orm 0.38.0 | Co-located with schema, type-checked, auto-migrated |
| Email-domain org grouping | Explicit tenant_id column | This phase | Faster (indexed), correct (no false domain matches), multi-tenant ready |

**Deprecated/outdated:**
- Email-domain-based org filtering in analytics queries: replaced by `tenant_id` column
- Singleton site_settings pattern (`id = 'default'`): replaced by per-tenant settings rows
- Global UNIQUE on skills.slug: replaced by composite `(tenant_id, slug)` UNIQUE

## Comprehensive Query Audit

All files that make database queries, categorized by the type of tenant_id injection needed.

### Tables Needing tenant_id Column (9 tables)
| Table | Current Unique Constraints | Change Required |
|-------|---------------------------|-----------------|
| users | email (global) | Add tenant_id; email stays globally unique (login identity) |
| skills | slug (global) | Add tenant_id; change to composite `(tenant_id, slug)` |
| ratings | none | Add tenant_id |
| api_keys | key_hash (global) | Add tenant_id; key_hash stays globally unique (auth identity) |
| usage_events | none | Add tenant_id |
| skill_embeddings | skill_id (global) | Add tenant_id; change to composite `(tenant_id, skill_id)` |
| skill_reviews | skill_id (global) | Add tenant_id; change to composite `(tenant_id, skill_id)` |
| skill_versions | none | Add tenant_id |
| site_settings | id (global) | Add tenant_id; change to composite `(tenant_id, id)` |

### Tables NOT Getting tenant_id (3 tables)
| Table | Reason |
|-------|--------|
| accounts | Auth.js managed; tenant derived from users.tenant_id |
| sessions | Auth.js managed; tenant derived from users.tenant_id |
| verification_tokens | Auth.js managed; stateless tokens |

### Files Needing tenant_id Injection (by location)

#### Server Actions (apps/web/app/actions/) - 13 files
| File | Queries | Injection Strategy |
|------|---------|-------------------|
| `skills.ts` | INSERT skills, INSERT skill_versions, UPDATE skills, SELECT skills (slug check via generateUniqueSlug) | Pass tenantId from session; add to all INSERT values; slug uniqueness scoped to tenant |
| `ratings.ts` | SELECT ratings, INSERT ratings, UPDATE ratings | Pass tenantId from session; add to INSERT/UPDATE |
| `api-keys.ts` | INSERT api_keys, SELECT api_keys, UPDATE api_keys, SELECT users | Pass tenantId from session; add to INSERT |
| `admin-settings.ts` | SELECT/UPDATE site_settings, SELECT skills | Pass tenantId from session; site_settings becomes per-tenant |
| `search.ts` | Delegates to lib/search-skills.ts | Pass tenantId through |
| `delete-skill.ts` | SELECT skills, DELETE skills (via service) | Pass tenantId from session |
| `fork-skill.ts` | SELECT skills, INSERT skills | Pass tenantId from session; forked skill gets same tenant_id as source |
| `merge-skills.ts` | SELECT skills, UPDATE/DELETE (via service) | Pass tenantId from session; enforce both skills same tenant |
| `ai-review.ts` | SELECT skills, SELECT/INSERT skill_reviews | Pass tenantId from session |
| `my-leverage.ts` | Delegates to lib/my-leverage.ts | Pass tenantId through |
| `get-employee-activity.ts` | Delegates to lib/analytics-queries.ts | Pass tenantId (replaces orgId email-domain pattern) |
| `get-skill-trend.ts` | Delegates to lib/analytics-queries.ts | Pass tenantId through |
| `export-analytics.ts` | Delegates to lib/analytics-queries.ts | Pass tenantId (replaces orgId) |

#### DB Services (packages/db/src/services/) - 8 files
| File | Queries | Injection Strategy |
|------|---------|-------------------|
| `search-skills.ts` | SELECT skills JOIN users | Add WHERE tenant_id = ? (or rely on RLS) |
| `skill-metrics.ts` | UPDATE skills, SELECT ratings | RLS will auto-filter; tenant_id set in transaction context |
| `skill-reviews.ts` | SELECT/INSERT/UPDATE skill_reviews | RLS will auto-filter |
| `skill-embeddings.ts` | INSERT/SELECT skill_embeddings | RLS will auto-filter |
| `skill-forks.ts` | SELECT skills | RLS will auto-filter |
| `skill-delete.ts` | UPDATE/DELETE skills | RLS will auto-filter |
| `skill-merge.ts` | SELECT/UPDATE/DELETE skills, ratings, usage_events | RLS will auto-filter; both skills must be same tenant |
| `api-keys.ts` | SELECT/UPDATE api_keys | RLS will auto-filter |
| `site-settings.ts` | SELECT/INSERT site_settings | Change singleton to per-tenant; key by tenant_id |

#### Library Files (apps/web/lib/) - 12 files
| File | Queries | Injection Strategy |
|------|---------|-------------------|
| `analytics-queries.ts` | 7 raw SQL queries using email-domain filtering | **Major refactor:** Replace all `u.email LIKE '%@' || split_part(...)` with `WHERE tenant_id = ?` |
| `search-skills.ts` | Complex SELECT with joins, FTS, quality scoring | Add WHERE tenant_id = ? or rely on RLS |
| `my-leverage.ts` | 4 raw SQL queries (getSkillsUsed, getSkillsUsedStats, getSkillsCreated, getSkillsCreatedStats) | Add WHERE tenant_id = ? on joined skill tables |
| `similar-skills.ts` | Vector search + ILIKE fallback | Add WHERE tenant_id = ? to both paths |
| `platform-stats.ts` | 3 aggregate queries | Scope to tenant_id (platform stats become per-tenant) |
| `platform-stat-trends.ts` | Aggregate daily trends | Scope to tenant_id |
| `total-stats.ts` | Aggregate totals + 14-day trends | Scope to tenant_id |
| `skill-stats.ts` | 4 queries for skill aggregates | RLS will auto-filter within tenant |
| `skill-detail-trends.ts` | Daily usage trends per skill | RLS will auto-filter |
| `usage-trends.ts` | Batch usage trends for skill cards | RLS will auto-filter |
| `leaderboard.ts` | CTE with RANK() window function | Scope to tenant_id |
| `trending.ts` | CTE with time-decay scoring | Scope to tenant_id |
| `user-stats.ts` | Aggregate user stats | Scope to tenant_id |
| `slug.ts` | SELECT skills WHERE slug LIKE | Scope to tenant_id (slug uniqueness per tenant) |
| `embedding-generator.ts` | Calls getSiteSettings + upsertSkillEmbedding | Delegates to services (tenant-scoped) |

#### Page Components (apps/web/app/(protected)/) - 5 files
| File | Queries | Injection Strategy |
|------|---------|-------------------|
| `page.tsx` (home) | Calls getPlatformStats, getTrendingSkills, getLeaderboard, getSkillsUsed/Created | All delegate to lib functions; pass tenantId |
| `skills/[slug]/page.tsx` | db.query.skills.findFirst, SELECT ratings, getSkillReview, etc. | Add tenant_id filter or rely on RLS |
| `my-skills/page.tsx` | SELECT skills WHERE author_id = user.id | RLS will auto-filter |
| `users/[id]/page.tsx` | db.query.users.findFirst, db.query.skills.findMany | RLS will auto-filter |
| `analytics/page.tsx` | Calls getOverviewStats, getUsageTrend, getEmployeeUsage, getSkillUsage | Pass tenantId (replaces orgId) |
| `admin/settings/page.tsx` | getSiteSettings | Becomes per-tenant |
| `admin/keys/page.tsx` | SELECT users, listAllApiKeysAction | Scope to tenant |

#### API Routes (apps/web/app/api/) - 3 files
| File | Queries | Injection Strategy |
|------|---------|-------------------|
| `mcp/[transport]/route.ts` | db.query.skills.findMany, INSERT usage_events, searchSkillsByQuery | Derive tenant from API key user; set session variable |
| `auth/validate-key/route.ts` | validateApiKey | No tenant filtering needed (key_hash is globally unique for auth) |
| `install-callback/route.ts` | INSERT usage_events, incrementSkillUses | Derive tenant from API key user (if authenticated) |

#### MCP App (apps/mcp/) - 4 files
| File | Queries | Injection Strategy |
|------|---------|-------------------|
| `src/tools/search.ts` | searchSkillsByQuery | Derive tenant from auth; pass through |
| `src/tools/list.ts` | db.query.skills.findMany | Derive tenant from auth; set session variable |
| `src/tools/deploy.ts` | db.query.skills.findMany | Derive tenant from auth; set session variable |
| `src/tracking/events.ts` | INSERT usage_events | Add tenantId to event values |

**Total: ~50 query locations across 45 files**

## Open Questions

1. **Public/anonymous MCP access and RLS**
   - What we know: MCP search/list can work without auth (anonymous mode). RLS default-deny would block all queries when `app.current_tenant_id` is not set.
   - What's unclear: Should anonymous MCP queries see ALL tenants' public skills, or only a specific "public marketplace" tenant?
   - Recommendation: Create a special "public" tenant for marketplace-visible skills. Anonymous queries set `app.current_tenant_id` to the public tenant. Alternatively, define a permissive SELECT policy that allows reading skills with `is_public = true` regardless of tenant.

2. **Users belonging to multiple tenants**
   - What we know: The requirements say users table gets tenant_id. But what if a user needs access to multiple tenants?
   - What's unclear: Is this a v1.5 requirement, or deferred to a later phase?
   - Recommendation: For now, users belong to exactly one tenant. If multi-tenant membership is needed later, add a `tenant_memberships` join table. The users.tenant_id remains their "primary" tenant.

3. **Drizzle pgPolicy maturity**
   - What we know: Drizzle's pgPolicy API is relatively new. Community reports some rough edges (GitHub issue #4763 asks for ability to disable RLS management by config).
   - What's unclear: Will `drizzle-kit generate` produce correct migration SQL for pgPolicy definitions?
   - Recommendation: Define policies in schema for documentation/type-safety, but use custom SQL migrations for the actual policy creation to ensure correctness. Verify generated migrations before applying.

4. **Database role for RLS policies**
   - What we know: RLS policies reference a role via `TO`. The current app connects as the postgres.js default role (likely the DB owner/superuser).
   - What's unclear: Is a separate `app_user` role needed, or can policies target `public` role?
   - Recommendation: For v1.5, target policies to `public` role (applies to all non-superuser roles). Create a dedicated `app_user` role in a later phase when the deployment environment supports it. Use `FORCE ROW LEVEL SECURITY` to ensure owner doesn't bypass.

5. **Existing data migration**
   - What we know: All existing data needs a default tenant_id. The "default" tenant must be created before backfilling.
   - What's unclear: How much data exists? Will the backfill UPDATE lock tables for too long?
   - Recommendation: Since this is a young project (v1.4), data volume is likely small. A simple `UPDATE ... SET tenant_id = 'default-uuid'` should complete quickly. For production, add a `WHERE tenant_id IS NULL` to make it idempotent and safe to retry.

## Sources

### Primary (HIGH confidence)
- Drizzle ORM RLS documentation: https://orm.drizzle.team/docs/rls - pgPolicy API, role definitions, policy configuration
- Drizzle ORM custom migrations: https://orm.drizzle.team/docs/kit-custom-migrations - `drizzle-kit generate --custom` workflow
- Codebase analysis: All 11 schema files, 8 service files, 13 server action files, 12 lib files, 3 API routes, 4 MCP tool files read directly

### Secondary (MEDIUM confidence)
- Crunchy Data RLS blog: https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres - session variable pattern, policy creation
- Bytebase RLS footguns: https://www.bytebase.com/blog/postgres-row-level-security-footguns/ - connection pooling pitfalls, LEAKPROOF, FORCE RLS
- Bytebase audit logging: https://www.bytebase.com/blog/postgres-audit-logging/ - audit table schema, trigger-based approach

### Tertiary (LOW confidence)
- Drizzle ORM GitHub discussion #2450: https://github.com/drizzle-team/drizzle-orm/discussions/2450 - community feedback on RLS support maturity
- Nile multi-tenant RLS blog: https://www.thenile.dev/blog/multi-tenant-rls - SET LOCAL pattern with connection pooling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed; Drizzle pgPolicy API verified via official docs
- Architecture: HIGH - Session variable + RLS pattern is the established PostgreSQL multi-tenancy approach; verified via multiple authoritative sources
- Migration strategy: HIGH - Multi-step nullable/backfill/NOT NULL pattern is standard PostgreSQL DDL practice; Drizzle custom migrations verified via docs
- Audit logs: HIGH - REVOKE + trigger pattern is well-established for append-only tables
- Pitfalls: HIGH - Connection pooling, FORCE RLS, LEAKPROOF verified via Bytebase authoritative guide
- Query audit: HIGH - Direct codebase analysis of every file touching the database

**Research date:** 2026-02-07
**Valid until:** 2026-03-09 (30 days - stable domain, no fast-moving dependencies)
