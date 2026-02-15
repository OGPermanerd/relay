# EverySkill Infrastructure

## Deployment Topology

```
Internet
  │
  ▼
Caddy (VPS host 178.156.181.178)
  │  Auto-TLS via Let's Encrypt
  │  On-demand certs for tenant subdomains
  │
  ├── everyskill.ai          ──┐
  ├── *.everyskill.ai         ─┤──► LXC relay-dev (10.10.10.152)
  ├── staging.everyskill.ai   ─┘      │
  │                                    ├── PM2: everyskill-prod    (:2000)
  │                                    ├── PM2: everyskill-staging (:2001)
  │                                    ├── Dev server              (:2002)
  │                                    ├── PostgreSQL 16           (:5432)
  │                                    └── Ollama                  (:11434)
  │
  └── Tailscale (100.109.82.118)
       └── Internal access for development + noVNC
```

### Host
- **Provider**: Hetzner VPS
- **Specs**: 32GB RAM, 8 vCPU, Ubuntu 24.04
- **Role**: Runs Caddy reverse proxy, manages LXC containers
- **Access**: SSH via Tailscale

### Application Container (LXC: relay-dev)
- **IP**: 10.10.10.152 (internal), 100.109.82.118 (Tailscale)
- **OS**: Ubuntu 24.04
- **Runtime**: Node.js 22 via nvm, PM2 process manager
- **Database**: PostgreSQL 16 (local, three databases)
- **AI**: Ollama running `nomic-embed-text` for local embeddings

---

## Environments

| Property | Production | Staging | Development |
|----------|-----------|---------|-------------|
| URL | everyskill.ai | staging.everyskill.ai | localhost:2002 |
| Port | 2000 | 2001 | 2002 |
| PM2 name | everyskill-prod | everyskill-staging | (npm run dev) |
| Database | everyskill | everyskill_staging | everyskill |
| Env file | .env.production | .env.staging | apps/web/.env.local |
| Google OAuth | Client 994097283862 | Client 994097283862 | Client 983177762193 |
| TLS | Auto (Caddy) | Auto (Caddy) | None |

### Environment File Hierarchy
- `apps/web/.env.local` overrides root `.env.local` for the web app
- PM2 loads from `.env.production` / `.env.staging` at the repo root
- After changing env files: `pm2 reload <name> --update-env`

### Key Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Session encryption key (openssl rand -base64 32) |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth Client Secret |
| `NEXTAUTH_URL` | Yes | Canonical app URL |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Yes | Root domain for cookies (everyskill.ai) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public-facing URL |
| `ANTHROPIC_API_KEY` | Yes | AI reviews, benchmarking |
| `VOYAGE_API_KEY` | Optional | Voyage AI embeddings (fallback to Ollama) |
| `R2_ENDPOINT` | Optional | Cloudflare R2 for file storage |
| `GMAIL_CLIENT_ID` | Optional | Gmail diagnostic OAuth |
| `GMAIL_CLIENT_SECRET` | Optional | Gmail diagnostic OAuth |
| `GMAIL_ENCRYPTION_KEY` | Optional | Token encryption (per-environment) |

---

## Deployment

### Standard Workflow

```bash
# 1. Deploy to staging (pull, build, migrate, reload, smoke test)
./deploy.sh staging

# 2. Verify staging manually or via smoke tests
#    Staging smoke tests run automatically during deploy

# 3. Promote staging build to production (backup, copy, migrate, reload, health check)
./deploy.sh promote
```

### What `deploy.sh staging` Does
1. `git pull origin master`
2. `pnpm install` (if lockfile changed)
3. `pnpm turbo build --filter=web` (with Turbo cache)
4. Copy `.next/standalone` + `public` + `static` to `builds/staging/`
5. Run migrations against staging DB
6. `pm2 reload everyskill-staging`
7. Wait for health check on :2001
8. Run Playwright staging smoke tests

### What `deploy.sh promote` Does
1. Backup current production build to `builds/production.bak/`
2. Copy `builds/staging/` to `builds/production/`
3. Run migrations against production DB
4. `pm2 reload everyskill-prod`
5. Wait for health check on :2000

### Rollback
```bash
# If production is broken after promotion:
cp -r builds/production.bak/* builds/production/
pm2 reload everyskill-prod
```

---

## Database

### PostgreSQL Configuration
- Version: 16
- Extensions: `pgvector` (similarity search), `pgcrypto` (UUID generation)
- Connection: local socket, password auth
- Three databases: `everyskill` (prod+dev), `everyskill_staging`

