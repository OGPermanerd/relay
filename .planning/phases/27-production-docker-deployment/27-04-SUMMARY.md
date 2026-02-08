---
phase: 27-production-docker-deployment
plan: 04
subsystem: infrastructure
tags: [docker-compose, orchestration, production, postgres, caddy]
dependency-graph:
  requires: [27-01, 27-02, 27-03]
  provides: [docker-compose-prod, env-template]
  affects: []
tech-stack:
  added: []
  patterns: [health-check-cascade, network-isolation, ip-bound-ports]
key-files:
  created:
    - docker/docker-compose.prod.yml
    - docker/.env.example
  modified: []
decisions:
  - id: ip-bound-caddy-ports
    description: "Caddy binds to 178.156.181.178:80 and :443, not 0.0.0.0"
    rationale: "Avoids conflict with Tailscale which also uses :443 on the VPS"
  - id: internal-only-postgres
    description: "PostgreSQL has no ports section — accessible only via Docker internal network"
    rationale: "SOC2-07 compliance; database never exposed to host or public network"
  - id: health-cascade
    description: "postgres (pg_isready) -> web (/api/health) -> caddy (depends_on web healthy)"
    rationale: "Ensures ordered startup; Caddy only starts after web is confirmed healthy"
metrics:
  duration: ~2 min
  completed: 2026-02-08
---

# Phase 27 Plan 04: Docker Compose Production Orchestration

**3-service Docker Compose stack with health check cascade, network isolation, and environment template.**

## What Was Done

### Task 1: Create docker-compose.prod.yml and .env.example

1. **docker/docker-compose.prod.yml** — Production orchestration with 3 services:
   - **caddy**: Custom build with Hetzner DNS module, IP-bound ports (178.156.181.178:80/:443), Caddyfile mounted read-only, depends on web healthy
   - **web**: Built from monorepo Dockerfile, exposes port 2000 internally only, health check via wget to /api/health, depends on postgres healthy, 30s start period
   - **postgres**: pgvector/pgvector:pg17 image, NO host ports (internal-only), pg_isready health check

   Networks: `internal` (internal: true) for web+postgres, `public` for caddy+web.
   Volumes: `postgres_data`, `caddy_data`, `caddy_config`.

2. **docker/.env.example** — Template documenting all 12 required environment variables across 6 categories (database, auth, DNS, AI services, R2 storage, admin) with generation instructions for secrets.

## Deviations from Plan

None — plan executed as written.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 116e603 | feat(27-04): add Docker Compose production orchestration |

## Verification

- [x] YAML validates (Python yaml.safe_load)
- [x] 3 services defined: caddy, web, postgres
- [x] postgres has NO ports section (internal-only)
- [x] caddy ports bind to 178.156.181.178 specifically
- [x] 2 healthcheck definitions (web + postgres; caddy relies on depends_on)
- [x] Volumes: postgres_data, caddy_data, caddy_config
- [x] Networks: internal (internal: true) and public
- [x] .env.example lists all 12 env vars referenced in compose file

## Next Phase Readiness

- Phase 27 fully complete — all deployment infrastructure ready
- Production deployment requires: LUKS setup (runbook), DNS A record, .env populated, `docker compose up`

## Self-Check: PASSED
