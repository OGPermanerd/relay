---
phase: 30-branding-navigation
plan: 04
status: complete
subsystem: branding
tags: [server-component, tenant, branding, white-label]
dependency_graph:
  requires: ["30-01"]
  provides: ["TenantBranding server component"]
  affects: ["apps/web/components/tenant-branding.tsx"]
tech_stack:
  patterns: ["server component with async headers", "conditional branding by tenant plan"]
key_files:
  created:
    - apps/web/components/tenant-branding.tsx
metrics:
  duration: 38s
  completed: 2026-02-08
---

# Phase 30 Plan 04: TenantBranding Server Component Summary

Server component that reads x-tenant-slug header, resolves tenant from DB via getTenantBySlug, and renders three branding variants: default AnimatedLogo, paid tenant-only logo, or freemium "TenantName x EverySkill" co-brand.

## What Was Done

Created `apps/web/components/tenant-branding.tsx` as an async server component that:

1. Reads the `x-tenant-slug` header injected by middleware via `await headers()`
2. Calls `getTenantBySlug()` from `@everyskill/db/services/tenant` to resolve the tenant
3. Renders three variants based on tenant state:
   - **No tenant / unknown slug**: Default `AnimatedLogo` component (from plan 30-01)
   - **Paid tenant with logo**: Tenant's own logo only via plain `<img>` tag
   - **Freemium tenant**: "TenantName x EverySkill" co-brand with optional tenant logo and small AnimatedLogo

Key design decisions:
- Uses plain `<img>` tag for tenant logos instead of `next/image` to avoid needing `remotePatterns` config for arbitrary tenant logo domains
- Server component (async) to read headers and fetch tenant data server-side without client-side fetching
- Falls back gracefully to default AnimatedLogo when no subdomain or unknown tenant

## Files Modified

- `apps/web/components/tenant-branding.tsx` (created) -- TenantBranding server component

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | a798bd8 | feat(30-04): create TenantBranding server component |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript check (`npx tsc --noEmit -p apps/web/tsconfig.json`): PASSED with zero errors
- Component exports `TenantBranding` (async function)
- Imports `AnimatedLogo` from `@/components/animated-logo` (30-01 output)
- Imports `getTenantBySlug` from `@everyskill/db/services/tenant`
- Uses `await headers()` (async pattern per Next.js 15+)

## Self-Check: PASSED

- FOUND: apps/web/components/tenant-branding.tsx
- FOUND: commit a798bd8