### Migration System
- Custom runner at `packages/db/src/migrate.ts`
- Tracks applied migrations in `_applied_migrations` table
- Does NOT use Drizzle's built-in migration tracking (`drizzle.__drizzle_migrations`)
- Run: `pnpm db:migrate` (requires `DATABASE_URL` in environment)
- 36 migrations (0000-0035) as of v5.0

### Schema Statistics
- 24 tables
- 9 tables with tenant_id + RLS policies
- HNSW index on skill_embeddings for vector search
- Denormalized counters on skills (totalUses, avgRating, feedbackPositiveCount, etc.)

### Backup
```bash
# Full backup
pg_dump -U everyskill everyskill > backup_$(date +%Y%m%d).sql

# Restore
psql -U everyskill everyskill < backup_20260215.sql
```

---

## Process Management (PM2)

### Auto-Start
- systemd service `pm2-dev.service` enabled — auto-starts PM2 on reboot
- PM2 resurrects processes from `~/.pm2/dump.pm2`
- Run `pm2 save` after any process configuration changes

### PM2 Commands
```bash
pm2 status                           # Process overview
pm2 logs everyskill-prod --lines 50  # Tail logs
pm2 reload everyskill-prod           # Zero-downtime reload
pm2 restart everyskill-prod          # Hard restart
pm2 reload everyskill-prod --update-env  # Reload with new env vars
pm2 monit                            # Real-time monitoring
```

### Process Configuration
```
everyskill-prod    | port 2000 | .env.production | cluster mode
everyskill-staging | port 2001 | .env.staging    | cluster mode
```

---

## TLS & Reverse Proxy (Caddy)

### Configuration
- Caddyfile on VPS host at `/etc/caddy/Caddyfile`
- Source of truth: `docker/Caddyfile` in repo
- Auto-provisions certificates via Let's Encrypt
- On-demand TLS for tenant subdomains (`*.everyskill.ai`)

### On-Demand TLS Validation
Caddy calls `http://10.10.10.152:2000/api/check-domain?domain=<hostname>` before provisioning a certificate. The endpoint returns 200 if the domain maps to an active tenant, 404 otherwise.

### Updating Caddy Config
```bash
# From inside LXC, write update script
cat > /tmp/update-caddy.sh << 'EOF'
lxc file pull relay-dev/home/dev/projects/relay/docker/Caddyfile /tmp/Caddyfile
cp /tmp/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
EOF
# VPS host operator runs the script
```

---

## Monitoring & Health Checks

### Health Endpoint
```bash
curl -s http://localhost:2000/api/health | jq .
# Returns: { "status": "healthy", "timestamp": "..." }
```

### System Health
```bash
uptime && free -h | grep Mem     # Load average and memory
ps aux --sort=-%cpu | head -10   # Top CPU consumers
ss -tlnp | grep -E "2000|2001"  # Verify ports are listening
```

### Circuit Breakers
- Stop if load average exceeds 40
- Stop if available memory drops below 2GB
- Stop after 3 identical failures in a row
- Kill runaway processes: `pkill -f "next-server" && pkill -9 node`

---

## Security

### Authentication
- Google Workspace SSO only — no public registration
- Email domain maps to tenant at sign-in
- JWT session strategy with 8-hour expiry (SOC2 compliance)
- Domain-scoped cookies with `__Secure-` prefix in production

### API Authentication
- API keys: `rlk_` prefix + SHA-256 hashed storage
- Timing-safe comparison for key validation
- Key expiry configurable per tenant (default 90 days)
- Bearer token auth on API endpoints

### Data Protection
- `sanitizePayload()` strips secrets from all user-submitted content
- RLS policies enforce tenant isolation at database level
- Gmail tokens encrypted with per-environment keys
- Insert-only audit tables for compliance trail

### Network
- VPS accessible only via Tailscale (development)
- Production traffic via Caddy with auto-TLS
- PostgreSQL listens on localhost only (no external access)
- Ollama listens on localhost only

---

## Cron Jobs

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/daily-digest` | Daily | Email digest of skill updates |
| `/api/cron/weekly-digest` | Weekly | Weekly summary email |
| `/api/cron/integrity-check` | Daily | Data integrity validation |

Cron jobs are triggered externally (systemd timer or crontab) via HTTP GET with auth.

---

*Last updated: 2026-02-15*
