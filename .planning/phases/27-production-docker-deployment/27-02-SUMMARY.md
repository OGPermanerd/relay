---
phase: 27-production-docker-deployment
plan: 02
subsystem: infrastructure
tags: [docker, caddy, deployment, production, containerization]
dependency-graph:
  requires: []
  provides: [dockerfile, caddy-reverse-proxy, wildcard-tls]
  affects: [27-03, 27-04]
tech-stack:
  added: []
  patterns: [multi-stage-docker-build, turbo-prune, xcaddy-builder]
key-files:
  created:
    - docker/Dockerfile
    - docker/Dockerfile.caddy
    - docker/Caddyfile
  modified: []
decisions:
  - 4-stage Dockerfile (pruner/installer/builder/runner) for minimal production image
  - Custom Caddy build with Hetzner DNS module for wildcard TLS via DNS challenge
  - public/ COPY commented out since apps/web/public/ does not exist yet
metrics:
  duration: 45s
  completed: 2026-02-07
---

# Phase 27 Plan 02: Dockerfiles and Caddyfile Summary

**4-stage multi-build Dockerfile for pnpm+turbo monorepo with custom Caddy reverse proxy for wildcard TLS**

## What Was Done

### Task 1: Create Dockerfiles and Caddyfile

Created three production deployment configuration files:

1. **docker/Dockerfile** -- 4-stage build optimized for the pnpm+turbo monorepo:
   - **pruner**: Uses `turbo prune web --docker` to extract only the web app and its workspace dependencies
   - **installer**: Installs dependencies from pruned lockfile (cached layer)
   - **builder**: Builds the Next.js app with standalone output
   - **runner**: Minimal alpine image (~150MB) running as non-root `nextjs` user on port 2000

2. **docker/Dockerfile.caddy** -- Custom Caddy image built with xcaddy including the `caddy-dns/hetzner/v2` module for DNS-01 ACME challenges (required for wildcard certificates).

3. **docker/Caddyfile** -- Wildcard subdomain routing configuration:
   - Matches `*.everyskill.ai` and `everyskill.ai`
   - TLS via Hetzner DNS API token for wildcard cert issuance
   - Reverse proxies to `web:2000` with proper forwarded headers

## Deviations from Plan

None -- plan executed exactly as written.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Dockerfiles and Caddyfile | f8f615c | docker/Dockerfile, docker/Dockerfile.caddy, docker/Caddyfile |

## Verification

- Dockerfile has 4 FROM stages (pruner, installer, builder, runner) -- confirmed
- Dockerfile.caddy includes Hetzner DNS module -- confirmed
- Caddyfile has wildcard domain, Hetzner TLS, and reverse proxy to web:2000 -- confirmed

## Next Phase Readiness

- docker/Dockerfile ready for docker-compose.prod.yml integration (plan 27-03)
- docker/Dockerfile.caddy ready for Caddy service definition (plan 27-03)
- docker/Caddyfile ready to be mounted into Caddy container (plan 27-03)

## Self-Check: PASSED
