# Domain Pitfalls: Multi-Tenancy, Production Deployment, and Hook-Based Tracking

**Domain:** Retrofitting multi-tenancy, Docker Compose production deployment, and Claude Code hooks into an existing single-tenant Next.js 16 + Drizzle ORM + PostgreSQL skill marketplace
**Researched:** 2026-02-07 (v1.5 milestone)
**Overall confidence:** HIGH (based on codebase audit + verified external sources)

---

## Critical Pitfalls

Mistakes that cause data leakage, security breaches, or require rewrites.

---

### Pitfall 1: Cross-Tenant Data Leakage via Missing WHERE Clauses

**What goes wrong:** After adding a `tenantId` column to tables, developers add tenant filtering to some queries but miss others. The existing codebase has **30+ files** with direct database queries (via `db.select`, `db.execute`, `db.query`, raw SQL CTEs) that would all need tenant-scoping. A single missed query leaks Tenant A's skills, usage events, or analytics to Tenant B.

**Why it happens:** Relay's current codebase has no concept of tenant scoping. Every query operates on the full dataset. The blast radius is enormous:

| File | Query Type | Risk |
|------|------------|------|
| `apps/web/lib/analytics-queries.ts` | 6 raw SQL queries with domain-based filtering | HIGH - domain-matching logic must become tenantId filtering |
| `apps/web/lib/leaderboard.ts` | Raw SQL CTE across users + skills | HIGH - currently returns global leaderboard |
| `apps/web/lib/trending.ts` | Raw SQL CTE across usage_events + skills | HIGH - trending shows all tenants' data |
| `apps/web/lib/platform-stats.ts` | 3 parallel queries on skills, users, ratings | HIGH - aggregates currently global |
| `apps/web/lib/total-stats.ts` | Aggregate on skills + usage_events | HIGH - days saved currently global |
| `packages/db/src/services/search-skills.ts` | ILIKE search across skills + users | HIGH - search returns all tenants' skills |
| `apps/web/app/actions/skills.ts` | Insert/update skills, slug generation | MEDIUM - new skills must have tenantId |
| `apps/web/app/actions/ratings.ts` | Insert/query ratings | MEDIUM - ratings should be tenant-scoped |
| `apps/web/lib/slug.ts` | Slug uniqueness check | CRITICAL - slug collision across tenants breaks URLs |
| `packages/db/src/services/api-keys.ts` | validateApiKey returns userId only | CRITICAL - must also return tenantId |
| `apps/mcp/src/tracking/events.ts` | Insert usage events | MEDIUM - events need tenantId |
| `apps/web/app/actions/search.ts` | quickSearch delegates to search-skills | HIGH - search must be tenant-scoped |
| `apps/web/lib/my-leverage.ts` | User's personal usage data | LOW - already user-scoped |
| `packages/db/src/services/site-settings.ts` | Singleton row settings | CRITICAL - must become per-tenant settings |

**Consequences:** One missed query means a tenant admin can see another tenant's employee usage data, skill content, or analytics. This is a security incident, not just a bug.

**Prevention:**
1. **Add tenantId column to ALL relevant tables in one migration** (skills, usage_events, ratings, skill_versions, skill_embeddings, skill_reviews, api_keys, site_settings, users). Do NOT add it piecemeal across phases.
2. **Create a tenant-scoped query helper** that wraps `db` with an automatic `WHERE tenantId = ?` clause. Use this everywhere instead of raw `db`.
3. **Write an integration test that asserts cross-tenant isolation** for every query function. Create two tenants with identical data, then verify each function only returns data for the queried tenant.
4. **Audit script:** After migration, grep for all `db.select`, `db.execute`, `db.query`, `db.insert`, `db.update`, `db.delete` calls in `apps/` and `packages/` source files. Every single one must either include a tenantId filter or be explicitly documented as intentionally global.

**Detection (warning signs):**
- Any query that does NOT include `tenantId` in its WHERE clause
- Tests that pass with only one tenant in the database (false confidence)
- Analytics that show suspiciously high numbers (aggregating across tenants)

**Which phase should address it:** The very first phase of multi-tenancy work. Schema migration + query helper must land before ANY tenant-visible features.

**Confidence:** HIGH - based on direct codebase audit of every query file

---

### Pitfall 2: Analytics Domain-Matching Logic Becomes a Tenant Leak Vector

**What goes wrong:** The current analytics system in `analytics-queries.ts` uses email domain matching to scope queries: `u.email LIKE '%@' || (SELECT split_part(u2.email, '@', 2) FROM users u2 WHERE u2.id = ${orgId})`. When multi-tenancy is added, this heuristic breaks in multiple ways:
- Users with personal email addresses (`gmail.com`) match across tenants
- A company with multiple domains (`company.com` and `company.co.uk`) has incomplete data
- The subquery approach means the `orgId` parameter is really a `userId` being used to derive a domain, not a real org/tenant identifier

