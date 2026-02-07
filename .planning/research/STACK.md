# Technology Stack: Production Deployment, Multi-Tenancy & Hook Tracking

**Project:** Relay v2.0 Milestone
**Researched:** 2026-02-07
**Scope:** Stack ADDITIONS only. Existing stack (Next.js 16.1.6, PostgreSQL, Drizzle ORM ^0.38.0, Auth.js 5.0.0-beta.30, MCP SDK, mcp-handler, Recharts, etc.) is validated and unchanged.

---

## Executive Summary

v2.0 requires three capabilities not in the current stack:

1. **Docker Compose production deployment** -- Containerize the Next.js monorepo app with standalone output, add Caddy reverse proxy for automatic HTTPS, and upgrade to pgvector/pgvector:pg17 for production PostgreSQL with vector search.

2. **Multi-tenant subdomain routing** -- Add a `tenants` table, add `tenantId` column to all existing tables, extract subdomain in middleware, scope all queries. Zero new npm dependencies.

3. **Claude Code hook-based usage tracking** -- Use PostToolUse hooks (configured via compliance skill frontmatter) to fire async HTTP callbacks to a Relay tracking endpoint. Zero new npm dependencies.

**Total new npm dependencies: ZERO.** All additions are infrastructure-level (Docker images, Caddyfile, Dockerfile, database schema, hook shell scripts).

---

## Recommended Stack Additions

### 1. Docker Production Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker Compose | v2 (bundled on Hetzner) | Service orchestration | Already installed on target server. 3 services (caddy, web, postgres) is a perfect Compose use case |
| Node.js Alpine | 22-alpine | Container base image | Matches `engines.node >= 22.0.0` in root package.json. Alpine cuts image from ~1GB to ~150MB |
| PostgreSQL + pgvector | pgvector/pgvector:pg17 | Database with vector search | Replaces current postgres:16-alpine. Bundles pgvector 0.8.x pre-compiled. PostgreSQL 17 is current stable |
| Caddy | 2.10.x (official Docker image: `caddy:2.10-alpine`) | Reverse proxy + automatic HTTPS | Automatic TLS, wildcard subdomain routing in ~20 lines of Caddyfile. Dramatically simpler than Nginx/Traefik |
| Turbo prune | Via turbo CLI ^2.3.0 (already installed) | Monorepo Docker layer optimization | `turbo prune web --docker` produces minimal dependency tree for cache-efficient builds |

#### Why Caddy Over Nginx or Traefik

| Criterion | Caddy | Nginx | Traefik |
|-----------|-------|-------|---------|
| Automatic HTTPS | Built-in, zero config for ACME + Tailscale | Requires certbot sidecar + cron renewal | Built-in but complex TOML/YAML config |
| Wildcard subdomains | `*.domain.com` block + `{labels.*}` placeholders | Manual server blocks per subdomain or lua | Docker labels (verbose), dynamic but opaque |
| Config complexity | ~20 lines Caddyfile | ~80 lines nginx.conf + certbot scripts | ~40 lines YAML + Docker labels per service |
| Tailscale integration | Native `.ts.net` cert provisioning (auto-detected) | Manual cert mounting from Tailscale socket | No native support |
| Hot reload | Automatic on Caddyfile change | `nginx -s reload` signal | Automatic via Docker events |
| Config language | Caddyfile (human-readable) | nginx.conf (bespoke syntax) | TOML/YAML (verbose) |

Caddy wins for this deployment: single server, wildcard subdomains, Tailscale on the network. The `{labels.*}` placeholder extracts subdomain dynamically from any request without per-tenant config.

#### Why pgvector/pgvector:pg17 Over Plain postgres:17-alpine

The project already uses pgvector for Voyage AI skill embeddings. The `pgvector/pgvector:pg17` image (maintained by the pgvector team on Docker Hub) includes the extension pre-compiled. This avoids a custom Dockerfile just to `apk add postgresql-pgvector` and compile. PostgreSQL 17 is the current stable release; upgrading from 16 is safe (minor dump/restore or pg_upgrade).

