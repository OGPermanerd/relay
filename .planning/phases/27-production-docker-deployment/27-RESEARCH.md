# Phase 27: Production Docker Deployment - Research

**Researched:** 2026-02-07
**Domain:** Docker Compose production deployment (Caddy + Next.js + PostgreSQL) on Hetzner VPS with LUKS encryption, automated backups, and wildcard HTTPS
**Confidence:** HIGH

## Summary

Phase 27 containerizes the EverySkill Next.js monorepo for production deployment on an existing Hetzner VPS (Ubuntu 24.04, 8 CPU, 30GB RAM). The deployment uses Docker Compose to orchestrate three services: Caddy (reverse proxy with automatic HTTPS and wildcard subdomain routing), Next.js (standalone build from turbo-pruned monorepo), and PostgreSQL with pgvector (pg17). SOC2 compliance is addressed via LUKS full-disk encryption for data at rest and automated encrypted backups with off-site storage.

The existing codebase has no Dockerfile or production docker-compose.yml -- only a dev-only compose file for local PostgreSQL. The `next.config.ts` currently lacks the `output: "standalone"` setting required for Docker deployment. All infrastructure is new.

**Key finding:** The everyskill.ai domain uses Hetzner DNS nameservers, which means the Caddy wildcard certificate (DNS-01 challenge) should use the `caddy-dns/hetzner` module (v2.0.0). Tailscale is already on port 443 on the VPS, so Caddy must bind to the host's public IP only (or Tailscale needs to be reconfigured to use a different port/interface).

**Primary recommendation:** Build a custom Caddy Docker image with the Hetzner DNS module for wildcard certs via DNS-01 challenge. Use 4-stage Dockerfile with turbo prune for the Next.js standalone build. Keep PostgreSQL internal-only (no host port mapping). Implement LUKS encryption via Hetzner Rescue Mode with Dropbear for remote unlock.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Component | Image/Version | Purpose | Why Standard |
|-----------|---------------|---------|--------------|
| Caddy | Custom build from `caddy:2-builder` + `caddy:2-alpine` | Reverse proxy, automatic HTTPS, wildcard subdomain routing | Auto-HTTPS with zero config, DNS-01 challenge via plugins, ~20 lines of Caddyfile vs ~80 lines Nginx |
| Next.js standalone | `node:22-alpine` (runner stage) | Production web server | `output: "standalone"` reduces image from ~1GB to ~150MB, includes only needed node_modules |
| PostgreSQL + pgvector | `pgvector/pgvector:pg17` | Database with vector search | Pre-compiled pgvector extension, PostgreSQL 17 stable, matches project requirements |
| Turbo prune | `turbo@^2.3.0` (already in devDeps) | Monorepo Docker layer optimization | `turbo prune web --docker` creates minimal dependency tree for cache-efficient builds |
| Docker Compose | v2 (already on VPS) | Service orchestration | 3-service topology is ideal for Compose; no K8s overhead needed |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| caddy-dns/hetzner | v2.0.0 | DNS-01 challenge for wildcard certs | Required for `*.everyskill.ai` wildcard certificate |
| xcaddy | latest (build tool) | Build custom Caddy with DNS module | Used in Caddy Dockerfile builder stage |
| cryptsetup/LUKS2 | System package | Full-disk encryption | One-time setup via Hetzner Rescue Mode |
| Dropbear SSH | initramfs package | Remote LUKS unlock on reboot | Required for headless server encryption |
| pg_dump | Bundled with PostgreSQL | Database backup | Called via `docker exec` in backup script |
| gpg | System utility | Backup encryption | Symmetric AES256 encryption of backup files |
| rclone or rsync | System utility | Off-site backup transfer | Transfer encrypted backups to Hetzner Storage Box via SFTP |
| cron | System service | Backup scheduling | Hourly incremental + daily full backups |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Caddy | Nginx + Certbot | No auto-HTTPS, 4x more config, requires certbot sidecar + cron renewal |
| Caddy | Traefik | Overkill for single-server; Docker labels are verbose and opaque |
| caddy-dns/hetzner | caddy-dns/cloudflare | Would require migrating DNS to Cloudflare; domain already uses Hetzner DNS |
| pgvector/pgvector:pg17 | postgres:17-alpine + manual pgvector build | Requires compile step in Dockerfile; pre-built image is simpler |
| LUKS full-disk | pgcrypto column-level | LUKS covers all files including WAL, temp files, Docker layers; pgcrypto is partial |
| rclone to Storage Box | S3 bucket | Hetzner Storage Box is cheaper, same provider, supports SFTP/rsync natively |
| Docker Compose | K3s/Kubernetes | Single server, 3 services -- K8s adds massive operational complexity for zero benefit |

