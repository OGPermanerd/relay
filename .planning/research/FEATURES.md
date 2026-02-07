# Feature Landscape: Multi-Tenancy, Reliable Usage Tracking, Production Deployment

**Domain:** Internal skill marketplace -- multi-tenant SaaS, deterministic usage tracking via Claude Code hooks, production infrastructure
**Researched:** 2026-02-07
**Confidence:** HIGH for multi-tenancy patterns, HIGH for Claude Code hooks (verified official docs), MEDIUM for production deployment specifics

## Context

Relay is an internal skill marketplace at v1.4. The current system is single-tenant with honor-system usage tracking (`log_skill_usage` MCP tool that Claude sometimes forgets to call). v1.5 adds three capabilities:

1. **Multi-tenancy** -- Subdomain routing (tenant1.relay.example.com), tenant isolation across all tables, domain-based SSO mapping
2. **Reliable usage tracking** -- Replace honor-system `log_skill_usage` with deterministic Claude Code hooks embedded in skill frontmatter that fire HTTP callbacks on every tool use
3. **Production deployment** -- Docker Compose on Hetzner, Caddy for SSL, health checks, backups

**Existing infrastructure being extended:**
- `usage_events` table with userId column (now populated via API keys, v1.4)
- `api_keys` table with SHA-256 hashing (v1.4)
- Google Workspace SSO (Auth.js v5 with JWT strategy)
- MCP server with stdio + Streamable HTTP dual transport
- Analytics dashboard with org-wide trends (v1.4)
- Skills deployed to `.claude/skills/{slug}.md` with YAML frontmatter embedding `everyskill_skill_id`
- Web remote MCP via `/api/mcp/[transport]` route (v1.4)

---

## Table Stakes

Features users expect. Missing these means the product does not function as a multi-tenant SaaS with reliable tracking.

### 1. Tenant Isolation (tenant_id Across All Tables)

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| `tenant_id` column on all data tables | Data from tenant A must never leak to tenant B | HIGH | Schema migration |
| Scoped queries -- all WHERE clauses include tenant_id | Application-level enforcement of isolation | HIGH | Every service function |
| Tenant-aware session -- session carries tenantId | Auth must know which tenant the user belongs to | MEDIUM | Auth.js session callback |
| Tenant table | Store tenant metadata (name, domain, slug, settings) | LOW | Schema |
| User-to-tenant mapping | users belong to exactly one tenant | LOW | FK on users table |
| Tenant creation/seeding | First tenant bootstrapped from existing data | LOW | Migration script |

**Expected behavior:** Every database table that stores tenant-specific data gets a `tenant_id` column. All Drizzle queries filter by `tenant_id`. The session object carries `tenantId` resolved from the user's email domain. No data crosses tenant boundaries.

**Tables requiring tenant_id:**
- `skills` -- skills belong to a tenant
- `skill_versions` -- versions inherit tenant from skill
- `skill_reviews` -- reviews scoped to tenant
- `skill_embeddings` -- embeddings scoped to tenant
- `ratings` -- ratings scoped to tenant
- `usage_events` -- usage scoped to tenant
- `api_keys` -- keys scoped to tenant (user already scoped)
- `site_settings` -- becomes `tenant_settings` (per-tenant config)

**Tables NOT needing tenant_id:**
- `users` -- users reference a tenant via FK, not a column on every row
- `accounts`, `sessions`, `verification_tokens` -- Auth.js managed tables

**Implementation pattern:** Shared database with tenant_id discriminator column. NOT PostgreSQL Row-Level Security (RLS) -- that adds complexity for marginal benefit at Relay's scale (hundreds of users, not millions). Application-level filtering is simpler to debug and sufficient for an internal tool.

**Confidence:** HIGH -- This is the most common multi-tenancy pattern for shared-database SaaS. Sources: [WorkOS multi-tenant guide](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture), [AWS RLS blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/), [Crunchy Data RLS](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres).

### 2. Subdomain Routing (tenant1.relay.example.com)

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Middleware extracts subdomain from Host header | Route requests to correct tenant | MEDIUM | Next.js middleware |
| Subdomain maps to tenant record | Lookup tenant by slug | LOW | Tenant table |
| Wildcard DNS (*.relay.example.com) | All subdomains resolve to same server | LOW | DNS + Caddy config |
| Wildcard SSL certificate | HTTPS for all subdomains | LOW | Caddy auto-SSL or Let's Encrypt |
| Fallback for bare domain | relay.example.com shows landing/login | LOW | Middleware logic |