**Why it happens:** The current system has no explicit tenant/org concept. It infers organizational boundaries from email domains. This was fine for single-tenant but becomes a data leakage vector in multi-tenant.

**Consequences:** Tenant A's analytics dashboard could show usage data for Tenant B's employees if they share an email domain (e.g., both are consultancies using `@gmail.com` accounts). Or, the same user could exist in multiple tenants and their usage would appear in the wrong tenant's analytics.

**Prevention:**
1. Replace ALL 6 analytics queries' domain-matching logic with explicit `tenantId` filtering in a single phase
2. The `getOverviewStats`, `getUsageTrend`, `getEmployeeUsage`, `getSkillUsage`, `getExportData`, and `getEmployeeActivity` functions must take `tenantId` (not `orgId` derived from userId) as their primary filter
3. Remove the `split_part(email, '@', 2)` pattern entirely - it is inherently unreliable for multi-tenant
4. Add the `tenantId` column to `usage_events` table so analytics queries filter directly on it, not via JOIN chains

**Detection:** Analytics numbers that don't match expected values after multi-tenancy launch; users appearing in wrong tenant's employee list.

**Which phase should address it:** Same phase as the schema migration. These queries are the highest-risk area for data leakage.

**Confidence:** HIGH - verified by reading all 6 analytics query functions line by line

---

### Pitfall 3: Google OAuth Does Not Support Wildcard Redirect URIs

**What goes wrong:** Multi-tenant subdomain routing means each tenant has a URL like `acme.relay.example.com`. Google OAuth requires registering **exact** redirect URIs. Google explicitly does not support wildcard patterns like `*.relay.example.com/api/auth/callback/google`. Developers discover this only after implementing subdomain routing and finding that Google rejects login attempts from any subdomain not explicitly registered.

**Why it happens:** Google's OAuth2 security model requires exact URI matching. This is a fundamental platform constraint, not a configuration issue.

**Consequences:** Either (a) you must register every new tenant's subdomain in Google Cloud Console manually (does not scale), or (b) authentication completely breaks for subdomain-based tenants.

**Prevention:** Use a **single shared auth endpoint** approach:
1. All tenants authenticate through the same callback URL: `auth.relay.example.com/api/auth/callback/google` (or the apex domain `relay.example.com/api/auth/callback/google`)
2. Store the originating tenant subdomain in the OAuth `state` parameter before redirect
3. After successful auth, redirect the user back to their tenant subdomain using the stored state
4. Set Auth.js cookies with `domain: '.relay.example.com'` so they are shared across all subdomains
5. Register only ONE redirect URI in Google Cloud Console

**Auth.js v5 specifics:** Auth.js v5 reads the host from request headers dynamically (no longer requires static `NEXTAUTH_URL`), but the `redirect_uri` sent to Google must still match what's registered. The workaround is to use `redirectProxyUrl` in the Auth.js config to force all OAuth callbacks through the shared auth domain.

**Detection:** Login works on the apex domain but fails on any subdomain with a `redirect_uri_mismatch` error from Google.

**Which phase should address it:** Auth configuration must be part of the FIRST multi-tenancy phase, before subdomain routing ships. If subdomain routing ships without fixing auth, every tenant is locked out.

**Confidence:** HIGH - Google's exact-match requirement is well documented and confirmed by multiple GitHub issues: [next-auth #9785](https://github.com/nextauthjs/next-auth/discussions/9785), [next-auth #12225](https://github.com/nextauthjs/next-auth/issues/12225), [Google OAuth docs](https://developers.google.com/identity/protocols/oauth2/web-server)

---

### Pitfall 4: Auth.js Subdomain Cookie Isolation / CSRF Failures

**What goes wrong:** Auth.js sets session cookies with a specific domain scope. When a user logs in on `acme.relay.example.com`, the session cookie may be scoped to that exact subdomain. Navigating to `beta.relay.example.com` requires re-authentication. Worse, CSRF token cookies set on one subdomain may not be readable on another, causing `InvalidCheckError` during OAuth callbacks.

