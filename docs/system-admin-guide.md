# EverySkill System Administration Guide

## Architecture Overview

```
Internet
  │
  ▼
Caddy (VPS host 178.156.181.178)
  │  ├── everyskill.ai          → LXC relay-dev:2000 (production)
  │  ├── staging.everyskill.ai  → LXC relay-dev:2001 (staging)
  │  ├── *.everyskill.ai        → LXC relay-dev:2000 (tenant subdomains)
  │  └── muse.everyskill.ai     → LXC ceo:3001 (Muse MCP)
  ▼
LXC relay-dev (10.10.10.152)
  ├── PM2: everyskill-prod    (port 2000, .env.production)
  ├── PM2: everyskill-staging (port 2001, .env.staging)
  └── Dev server              (port 2002, .env.local)
```

- **VPS host:** Hetzner, 32GB RAM / 8 vCPU, runs Caddy reverse proxy
- **LXC container:** `relay-dev`, runs the application via PM2
- **Database:** PostgreSQL 16, local to the LXC
- **TLS:** Caddy auto-provisions via Let's Encrypt (on-demand for tenant subdomains)

---

## Going Live Checklist

### 1. Generate Secrets

```bash
# Generate AUTH_SECRET (session encryption key)
openssl rand -base64 32
```

### 2. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application type)
3. Set authorized redirect URIs:
   - `https://everyskill.ai/api/auth/callback/google`
   - `https://staging.everyskill.ai/api/auth/callback/google`
4. Copy the Client ID and Client Secret

### 3. Fill Environment Files

Both `.env.production` and `.env.staging` live in `/home/dev/projects/relay/` (gitignored).

**Required variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://everyskill:SECURE_PASSWORD@localhost:5432/everyskill` |
| `AUTH_SECRET` | Session encryption (from step 1) | `K7x...base64...` |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | `983...apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | `GOCSPX-...` |
| `NEXTAUTH_URL` | Canonical app URL | `https://everyskill.ai` (prod) / `https://staging.everyskill.ai` (staging) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Root domain for cookies | `everyskill.ai` |
| `NEXT_PUBLIC_APP_URL` | Public-facing app URL | `https://everyskill.ai` |
| `ANTHROPIC_API_KEY` | For AI skill reviews | `sk-ant-...` |
| `VOYAGE_API_KEY` | For semantic embeddings | `pa-...` |
| `R2_ENDPOINT` | Cloudflare R2 endpoint | `https://....r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 access key | |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | |
| `R2_BUCKET_NAME` | R2 bucket name | `everyskill` |

**Staging uses a separate database** (`everyskill_staging`) but can share API keys.

### 4. Set Up Databases

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create production database + user
CREATE USER everyskill WITH PASSWORD 'your-secure-password';
CREATE DATABASE everyskill OWNER everyskill;
\c everyskill
CREATE EXTENSION IF NOT EXISTS vector;

# Create staging database
CREATE DATABASE everyskill_staging OWNER everyskill;
\c everyskill_staging
CREATE EXTENSION IF NOT EXISTS vector;

\q
```

### 5. Run Migrations

```bash
cd /home/dev/projects/relay

# Staging
source .env.staging && export DATABASE_URL && pnpm db:migrate

# Production
source .env.production && export DATABASE_URL && pnpm db:migrate
```

### 6. Create Default Tenant

The first migration seeds a `default` tenant, but you need to create a tenant for each email domain that should be able to log in.

```sql
-- Connect to production database
psql -U everyskill -d everyskill

-- Create a tenant for your organization
INSERT INTO tenants (id, name, slug, domain, is_active, plan)
VALUES (
  gen_random_uuid()::text,
  'FNCR',
  'fncr',
  'fncr.com',
  true,
  'freemium'
);
```

The `domain` column is the email domain — anyone with a `@fncr.com` Google account can sign in. The **first user** to sign in for a tenant is automatically promoted to **admin**.

### 7. Deploy

