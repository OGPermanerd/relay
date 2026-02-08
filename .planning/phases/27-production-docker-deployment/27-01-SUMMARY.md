---
phase: 27-production-docker-deployment
plan: 01
subsystem: infrastructure
tags: [docker, nextjs, standalone, health-check, dockerignore]
dependency-graph:
  requires: []
  provides: [standalone-output, health-endpoint, dockerignore]
  affects: [27-02, 27-04]
tech-stack:
  added: []
  patterns: [next-standalone-output, docker-health-check]
key-files:
  created:
    - apps/web/app/api/health/route.ts
    - .dockerignore
  modified:
    - apps/web/next.config.ts
    - apps/web/middleware.ts
decisions:
  - id: standalone-output
    description: "Next.js standalone output with outputFileTracingRoot pointing to monorepo root"
    rationale: "Standalone produces ~150MB image vs ~1GB; tracing root ensures @everyskill/* packages are included"
  - id: health-lightweight
    description: "Health endpoint checks isDatabaseConfigured() not full query"
    rationale: "Fast response for Docker health checks; avoids DB connection pool overhead"
metrics:
  duration: ~2 min
  completed: 2026-02-08
---

# Phase 27 Plan 01: Next.js Standalone Config + Health Endpoint + .dockerignore

**Prepare Next.js app for Docker deployment with standalone output, health check endpoint, and build context exclusions.**

## What Was Done

### Task 1: Enable standalone output and add health endpoint

1. **apps/web/next.config.ts** — Added `output: "standalone"` and `outputFileTracingRoot: path.join(import.meta.dirname, "../../")` to produce a self-contained build that includes monorepo workspace packages.

2. **apps/web/app/api/health/route.ts** — New health check endpoint returning `{status: "healthy", db: true}` (200) or `{status: "unhealthy", db: false}` (503). Uses `isDatabaseConfigured()` from `@everyskill/db`. Marked `force-dynamic`.

3. **apps/web/middleware.ts** — Added `/api/health` to the exempt paths block so Docker health checks bypass auth.

### Task 2: Create .dockerignore

Created `.dockerignore` at repo root excluding: `node_modules`, `.next`, `.turbo`, `dist`, `.env*`, `.git`, `.planning`, test artifacts, `docker/`, IDE configs, and `*.tsbuildinfo`.

## Deviations from Plan

None — plan executed as written.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1+2 | 974c35d | feat(27-01): prepare Next.js for Docker deployment |

## Verification

- [x] `next.config.ts` contains `output: "standalone"` and `outputFileTracingRoot`
- [x] `/api/health` route exists and exports GET handler
- [x] Middleware exempts `/api/health` from auth
- [x] `.dockerignore` exists at repo root with proper exclusions
- [x] `pnpm turbo build --filter=web` succeeds with standalone output (81MB)

## Next Phase Readiness

- Standalone output ready for Dockerfile COPY in plan 27-02
- Health endpoint ready for docker-compose health checks in plan 27-04
- .dockerignore prevents secrets and large dirs from entering build context

## Self-Check: PASSED
