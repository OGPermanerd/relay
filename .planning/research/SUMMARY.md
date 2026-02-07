# Research Summary: Relay v1.5 Multi-Tenant Production SaaS

**Project:** Relay Internal Skill Marketplace
**Domain:** Multi-tenant SaaS conversion with production deployment, deterministic usage tracking, and SOC2 compliance
**Researched:** 2026-02-07
**Confidence:** HIGH (official documentation verified, codebase audited, compliance requirements confirmed)

## Executive Summary

Relay v1.5 transforms a single-tenant skill marketplace into a production-ready multi-tenant SaaS platform. Research confirms three critical architectural requirements: (1) row-level tenant isolation via `tenant_id` columns with PostgreSQL RLS, (2) Docker Compose production deployment with Caddy reverse proxy for automatic HTTPS and wildcard subdomain routing, and (3) deterministic usage tracking via Claude Code hooks embedded in skill frontmatter that fire HTTP callbacks on every tool invocation.

The existing Next.js 16.1.6 + Drizzle ORM + PostgreSQL architecture is well-suited for this transformation with zero new npm dependencies required for multi-tenancy. However, the conversion carries significant risk: 30+ query files currently operate without tenant context, creating a massive data leakage surface. The critical path is database schema migration first (add tenant_id to all tables), followed by query audit and tenant-scoping, before any tenant-visible features ship. The research identifies 22 specific pitfalls, with 7 classified as critical (causing data leakage or security breaches).

SOC2 compliance requirements are achievable with the planned architecture: RLS provides database-enforced tenant isolation, append-only audit logging captures security events, LUKS volume encryption satisfies encryption-at-rest requirements, and Auth.js JWT sessions configured with 8-hour timeouts meet session management requirements. The most impactful SOC2 gap is lack of audit logging (no audit_logs table exists), which must be addressed in the first multi-tenancy phase.

## Key Findings

### Stack Additions (from STACK.md)

The existing stack (Next.js 16.1.6, PostgreSQL, Drizzle ORM ^0.38.0, Auth.js 5.0.0-beta.30) requires ZERO new npm dependencies for multi-tenancy. All additions are infrastructure-level.