### 2. Multi-Tenant Architecture

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Drizzle ORM (existing) | ^0.38.0 | Row-level tenant isolation via `tenantId` column | Application-level `WHERE tenantId = ?` on every query. Simpler and more auditable than PostgreSQL RLS for this use case |
| Next.js middleware (existing) | via next@16.1.6 | Subdomain extraction + tenant resolution | Middleware already runs on every request for auth. Adding subdomain parsing is ~15 lines of code |
| Auth.js (existing) | 5.0.0-beta.30 | Per-tenant Google SSO domain restriction | Already restricts by `AUTH_ALLOWED_DOMAIN`. Becomes per-tenant lookup: subdomain -> tenant -> allowedDomain |

**No new npm packages needed.** The multi-tenancy pattern is entirely application-level:

1. Middleware extracts subdomain from `req.headers.get('host')`
2. Middleware resolves tenant by subdomain (cached in-memory with TTL)
3. Tenant ID propagated via custom header or cookie to server actions
4. All Drizzle queries include `WHERE tenantId = ?` (enforced by service layer)
5. Auth.js `signIn` callback validates email domain against `tenant.allowedDomain`

#### Why Row-Level tenantId Over Alternatives

| Approach | Complexity | Migration Effort | Query Overhead | Data Isolation | Recommendation |
|----------|------------|------------------|----------------|----------------|----------------|
| **tenantId column + app-level WHERE** | LOW | Add column + backfill | Negligible with index | Logical (app-enforced) | **USE THIS** |
| PostgreSQL RLS policies | MEDIUM | Drizzle RLS API is beta (requires ^1.0.0-beta.1), `SET` per request | Slight per-query overhead | Database-enforced | Overkill for <50 tenants; Drizzle RLS API not stable |
| Schema-per-tenant | HIGH | Dynamic schema creation, per-tenant migrations | Connection per schema | Schema-level | Wrong for shared-DB single-server |
| Database-per-tenant | VERY HIGH | Separate instances, separate connection pools | Per-DB connection | Full isolation | Wrong for Docker Compose single-server |

Row-level tenantId is right because:
- Relay is an internal tool with <50 expected tenants (one per org/team)
- Single PostgreSQL instance on a single Hetzner server
- Drizzle ORM ^0.38.0 does not have stable RLS support (`pgTable.withRLS()` requires drizzle-orm v1.0.0-beta.1+ which is not production-ready)
- Application-level filtering is battle-tested, trivial to audit, works with the existing Drizzle version
- A `tenantId` composite index on frequently queried tables ensures query performance

### 3. Claude Code Hook-Based Usage Tracking

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Claude Code hooks | Built into Claude Code CLI | PostToolUse event firing | Hooks configured in skill YAML frontmatter. Fire shell commands on tool events. No library needed |
| curl | System utility | HTTP callback from hook to Relay API | Hook commands receive JSON stdin, curl posts to tracking endpoint. Zero dependencies |
| jq | System utility (or inline processing) | JSON field extraction from stdin | Optional; can use simple shell approach instead |
| Next.js API route (existing) | via next@16.1.6 | `/api/track` endpoint receiving callbacks | Validates API key, writes usage event. Uses existing `usageEvents` table and `apiKeys` auth |

**No new npm packages needed.** The entire hook system is:

1. **Compliance skill** (a markdown file with YAML frontmatter) deployed to each user's `.claude/skills/` directory
2. **PostToolUse hook** in the skill frontmatter fires after every tool call
3. **Hook command** (shell script or inline curl) extracts tool info from JSON stdin and POSTs to Relay's `/api/track`
4. **Relay API route** validates the `RELAY_API_KEY` header, maps to user + tenant, inserts `usageEvent`
5. **Async mode** (`"async": true`) ensures hooks never block Claude Code's operation

---

## Docker Compose Service Topology

