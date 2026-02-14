---
created: 2026-02-14T18:51:28.761Z
title: Create aveone tenant and subdomain for staging
area: infrastructure
files:
  - packages/db/src/services/tenant.ts
  - docker/Caddyfile
---

## Problem

Need to create an aveone.everyskill.ai subdomain and corresponding tenant for testing branding and whitelabeling capabilities. This would allow verifying the multi-tenancy subdomain routing (Phase 26) with a real second tenant beyond the default.

## Solution

1. Create DNS record: `aveone.everyskill.ai` pointing to VPS (178.156.181.178)
2. Update Caddyfile to handle `aveone.everyskill.ai` subdomain (or use wildcard `*.everyskill.ai`)
3. Insert tenant record in DB: `INSERT INTO tenants (id, name, slug, domain, ...) VALUES (..., 'AveOne', 'aveone', 'aveone.com', ...)`
4. Verify subdomain routing works: `aveone.everyskill.ai` resolves to correct tenant
5. Test branding/whitelabeling with tenant-specific settings