**Installation (no npm packages needed -- all infrastructure):**
```bash
# On VPS (already done): Docker + Docker Compose installed
# In repo: No new npm dependencies
```

## Architecture Patterns

### Recommended Project Structure (new files)
```
docker/
  Dockerfile              # 4-stage Next.js standalone build
  Dockerfile.caddy        # Custom Caddy with Hetzner DNS module
  docker-compose.prod.yml # Production 3-service orchestration
  Caddyfile               # Wildcard subdomain routing + HTTPS
  .env.example            # Environment variable template
  backup.sh               # Automated backup script
  restore.sh              # Backup restoration script (for testing)
```

### Pattern 1: 4-Stage Dockerfile for pnpm + Turbo Monorepo

**What:** Multi-stage Docker build that prunes the monorepo, installs dependencies, builds, and creates a minimal production image.

**When to use:** Always for production Next.js deployments from a turbo monorepo.

**Example:**
```dockerfile
# Stage 1: Prune monorepo to only web app and its workspace dependencies
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install -g turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune web --docker

# Stage 2: Install dependencies (cached layer -- only rebuilds when package.json changes)
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
# Copy lockfile and package.json files first (from turbo prune --docker output)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=web

# Stage 4: Production runner (~150MB)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# Copy standalone output (includes only needed node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Copy static assets (standalone output does NOT include these)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Copy public directory if it exists
# COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 2000
ENV PORT=2000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
```

**Critical: next.config.ts must be updated FIRST:**
```typescript
import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Tell Next.js to trace dependencies from the monorepo root,
  // not just the apps/web directory. Without this, @everyskill/* packages are missed.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@everyskill/ui", "@everyskill/core", "@everyskill/db"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
```

Source: [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker), [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying), verified blog at bstefanski.com

### Pattern 2: Custom Caddy Build with DNS Module

**What:** Build a custom Caddy Docker image that includes the Hetzner DNS provider module for DNS-01 wildcard certificate challenges.

**When to use:** When you need wildcard certificates and your DNS is hosted on Hetzner.

**Example:**
```dockerfile
# docker/Dockerfile.caddy
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/hetzner/v2

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

**Caddyfile:**
```caddyfile
# Wildcard cert for *.everyskill.ai + apex domain
*.everyskill.ai, everyskill.ai {
    tls {
        dns hetzner {env.HETZNER_DNS_API_TOKEN}
    }
    reverse_proxy web:2000
}
```

Source: [caddy-dns/hetzner](https://github.com/caddy-dns/hetzner), [Caddy Wildcard Docs](https://caddyserver.com/docs/automatic-https)

### Pattern 3: Internal-Only Database Network

**What:** PostgreSQL is accessible only within the Docker network. No host port mapping.

**When to use:** Always in production. NEVER expose database ports to the host.

**Example:**
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    # NO ports: section -- internal only
    networks:
      - internal
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U everyskill"]
      interval: 5s
      timeout: 5s
      retries: 5

  web:
    # ...
    networks:
      - internal
      - public

  caddy:
    # ...
    ports:
      - "80:80"
      - "443:443"
    networks:
      - public
      - internal

networks:
  internal:
    internal: true  # No external access
  public:
```