```bash
# Build and deploy to staging
./deploy.sh staging

# Verify staging works at https://staging.everyskill.ai
# Then promote to production
./deploy.sh promote
```

### 8. Configure CI/CD (Optional)

Set these GitHub Actions secrets:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | SSH user on VPS (e.g., `root`) |
| `VPS_SSH_KEY` | Private SSH key for deployment |

Pushes to `master` will auto-deploy to staging after CI passes.

---

## Day-to-Day Operations

### Deploying

```bash
# Deploy to staging (pull + build + migrate + reload)
./deploy.sh staging

# Promote staging build to production (with backup + rollback)
./deploy.sh promote
```

### Monitoring

```bash
# PM2 process status
pm2 status

# Tail logs
pm2 logs everyskill-prod --lines 100
pm2 logs everyskill-staging --lines 100

# Health check
curl -s http://localhost:2000/api/health | jq .
curl -s http://localhost:2001/api/health | jq .

# System resources
uptime && free -h | grep Mem
```

### Restarting

```bash
# Reload (zero-downtime)
pm2 reload everyskill-prod --update-env

# Hard restart
pm2 restart everyskill-prod

# Restart after env changes
pm2 reload everyskill-prod --update-env
```

### Database

```bash
# Run pending migrations
source .env.production && export DATABASE_URL && pnpm db:migrate

# Open Drizzle Studio (visual DB explorer)
source .env.production && export DATABASE_URL && pnpm db:studio

# Direct psql access
psql -U everyskill -d everyskill
```

### Adding a New Tenant

```sql
INSERT INTO tenants (id, name, slug, domain, is_active, plan)
VALUES (
  gen_random_uuid()::text,
  'Acme Corp',         -- Display name
  'acme',              -- URL slug (acme.everyskill.ai)
  'acme.com',          -- Email domain for login
  true,
  'freemium'
);
```

After inserting, any `@acme.com` Google user can sign in. First user becomes admin.

### Revoking Access

```sql
-- Deactivate a tenant (blocks all sign-ins for that domain)
UPDATE tenants SET is_active = false WHERE domain = 'example.com';

-- Remove a specific user
DELETE FROM users WHERE email = 'user@example.com';
```

---

## Caddy (Reverse Proxy)

The Caddyfile lives on the VPS host at `/etc/caddy/Caddyfile`. Source of truth in the repo: `docker/Caddyfile`.

To update:

```bash
# From inside the LXC, write a script for the host
cat > /tmp/update-caddy.sh << 'EOF'
lxc file pull relay-dev/home/dev/projects/relay/docker/Caddyfile /tmp/Caddyfile
cp /tmp/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
EOF

# The VPS host operator runs this script
```

### On-Demand TLS for Tenant Subdomains

Caddy validates tenant subdomains by calling `http://10.10.10.152:2000/api/check-domain?domain=<hostname>`. If the domain maps to an active tenant, Caddy provisions a TLS certificate automatically.

---

## Development Environment

```bash
cd /home/dev/projects/relay

# Install dependencies
pnpm install

# Start dev server (port 2002)
cd apps/web && npm run dev

# Run tests
npx playwright test                              # All E2E tests
npx playwright test tests/e2e/specific.spec.ts   # Single test file

# Lint
pnpm lint

# Type check
pnpm turbo typecheck

# Build
pnpm turbo build --filter=web
```

Dev uses `.env.local` with a local PostgreSQL database (`everyskill` on localhost).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Access denied" on login | Email domain not in `tenants` table | Insert tenant row with matching domain |
| Blank page after deploy | Static assets not copied | Re-run `./deploy.sh staging` |
| Health check fails | App crash or DB connection error | Check `pm2 logs`, verify `DATABASE_URL` |
| TLS cert not provisioning | `/api/check-domain` returning 404 | Verify tenant exists and is active |
| Session not persisting across subdomains | Cookie domain mismatch | Verify `NEXT_PUBLIC_ROOT_DOMAIN=everyskill.ai` |