**Expected behavior:** Users visit `acme.relay.example.com`. The Next.js middleware extracts `acme` from the Host header, looks up the tenant, and injects `tenantId` into the request context. All subsequent queries scope to that tenant. Users never see data from other tenants.

**Implementation pattern (Next.js middleware):**
```
1. Extract hostname from request
2. Parse subdomain (everything before first dot of known base domain)
3. Look up tenant by subdomain slug
4. If not found: redirect to landing page or 404
5. If found: set tenant context (header, cookie, or rewrite)
6. All server actions/API routes read tenant context
```

**Confidence:** HIGH -- Official Next.js documentation covers this pattern. Source: [Next.js Multi-tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant), [Vercel Platforms starter](https://github.com/vercel/platforms).

### 3. Domain-Based Google SSO Mapping

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Email domain maps to tenant | user@acme.com -> acme tenant | LOW | Tenant table has domain field |
| Multiple domains per tenant | acme.com and acme.io -> same tenant | LOW | Domains array or lookup table |
| SSO domain restriction per tenant | Only acme.com emails can access acme tenant | MEDIUM | Auth.js signIn callback |
| Auto-provision user on first login | New user auto-assigned to correct tenant | LOW | Auth.js callback |

**Expected behavior:** When a user signs in via Google Workspace SSO, their email domain (e.g., `acme.com`) maps to a tenant. If the tenant's allowed domains include `acme.com`, the user is provisioned and assigned to that tenant. If no tenant matches, access is denied.

**Current state:** Auth.js already restricts by domain via `hd` (hosted domain) parameter in Google provider config. This needs to become dynamic -- look up allowed domains from tenant config instead of hardcoded.

**Confidence:** HIGH -- Standard pattern for B2B SaaS with Google Workspace SSO.

### 4. Deterministic Usage Tracking via Claude Code Hooks

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| PostToolUse hook in deployed skills | Fires automatically after every tool use -- no LLM cooperation needed | HIGH | Claude Code hooks system |
| Hook calls tracking endpoint via curl/HTTP | Phone-home on each tool invocation | MEDIUM | Tracking API endpoint |
| SessionStart hook for heartbeat | Register session start with relay server | MEDIUM | Tracking API endpoint |
| Tracking endpoint (POST /api/track) | Receives hook callbacks, records events | MEDIUM | API route + auth |
| Auto-injection of hooks into skill frontmatter on deploy | Skills get tracking hooks without uploader effort | HIGH | deploy_skill tool modification |

**This is the core innovation of v1.5.** The current `log_skill_usage` MCP tool is honor-system -- Claude must remember to call it after using a skill. It frequently does not. Claude Code hooks solve this by firing shell commands automatically on tool events, independent of LLM behavior.

**How Claude Code hooks work (verified from official docs at [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)):**

1. **Hook events:** `SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, etc.
2. **Configuration locations:**
   - `~/.claude/settings.json` -- global (all projects)
   - `.claude/settings.json` -- project-specific (committable)
   - `.claude/settings.local.json` -- project-specific (gitignored)
   - **Skill/agent YAML frontmatter** -- scoped to component lifecycle
3. **Matcher field:** Regex against tool_name. E.g., `"Bash"`, `"Edit|Write"`, `"mcp__.*"`
4. **Hook handler:** Shell command receives JSON on stdin with `session_id`, `tool_name`, `tool_input`, `tool_response` (for PostToolUse)
5. **Async option:** `"async": true` runs hook in background without blocking Claude

**Skill frontmatter hooks (verified):**
```yaml
---
name: my-skill
description: Does something useful
hooks:
  PostToolUse:
    - matcher: ".*"
      hooks:
        - type: command
          command: "curl -s -X POST https://relay.example.com/api/track -H 'Content-Type: application/json' -d '{\"session_id\": \"'$CLAUDE_SESSION_ID'\", \"skill_id\": \"abc123\", \"event\": \"tool_use\"}' > /dev/null 2>&1 || true"
          async: true
  SessionStart:
    - hooks:
        - type: command
          command: "curl -s -X POST https://relay.example.com/api/track -d '{\"event\": \"session_start\"}' > /dev/null 2>&1 || true"
          once: true
---
```

**Key design decisions:**
- **PostToolUse, not PreToolUse:** Track after successful execution, not before (avoids tracking failed/blocked calls)
- **Async hooks:** `"async": true` prevents tracking from blocking Claude's workflow
- **Fail-silent:** `|| true` ensures tracking failures never disrupt the user
- **`once: true` on SessionStart:** Heartbeat fires once per session, not on every resume/compact
- **Matcher `".*"`:** Track ALL tool uses during skill execution, not just specific tools
- **Skill-scoped hooks:** Hooks defined in SKILL.md frontmatter only fire while that skill is active

**Critical limitation:** Skill-scoped hooks only fire while the skill is active (loaded into context). If Claude uses skill knowledge but the skill is no longer "active," hooks do not fire. This means tracking captures skill invocation but not every downstream tool call from skill-inspired behavior. This is acceptable -- the goal is measuring skill adoption, not total surveillance.

**The `once` field:** Supported in skills and slash commands but NOT in agents. When `once: true`, the hook runs only on the first occurrence per session, then is removed. Source: [Hooks reference](https://code.claude.com/docs/en/hooks).

**Confidence:** HIGH -- All hook capabilities verified against official Claude Code documentation at code.claude.com/docs/en/hooks. The hooks system is mature with 14 event types, skill frontmatter support, async execution, and the `once` modifier.

### 5. Auto-Injection of Tracking Hooks on Skill Deploy

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| deploy_skill injects hooks into frontmatter | Tracking is automatic, not opt-in | MEDIUM | deploy_skill tool modification |
| Hooks include tenant-specific tracking URL | Each tenant's hooks point to their tracking endpoint | LOW | Tenant config |
| Hooks include skill_id and api_key for attribution | Events are attributable to skill + user | LOW | Existing frontmatter fields |
| Uploaded skills preserve original frontmatter | Uploader's hooks are not clobbered | MEDIUM | Merge logic |
| Compliance verification on deploy | Warn if skill lacks tracking hooks | LOW | Frontmatter parsing |

**Expected behavior:** When `deploy_skill` returns skill content for Claude to save to `.claude/skills/{slug}.md`, the content includes tracking hooks in the YAML frontmatter. The uploader never needs to add hooks manually. The hooks fire PostToolUse callbacks to the tenant's tracking endpoint with the skill ID and session context.

**Current state (v1.4):** The `deploy_skill` tool already injects frontmatter:
```yaml
---
everyskill_skill_id: {skill.id}
everyskill_skill_name: {skill.name}
everyskill_category: {skill.category}
everyskill_hours_saved: {skill.hoursSaved}
---
```

**v1.5 enhancement -- add hooks to this frontmatter:**
```yaml
---
everyskill_skill_id: abc-123
everyskill_skill_name: code-review
everyskill_category: workflow
everyskill_hours_saved: 2
hooks:
  PostToolUse:
    - matcher: ".*"
      hooks:
        - type: command
          command: 'curl -s -X POST "https://acme.relay.example.com/api/track" -H "Content-Type: application/json" -H "Authorization: Bearer $EVERYSKILL_API_KEY" -d "$(echo $0 | jq -c \"{session_id: .session_id, skill_id: \\\"abc-123\\\", tool_name: .tool_name, event: \\\"post_tool_use\\\"}\")" > /dev/null 2>&1 || true'
          async: true
  SessionStart:
    - hooks:
        - type: command
          command: 'curl -s -X POST "https://acme.relay.example.com/api/track" -H "Content-Type: application/json" -H "Authorization: Bearer $EVERYSKILL_API_KEY" -d "{\"event\": \"session_start\", \"skill_id\": \"abc-123\"}" > /dev/null 2>&1 || true'
          once: true
---
```

**Confidence:** HIGH -- The deploy_skill tool already handles frontmatter injection (verified in `/home/dev/projects/relay/apps/mcp/src/tools/deploy.ts` lines 70-72). Adding hooks to this frontmatter is a string construction exercise.

### 6. Tracking API Endpoint

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| POST /api/track endpoint | Receives hook callbacks from user machines | MEDIUM | API route |
| API key authentication | Validate EVERYSKILL_API_KEY from Authorization header | LOW | Existing api_keys validation |
| Rate limiting | Prevent abuse from malformed hooks | MEDIUM | Rate limiter middleware |
| Event schema validation | Reject malformed payloads | LOW | Zod schema |
| Async event recording | Non-blocking DB writes | LOW | Existing trackUsage pattern |
| Tenant scoping from API key | API key resolves to user -> tenant | LOW | Existing chain |

**Expected behavior:** Claude Code hooks fire HTTP POSTs to `https://{tenant}.relay.example.com/api/track` with event data. The endpoint validates the API key, resolves the tenant, and records the event. Events are stored in `usage_events` with full attribution (userId, skillId, toolName, tenantId).

**Endpoint must be:**
- Unauthenticated path in middleware (like `/api/install-callback` and `/api/mcp`)
- Fast (< 100ms response) -- hooks have timeouts
- Fail-tolerant -- 5xx should not break Claude's workflow
- Rate-limited -- protect against runaway hooks

**Confidence:** HIGH -- This is a standard webhook receiver pattern. The existing `/api/install-callback` and `/api/mcp` endpoints already handle unauthenticated API requests with validation.

### 7. Tenant Admin Panel

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Tenant settings page | Configure tenant name, domains, branding | MEDIUM | Tenant table |
| User management (list, roles) | See who belongs to tenant | MEDIUM | User-tenant relationship |
| Admin role | Distinguish admin from regular user | LOW | Role field on user |
| Invite by email domain | Users with matching domain auto-join | LOW | Domain config |
| Tenant-specific analytics | Skills, usage, FTE days saved per tenant | LOW | Existing analytics + WHERE tenant_id |

**Expected behavior:** Each tenant has at least one admin user. Admins access a settings page to configure tenant domains, view users, and see tenant-specific analytics. Non-admin users see the standard skill marketplace scoped to their tenant.

**Role model (minimal):**
- `admin` -- full tenant management, user management, analytics
- `member` -- browse, deploy, contribute skills, see personal analytics

**Confidence:** HIGH -- Standard B2B SaaS admin panel pattern.

### 8. Production Docker Compose Deployment

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Docker Compose with Next.js + PostgreSQL + Caddy | Single-command deployment | HIGH | Dockerfiles |
| Caddy for automatic SSL and wildcard certs | HTTPS with zero config | MEDIUM | DNS + Caddy config |
| PostgreSQL with persistent volume | Data survives container restarts | LOW | Docker volumes |
| Environment variable configuration | .env file for secrets | LOW | Standard pattern |
| Health check endpoints | Container orchestration, monitoring | LOW | API route |
| Backup strategy for PostgreSQL | Prevent data loss | MEDIUM | pg_dump cron or similar |

**Expected behavior:** `docker compose up` on a Hetzner VPS starts the full stack. Caddy auto-provisions SSL certificates (including wildcard for `*.relay.example.com`). PostgreSQL data is persisted to a Docker volume. Environment variables configure database URL, Google OAuth credentials, API keys, etc.

**Confidence:** HIGH -- Docker Compose + Caddy is a well-established self-hosted deployment pattern.

### 9. Deploy-Time Compliance Checking

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Verify tracking hooks exist in deployed skills | Ensure no skill bypasses tracking | MEDIUM | Frontmatter parsing |
| Nudge if hooks are missing or outdated | Soft enforcement, not blocking | LOW | MCP tool response |
| Compliance status in analytics | "X% of deployed skills have tracking" | LOW | Query on skill content |

**Expected behavior:** When `deploy_skill` runs, it verifies the output skill file will include tracking hooks. If a user manually removes hooks from a deployed skill and re-deploys, the system detects the absence and re-injects them. The analytics dashboard shows compliance rate.

**This is soft enforcement, not hard blocking.** Users can still edit their local `.claude/skills/` files. The system cannot prevent that. But every deploy_skill invocation ensures hooks are present, and analytics show what percentage of active installs are compliant.

**Confidence:** MEDIUM -- The enforcement is at deploy time only. Post-deploy modifications by users are undetectable.

---

## Differentiators

Features that set Relay apart. Not required for launch but high-value.

### Compliance Skill (Standalone Tracker)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Standalone "relay-tracker" skill | A skill whose sole purpose is registering session heartbeats and providing org-wide tracking hooks | MEDIUM | Installed alongside other skills |
| SessionStart heartbeat | Know when employees start Claude sessions, even without using a specific skill | MEDIUM | Uses `once: true` SessionStart hook |
| Global PostToolUse tracking | Track ALL tool usage across ALL skills, not just Relay-deployed ones | HIGH | Requires project-level or user-level hook, not skill-scoped |

**Why this matters:** Skill-scoped hooks only fire while that skill is active. A standalone compliance skill with `SessionStart` hooks can register heartbeats. However, for truly global tracking (every tool use, not just during skill execution), hooks must be configured at the project level (`.claude/settings.json`) or user level (`~/.claude/settings.json`), NOT in skill frontmatter.

**Architecture implications:** The compliance skill registers a session heartbeat on startup. For comprehensive tool tracking, the install process would also need to add entries to `.claude/settings.json` or `~/.claude/settings.json`. This is more invasive than skill-scoped hooks and should be opt-in with clear communication to users.

### Tenant Onboarding Wizard

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Self-service tenant creation | New orgs can onboard without manual DB work | MEDIUM | Web form + DB provisioning |
| Guided setup flow | Domain config, first admin, SSO test | MEDIUM | Multi-step form |
| Sample skills seeding | New tenants start with example skills | LOW | Seed script |

### Cross-Tenant Skill Marketplace

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shared/public skills visible across tenants | "Community" skills available to all | HIGH | Cross-tenant query logic |
| Tenant can "import" a public skill | Copy into their namespace | MEDIUM | Fork-like mechanism |
| Skill visibility: private (tenant-only) vs public | Control what others can see | MEDIUM | Visibility field on skills |

### Zero-Downtime Deployment

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rolling container updates | Deploy without dropping connections | MEDIUM | Docker Compose + Caddy health checks |
| Database migrations without downtime | Schema changes during operation | HIGH | Careful migration strategy |
| Blue-green deployment option | Instant rollback capability | HIGH | Requires more infrastructure |

### Tailscale Integration

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tailscale sidecar for private access | Internal users access via Tailscale network | LOW | Docker sidecar container |
| Dual access: public domain + Tailscale | External (HTTPS) and internal (Tailscale) paths | MEDIUM | Caddy + Tailscale config |
| MagicDNS for internal hostname | relay.ts.net as alternative to public domain | LOW | Tailscale config |

### Monitoring and Alerting

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Health check dashboard | At-a-glance system status | LOW | /api/health endpoint |
| Error rate monitoring | Detect issues before users report them | MEDIUM | Log aggregation |
| Usage anomaly detection | Detect unusual patterns (abuse, outage) | HIGH | Statistical analysis |
| Uptime monitoring | External ping service | LOW | UptimeRobot or similar |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Tempting | Why Problematic | Do Instead |
|--------------|-------------|-----------------|------------|
| **PostgreSQL Row-Level Security (RLS)** | "Defense in depth" | Adds significant complexity to Drizzle ORM queries, debugging becomes harder, RLS doesn't apply to superusers/table owners, and the app already scopes queries by tenant_id. At Relay's scale (<1000 users), RLS is overengineering. | Application-level tenant_id filtering in all queries. Add integration tests that verify no cross-tenant data leakage. |
| **Separate database per tenant** | "Complete isolation" | Massive operational complexity -- migrations must run N times, connection pooling per DB, backup management multiplied. Only justified at enterprise scale with regulatory requirements. | Shared database with tenant_id column. Single migration path, single connection pool. |
| **Blocking hooks (non-async tracking)** | "Guaranteed delivery" | Sync hooks block Claude's agent loop. If the tracking endpoint is slow or down, the user's entire Claude session freezes. Claude Code has hook timeouts (default 600s for command hooks) but even a 2-second delay per tool call degrades UX severely. | Always use `async: true` for tracking hooks. Accept eventual consistency -- a missed tracking event is far less costly than a blocked Claude session. |
| **Global user-level hooks via ~/.claude/settings.json** | "Track everything everywhere" | Modifying user-level settings is invasive, affects ALL projects (not just Relay), and users may legitimately not want org tracking in personal projects. Creates trust issues. | Skill-scoped hooks (in SKILL.md frontmatter) + project-level hooks (in .claude/settings.json for opted-in projects). Transparent, scoped, revocable. |
| **Mandatory hook compliance** | "100% tracking coverage" | Users can always edit local files. Hard enforcement is impossible and attempting it creates adversarial dynamics. Detected tampering creates a surveillance culture. | Soft enforcement: inject hooks on deploy, show compliance rate in analytics, make tracking VALUE visible ("your skills saved X days") so users want to be tracked. |
| **Complex RBAC (roles beyond admin/member)** | "Enterprise needs granular permissions" | At Relay's current scale, complex RBAC is YAGNI. Two roles (admin, member) cover all use cases. Adding editor, viewer, contributor, etc. creates confusion and maintenance burden. | Two roles: admin and member. Add granularity later if proven needed. |
| **Custom tenant themes/branding** | "White-label experience" | Significant CSS complexity, testing burden (every page in every theme), and low value for an internal tool. | Tenant name in header. Maybe a logo. That's it. |
| **PreToolUse hooks for tracking** | "Track intent, not just completion" | PreToolUse fires before the tool runs. If the tool fails or is blocked, you've tracked a non-event. Also, PreToolUse hooks can block/modify tool calls, introducing risk. | PostToolUse only -- tracks actual completed tool executions. |
| **Storing raw hook payloads** | "We might need the full context later" | Hook input JSON includes `tool_input` and `tool_response` which can contain file contents, code, and sensitive data. Storing this is a privacy/security liability. | Store only: session_id, skill_id, tool_name, timestamp, user_id. Discard tool_input and tool_response. |
| **Real-time WebSocket tracking dashboard** | "Live usage feed" | Overkill for an internal tool. SSR with periodic refresh is sufficient. WebSocket adds connection management complexity and scaling concerns. | Server Components with revalidation. Refresh on navigation. |
| **Multi-region deployment** | "Low latency globally" | Relay is an internal tool, likely single-region. Multi-region adds database replication complexity (write conflicts, eventual consistency) for minimal benefit. | Single Hetzner VPS in the region closest to the majority of users. |

---

## Feature Dependencies

```
[Tenant Isolation] (#1)
    |--requires--> Schema migration (add tenant_id columns)
    |--requires--> Tenant table (new)
    |--requires--> User-tenant mapping
    |--blocks----> Everything else (all features need tenant context)

[Subdomain Routing] (#2)
    |--requires--> [Tenant Isolation] (#1)
    |--requires--> Wildcard DNS + SSL
    |--modifies--> Next.js middleware (existing)
    |--enables---> Per-tenant URLs

[Domain SSO Mapping] (#3)
    |--requires--> [Tenant Isolation] (#1)
    |--modifies--> Auth.js config (existing)
    |--modifies--> signIn callback logic

[Claude Code Hooks Tracking] (#4)
    |--requires--> [Tracking Endpoint] (#6)
    |--requires--> [Auto-Injection] (#5)
    |--independent of--> [Tenant Isolation] (hooks work without tenancy)

[Auto-Injection of Hooks] (#5)
    |--modifies--> deploy_skill tool (existing)
    |--requires--> Tracking URL (from tenant config or env)
    |--requires--> Hook frontmatter format knowledge

[Tracking Endpoint] (#6)
    |--creates---> POST /api/track route (new)
    |--reuses----> validateApiKey (existing)
    |--extends---> usage_events table (add hook-sourced events)
    |--requires--> [Tenant Isolation] (#1) for tenant scoping

[Tenant Admin Panel] (#7)
    |--requires--> [Tenant Isolation] (#1)
    |--requires--> Admin role on users
    |--extends---> Existing analytics with tenant filter

[Docker Compose Deployment] (#8)
    |--independent of--> All feature work
    |--requires--> Dockerfiles for web + MCP + PostgreSQL
    |--requires--> Caddy config for SSL + reverse proxy
    |--enables---> [Subdomain Routing] (#2) via Caddy wildcard

[Compliance Checking] (#9)
    |--requires--> [Auto-Injection] (#5)
    |--modifies--> deploy_skill response (nudge message)
```

### Critical Path

```
Phase 1: Infrastructure
    Docker Compose + Caddy + PostgreSQL
    (Independent, can start immediately)

Phase 2: Multi-Tenancy Foundation
    Tenant table + tenant_id migration + scoped queries
    Subdomain routing in middleware
    Domain-based SSO mapping
    Admin role + tenant admin panel
    (Must be sequential, blocks all tenant-aware features)

Phase 3: Reliable Tracking
    POST /api/track endpoint
    Hook auto-injection in deploy_skill
    Compliance checking
    (Can partially parallel with Phase 2 if endpoint is tenant-agnostic initially)

Phase 4: Integration & Polish
    Tenant-specific analytics
    Compliance dashboard
    Deploy-time verification
```

---

## MVP Recommendation

### Must Have for v1.5

**Docker Compose Deployment -- Build First (independent):**
- [ ] Dockerfile for Next.js web app
- [ ] Dockerfile for MCP server (if separate)
- [ ] docker-compose.yml with PostgreSQL, web, Caddy
- [ ] Caddy config with wildcard SSL for *.relay.example.com
- [ ] .env template for all configuration
- [ ] Health check endpoint (GET /api/health)
- [ ] PostgreSQL backup script (pg_dump cron)

**Tenant Isolation -- Build Second (foundation):**
- [ ] `tenants` table (id, name, slug, domains, createdAt)
- [ ] `tenant_id` column on: skills, skill_versions, skill_reviews, skill_embeddings, ratings, usage_events, api_keys
- [ ] Migration: create tenant for existing data, backfill tenant_id
- [ ] `role` field on users (admin/member)
- [ ] Session callback includes tenantId resolved from user email domain
- [ ] All service functions accept and filter by tenantId
- [ ] Integration tests: verify cross-tenant data isolation

**Subdomain Routing -- Build with Tenancy:**
- [ ] Middleware extracts subdomain from Host header
- [ ] Subdomain maps to tenant via DB lookup (cached)
- [ ] Tenant context available in all server actions
- [ ] Bare domain redirects to login/landing

**Domain SSO Mapping -- Build with Tenancy:**
- [ ] Tenant domains config (array of allowed email domains)
- [ ] signIn callback: match email domain to tenant
- [ ] Auto-provision user to correct tenant on first login
- [ ] Reject login if no tenant matches email domain

**Tracking Endpoint -- Build Third:**
- [ ] POST /api/track route (unauthenticated in middleware)
- [ ] Zod schema for event payload (session_id, skill_id, tool_name, event_type)
- [ ] API key validation from Authorization header
- [ ] Rate limiting (100 req/min per API key)
- [ ] Record event to usage_events with tenant_id

**Hook Auto-Injection -- Build with Tracking:**
- [ ] Modify deploy_skill to inject hooks into YAML frontmatter
- [ ] PostToolUse hook: async curl to /api/track with skill_id, session_id, tool_name
- [ ] SessionStart hook: once-per-session heartbeat
- [ ] Hooks use $EVERYSKILL_API_KEY env var for authentication
- [ ] Tracking URL derived from tenant subdomain

**Tenant Admin Panel -- Build Last:**
- [ ] Admin-only settings page
- [ ] Tenant configuration (name, domains)
- [ ] User list for tenant
- [ ] Tenant-scoped analytics (reuse existing analytics with WHERE tenant_id)

### Defer to Post-v1.5

- [ ] Cross-tenant skill marketplace (shared/public skills)
- [ ] Tenant onboarding wizard (self-service creation)
- [ ] Zero-downtime deployments (rolling updates)
- [ ] Monitoring/alerting stack
- [ ] Custom tenant branding
- [ ] Compliance skill (standalone global tracker)
- [ ] Weekly digest emails

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Docker Compose deployment | HIGH (enables production) | HIGH | LOW | P0 |
| Tenant isolation (tenant_id) | HIGH (enables multi-tenancy) | HIGH | MEDIUM | P0 |
| Subdomain routing | HIGH (user-facing tenancy) | MEDIUM | LOW | P0 |
| Domain SSO mapping | HIGH (seamless login) | MEDIUM | LOW | P0 |
| POST /api/track endpoint | HIGH (enables hook tracking) | MEDIUM | LOW | P0 |
| Hook auto-injection | HIGH (deterministic tracking) | MEDIUM | MEDIUM | P0 |
| Tenant admin panel | MEDIUM (admin operations) | MEDIUM | LOW | P1 |
| Compliance checking | MEDIUM (tracking visibility) | LOW | LOW | P1 |
| Health checks | MEDIUM (operational) | LOW | LOW | P1 |
| PostgreSQL backups | HIGH (data safety) | LOW | LOW | P1 |
| Tailscale integration | MEDIUM (internal access) | LOW | LOW | P2 |
| Compliance skill (standalone) | MEDIUM (global tracking) | MEDIUM | MEDIUM | P2 |
| Zero-downtime deploys | LOW (nice to have) | HIGH | MEDIUM | P3 |
| Cross-tenant marketplace | LOW (future feature) | HIGH | HIGH | P3 |

---

## Claude Code Hooks -- Technical Reference

This section documents verified hook capabilities relevant to Relay's tracking design.

### Hook Event Lifecycle

```
SessionStart (once per session)
    -> UserPromptSubmit
        -> PreToolUse (before each tool)
            -> [Tool Executes]
        -> PostToolUse (after success) / PostToolUseFailure (after failure)
    -> Stop (when Claude finishes)
SessionEnd (when session terminates)
```

### Hook Configuration in Skill Frontmatter

Source: [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks), [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)

```yaml
---
name: my-skill
description: What this skill does
hooks:
  PostToolUse:
    - matcher: ".*"           # Regex against tool_name
      hooks:
        - type: command       # Shell command
          command: "your-script.sh"
          async: true         # Non-blocking
          timeout: 30         # Seconds
  SessionStart:
    - hooks:
        - type: command
          command: "init.sh"
          once: true          # Only fires once per session (skills only, NOT agents)
---
```

### PostToolUse Input Schema (what the hook script receives on stdin)

```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  },
  "tool_response": {
    "stdout": "all tests passed"
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

### Environment Variables Available in Hooks

| Variable | Available In | Description |
|----------|--------------|-------------|
| `$CLAUDE_PROJECT_DIR` | All hooks | Project root directory |
| `$CLAUDE_SESSION_ID` | Skill content (not hooks directly) | Session ID for correlation |
| `$CLAUDE_ENV_FILE` | SessionStart only | Path to write env vars |
| `$CLAUDE_CODE_REMOTE` | All hooks | "true" if remote web environment |

### Limitations Relevant to Relay

1. **Skill-scoped hooks are lifecycle-bound:** Hooks in SKILL.md only fire while that skill is active in Claude's context. Once the skill is no longer loaded, its hooks stop firing.
2. **No guaranteed delivery:** Async hooks can fail silently. Network errors, endpoint downtime, or hook timeouts mean some events will be lost. Design for eventual consistency.
3. **No hook input modification for PostToolUse:** PostToolUse cannot modify or block the tool result (tool already ran). It can provide feedback to Claude via `decision: "block"` but cannot undo the action.
4. **Hook snapshots at session start:** Hook configurations are captured at session startup. Mid-session changes to hooks require a new session to take effect.
5. **Windows compatibility:** SessionStart hooks have known issues on Windows (hanging during initialization). Source: [GitHub issue #9542](https://github.com/anthropics/claude-code/issues/9542). Test Windows behavior.

---

## Sources

### Claude Code Hooks (HIGH confidence)
- [Hooks Reference -- Official Docs](https://code.claude.com/docs/en/hooks) -- Complete hook event reference, configuration schema, input/output formats
- [Skills Documentation -- Official Docs](https://code.claude.com/docs/en/skills) -- Skill frontmatter fields including hooks
- [GitHub: claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) -- Community examples
- [GitHub: claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) -- PostToolUse tracking to HTTP endpoint example
- [DataCamp: Claude Code Hooks Guide](https://www.datacamp.com/tutorial/claude-code-hooks) -- Practical examples
- [GitHub Issue #17688: Skill-scoped hooks in plugins](https://github.com/anthropics/claude-code/issues/17688) -- Known limitation with plugin hooks

### Multi-Tenancy (HIGH confidence)
- [Next.js Multi-tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) -- Official Next.js documentation
- [Vercel Platforms Starter](https://github.com/vercel/platforms) -- Reference implementation
- [WorkOS: Developer's Guide to Multi-Tenant Architecture](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) -- Comprehensive patterns
- [Frontegg: SaaS Multitenancy](https://frontegg.com/blog/saas-multitenancy) -- Components and best practices
- [AWS: Multi-tenant data isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) -- RLS patterns (decided against for Relay)
- [Crunchy Data: Row Level Security for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) -- RLS tradeoffs
- [Nile: Shipping multi-tenant SaaS with RLS](https://www.thenile.dev/blog/multi-tenant-rls) -- Practical RLS implementation

### Production Deployment (MEDIUM confidence)
- [Caddy documentation](https://caddyserver.com/docs/) -- Auto-SSL, wildcard certificates, reverse proxy
- Docker Compose documentation -- Multi-container orchestration

### Existing Codebase (HIGH confidence)
- `/home/dev/projects/relay/apps/mcp/src/tools/deploy.ts` -- Current frontmatter injection (lines 70-72)
- `/home/dev/projects/relay/apps/mcp/src/tools/log-usage.ts` -- Honor-system tracking (being replaced)
- `/home/dev/projects/relay/apps/mcp/src/tracking/events.ts` -- trackUsage function
- `/home/dev/projects/relay/apps/mcp/src/auth.ts` -- API key resolution to userId
- `/home/dev/projects/relay/packages/db/src/schema/usage-events.ts` -- Usage events schema
- `/home/dev/projects/relay/packages/db/src/schema/skills.ts` -- Skills schema (no tenant_id yet)
- `/home/dev/projects/relay/apps/web/middleware.ts` -- Auth middleware (needs subdomain logic)

---

*Feature research for: Relay v1.5 multi-tenancy, deterministic usage tracking, production deployment*
*Researched: 2026-02-07*
*Confidence: HIGH for multi-tenancy and Claude Code hooks (well-established patterns, official docs verified), MEDIUM for production deployment specifics (standard patterns, project-specific config needed)*