Source: Docker networking best practices, SOC2-07 requirement

### Pattern 4: Health Check Cascade

**What:** Services start in dependency order using health checks as readiness gates.

**When to use:** Always in Docker Compose production deployments.

**Example:**
```yaml
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U everyskill"]
      interval: 5s
      timeout: 5s
      retries: 5

  web:
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:2000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s  # Give Next.js time to start

  caddy:
    depends_on:
      web:
        condition: service_healthy
```

**Requires creating `/api/health` endpoint:**
```typescript
// apps/web/app/api/health/route.ts
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@everyskill/db";

export async function GET() {
  const dbOk = isDatabaseConfigured();
  if (!dbOk) {
    return NextResponse.json({ status: "unhealthy", db: false }, { status: 503 });
  }
  return NextResponse.json({ status: "healthy", db: true });
}
```

**IMPORTANT:** Add `/api/health` to the middleware matcher exemptions:
```typescript
// middleware.ts -- add to exempt paths
if (
  pathname.startsWith("/api/auth") ||
  pathname === "/api/dev-login" ||
  pathname.startsWith("/api/install-callback") ||
  pathname.startsWith("/api/mcp") ||
  pathname === "/api/validate-key" ||
  pathname === "/api/health"  // <-- Add this
) {
  return NextResponse.next();
}
```

### Pattern 5: Encrypted Backup Pipeline

**What:** Automated pg_dump with gzip compression, GPG encryption, and off-site transfer.

**When to use:** Production databases requiring SOC2 compliance.

**Example:**
```bash
#!/bin/bash
# docker/backup.sh
set -euo pipefail

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="everyskill_${DATE}.sql.gz.gpg"
RETENTION_DAYS=90

# Dump, compress, and encrypt in a single pipeline (no unencrypted temp file)
docker exec everyskill-postgres pg_dump -U everyskill everyskill \
  | gzip \
  | gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase-file /etc/backup-passphrase \
  > "${BACKUP_DIR}/${BACKUP_FILE}"

# Transfer to Hetzner Storage Box (off-site)
rsync -az --port=23 \
  "${BACKUP_DIR}/${BACKUP_FILE}" \
  "uXXXXXX@uXXXXXX.your-storagebox.de:backups/"

# Cleanup old local backups
find "${BACKUP_DIR}" -name "everyskill_*.sql.gz.gpg" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup complete: ${BACKUP_FILE}"
```

**Cron schedule:**
```cron
# Hourly incremental (WAL-based or pg_dump of recent changes)
0 * * * * /opt/everyskill/backup.sh >> /var/log/backup.log 2>&1
# Daily full at 2 AM
0 2 * * * /opt/everyskill/backup.sh --full >> /var/log/backup.log 2>&1
```

**Note on "incremental":** PostgreSQL does not have true incremental pg_dump. For SOC2 compliance, "hourly incremental" in this context means hourly full pg_dumps (the database is small enough for this to complete in seconds). For true incrementals, WAL archiving would be needed, which adds complexity beyond the Phase 27 scope.

### Anti-Patterns to Avoid