```yaml
# docker/docker-compose.prod.yml
services:
  # 1. Reverse proxy -- handles TLS termination, wildcard subdomain routing
  caddy:
    image: caddy:2.10-alpine
    # For public domain with wildcard certs, use custom build:
    # build:
    #   context: ./caddy
    #   dockerfile: Dockerfile
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data       # Persisted TLS certificates
      - caddy_config:/config
    environment:
      - BASE_DOMAIN=${BASE_DOMAIN}
    depends_on:
      web:
        condition: service_healthy
    restart: unless-stopped

  # 2. Next.js app -- standalone mode, minimal image (~150MB)
  web:
    build:
      context: ../
      dockerfile: docker/Dockerfile
    environment:
      - DATABASE_URL=postgresql://relay:${DB_PASSWORD}@postgres:5432/relay
      - NEXTAUTH_URL=https://${BASE_DOMAIN}
      - AUTH_SECRET=${AUTH_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - VOYAGE_API_KEY=${VOYAGE_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    expose:
      - "2000"    # Only accessible within Docker network
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:2000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # 3. PostgreSQL with pgvector pre-installed
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_USER: relay
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: relay
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U relay"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    # NOT port-mapped to host -- only accessible within Docker network

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

**Key architecture decisions:**
- PostgreSQL has no host port mapping (security: accessible only within Docker network)
- Caddy handles all external traffic on 80/443
- Next.js exposes port 2000 within Docker network only (never to host)
- Health checks cascade: postgres -> web -> caddy (via depends_on conditions)
- Named volumes for persistence: `postgres_data`, `caddy_data`, `caddy_config`

### Caddyfile for Wildcard Subdomain Routing

**Option A: Tailscale-only deployment (simplest, no DNS challenge)**

```caddyfile
# Caddy auto-provisions per-subdomain certs from Tailscale
# No DNS challenge, no cert configuration needed
# First request to a new subdomain has ~2s delay for cert provisioning, then cached