**Why it happens:** Auth.js v5 changed cookie behavior between v4 and v5 (documented in [issue #10915](https://github.com/nextauthjs/next-auth/issues/10915)). The default cookie configuration does not account for subdomain sharing.

**Consequences:** Users cannot log in from tenant subdomains, or get CSRF errors during the OAuth callback. This completely blocks authentication.

**Prevention:**
1. Explicitly configure Auth.js cookie options:
   ```typescript
   cookies: {
     sessionToken: {
       name: '__Secure-next-auth.session-token',
       options: {
         httpOnly: true,
         sameSite: 'lax',
         path: '/',
         secure: true,
         domain: '.relay.example.com'  // Leading dot = all subdomains
       }
     },
     callbackUrl: {
       name: '__Secure-next-auth.callback-url',
       options: {
         sameSite: 'lax',
         path: '/',
         secure: true,
         domain: '.relay.example.com'
       }
     },
     csrfToken: {
       name: '__Host-next-auth.csrf-token',  // __Host prefix requires exact domain
       options: {
         httpOnly: true,
         sameSite: 'lax',
         path: '/',
         secure: true,
         // NOTE: __Host-prefixed cookies CANNOT have domain set
         // Use __Secure- prefix instead if cross-subdomain is needed
       }
     }
   }
   ```
2. Test auth flow from EACH subdomain, not just the apex domain
3. Be aware that `__Host-` prefixed cookies (used by Auth.js for CSRF) cannot have a domain attribute set - they are bound to the exact origin. Consider switching to `__Secure-` prefix for the CSRF cookie if cross-subdomain auth is needed.

**Detection:** Login works on the main domain, fails on subdomains with CSRF errors or infinite redirect loops.

**Which phase should address it:** Same phase as Pitfall 3 (auth configuration).

**Confidence:** HIGH - confirmed via Auth.js GitHub issues and Next.js multi-tenant documentation

---

### Pitfall 5: MCP Server API Key Must Return Tenant Context

**What goes wrong:** The current `validateApiKey` function in `packages/db/src/services/api-keys.ts` returns `{ userId, keyId }`. The MCP auth module in `apps/mcp/src/auth.ts` caches `userId` and uses it for all subsequent tool calls. In multi-tenant mode, the MCP server has no way to know which tenant a user belongs to, meaning:
- `search_skills` returns skills from ALL tenants
- `log_usage` records events without tenant context
- `confirm_install` and `deploy` operate without tenant scoping

**Why it happens:** The API key table has `userId` but no `tenantId`. The MCP auth resolution happens once at startup and caches only the userId.

**Consequences:** MCP tool calls leak data across tenants. A user with Tenant A's API key could search and find Tenant B's skills.

**Prevention:**
1. Add `tenantId` to the `api_keys` table (or resolve it via the user's tenant membership)
2. Modify `validateApiKey` to return `{ userId, keyId, tenantId }`
3. Modify `resolveUserId` in MCP auth to also cache `tenantId`
4. Pass `tenantId` to every MCP tool handler as required context
5. Every MCP tool query must filter by tenantId

**Detection:** MCP search returning skills the user shouldn't see; usage events without tenant attribution.

**Which phase should address it:** Must be completed in the same phase as the database schema migration. MCP is a primary data access path.

**Confidence:** HIGH - direct reading of `api-keys.ts` and `auth.ts` confirms the gap

---

### Pitfall 6: Slug Uniqueness Constraint Breaks Under Multi-Tenancy

**What goes wrong:** The `skills` table has `slug: text("slug").notNull().unique()`. This is a GLOBAL unique constraint. In multi-tenant mode, Tenant A creating a skill called "code-review" would prevent Tenant B from creating their own "code-review" skill. The `generateUniqueSlug` function in `lib/slug.ts` checks for collisions globally, meaning Tenant B gets "code-review-a3b4c5d6" while Tenant A has the clean "code-review" slug.

**Why it happens:** The unique constraint was designed for single-tenant. Multi-tenant needs uniqueness scoped to the tenant: `UNIQUE(tenant_id, slug)`.

**Consequences:**
- Slugs become unpredictable across tenants (some get clean slugs, others get UUID suffixes)
- URL collisions if middleware doesn't correctly scope slug lookups to the current tenant
- Migration is complex: must drop the existing unique index and create a composite unique index

**Prevention:**
1. **Migration strategy:** In a single migration:
   - Add `tenant_id` column to skills table
   - Backfill all existing rows with the default tenant's ID
   - Drop the existing `UNIQUE(slug)` constraint
   - Add `UNIQUE(tenant_id, slug)` composite constraint
2. Update `generateUniqueSlug` to check collisions only within the current tenant
3. Update the `[slug]` page route to resolve skills by `(tenantId, slug)` not just `slug`

**Detection:** Slug collision errors when different tenants try to create identically-named skills.

**Which phase should address it:** Schema migration phase (same as Pitfall 1).

**Confidence:** HIGH - verified by reading `packages/db/src/schema/skills.ts` line 29 and `lib/slug.ts`

---

### Pitfall 7: Site Settings Singleton Becomes a Shared Mutation Point

**What goes wrong:** The `site_settings` table uses a singleton pattern with `id: text("id").primaryKey().default("default")`. All tenants would read and write the same "default" row. If Tenant A's admin enables Ollama semantic search, it enables it for ALL tenants. If Tenant B's admin changes the embedding model, it changes for everyone.

**Why it happens:** Settings were designed for a single deployment. The schema has no tenant scoping.

**Consequences:** One tenant's admin configuration silently affects all other tenants. This is both a data integrity issue and a security issue (one tenant controlling another tenant's features).

**Prevention:**
1. Change `site_settings` primary key from singleton `"default"` to `tenantId`
2. Each tenant gets their own settings row
3. Update `getSiteSettings()` and `updateSiteSettings()` to take `tenantId` parameter
4. Default settings for new tenants should come from a template, not from another tenant's config
5. The admin settings page must scope to the current tenant

**Detection:** Settings changes by one admin unexpectedly affecting other tenants.

**Which phase should address it:** Schema migration phase.

**Confidence:** HIGH - verified by reading `packages/db/src/schema/site-settings.ts`

---

## Major Pitfalls

Mistakes that cause significant delays, outages, or security issues.

---

### Pitfall 8: Wildcard SSL Certificate Requires DNS Challenge (Cannot Use HTTP Challenge)

**What goes wrong:** Let's Encrypt's HTTP-01 challenge (the most common automated approach) does NOT support wildcard certificates. Wildcard certs (`*.relay.example.com`) require the DNS-01 challenge, which means your certificate automation must have programmatic access to your DNS provider's API to create TXT records.

**Why it happens:** Developers set up Certbot with the standard HTTP challenge, then discover it refuses to issue `*.relay.example.com`.

**Consequences:** Either (a) SSL completely fails for tenant subdomains, or (b) you resort to issuing individual certificates per tenant (does not scale, hits Let's Encrypt rate limits of ~50 certificates per registered domain per week).

**Prevention:**
1. Use DNS-01 challenge with a Certbot DNS plugin matching your DNS provider (Hetzner DNS, Cloudflare, Route53, etc.)
2. Set up a Docker container that runs Certbot with the DNS plugin for automatic renewal
3. If using Hetzner DNS: use `certbot-dns-hetzner` plugin
4. If using Cloudflare (recommended for Hetzner VPS): use `certbot-dns-cloudflare` plugin
5. Store DNS API credentials securely (Docker secrets, not environment variables in docker-compose.yml)
6. Test renewal BEFORE the 90-day expiry: `certbot renew --dry-run`

**Alternative approach:** Use Traefik as the reverse proxy instead of Nginx. Traefik has built-in ACME support with automatic certificate management and DNS challenge support for many providers.

**Detection:** SSL errors when accessing any `*.relay.example.com` subdomain; certificate renewal failures in logs.

**Which phase should address it:** Infrastructure/deployment phase, before multi-tenancy subdomain routing.

**Confidence:** HIGH - Let's Encrypt's challenge types are [documented officially](https://letsencrypt.org/docs/challenge-types/)

---

### Pitfall 9: Docker Compose Exposes PostgreSQL Port to the Internet

**What goes wrong:** A common docker-compose.yml mistake:
```yaml
services:
  postgres:
    ports:
      - "5432:5432"  # DANGER: Exposes to 0.0.0.0
```
This binds PostgreSQL to ALL network interfaces, making it accessible from the internet. Even with a firewall like UFW, Docker manipulates iptables directly and can bypass UFW rules.

**Why it happens:** Developers copy local development docker-compose configs to production. In local dev, port mapping is convenient. In production, it's a security disaster.

**Consequences:** Anyone on the internet can attempt to connect to your PostgreSQL instance. If the password is weak or default, full database compromise.

**Prevention:**
1. **Never expose database ports in production docker-compose.yml.** Use Docker networks instead:
   ```yaml
   services:
     postgres:
       # NO ports section
       networks:
         - internal
     web:
       networks:
         - internal
         - public
   networks:
     internal:
       internal: true  # No external access
     public:
   ```
2. If you must expose a port for debugging, bind to localhost only: `"127.0.0.1:5432:5432"`
3. Be aware that Docker's iptables rules bypass UFW. Even `ufw deny 5432` does NOT block Docker-exposed ports.
4. Use `docker network inspect` to verify the postgres container is only on internal networks

**Detection:** `nmap -p 5432 your-server-ip` from an external machine showing the port as open.

**Which phase should address it:** Infrastructure/deployment phase. The very first docker-compose.yml must get this right.

**Confidence:** HIGH - this is a well-known Docker security issue

---

### Pitfall 10: Database Migration Downtime for Adding tenant_id to Existing Tables

**What goes wrong:** Adding a `NOT NULL` column to existing tables with data requires a default value. A naive approach like `ALTER TABLE skills ADD COLUMN tenant_id TEXT NOT NULL` fails because existing rows have no value. Adding it with a default like `DEFAULT 'default-tenant'` and then updating rows works but locks the table for the duration of the UPDATE on large tables.

**Why it happens:** Drizzle Kit generates migrations that may not account for existing data. The `drizzle-kit generate` command creates the DDL but doesn't know about data backfill needs.

**Consequences:** Table locks during migration cause downtime. Or, if you add the column as nullable first, you risk queries that forget to filter on tenantId silently returning cross-tenant data (null tenantId rows).

**Prevention:** Use a multi-step migration strategy:
1. **Step 1:** Add `tenant_id` as NULLABLE column (no lock, instant)
2. **Step 2:** Backfill existing rows with the default tenant ID (can be done in batches to avoid long locks)
3. **Step 3:** Add NOT NULL constraint (brief lock, but all rows already have values)
4. **Step 4:** Add indexes on `tenant_id` (concurrent index creation: `CREATE INDEX CONCURRENTLY`)
5. **Step 5:** Update composite unique constraints (drop old, add new)

Use Drizzle Kit's custom migration feature (`drizzle-kit generate` then edit the generated SQL) to split this into the correct steps. Do NOT rely on Drizzle's auto-generated migration for this.

The tables that need `tenant_id` added:
- `skills` (+ update unique constraint on slug)
- `usage_events`
- `ratings`
- `skill_versions`
- `skill_embeddings`
- `skill_reviews`
- `api_keys`
- `site_settings` (change primary key strategy)
- `users` (users may belong to multiple tenants - consider a join table instead)

**Detection:** Migration failures in production; long-running locks visible in `pg_stat_activity`.

**Which phase should address it:** Schema migration phase. Must be the FIRST step in multi-tenancy.

**Confidence:** HIGH - standard PostgreSQL migration knowledge + Drizzle migration [docs](https://orm.drizzle.team/docs/kit-custom-migrations)

---

### Pitfall 11: Next.js Middleware Subdomain Extraction Fails on localhost

**What goes wrong:** Subdomain routing relies on parsing the `Host` header to extract the tenant. On localhost, the host is `localhost:3000` with no subdomain. Developers either (a) can't test multi-tenancy locally, or (b) write localhost-specific code that diverges from production behavior.

**Why it happens:** `localhost` has no subdomain support in browsers. `acme.localhost:3000` works in Chrome but not in all browsers or tools (like Playwright).

**Consequences:** Development/testing cycle is broken. Bugs in subdomain routing are only caught in production.

**Prevention:**
1. Use `/etc/hosts` entries for local development: `127.0.0.1 acme.relay.local beta.relay.local relay.local`
2. Or use a `.localhost` TLD which Chrome supports: `acme.localhost:3000` (but test in Playwright too)
3. Write middleware that supports both modes:
   ```typescript
   function extractTenant(host: string): string | null {
     // Production: acme.relay.example.com -> acme
     // Local: acme.relay.local:3000 -> acme
     const hostname = host.split(':')[0];
     const parts = hostname.split('.');
     if (parts.length > 2) return parts[0]; // subdomain
     return null; // apex domain (no tenant)
   }
   ```
4. Use environment variable for the base domain: `BASE_DOMAIN=relay.example.com` in production, `BASE_DOMAIN=relay.local` in development

**Detection:** Works in production but not locally, or vice versa. Playwright tests fail with subdomain routing.

**Which phase should address it:** Subdomain routing implementation phase.

**Confidence:** MEDIUM - based on common Next.js multi-tenant patterns

---

### Pitfall 12: Claude Code Hooks Are Fire-and-Forget with No Retry

**What goes wrong:** Claude Code hooks run shell commands that exit with a code. If a PostToolUse hook that sends tracking data to the Relay API endpoint encounters a network error (endpoint down, timeout, DNS failure), the hook fails silently (non-zero exit codes other than 2 are logged but don't block). There is no retry mechanism built into Claude Code hooks.

**Why it happens:** Hooks are designed for local operations (formatting, linting). They are NOT designed as reliable delivery mechanisms for remote APIs.

**Consequences:** Usage tracking data is permanently lost whenever the Relay server is unreachable (server restart, network blip, DNS issues). Over time, this creates systematic undercounting.

**Prevention:**
1. **Write-ahead log pattern:** The hook should append events to a local file (`~/.relay/pending-events.jsonl`) first, then attempt to send. A separate background process or the next hook invocation retries failed sends.
2. **Batch and flush:** Instead of sending one HTTP request per hook event, batch events and flush periodically.
3. **Hook script resilience:**
   ```bash
   #!/bin/bash
   EVENT=$(cat)
   # Always write to local log first (never fails)
   echo "$EVENT" >> ~/.relay/pending-events.jsonl
   # Attempt send with timeout (fire-and-forget, don't block Claude Code)
   curl -s --max-time 5 -X POST "$RELAY_URL/api/track" \
     -H "Authorization: Bearer $RELAY_API_KEY" \
     -d "$EVENT" &
   exit 0  # Always succeed - don't block Claude Code
   ```
4. **Flush pending events on session start:** Use a `SessionStart` hook to retry any events in the pending log.

**Detection:** Usage counts in Relay dashboard are consistently lower than expected; spikes in tracking after the server recovers from downtime (if flush-on-reconnect is implemented).

**Which phase should address it:** Hook implementation phase.

**Confidence:** HIGH - verified from [Claude Code hooks documentation](https://code.claude.com/docs/en/hooks-guide) that non-zero exit codes (except 2) are logged but don't block, and there's no built-in retry

---

### Pitfall 13: Hook Auto-Injection Modifying User's .claude/settings.json

**What goes wrong:** If the "auto-inject tracking hooks" feature modifies the user's `.claude/settings.json` during skill installation, it could:
- Overwrite existing user hooks (data loss)
- Create JSON syntax errors if the merge logic is flawed
- Conflict with project-level settings in `.claude/settings.json`
- Break if the user doesn't have a `.claude` directory yet

**Why it happens:** Claude Code hooks are stored in JSON settings files. Programmatically merging into an existing JSON file while preserving the user's other configurations is error-prone.

**Consequences:** User's Claude Code stops working, existing hooks are overwritten, or the injected hooks silently don't fire.

**Prevention:**
1. **Use project-level hooks instead of user-level hooks.** Install hooks in `.claude/settings.json` (project root) rather than `~/.claude/settings.json`. This scopes the hooks to the project and doesn't touch the user's global config.
2. **Merge, don't overwrite:** If hooks already exist in the target file, add to the existing array rather than replacing it. Always read the file first, parse JSON, merge arrays, write back.
3. **Validate JSON after write:** After modifying the settings file, parse it to verify it's valid JSON.
4. **Create backup:** Before modifying, copy the original file to `.claude/settings.json.backup`.
5. **Deduplication:** Before adding a hook, check if an identical hook command already exists in the array (Claude Code deduplicates at runtime, but keeping the file clean prevents confusion).

**Detection:** User reports Claude Code errors after installing a skill; `jq . .claude/settings.json` fails with parse error.

**Which phase should address it:** Hook auto-injection implementation phase.

**Confidence:** HIGH - based on hooks guide showing the JSON structure and the fact that hooks are configured via JSON files

---

## Moderate Pitfalls

Mistakes that cause delays, degraded UX, or technical debt.

---

### Pitfall 14: Tenant Isolation in R2/Object Storage

**What goes wrong:** The current skill storage uses R2 with object keys like `skills/{skillId}/v{version}/content.md`. In multi-tenant mode, if two tenants have skills with the same ID (UUIDs make this unlikely but not impossible with forks), they could collide. More importantly, the R2 presigned URLs generated by `generateUploadUrl` are not tenant-scoped, meaning a malicious user could potentially access another tenant's skill content by guessing object keys.

**Prevention:**
1. Add tenant prefix to all R2 object keys: `{tenantId}/skills/{skillId}/v{version}/content.md`
2. Validate tenant context before generating presigned URLs
3. Consider per-tenant R2 buckets for strongest isolation (more expensive, harder to manage)

**Which phase should address it:** After schema migration, before skill upload/download flows are used in production.

**Confidence:** MEDIUM - depends on R2 configuration details not fully visible in codebase

---

### Pitfall 15: Admin Role Is Hardcoded to Email List

**What goes wrong:** The `isAdmin` function in `apps/web/lib/admin.ts` reads from `ADMIN_EMAILS` environment variable. In multi-tenant mode, there's no concept of per-tenant admins. Either everyone in the env var is admin of ALL tenants, or the admin system doesn't work at all.

**Prevention:**
1. Add a `tenant_memberships` table with columns: `userId`, `tenantId`, `role` (admin/member)
2. Replace `isAdmin(email)` with `isTenantAdmin(userId, tenantId)` that checks the membership table
3. Keep a super-admin concept (cross-tenant admin) for platform operations, separate from tenant admins

**Which phase should address it:** Multi-tenancy schema phase (requires the tenants and memberships tables).

**Confidence:** HIGH - verified by reading `apps/web/lib/admin.ts`

---

### Pitfall 16: Middleware Performance with Subdomain Resolution on Every Request

**What goes wrong:** The current middleware in `apps/web/middleware.ts` does auth checking on every request. Adding subdomain extraction + database lookup to resolve tenant on every request adds latency and database load.

**Prevention:**
1. **Do NOT query the database in middleware.** Middleware runs on the Edge Runtime (in Vercel) or on every request. Database queries in middleware = a query per page load.
2. **Resolve tenant from subdomain using an in-memory cache** (or hardcoded tenant registry for small numbers of tenants).
3. **Store tenantId in the JWT token** at login time. Then middleware only needs to parse the JWT, not query the database.
4. Alternative: Use a Redis cache for tenant lookups with short TTL.

**Which phase should address it:** Subdomain routing implementation phase.

**Confidence:** HIGH - the current middleware already has auth but no DB queries, adding them would be a regression

---

### Pitfall 17: Docker Build Includes .env Secrets in Image Layers

**What goes wrong:** If `.env` is not in `.dockerignore`, secrets like `DATABASE_URL`, `GOOGLE_CLIENT_SECRET`, `R2_SECRET_ACCESS_KEY` end up in Docker image layers. Anyone with access to the image can extract them.

**Prevention:**
1. Add `.env*` to `.dockerignore`
2. Use Docker build args for build-time config and runtime environment variables for runtime config
3. For production: use Docker secrets or a mounted `.env` file via docker-compose `env_file:` directive (not `COPY . .` in Dockerfile)
4. Never use `ARG` for secrets that shouldn't be in image layers - `ARG` values are visible in image history
5. Use multi-stage builds: build in one stage, copy only the output to a clean stage

**Which phase should address it:** Infrastructure/deployment phase.

**Confidence:** HIGH - standard Docker security practice

---

### Pitfall 18: Drizzle Schema Changes Not Matching Migration Output

**What goes wrong:** Drizzle Kit's `generate` command compares the current schema files to the last snapshot. If you modify schema files and forget to run `drizzle-kit generate`, the application code expects columns that don't exist in the database. Conversely, if you hand-edit migration SQL (needed for multi-step tenant_id addition) but forget to update the schema snapshot, future migrations may try to re-add existing columns.

**Prevention:**
1. After any custom migration edits, run `drizzle-kit check` to verify schema consistency
2. Always test migrations against a copy of the production database, not just a fresh database
3. Keep the migration workflow strict: modify schema -> generate -> edit SQL if needed -> apply -> verify
4. For the tenant_id addition specifically: modify ALL schema files first, then generate ONE migration, then split the generated SQL into multiple steps

**Which phase should address it:** Schema migration phase.

**Confidence:** HIGH - Drizzle [migration docs](https://orm.drizzle.team/docs/migrations) confirm the snapshot-based approach

---

### Pitfall 19: Hook PostToolUse Event Timing for MCP Tool Tracking

**What goes wrong:** Claude Code hooks fire on specific events. For tracking MCP tool usage, you'd want `PostToolUse` with a matcher like `mcp__relay-skills__.*`. However, the hook receives `tool_input` (what was sent to the tool) but may not reliably receive the full `tool_output` (what the tool returned). If the hook script needs to know whether the tool call succeeded or what skill was used, the input alone may be insufficient.

**Why it happens:** PostToolUse fires after a successful tool call. PostToolUseFailure fires after a failure. The input data includes `tool_input` and `tool_name` but the output may be truncated or absent in the hook's stdin payload.

**Prevention:**
1. Design the tracking hook to work with `tool_input` only (skill name, search query, etc.) - don't depend on `tool_output`
2. Use `PostToolUse` for success tracking and `PostToolUseFailure` for failure tracking
3. Match specifically: `"matcher": "mcp__relay-skills__.*"` to only fire on Relay MCP tools
4. Log the `session_id` from the hook input for correlation with server-side MCP logs

**Which phase should address it:** Hook implementation phase.

**Confidence:** HIGH - verified from [hooks documentation](https://code.claude.com/docs/en/hooks-guide) that PostToolUse receives tool_input in JSON on stdin

---

## Minor Pitfalls

Mistakes that cause annoyance or minor issues but are fixable.

---

### Pitfall 20: Docker Compose Service Naming Conflicts

**What goes wrong:** Using generic service names like `db` or `web` in docker-compose.yml conflicts with other projects running on the same host. Docker creates containers and networks with these names, and two projects using `db` as a service name can cause confusion.

**Prevention:** Use project-specific service names: `relay-db`, `relay-web`, `relay-nginx`. Or use the `COMPOSE_PROJECT_NAME` environment variable to namespace.

**Which phase should address it:** Infrastructure/deployment phase.

**Confidence:** HIGH

---

### Pitfall 21: Forgetting to Set `output: 'standalone'` in next.config

**What goes wrong:** Without `output: 'standalone'`, the Docker image includes the entire `node_modules` directory, making the image 1-2GB instead of ~200MB. This slows deployment, increases storage costs, and increases cold start times.

**Prevention:** Add `output: 'standalone'` to `next.config.ts`. Verify the Docker image size after build.

**Which phase should address it:** Infrastructure/deployment phase.

**Confidence:** HIGH - documented in Next.js [deployment docs](https://nextjs.org/docs/app/building-your-application/deploying)

---

### Pitfall 22: Embedding Dimensions Mismatch Between Tenants

**What goes wrong:** The current `site_settings` stores `embeddingDimensions` as a global setting. If different tenants configure different embedding models with different dimensions, the `skill_embeddings` pgvector column dimension must accommodate all of them, or each tenant needs separate embedding configuration.

**Prevention:** Standardize embedding dimensions across all tenants (enforce a single model), or scope the embedding configuration per tenant and validate dimensions on insert.

**Which phase should address it:** After site_settings becomes per-tenant.

**Confidence:** MEDIUM

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema migration (add tenantId) | Table locks on large tables during ALTER | Use nullable column + backfill + constraint strategy (Pitfall 10) |
| Schema migration (add tenantId) | Slug uniqueness breaks | Composite unique constraint `(tenant_id, slug)` (Pitfall 6) |
| Schema migration (add tenantId) | Site settings shared across tenants | Convert to per-tenant settings (Pitfall 7) |
| Auth/OAuth configuration | Google OAuth redirect_uri_mismatch | Single shared auth endpoint + state parameter (Pitfall 3) |
| Auth/OAuth configuration | Cross-subdomain cookie failures | Explicit cookie domain configuration (Pitfall 4) |
| Subdomain routing | Cannot test locally | Use /etc/hosts entries + configurable base domain (Pitfall 11) |
| Query tenant-scoping | Data leakage in analytics queries | Replace domain-matching with tenantId filtering (Pitfall 2) |
| Query tenant-scoping | Missed WHERE clauses | Tenant-scoped query helper + integration tests (Pitfall 1) |
| MCP server multi-tenancy | API key doesn't return tenant context | Add tenantId to validateApiKey return (Pitfall 5) |
| Docker Compose setup | PostgreSQL exposed to internet | Internal-only Docker network (Pitfall 9) |
| Docker Compose setup | Secrets in image layers | .dockerignore + runtime env vars (Pitfall 17) |
| SSL/TLS setup | Wildcard cert requires DNS challenge | DNS-01 with provider API plugin (Pitfall 8) |
| Hook tracking | Lost events on network failure | Write-ahead log + batch flush (Pitfall 12) |
| Hook auto-injection | Overwriting user settings | Project-level hooks + merge logic (Pitfall 13) |
| Admin system | Global admin, not per-tenant | Membership table with roles (Pitfall 15) |

---

## Sources

### Codebase Audit (PRIMARY)
- Direct reading of all schema files, service files, server actions, analytics queries, auth configuration, middleware, MCP server code, and tracking modules in the Relay codebase

### External Sources (VERIFIED)
- [Auth.js dynamic NEXTAUTH_URL discussion](https://github.com/nextauthjs/next-auth/discussions/9785) - Multi-tenant auth configuration
- [Auth.js subdomain behavior issue](https://github.com/nextauthjs/next-auth/issues/10915) - Cookie changes in v5
- [Auth.js subdomain proxy CSRF issue](https://github.com/nextauthjs/next-auth/issues/12225) - InvalidCheckError with subdomains
- [Google OAuth redirect URI docs](https://developers.google.com/identity/protocols/oauth2/web-server) - Exact-match requirement
- [Claude Code hooks guide](https://code.claude.com/docs/en/hooks-guide) - Hook lifecycle, events, failure modes
- [Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/) - DNS-01 requirement for wildcards
- [Drizzle ORM migrations docs](https://orm.drizzle.team/docs/migrations) - Migration workflow
- [Drizzle ORM custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations) - Custom SQL in migrations
- [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant) - Official multi-tenant patterns
- [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) - Standalone output
- [PostgreSQL RLS guide (AWS)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) - RLS vs application-level filtering
- [Multi-tenant security (Qrvey)](https://qrvey.com/blog/multi-tenant-security/) - General multi-tenant security patterns
- [Multi-tenant risks (Clerk)](https://clerk.com/blog/what-are-the-risks-and-challenges-of-multi-tenancy) - Common challenges