- **Exposing PostgreSQL ports to host:** `ports: "5432:5432"` makes the database accessible from the internet. Docker bypasses UFW/iptables rules. NEVER do this in production.
- **Copying .env into Docker image:** Secrets end up in image layers. Use runtime `environment:` or `env_file:` in docker-compose.yml instead.
- **Using `ARG` for secrets:** ARG values are visible in `docker image history`. Use runtime env vars only.
- **Missing `outputFileTracingRoot`:** Without this, Next.js standalone build misses `@everyskill/*` workspace packages. The app will crash on startup with module-not-found errors.
- **Missing `.dockerignore`:** Without it, `node_modules/`, `.next/`, `.env`, and other large/sensitive directories get copied into the build context, slowing builds and potentially leaking secrets.
- **Using `latest` tags for base images:** Pin to specific versions (`node:22-alpine`, `pgvector/pgvector:pg17`). `latest` can break builds without warning.
- **Running as root in containers:** Always create and use a non-root user (`nextjs` user with UID 1001).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS certificate management | Manual certbot + cron | Caddy automatic HTTPS | Caddy handles issuance, renewal, OCSP stapling automatically |
| Wildcard DNS challenge | Custom ACME client | caddy-dns/hetzner module | Handles TXT record creation/cleanup automatically |
| Monorepo Docker optimization | Manual dependency copying | `turbo prune web --docker` | Automatically creates minimal dependency tree with pruned lockfile |
| Next.js production server | Custom Express server | `output: "standalone"` + `server.js` | Standalone includes its own minimal server, no custom server needed |
| Database backup encryption | Custom encryption logic | gpg symmetric with AES256 | Standard, auditable, well-understood tool |
| Docker health checks | Custom monitoring scripts | Built-in Docker healthcheck | Native restart and dependency ordering based on health status |
| pgvector installation | Custom Dockerfile with apt/compile | `pgvector/pgvector:pg17` image | Pre-compiled, maintained by pgvector team, just works |
| Service dependency ordering | sleep/wait-for scripts | Docker Compose `depends_on` + `condition: service_healthy` | Native, reliable, no scripts needed |

**Key insight:** Every component of this deployment has a standard, battle-tested solution. The only custom code is the backup script (a ~20 line shell script) and the `/api/health` endpoint (~10 lines).

## Common Pitfalls

### Pitfall 1: Tailscale Port 443 Conflict

**What goes wrong:** Tailscale is already running on the VPS and listening on port 443. When Caddy tries to bind to 0.0.0.0:443, it fails with "address already in use."

**Why it happens:** The VPS has Tailscale configured to use port 443 for its DERP/tunnel connections or for serving Tailscale HTTPS certificates.

**How to avoid:** Two approaches:
1. **Preferred:** Configure Caddy to bind only to the public IP address (not 0.0.0.0), while Tailscale binds to the Tailscale interface. In docker-compose: `ports: ["178.156.181.178:80:80", "178.156.181.178:443:443"]`
2. **Alternative:** Reconfigure Tailscale to use a different port (e.g., 41641 which is its default UDP port) and let Caddy have 443.
3. **Last resort:** Run Caddy on the host network (`network_mode: host`) but this sacrifices Docker network isolation.

**Warning signs:** Caddy container fails to start, logs show "bind: address already in use" for port 443.

### Pitfall 2: Docker Bypasses UFW Firewall

**What goes wrong:** Docker manipulates iptables directly, bypassing UFW rules. Even if you `ufw deny 5432`, a Docker container with `ports: "5432:5432"` is accessible from the internet.

**Why it happens:** Docker inserts its own iptables chains before UFW's rules.

**How to avoid:** NEVER use `ports:` for internal services. Use Docker internal networks instead. Only Caddy should have `ports:` for 80 and 443. Verify with `nmap -p 5432 <server-ip>` from an external machine.

**Warning signs:** Database accessible from external network scan.

### Pitfall 3: Missing outputFileTracingRoot in Monorepo

**What goes wrong:** Next.js standalone build traces file dependencies starting from the app directory (`apps/web/`). In a monorepo, workspace packages like `@everyskill/db` live outside this directory at `packages/db/`. Without `outputFileTracingRoot`, these files are not included in the standalone output. The app crashes on startup with "Cannot find module '@everyskill/db'".

**Why it happens:** Next.js file tracing doesn't know about the monorepo root unless explicitly told.

**How to avoid:** Set `outputFileTracingRoot: path.join(__dirname, "../../")` in `next.config.ts`. This tells Next.js to trace from the monorepo root, capturing all workspace dependencies.