**Production deployment stack:**
- **Docker Compose v2** — 3-service orchestration (Caddy, Next.js web, PostgreSQL) on single Hetzner VPS
- **Caddy 2.10-alpine** — Reverse proxy with automatic HTTPS (Let's Encrypt or Tailscale), wildcard subdomain routing in ~20 lines of config. Chosen over Nginx (requires certbot sidecar) and Traefik (Docker labels complexity).
- **PostgreSQL + pgvector (pg17)** — Upgrade from postgres:16-alpine to pgvector/pgvector:pg17 Docker image (bundles pgvector 0.8.x pre-compiled)
- **Node.js 22-alpine** — Matches monorepo requirements, Alpine cuts image from ~1GB to ~150MB
- **Turbo prune** — `turbo prune web --docker` for monorepo Docker layer optimization

**Multi-tenancy implementation:**
- **Row-level tenant_id column** — Application-level `WHERE tenant_id = ?` on every query. PostgreSQL RLS policies for defense-in-depth. Drizzle ORM ^0.38.0 has native RLS support.
- **Next.js middleware** — Subdomain extraction from Host header, tenant resolution (cached), tenantId propagation
- **Auth.js per-tenant domain mapping** — `signIn` callback validates email domain against tenant's `allowedDomain`

**Hook-based tracking:**
- **Claude Code PostToolUse hooks** — Configured in skill YAML frontmatter, fire shell commands on tool events
- **curl for HTTP callbacks** — Hook commands POST to `/api/track` with API key auth
- **Async mode** — `"async": true` ensures hooks never block Claude Code operation

**Critical version decisions:**
- Next.js: Add `output: "standalone"` + `outputFileTracingRoot` to config (no version change)
- Drizzle ORM: No change needed (^0.38.0 supports RLS via `pgPolicy`)
- PostgreSQL: Upgrade postgres:16-alpine → pgvector/pgvector:pg17

### Expected Features (from FEATURES.md)

**Table stakes (must ship in v1.5):**
1. **Tenant isolation** — tenant_id on all data tables, scoped queries, tenant table with slug/domain mapping
2. **Subdomain routing** — `acme.relay.example.com` extracts tenant from Host header, middleware resolves tenant
3. **Domain-based SSO mapping** — Email domain → tenant lookup in Auth.js signIn callback
4. **Deterministic usage tracking** — PostToolUse hooks in skill frontmatter fire HTTP callbacks with skill_id, session_id, tool_name
5. **Hook auto-injection** — `deploy_skill` tool injects tracking hooks into skill YAML frontmatter automatically
6. **Tracking API endpoint** — `POST /api/track` validates API key, records usage events with tenant_id
7. **Tenant admin panel** — Admin-only settings page for tenant config (name, domains), user management
8. **Docker Compose production deployment** — Single-command deployment with PostgreSQL + Next.js + Caddy, persistent volumes, health checks

**Differentiators (defer to post-v1.5):**
- Compliance skill (standalone tracker for global session heartbeats)
- Cross-tenant skill marketplace (shared/public skills)
- Tenant onboarding wizard (self-service tenant creation)
- Zero-downtime deployments (rolling updates)

**Anti-features (explicitly avoid):**
- PostgreSQL RLS as the ONLY isolation layer (use RLS + application-level for defense-in-depth)
- Separate database per tenant (overkill for <50 tenants)
- Blocking hooks (non-async tracking) — would freeze Claude sessions on endpoint failures
- Global user-level hooks via ~/.claude/settings.json (invasive, affects all projects)
- Mandatory hook compliance (users can edit local files; soft enforcement only)
- Storing raw hook payloads (tool_input/tool_response contain sensitive code)

### Architecture Highlights (from ARCHITECTURE.md)

**Core components:**
1. **Multi-tenant middleware** — Extracts subdomain → resolves tenant → sets tenantId context → scopes all downstream queries
2. **Tenant-scoped service layer** — All Drizzle queries wrapped with automatic `WHERE tenantId = ?` enforcement
3. **Skill deployment with hooks** — `deploy_skill` MCP tool returns skill content with PostToolUse/SessionStart hooks pre-injected in frontmatter
4. **Hook callback receiver** — `/api/track` API route validates API key, resolves userId + tenantId, inserts usage_events
5. **Tenant admin system** — Role-based access (admin/member), tenant settings management, user provisioning

**Key integration points:**
- Caddy terminates TLS, routes `*.relay.example.com` → Next.js container on internal Docker network
- PostgreSQL exposed only within Docker network (no host port mapping)
- Auth.js cookies set with `domain: '.relay.example.com'` for cross-subdomain sharing
- API keys scoped to tenantId, validation returns `{ userId, tenantId, keyId }`
- MCP auth resolves userId from `EVERYSKILL_API_KEY` env var, caches tenantId for session

**Data flow for tracking:**
```
Claude Code skill execution
  → PostToolUse hook fires (async)
  → curl POSTs to /api/track with API key header
  → API route validates key → resolves userId + tenantId
  → Insert usage_events with (userId, tenantId, skillId, toolName, sessionId)
  → Return 200 OK (fire-and-forget)
```

### Critical Pitfalls (from PITFALLS.md)

**Top 7 pitfalls that cause data leakage or security breaches:**

1. **Cross-tenant data leakage via missing WHERE clauses** — Relay has 30+ files with direct database queries. A single missed `WHERE tenantId = ?` leaks Tenant A's data to Tenant B. Mitigation: (1) Add tenant_id to ALL tables in one migration, (2) Create tenant-scoped query helper with automatic filtering, (3) Write integration tests for every query function with 2 tenants, (4) Audit script to grep all db.select/execute/query calls.

2. **Analytics domain-matching logic becomes tenant leak vector** — Current analytics uses `u.email LIKE '%@' || domain` pattern. This breaks with multi-tenancy (personal emails match across tenants, multi-domain companies incomplete). Mitigation: Replace ALL 6 analytics queries' domain-matching with explicit `tenantId` filtering in the same phase as schema migration.

3. **Google OAuth does not support wildcard redirect URIs** — `*.relay.example.com/api/auth/callback/google` is NOT supported. Mitigation: Single shared auth endpoint (apex domain or `auth.relay.example.com`), store originating subdomain in OAuth `state` parameter, redirect back to tenant subdomain after auth, set Auth.js cookies with `domain: '.relay.example.com'`.

4. **Auth.js subdomain cookie isolation / CSRF failures** — Session cookies scoped to one subdomain don't work on others. CSRF tokens fail across subdomains. Mitigation: Explicitly configure Auth.js cookies with `domain: '.relay.example.com'`, test auth flow from EACH subdomain, be aware `__Host-` prefixed cookies cannot have domain set.

5. **MCP server API key must return tenant context** — Current `validateApiKey` returns `{ userId, keyId }` only. MCP has no way to know tenant, so search/deploy/usage operate without tenant scoping. Mitigation: Add `tenantId` to api_keys table, modify validateApiKey to return `{ userId, keyId, tenantId }`, pass tenantId to every MCP tool handler.

6. **Slug uniqueness constraint breaks under multi-tenancy** — Global `UNIQUE(slug)` means Tenant A's "code-review" prevents Tenant B from using the same slug. Mitigation: Drop existing unique index, add `UNIQUE(tenant_id, slug)` composite constraint, update generateUniqueSlug to check collisions only within tenant.

7. **Site settings singleton becomes shared mutation point** — Current `site_settings` table uses `id: "default"` singleton. All tenants would read/write the same row. Mitigation: Change primary key from singleton to `tenantId`, each tenant gets own settings row, update getSiteSettings/updateSiteSettings to take tenantId parameter.

**Major pitfalls (cause significant delays or outages):**
- Wildcard SSL requires DNS-01 challenge (HTTP-01 doesn't support wildcards) — use Certbot with DNS provider plugin
- Docker Compose exposes PostgreSQL to internet — NEVER use `ports: "5432:5432"`, use internal Docker networks only
- Database migration downtime for adding tenant_id — use multi-step strategy: add as nullable, backfill, add NOT NULL constraint
- Middleware subdomain extraction fails on localhost — use /etc/hosts entries or `.localhost` TLD for dev
- Claude Code hooks are fire-and-forget with no retry — implement write-ahead log pattern for pending events

### SOC2 Compliance Requirements (from SOC2.md)

**Critical SOC2 gaps requiring immediate action:**

1. **Audit logging (CRITICAL)** — No audit_logs table exists. SOC2 requires immutable record of all security events. New table needed with: actorId, tenantId, action, resourceType, resourceId, ipAddress, metadata, previousState, newState, outcome, errorMessage, createdAt. Must be append-only (REVOKE UPDATE, DELETE).

2. **Encryption at rest (CRITICAL)** — PostgreSQL data files unencrypted. Mitigation: LUKS full-disk encryption on Hetzner VPS for Docker volumes. Simpler and more comprehensive than column-level pgcrypto.

3. **Session timeout too long (CRITICAL)** — Auth.js default is 30 days. SOC2 requires 8-24 hours. Mitigation: Configure `session.maxAge: 8 * 60 * 60` (8 hours), implement client-side idle timeout (30 minutes).

4. **API key rotation policy missing (CRITICAL)** — Keys never expire. SOC2 requires documented rotation. Mitigation: Default 90-day expiration, max 365-day lifetime, rotation notification at 14 days before expiry, emergency revocation capability.

5. **Tenant data isolation not database-enforced (HIGH)** — Application-level WHERE clauses only. Mitigation: Add PostgreSQL RLS policies on all tenant-scoped tables with `USING (tenant_id = current_setting('app.tenant_id'))`. Drizzle ORM supports this via `pgPolicy`.

**Acceptable current implementations:**
- API key storage (SHA-256 hashed, timing-safe comparison) — already SOC2-compliant
- Google SSO authentication — acceptable with MFA delegated to Google Workspace
- TLS in transit — will be satisfied by Caddy automatic HTTPS

**Required capabilities for SOC2:**
- Backup strategy: Hourly incremental + daily full, 90-day retention, off-site storage (Hetzner Storage Box), quarterly restore testing
- Tenant offboarding: Complete data purge with 30-day grace period, cascade delete, audit log of deletion (audit logs NOT deleted)
- Monitoring: Failed login tracking, cross-tenant access detection, API key abuse alerts, system availability monitoring
- Data retention policy: Audit logs 13 months minimum, usage events 24 months, skills until tenant deletion

## Implications for Roadmap

Based on research, the critical path is **schema migration first** (tenant_id must be on all tables before any features), followed by **query audit and tenant-scoping** (fix all 30+ query files), followed by **auth configuration** (subdomain routing + OAuth), and only then can **tenant-visible features** ship.

### Suggested Phase Structure

#### Phase 1: Multi-Tenancy Foundation (CRITICAL PATH)
**Rationale:** Everything else depends on tenant isolation being database-enforced and query-scoped. This phase must complete before ANY tenant-visible features.

**Delivers:**
- `tenants` table (id, name, slug, domain, isActive, createdAt, updatedAt)
- `tenant_id` column on all data tables (skills, usage_events, ratings, skill_versions, skill_embeddings, skill_reviews, api_keys, site_settings, users)
- Composite unique constraints: `UNIQUE(tenant_id, slug)` on skills
- PostgreSQL RLS policies on all tenant-scoped tables
- Tenant-scoped query helper wrapping Drizzle with automatic `WHERE tenantId = ?`
- Migration strategy: add nullable column → backfill → add NOT NULL → indexes → composite constraints
- Integration tests verifying cross-tenant isolation (2 tenants with identical data)
- Audit script: grep all db.select/execute/query, verify all have tenantId filter
- `audit_logs` table (append-only, no RLS, tracks all security events)

**Addresses pitfalls:** #1 (cross-tenant leakage), #6 (slug uniqueness), #7 (site settings singleton), #10 (migration downtime)

**Addresses SOC2:** Tenant isolation, audit logging foundation

**Research flag:** Standard pattern, no additional research needed.

---

#### Phase 2: Authentication and Subdomain Routing
**Rationale:** Auth must work across subdomains before tenant-specific features are usable. Depends on Phase 1 (tenantId in JWT).

**Delivers:**
- Middleware subdomain extraction from Host header (with localhost dev support)
- Tenant resolution by subdomain slug (cached in-memory, TTL-based)
- Auth.js cookie configuration: `domain: '.relay.example.com'` for all auth cookies
- Single shared auth endpoint for Google OAuth (apex domain or auth subdomain)
- OAuth `state` parameter stores originating tenant subdomain
- Post-auth redirect back to tenant subdomain
- `signIn` callback: email domain → tenant lookup, validate `allowedDomain`, reject if no match
- JWT includes tenantId: `jwt({ token, user }) { token.tenantId = user.tenantId }`
- Session timeout: 8-hour maxAge (down from 30 days)
- Middleware exemptions: `/api/auth/*`, `/api/validate-key`, `/api/track`, `/api/install-callback`

**Addresses pitfalls:** #3 (OAuth wildcard URIs), #4 (subdomain cookies), #11 (localhost testing)

**Addresses SOC2:** Session timeout, per-tenant domain mapping

**Research flag:** Standard multi-tenant auth pattern, extensive documentation available. Low research needs.

---

#### Phase 3: Production Docker Deployment
**Rationale:** Infrastructure can be developed in parallel with Phases 1-2, then integrated. No dependencies on multi-tenancy schema.

**Delivers:**
- Dockerfile for Next.js (multi-stage: pruner → installer → builder → runner using Node 22-alpine)
- `next.config.ts` additions: `output: "standalone"`, `outputFileTracingRoot: path.join(__dirname, "../../")`
- docker-compose.yml with 3 services: caddy (reverse proxy), web (Next.js), postgres (pgvector/pg17)
- Caddyfile for wildcard subdomain routing: `*.{$BASE_DOMAIN}` reverse_proxy to web:2000
- TLS automation via Caddy (Let's Encrypt DNS-01 challenge with Cloudflare plugin, or Tailscale auto-certs)
- Internal Docker network: postgres accessible only within network (no host port mapping)
- Named volumes: postgres_data, caddy_data, caddy_config
- Health checks: postgres (pg_isready), web (/api/health), caddy (depends_on with conditions)
- .env template with all configuration variables
- LUKS volume encryption on Hetzner VPS for /var/lib/docker/volumes
- Backup script: hourly pg_dump → gzip → gpg encrypt → rclone to Hetzner Storage Box

**Addresses pitfalls:** #8 (wildcard SSL DNS challenge), #9 (PostgreSQL exposed), #17 (secrets in Docker layers), #21 (standalone output)

**Addresses SOC2:** TLS everywhere, encryption at rest (LUKS), backup strategy, off-site storage

**Research flag:** Standard Docker Compose pattern, Caddy official docs comprehensive. Low research needs.

---

#### Phase 4: Hook-Based Usage Tracking
**Rationale:** Depends on Phase 2 (API key with tenantId), but can develop in parallel with Phase 3.

**Delivers:**
- API route: `POST /api/track` (unauthenticated in middleware, uses Bearer token auth)
- Zod schema for event payload: `{ session_id, skill_id, tool_name, event_type, timestamp }`
- API key validation with tenant context: `validateApiKey` returns `{ userId, keyId, tenantId }`
- Rate limiting: 100 requests/minute per API key
- Payload signature verification: HMAC-SHA256 with shared secret
- Timestamp validation: reject callbacks older than 5 minutes (replay prevention)
- Insert usage_events with (userId, tenantId, skillId, toolName, sessionId, metadata, createdAt)
- Hook frontmatter template for PostToolUse: async curl to /api/track with API key
- Hook frontmatter template for SessionStart: once-per-session heartbeat with `once: true`
- Modify `deploy_skill` tool to inject hooks into YAML frontmatter with tenant tracking URL
- Hook resilience pattern: write-ahead log (~/.relay/pending-events.jsonl) + batch flush on SessionStart
- Audit logging: log hook callback received, validation failures, rate limit hits

**Addresses pitfalls:** #12 (hooks fire-and-forget), #19 (PostToolUse timing)

**Addresses SOC2:** Hook callback TLS required, API key auth, payload signing, data minimization, audit logging

**Research flag:** Claude Code hooks extensively documented (official docs verified). Low research needs.

---

#### Phase 5: Tenant Admin System and Analytics
**Rationale:** Depends on all previous phases (tenant schema, auth, tracking). Final integration phase.

**Delivers:**
- `tenant_memberships` table: (userId, tenantId, role: 'admin' | 'member', createdAt)
- Replace `isAdmin(email)` with `isTenantAdmin(userId, tenantId)` checking memberships table
- Tenant admin panel: `/settings/tenant` (admin-only route)
- Tenant settings CRUD: update name, domains, logo, isActive
- User management: list users in tenant, view roles, remove users
- Replace 6 analytics queries' domain-matching with tenantId filtering
- Tenant-scoped analytics dashboard: org-level stats filtered by session.user.tenantId
- Per-employee analytics: aggregate usage_events by userId within tenant
- Skill analytics: usage by tenant members only
- Audit logging: tenant settings changes, user role changes, admin actions

**Addresses pitfalls:** #2 (analytics domain-matching), #15 (hardcoded admin list)

**Addresses SOC2:** Role-based access control, audit logging of admin actions, data access controls

**Research flag:** Standard multi-tenant admin patterns. Low research needs.

---

### Phase Ordering Rationale

1. **Schema first** — Tenant_id must exist on all tables before any code references it. Attempting to build subdomain routing or admin panels before the schema is migrated guarantees data leakage bugs.

2. **Auth before features** — Users cannot log in to tenant subdomains until OAuth and cookies are configured. Shipping subdomain routing without fixing auth locks everyone out.

3. **Infrastructure parallel track** — Docker deployment has zero dependencies on multi-tenancy. Can be developed and tested in parallel, then integrated once schema and auth are ready.

4. **Tracking after API keys scoped** — Hook callbacks require API keys to return tenantId. This depends on schema migration (Phase 1) and auth (Phase 2).

5. **Admin last** — Admin panel consumes all previous work. It's the integration point that proves multi-tenancy works end-to-end.

### Research Flags

**Phases with standard patterns (skip /gsd:research-phase):**
- Phase 1: Multi-tenancy schema — row-level isolation is extensively documented
- Phase 2: Auth + subdomain — Next.js multi-tenant guide is comprehensive
- Phase 3: Docker deployment — Caddy + Docker Compose is standard pattern
- Phase 5: Admin system — RBAC patterns are well-established

**Phases that MAY need research during execution:**
- Phase 4: Hook-based tracking — IF Claude Code hooks documentation is insufficient, may need to research hook reliability patterns. However, official docs are comprehensive, so research likely unnecessary.

**Overall:** No phases require `/gsd:research-phase` during planning. All patterns are well-documented and verified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack additions | HIGH | Zero new npm dependencies. Docker Compose + Caddy are mature. Verified via official docs. |
| Multi-tenancy architecture | HIGH | Row-level isolation + RLS is industry standard. Drizzle ORM RLS support confirmed. |
| Hook-based tracking | HIGH | Claude Code hooks official documentation is comprehensive. PostToolUse schema verified. |
| Production deployment | HIGH | Docker standalone + Caddy wildcard SSL are documented patterns. Hetzner is straightforward VPS. |
| SOC2 compliance | MEDIUM-HIGH | Requirements well-documented. Implementation specifics are Relay-specific but patterns are standard. |
| Analytics migration | HIGH | Direct audit of 6 analytics query functions. Domain-matching logic identified, fix is straightforward. |
| Pitfalls | HIGH | 30+ query files audited. Auth.js subdomain issues confirmed via GitHub issues. Google OAuth constraints verified. |

**Overall confidence:** HIGH — Research is thorough, sources are authoritative, implementation patterns are proven.

### Gaps to Address During Execution

1. **Drizzle RLS syntax** — Drizzle ORM documentation shows `pgPolicy` API, but edge cases with transactions and session variables need validation during Phase 1 implementation. Test extensively.

2. **Caddy wildcard cert for Tailscale** — Tailscale .ts.net domains do NOT support wildcard certs (GitHub issue #7081 confirmed). If using Tailscale, each subdomain gets individual cert on first request (~2s delay). For <50 tenants this is acceptable, but document the limitation.

3. **Hook reliability at scale** — Write-ahead log pattern for hook callbacks is recommended but untested at scale. Monitor hook failure rates in production and adjust retry strategy if needed.

4. **LUKS key management** — Hetzner Rescue mode for LUKS key provisioning is operational risk. Document key custodians and emergency recovery procedure during Phase 3.

5. **Migration downtime window** — Multi-step tenant_id addition (nullable → backfill → NOT NULL → indexes) should be tested against production-sized dataset to estimate downtime. If >5 minutes, consider maintenance window.

## Open Questions Requiring Decisions

1. **Deployment domain choice:**
   - Option A: Public domain with wildcard cert (relay.company.com) — requires Cloudflare DNS + Caddy custom build with DNS plugin
   - Option B: Tailscale-only (relay.ts.net) — simpler but no wildcard cert, per-subdomain provisioning
   - **Recommendation:** Option A if custom domain available (cleaner tenant URLs). Option B only if Tailscale-only access is required.

2. **Default tenant for existing data:**
   - How to name the tenant that existing v1.4 data belongs to? "default", "acme", or organization name?
   - **Recommendation:** Use actual organization name if known, or prompt during migration.

3. **Hook auto-injection scope:**
   - Should hooks be injected into ALL skills on deploy, or only new skills after v1.5?
   - What if a skill already has custom hooks in its frontmatter?
   - **Recommendation:** Inject into all skills, merge with existing hooks (array append), deduplicate.

4. **Tenant admin first user:**
   - When a new tenant is created, who becomes the first admin? The user who signs in with matching email domain?
   - **Recommendation:** First user with matching email domain auto-provisioned as admin. Document this as tenant bootstrap behavior.

5. **Cross-tenant skills (future):**
   - Should some skills be marked "public" and visible across all tenants (like a community marketplace)?
   - **Decision:** Defer to post-v1.5. All skills are private to their tenant in v1.5.

6. **Backup encryption recipient:**
   - GPG backup encryption requires a recipient key. Who should be the key custodian?
   - **Recommendation:** Create dedicated backup@company.com GPG key pair, store private key in secure location (password manager or hardware token), document in runbook.

## Sources

### Primary Sources (HIGH confidence)
- **STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SOC2.md** — Parallel researcher agent outputs, 2026-02-07
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — Complete hook lifecycle, PostToolUse schema, skill frontmatter hooks
- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https) — TLS automation, wildcard cert requirements
- [Caddy Common Patterns](https://caddyserver.com/docs/caddyfile/patterns) — Wildcard subdomain Caddyfile
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) — Official subdomain middleware pattern
- [Drizzle ORM RLS Docs](https://orm.drizzle.team/docs/rls) — pgPolicy API, RLS support
- [PostgreSQL RLS Guide](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) — Row-level security patterns
- [Auth.js v5 Documentation](https://authjs.dev/getting-started) — Session management, cookie configuration
- [Let's Encrypt Challenge Types](https://letsencrypt.org/docs/challenge-types/) — DNS-01 requirement for wildcards

### Secondary Sources (MEDIUM confidence)
- [Google OAuth redirect URI docs](https://developers.google.com/identity/protocols/oauth2/web-server) — Exact-match requirement confirmed
- [Auth.js GitHub issues](https://github.com/nextauthjs/next-auth/discussions/9785) — Multi-tenant subdomain patterns
- [Tailscale wildcard cert issue](https://github.com/tailscale/tailscale/issues/7081) — No wildcard .ts.net support
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker) — turbo prune --docker flag
- [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying) — Standalone output mode

### Codebase Audit (PRIMARY)
- Direct reading of 30+ query files in apps/web/lib/, packages/db/src/services/, apps/mcp/src/
- Schema files: skills.ts, usage-events.ts, site-settings.ts, api-keys.ts
- Auth configuration: auth.ts, auth.config.ts, middleware.ts
- MCP server: apps/mcp/src/index.ts, apps/mcp/src/auth.ts, apps/mcp/src/tracking/events.ts
- Analytics queries: analytics-queries.ts (6 functions with domain-matching logic)

---

**Research completed:** 2026-02-07
**Ready for roadmap:** Yes
**Estimated LOC impact:** ~2,500 lines (schema migrations, query updates, Docker configs, auth changes, hook injection)
**Risk level:** HIGH (data leakage risk during transition) — mitigated by phase ordering and testing strategy
