---
plan: 28-07
phase: 28
subsystem: database
status: complete
duration: ~1 min
completed: 2026-02-08
tags: [schema, migration, site-settings, key-expiry, soc2]
tech-stack:
  added: []
  patterns: [idempotent-migration, per-tenant-config]
key-files:
  created:
    - packages/db/src/migrations/0007_add_key_expiry_days.sql
  modified:
    - packages/db/src/schema/site-settings.ts
decisions:
  - decision: "90-day default key expiry"
    rationale: "SOC2-05 compliance requires bounded API key lifetimes; 90 days is industry standard"
requires: [25-04]
provides: [key-expiry-config-column]
affects: [28-08, 28-09]
---

# Phase 28 Plan 07: Per-Tenant Key Expiry Configuration Summary

Added `keyExpiryDays` integer column to `site_settings` table with NOT NULL DEFAULT 90, enabling per-tenant API key expiry configuration for SOC2-05 compliance.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add keyExpiryDays to site_settings schema and migration | dee2aef | site-settings.ts, 0007_add_key_expiry_days.sql |

## Files Modified

- `packages/db/src/schema/site-settings.ts` -- Added `keyExpiryDays: integer("key_expiry_days").notNull().default(90)` after `embeddingDimensions`
- `packages/db/src/migrations/0007_add_key_expiry_days.sql` -- Created idempotent migration with IF NOT EXISTS guard

## Verification

- TypeScript compilation: `npx tsc --noEmit -p packages/db/tsconfig.json` -- PASSED (zero errors)
- Schema types `SiteSettings` and `NewSiteSettings` correctly infer the new `keyExpiryDays` field

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