**Warning signs:** Build succeeds but container crashes immediately with module resolution errors.

### Pitfall 4: Secrets in Docker Image Layers

**What goes wrong:** If `.env` files are not excluded from the Docker build context, they get copied into the image during the `COPY . .` stage. Even if later stages don't use them, the secrets persist in the intermediate layer and can be extracted with `docker history`.

**Why it happens:** Developers forget to create `.dockerignore` or don't exclude env files.

**How to avoid:** Create a comprehensive `.dockerignore` file:
```
node_modules
.next
.turbo
dist
.env
.env.*
.git
.planning
playwright-report
test-results
coverage
```

**Warning signs:** Docker build context is unexpectedly large (contains node_modules); `docker history` shows layers with env file copies.

### Pitfall 5: LUKS Key Management and Remote Unlock

**What goes wrong:** After LUKS encryption, the server cannot boot without the encryption passphrase. If the server reboots (OS update, power failure, Hetzner maintenance), it hangs at the LUKS unlock prompt. Without Dropbear SSH configured in initramfs, the only way to unlock is through Hetzner's KVM console.

**Why it happens:** Full-disk encryption requires a key at every boot. There is no persistent unlock on a headless server.

**How to avoid:**
1. Install Dropbear in initramfs for remote SSH-based unlock
2. Configure Dropbear on port 2222 with key-only auth
3. Document the unlock procedure in a runbook
4. Designate at least two key custodians who can perform the unlock
5. Test the unlock procedure before deploying production workloads
6. Set up monitoring that alerts if the server is down after reboot (hasn't come up within 10 minutes)

**Warning signs:** Server unreachable after a reboot; SSH to port 22 times out (Dropbear on port 2222 is the only way in).

### Pitfall 6: Caddy DNS Module Compatibility

**What goes wrong:** The `caddy-dns/hetzner` module had compatibility issues with Caddy v2.10 due to a libdns 1.0 update. Building with `xcaddy` may fail or produce a binary that doesn't work.

**Why it happens:** The module maintainer was slow to merge the v2.10 compatibility PR. Version v2.0.0 (Preview 3, Dec 2025) should address this.

**How to avoid:**
1. Use `github.com/caddy-dns/hetzner/v2` (v2 module path) not the v1 path
2. Test the custom Caddy build locally before deploying
3. Verify wildcard cert issuance works with a test domain first
4. Have a fallback plan: individual per-subdomain certs work without the DNS module (Caddy provisions them on-demand via HTTP-01 challenge), but only for the apex domain, not wildcards

**Warning signs:** `xcaddy build` fails with dependency errors; Caddy logs show "module not registered: dns.providers.hetzner".

### Pitfall 7: pnpm Workspace Symlinks in Docker

**What goes wrong:** When using `turbo prune --docker`, the pruned lockfile and workspace structure must be copied correctly. Missing `pnpm-workspace.yaml` or `pnpm-lock.yaml` from the pruned output causes `pnpm install --frozen-lockfile` to fail.

**Why it happens:** The turbo prune `--docker` flag outputs files into `out/json/` (package.json files only) and `out/full/` (complete source). The lockfile and workspace config are at the output root, not inside these subdirectories.

**How to avoid:** Copy these files explicitly in the installer stage:
```dockerfile
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
```

**Warning signs:** `pnpm install --frozen-lockfile` fails with "Cannot find pnpm-lock.yaml" or "This project is configured to use a workspace but no workspace configuration file was found".

## Code Examples

### Complete docker-compose.prod.yml

```yaml
# docker/docker-compose.prod.yml
services:
  caddy:
    build:
      context: .
      dockerfile: Dockerfile.caddy
    container_name: everyskill-caddy
    ports:
      - "178.156.181.178:80:80"
      - "178.156.181.178:443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    environment:
      HETZNER_DNS_API_TOKEN: ${HETZNER_DNS_API_TOKEN}
    depends_on:
      web:
        condition: service_healthy
    networks:
      - public
      - internal
    restart: unless-stopped

  web:
    build:
      context: ../
      dockerfile: docker/Dockerfile
    container_name: everyskill-web
    environment:
      DATABASE_URL: postgresql://everyskill:${DB_PASSWORD}@postgres:5432/everyskill
      NEXTAUTH_URL: https://everyskill.ai
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID}
      AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET}
      NEXT_PUBLIC_ROOT_DOMAIN: everyskill.ai
      NEXT_PUBLIC_APP_URL: https://everyskill.ai
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      R2_ENDPOINT: ${R2_ENDPOINT}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME}
      ADMIN_EMAILS: ${ADMIN_EMAILS}
      NODE_ENV: production
    expose:
      - "2000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:2000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks:
      - internal
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg17
    container_name: everyskill-postgres
    environment:
      POSTGRES_USER: everyskill
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: everyskill
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U everyskill"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - internal
    restart: unless-stopped
    # NO ports: section -- database is internal only (SOC2-07)

volumes:
  postgres_data:
  caddy_data:
  caddy_config:

networks:
  internal:
    internal: true
  public:
```

### Complete Caddyfile

```caddyfile
# docker/Caddyfile
*.everyskill.ai, everyskill.ai {
    tls {
        dns hetzner {env.HETZNER_DNS_API_TOKEN}
    }

    # Pass the original Host header to Next.js for subdomain extraction
    reverse_proxy web:2000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### Complete .dockerignore

```
# docker/.dockerignore (place at repo root)
node_modules
.next
.turbo
dist
.env
.env.*
.env.local
.git
.gitignore
.planning
playwright-report
test-results
coverage
docker
.vscode
.idea
*.tsbuildinfo
*.md
!README.md
```

### Environment Variable Template

```bash
# docker/.env.example

# === Database ===
DB_PASSWORD=                          # Strong random password for PostgreSQL

# === Auth.js / NextAuth ===
AUTH_SECRET=                          # Generate: openssl rand -base64 32
AUTH_GOOGLE_ID=                       # Google Cloud Console OAuth client ID
AUTH_GOOGLE_SECRET=                   # Google Cloud Console OAuth client secret

# === Domain ===
NEXT_PUBLIC_ROOT_DOMAIN=everyskill.ai
NEXT_PUBLIC_APP_URL=https://everyskill.ai

# === Caddy / DNS ===
HETZNER_DNS_API_TOKEN=               # Hetzner DNS Console API token (Zone.DNS:Edit)

# === R2 Storage ===
R2_ENDPOINT=                         # Cloudflare R2 endpoint
R2_ACCESS_KEY_ID=                    # R2 access key
R2_SECRET_ACCESS_KEY=                # R2 secret key
R2_BUCKET_NAME=                      # R2 bucket name

# === AI Services ===
ANTHROPIC_API_KEY=                   # For AI review feature

# === Admin ===
ADMIN_EMAILS=                        # Comma-separated admin emails

# === Backup (set on host, not in Docker) ===
# BACKUP_GPG_PASSPHRASE=             # Symmetric encryption passphrase
# STORAGEBOX_USER=                   # Hetzner Storage Box username (uXXXXXX)
# STORAGEBOX_HOST=                   # Hetzner Storage Box hostname
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| postgres:16-alpine | pgvector/pgvector:pg17 | PostgreSQL 17 stable (2024) | Upgrade needed; pg17 is current stable with pgvector pre-compiled |
| caddy-dns/hetzner v1 | caddy-dns/hetzner/v2 | Dec 2025 (v2.0.0-preview3) | v2 uses Hetzner Console Cloud DNS API; v1 is legacy |
| turbo prune --scope | turbo prune (no --scope flag) | Turbo 2.x | The `--scope` flag was replaced; use `turbo prune web` directly |
| next.config.js | next.config.ts | Next.js 15+ | TypeScript config is the default; ESM imports for `path` and `url` needed |
| `caddy:2.10-alpine` | `caddy:2-alpine` | Ongoing | Use major version tag `2` for latest stable; pin to specific if needed |

**Deprecated/outdated:**
- `turbo prune --scope=web --docker` -- the `--scope` flag no longer exists in Turbo 2.x. Use `turbo prune web --docker` instead.
- `caddy-dns/hetzner` (v1 module path) -- use `github.com/caddy-dns/hetzner/v2` for Caddy v2.10+ compatibility.
- `NEXTAUTH_URL` as the primary config -- Auth.js v5 with `trustHost: true` derives the host from request headers. But `NEXTAUTH_URL` is still used for OAuth callback URL construction.

## Deployment Sequence

The deployment has two tracks that can proceed in parallel:

**Track A: Server Infrastructure (one-time manual setup)**
1. LUKS encryption via Hetzner Rescue Mode + Dropbear remote unlock
2. Verify LUKS works (reboot test with Dropbear unlock)
3. Create Hetzner DNS API token for wildcard certs
4. Set up Hetzner Storage Box for off-site backups
5. Generate backup GPG key

**Track B: Application Docker Configuration (code changes)**
1. Update `next.config.ts` with `output: "standalone"` and `outputFileTracingRoot`
2. Create `/api/health` endpoint + middleware exemption
3. Create `.dockerignore`
4. Create `Dockerfile` (4-stage Next.js build)
5. Create `Dockerfile.caddy` (custom Caddy with Hetzner DNS)
6. Create `Caddyfile` (wildcard routing)
7. Create `docker-compose.prod.yml` (3 services)
8. Create `.env.example` template
9. Create `backup.sh` and `restore.sh` scripts
10. Local build test (`docker compose build`)
11. Local run test (`docker compose up`) with health check verification

**Integration: Deploy to VPS**
1. Clone repo to VPS
2. Create `.env` from template with production values
3. `docker compose -f docker/docker-compose.prod.yml up -d`
4. Verify all health checks pass
5. Verify wildcard HTTPS works (curl from external)
6. Run database migrations
7. Set up backup cron jobs
8. Verify backup + restore cycle

## Open Questions

Things that couldn't be fully resolved:

1. **Tailscale port conflict resolution**
   - What we know: Tailscale is on port 443 on the VPS. Caddy needs 443 for HTTPS.
   - What's unclear: How exactly Tailscale is configured (funnel? DERP? proxy?). Whether binding Caddy to the public IP only (178.156.181.178:443) while Tailscale uses 100.x.x.x:443 (Tailscale interface) avoids the conflict.
   - Recommendation: Check Tailscale config on VPS (`tailscale status`, `ss -tlnp | grep 443`). If binding to specific IPs works, do that. Otherwise, reconfigure Tailscale to not use 443.

2. **caddy-dns/hetzner v2.0.0 stability**
   - What we know: v2.0.0 Preview 3 was released Dec 2025. There was a Caddy v2.10 compatibility issue in May 2025 that was addressed by the v2 release.
   - What's unclear: Whether v2.0.0 is fully stable or still in preview. The "Preview 3" label suggests it may not be GA.
   - Recommendation: Build and test locally. If it fails, fall back to `caddy-dns/cloudflare` (would require migrating DNS to Cloudflare, which is more work but more stable).

3. **Database migration strategy for pg16 to pg17**
   - What we know: Dev uses postgres:16-alpine. Production will use pgvector/pgvector:pg17.
   - What's unclear: Whether a pg_dump/pg_restore cycle is needed or if the data directory is compatible.
   - Recommendation: Since this is a fresh production deployment (no existing prod database), simply start with pg17. Seed/migrate from scratch. Dev database stays on pg16 for now (compatible at the SQL level).

4. **Backup "incremental" implementation**
   - What we know: SOC2-06 requires "hourly incremental + daily full." PostgreSQL pg_dump is always a full dump.
   - What's unclear: Whether hourly full dumps are acceptable, or if WAL archiving is truly needed.
   - Recommendation: For a small database (<1GB), hourly pg_dump is fine and completes in seconds. Call these "hourly snapshots" rather than "incremental" in documentation. Add WAL archiving only if database grows significantly.

5. **Public directory**
   - What we know: `apps/web/public/` does not currently exist (no static assets).
   - What's unclear: Whether it will exist by deployment time.
   - Recommendation: Include the COPY line in Dockerfile but comment it out with a note. Uncomment when public/ is added.

## Sources

### Primary (HIGH confidence)
- [Turborepo Docker Guide](https://turborepo.dev/docs/guides/tools/docker) -- turbo prune --docker, multi-stage Dockerfile pattern
- [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying) -- standalone output, outputFileTracingRoot
- [caddy-dns/hetzner GitHub](https://github.com/caddy-dns/hetzner) -- v2.0.0, xcaddy build, Caddyfile syntax
- [caddy-dns/cloudflare GitHub](https://github.com/caddy-dns/cloudflare) -- Alternative DNS module, Dockerfile pattern
- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https) -- Wildcard cert, DNS-01 requirements
- [pgvector/pgvector Docker Hub](https://hub.docker.com/r/pgvector/pgvector) -- pg17 tag, pre-compiled extension
- [Hetzner Storage Box Docs](https://docs.hetzner.com/storage/storage-box/) -- SSH/rsync access, backup storage
- Codebase audit: `next.config.ts`, `middleware.ts`, `auth.config.ts`, `package.json`, `turbo.json`, `docker/docker-compose.yml`

### Secondary (MEDIUM confidence)
- [Turborepo + pnpm Dockerfile (bstefanski.com)](https://www.bstefanski.com/blog/turborepo-nextjs-dockerfile) -- Verified pnpm + turbo prune pattern
- [Hetzner LUKS Encryption Guide (disk-encryption-hetzner)](https://github.com/TheReal1604/disk-encryption-hetzner/blob/master/ubuntu/ubuntu_swraid_lvm_luks.md) -- Complete LUKS + Dropbear procedure
- [Caddy Community: Wildcard + Cloudflare DNS](https://caddy.community/t/how-to-guide-caddy-v2-cloudflare-dns-01-via-docker/8007) -- Docker pattern for DNS challenge
- [Caddy Community: Hetzner DNS v2.10 compatibility](https://caddy.community/t/module-dns-providers-hetzner-not-compatible-with-caddy-v2-10/31142) -- Known issue, v2.0.0 fix
- DNS lookup: `dig NS everyskill.ai` returns Hetzner nameservers (hydrogen/helium/oxygen.ns.hetzner)

### Tertiary (LOW confidence)
- Tailscale port conflict resolution -- inferred from search results, needs verification on actual VPS
- caddy-dns/hetzner v2.0.0 stability -- labeled "Preview 3", may have edge cases
- Hourly pg_dump adequacy for SOC2 "incremental" requirement -- interpretation, auditor may require WAL archiving

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools are well-documented, production-proven, verified via official sources
- Architecture (Docker topology): HIGH -- 3-service Compose with Caddy is a standard pattern, verified via multiple sources
- Architecture (LUKS): MEDIUM -- Procedure is well-documented but involves manual server operations in rescue mode
- Pitfalls: HIGH -- Identified from codebase audit (missing outputFileTracingRoot, missing .dockerignore) and verified infrastructure constraints (Tailscale port conflict, Docker bypassing UFW)
- Backup strategy: MEDIUM -- pg_dump + gpg is standard, but "incremental" interpretation and Storage Box integration details need validation

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable infrastructure, unlikely to change rapidly)