{$TS_HOSTNAME}.ts.net {
    reverse_proxy web:2000
}
```

Note: Tailscale `.ts.net` domains do NOT support wildcard certificates (confirmed via GitHub issue tailscale/tailscale#7081). Each subdomain gets an individual certificate on first request. This works fine for <50 tenants -- there is a ~2 second delay on the very first request to each new subdomain while the cert is provisioned, then it is cached.

Since Tailscale terminates at the host (not inside Docker), and tenants are distinguished by subdomain, the approach for Tailscale is: Caddy listens on the host network (or on the Tailscale interface), and the subdomain is passed through to Next.js via the `Host` header. Next.js middleware reads the Host header to determine the tenant.

**Option B: Public domain with wildcard cert (requires DNS provider plugin)**

```caddyfile
# Wildcard cert for *.relay.company.com via DNS-01 challenge
*.{$BASE_DOMAIN}, {$BASE_DOMAIN} {
    tls {
        dns cloudflare {$CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy web:2000
}
```

This requires a custom Caddy build with the DNS provider module:

```dockerfile
# docker/caddy/Dockerfile
FROM caddy:2.10-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.10-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

**Recommendation:** Use Option B (public domain) if a custom domain like `relay.company.com` is available with Cloudflare DNS. This gives clean tenant URLs (`acme.relay.company.com`). Fall back to Option A only if Tailscale-only access is required.

### Dockerfile for Next.js Standalone (pnpm Monorepo)

```dockerfile
# docker/Dockerfile
# Multi-stage build using turbo prune for minimal dependency tree

# Stage 1: Prune monorepo to only web app and its dependencies
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN npm install -g turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune web --docker

# Stage 2: Install dependencies (cached layer -- only rebuilds when package.json changes)
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
# Copy only package.json files first (from turbo prune --docker output)
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=installer /app/ .
# Copy full source code
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=web

# Stage 4: Production runner (~150MB)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# Copy standalone output (includes only needed node_modules)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets and public directory
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 2000
ENV PORT=2000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
```

**Critical next.config.ts change required for standalone + monorepo:**

```typescript
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Tell Next.js to trace dependencies from the monorepo root,
  // not just the apps/web directory
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@relay/ui", "@relay/core", "@relay/db"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};
```

Without `outputFileTracingRoot`, the standalone build will miss `@relay/*` workspace package files.

---

## Claude Code Hook Configuration Detail

### PostToolUse Hook Schema (from Official Docs -- HIGH Confidence)

**What PostToolUse receives on stdin:**
```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "tool_response": {
    "stdout": "...",
    "exitCode": 0
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

**Matcher:** Regex on `tool_name`. Use `".*"` to match all tools, `"Bash|Write|Edit"` for specific tools, `"mcp__.*"` for all MCP tools.

### Compliance Skill with Hook Frontmatter

The tracking hook is deployed as part of a "compliance skill" -- a markdown file with YAML frontmatter that defines the hook. When the skill is active in a user's `.claude/skills/`, the hook fires automatically.

```yaml
---
name: relay-usage-tracker
description: Tracks tool usage for organizational compliance and analytics
hooks:
  PostToolUse:
    - matcher: ".*"
      hooks:
        - type: command
          command: |
            curl -s -X POST "${RELAY_URL}/api/track" \
              -H "Authorization: Bearer ${RELAY_API_KEY}" \
              -H "Content-Type: application/json" \
              -d @-
          async: true
          timeout: 10
---

# Relay Usage Tracker

This skill enables automatic usage tracking for your organization's Relay instance.
All tool invocations are logged for compliance and analytics purposes.

## What is tracked

- Tool name (Bash, Write, Edit, Read, etc.)
- Working directory
- Session ID
- Timestamp (server-side)

## Privacy

- Tool input/output content is NOT stored -- only tool names and metadata
- Data is associated with your API key for per-employee attribution
- All data stays within your organization's Relay instance
```

**Key design decisions for hook tracking:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hook location | Skill frontmatter | Deploys with the skill; no manual settings.json editing per user |
| Async mode | `"async": true` | Never blocks Claude Code's operation. Results delivered on next turn if needed |
| Timeout | 10 seconds | Generous for HTTP POST; if Relay is unreachable, hook exits cleanly |
| Matcher | `".*"` (all tools) | Track everything for complete visibility. Server-side filtering decides what to store |
| Payload | Full stdin (`-d @-`) | Send entire PostToolUse JSON; server extracts what it needs |
| Auth | `$RELAY_API_KEY` env var | Already configured for MCP auth; reused for hook callbacks |

### Server-Side Tracking Endpoint

```
POST /api/track
Headers:
  Authorization: Bearer rlk_abc123...
  Content-Type: application/json
Body: (PostToolUse stdin JSON -- forwarded directly from hook)

Response: 200 OK (empty body)
```

The endpoint:
1. Validates API key -> resolves userId + tenantId
2. Extracts `tool_name`, `session_id`, `cwd` from body
3. Inserts into `usageEvents` table with `tenantId`
4. Returns 200 immediately (fire-and-forget from hook's perspective)

**What NOT to store:** `tool_input` and `tool_response` may contain sensitive code. Store only `tool_name` and metadata fields. The compliance skill description makes this clear to users.

---

## Schema Changes Required for Multi-Tenancy

### New Table: `tenants`

```typescript
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),                        // "Acme Corp"
  subdomain: text("subdomain").notNull().unique(),     // "acme"
  allowedDomain: text("allowed_domain").notNull(),     // "acme.com" (Google SSO)
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Column Additions to Existing Tables

Every tenant-scoped table gets a `tenantId` column:

```
users          + tenantId text NOT NULL REFERENCES tenants(id)
skills         + tenantId text NOT NULL REFERENCES tenants(id)
skillVersions  + tenantId text NOT NULL REFERENCES tenants(id)
usageEvents    + tenantId text NOT NULL REFERENCES tenants(id)
ratings        + tenantId text NOT NULL REFERENCES tenants(id)
skillReviews   + tenantId text NOT NULL REFERENCES tenants(id)
apiKeys        + tenantId text NOT NULL REFERENCES tenants(id)
siteSettings   + tenantId text (replaces singleton "default" id pattern)
skillEmbeddings + tenantId text NOT NULL REFERENCES tenants(id)
```

### Index Additions

```sql
-- Single-column tenant indexes for filtering
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_skills_tenant ON skills(tenant_id);
CREATE INDEX idx_usage_events_tenant ON usage_events(tenant_id);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_ratings_tenant ON ratings(tenant_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_skills_tenant_slug ON skills(tenant_id, slug);
CREATE UNIQUE INDEX idx_skills_tenant_slug_unique ON skills(tenant_id, slug);
-- (slug uniqueness becomes per-tenant, not global)
```

### Migration Strategy

For the v1 -> v2 migration with existing data:

1. Create `tenants` table
2. Insert a "default" tenant for existing data
3. Add `tenantId` column to all tables with `DEFAULT 'default-tenant-id'`
4. Backfill `tenantId` for all existing rows
5. Make `tenantId` NOT NULL
6. Drop old unique constraints that should become per-tenant (e.g., `skills.slug`)
7. Add new per-tenant unique constraints
8. Add indexes

---

## Auth.js Multi-Tenant Configuration

### Current State (Single Tenant)

```typescript
// auth.config.ts -- edge-compatible (used by middleware)
const ALLOWED_DOMAIN = process.env.AUTH_ALLOWED_DOMAIN || "company.com";
// ...
authorization: { params: { hd: ALLOWED_DOMAIN } }
```

### Target State (Multi-Tenant)

The middleware extracts the subdomain before auth checks. The auth configuration becomes dynamic per-tenant:

```typescript
// Middleware flow:
// 1. Extract subdomain from Host header
// 2. Look up tenant by subdomain (cached)
// 3. If no tenant found, return 404
// 4. Set tenant info in request headers for downstream
// 5. Auth.js checks proceed with tenant context

// auth.ts -- signIn callback becomes tenant-aware:
async signIn({ account, profile }) {
  if (account?.provider === "google") {
    const email = profile?.email;
    const domain = email?.split("@")[1];
    // Look up tenant by email domain
    const tenant = await getTenantByAllowedDomain(domain);
    if (!tenant) return false;
    // Verified + domain matches a tenant
    return profile?.email_verified === true;
  }
  return false;
}
```

**Key constraint:** `auth.config.ts` runs at the Edge (middleware) and cannot import database modules. The `hd` parameter in Google OAuth is a UX hint only (not security). The actual domain validation happens in the `signIn` callback in `auth.ts` (server-side) where database access is available.

**NEXTAUTH_URL consideration:** Auth.js uses `NEXTAUTH_URL` for callback URLs. With subdomains, the callback URL must work for all tenants. Set `NEXTAUTH_URL=https://${BASE_DOMAIN}` and configure Google OAuth to allow callbacks from `*.relay.company.com`. Auth.js `trustHost: true` is already set.

---

## Environment Variables for Production

```bash
# docker/.env (NOT committed to git)

# Database
DB_PASSWORD=<strong-random-password>

# Next.js / Auth.js
AUTH_SECRET=<openssl-rand-base64-32>
NEXTAUTH_URL=https://relay.company.com
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>

# Domain configuration
BASE_DOMAIN=relay.company.com

# Caddy (only for Option B: public domain with wildcard cert)
CLOUDFLARE_API_TOKEN=<cloudflare-api-token-with-dns-edit>

# Tailscale (only for Option A: Tailscale-only)
# TS_HOSTNAME=relay-server

# Voyage AI (existing)
VOYAGE_API_KEY=<existing-key>

# Anthropic (existing)
ANTHROPIC_API_KEY=<existing-key>
```

---

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Reverse proxy | Caddy 2.10 | Nginx | No automatic HTTPS; requires certbot sidecar, ~4x more config lines, no Tailscale integration |
| Reverse proxy | Caddy 2.10 | Traefik | Overkill for single-server; Docker label config is verbose and opaque; no benefit without K8s/Swarm |
| Tenant isolation | Row-level tenantId | PostgreSQL RLS | Drizzle RLS API is in beta (requires v1.0.0-beta.1+); app-level WHERE is simpler with current ^0.38.0 |
| Tenant isolation | Row-level tenantId | Schema-per-tenant | Dynamic schema creation, per-tenant migration running, complex connection management. Wrong for <50 tenants |
| Tenant isolation | Row-level tenantId | Database-per-tenant | Multiple PostgreSQL instances. Wrong for single Docker Compose server |
| Hook tracking | PostToolUse + curl | Custom MCP tool for tracking | Hooks are deterministic (fire on every tool use); MCP tools require Claude to decide to call them (unreliable) |
| Hook tracking | Skill frontmatter hooks | Global ~/.claude/settings.json | Skill-scoped hooks deploy with the skill; no per-user manual config needed |
| Hook tracking | PostToolUse async | Synchronous hook | Async never blocks Claude Code operation; tracking is fire-and-forget |
| Docker image | Node.js standalone | Full node_modules copy | Standalone is ~150MB vs ~1GB+; faster deploys, smaller attack surface |
| PostgreSQL image | pgvector/pgvector:pg17 | postgres:17-alpine + manual pgvector | Pre-built image is simpler; no compile step in Dockerfile |
| Container orchestration | Docker Compose | Kubernetes / K3s | Single server, <50 tenants, 3 services. K8s adds massive operational complexity for zero benefit here |
| Subdomain routing | Middleware rewrite | Separate Next.js instances per tenant | One instance serves all tenants. Separate instances wastes resources and complicates deployment |

---

## What NOT to Add

| Technology | Why Skip It |
|------------|-------------|
| Redis | Sessions are JWT (stateless). No caching layer needed at <50 tenants. PostgreSQL handles everything |
| Kubernetes / K3s | Single Hetzner server. Docker Compose handles 3 services. Revisit only if scaling to multiple servers |
| Nile Database | Drizzle's Nile integration is for hosted multi-tenant Postgres. We self-host on Hetzner |
| Supabase/Neon RLS helpers | `drizzle-orm/supabase` and `drizzle-orm/neon` are provider-specific. We use plain PostgreSQL |
| pgBouncer | Connection pooling handled by postgres.js client already. Not needed at this scale |
| Grafana / Prometheus | Relay has its own analytics dashboard (Phase 23). System monitoring can be added later |
| Watchtower | Auto-updating production containers is risky. Deploy manually or via CI/CD |
| Let's Encrypt certbot | Caddy handles ACME automatically. Certbot is redundant and adds complexity |
| dotenv in production | Environment variables injected via Docker Compose `environment:` block. No `.env` file inside container |
| Next.js custom server | Standalone output already creates `server.js`. Custom server adds complexity with no benefit |
| Multi-database Drizzle | Single database, single connection pool. Multi-DB patterns add connection management overhead |
| Subdomain SSL cert manager | Caddy handles all certificate provisioning automatically, whether via ACME, Tailscale, or internal CA |
| Event queue (BullMQ, etc.) | Hook tracking is fire-and-forget HTTP POST. No queue needed at this scale |
| `jq` binary in Docker | Not needed in the web container. `jq` is only used in the hook shell script on developer machines (already installed or installable) |

---

## Version Summary

| Component | Current | Change | Notes |
|-----------|---------|--------|-------|
| next | ^16.1.6 | Add `output: "standalone"` + `outputFileTracingRoot` to config | No version change needed |
| drizzle-orm | ^0.38.0 | No change | tenantId is a regular column; no RLS features needed |
| postgres (Docker) | postgres:16-alpine | **Upgrade to pgvector/pgvector:pg17** | Bundles pgvector 0.8.x; PostgreSQL 17 stable |
| caddy (Docker) | N/A (new) | **Add caddy:2.10-alpine** | New reverse proxy service |
| turbo | ^2.3.0 | No change | Use `turbo prune web --docker` in Dockerfile |
| pnpm | 9.15.0 | No change | Used in Docker multi-stage build |

**Total new npm dependencies: ZERO.** All changes are infrastructure and schema.

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Docker standalone + turbo prune | HIGH | Verified via official Turborepo Docker docs and Next.js deployment docs. Standard pattern. |
| Caddy reverse proxy wildcard config | HIGH | Verified via official Caddy documentation (caddyfile/patterns). `{labels.*}` placeholder documented. |
| Caddy automatic HTTPS with Tailscale | HIGH | Verified via official Tailscale blog post and Caddy automatic-https docs. `.ts.net` auto-provisioning confirmed. |
| Tailscale wildcard cert limitation | MEDIUM | Multiple community sources confirm no wildcard `.ts.net` certs (GH issue #7081). Per-subdomain provisioning works but has initial latency. |
| pgvector/pgvector:pg17 Docker image | HIGH | Verified on Docker Hub. `pg17` tag is current and actively maintained. |
| Claude Code PostToolUse hook schema | HIGH | Verified via official hooks reference at code.claude.com/docs/en/hooks. Complete JSON input schema documented. |
| Skill frontmatter hooks | HIGH | Documented in official hooks reference under "Hooks in skills and agents" section. YAML frontmatter format confirmed. |
| Async hook behavior | HIGH | Official docs: `"async": true` runs in background, cannot block or return decisions. |
| Row-level tenantId pattern | HIGH | Standard multi-tenant pattern. Drizzle RLS confirmed as beta (v1.0.0-beta.1+); app-level WHERE is the safe choice. |
| Next.js outputFileTracingRoot for monorepo | MEDIUM | Documented in Next.js docs but monorepo edge cases exist; may need debugging during implementation. |
| Auth.js multi-tenant callback URLs | MEDIUM | `trustHost: true` is already set. Google OAuth callback wildcard support needs verification during implementation. |

---

## Sources

### Official Documentation (HIGH Confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Complete hook lifecycle, PostToolUse schema, skill frontmatter hooks, async mode, matcher patterns
- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https) -- TLS automation, wildcard cert requirements, Tailscale .ts.net handling
- [Caddy Common Patterns](https://caddyserver.com/docs/caddyfile/patterns) -- Wildcard subdomain Caddyfile with `{labels.*}` placeholder, handle + host matcher
- [Caddy Reverse Proxy Directive](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) -- Upstream configuration
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker) -- `turbo prune --docker` flag, multi-stage Dockerfile template
- [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying) -- Standalone output mode, `outputFileTracingRoot`
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) -- Subdomain middleware pattern reference
- [Drizzle ORM RLS Docs](https://orm.drizzle.team/docs/rls) -- `pgTable.withRLS()` API, pgPolicy, confirmed beta status (v1.0.0-beta.1+)
- [pgvector Docker Hub](https://hub.docker.com/r/pgvector/pgvector) -- pg17 tag, image details

### Verified via Web Search (MEDIUM Confidence)
- [Tailscale + Caddy Blog](https://tailscale.com/blog/caddy) -- Automatic `.ts.net` cert provisioning, no special config needed
- [Caddy GitHub Releases](https://github.com/caddyserver/caddy/releases) -- Current stable is 2.10.x
- [pgvector GitHub](https://github.com/pgvector/pgvector) -- Current version 0.8.1, pg17 support confirmed
- [Drizzle tenantId Discussion #1539](https://github.com/drizzle-team/drizzle-orm/discussions/1539) -- Community patterns for WHERE enforcement in multi-tenant apps

### Community Sources (LOW Confidence, Noted for Awareness)
- [Tailscale Wildcard Cert FR #7081](https://github.com/tailscale/tailscale/issues/7081) -- Wildcard .ts.net not supported; per-subdomain provisioning is the workaround
- [Next.js Monorepo Standalone Discussion #35437](https://github.com/vercel/next.js/discussions/35437) -- Community edge cases with outputFileTracingRoot in monorepos

---

*Stack research for: Relay v2.0 -- Production Deployment, Multi-Tenancy & Hook Tracking*
*Researched: 2026-02-07*
