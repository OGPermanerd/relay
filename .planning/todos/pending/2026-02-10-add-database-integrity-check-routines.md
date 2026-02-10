---
created: 2026-02-10T15:30:53.322Z
title: Add database integrity check routines
area: database
files:
  - packages/db/src/services/skill-metrics.ts
  - packages/db/src/services/usage-tracking.ts
  - packages/db/src/schema/skills.ts
  - packages/db/src/schema/usage-events.ts
---

## Problem

Denormalized counters on the `skills` table (`total_uses`, `average_rating`) can drift from actual `usage_events` rows. This was discovered when `trevor@fncr.com` had 3 skills with `total_uses` summing to 14, but zero corresponding `usage_events` in the fncr tenant. Similarly, user migrations (auth collisions creating duplicate user records) can leave orphaned data in the wrong tenant.

Specific inconsistencies to detect:
1. `skills.total_uses` vs `COUNT(*)` from `usage_events` for each skill
2. `skills.average_rating` vs `AVG(rating)` from `ratings` for each skill
3. `tenant_id` mismatches: user.tenant_id != usage_events.tenant_id for the same user_id
4. Orphaned records: usage_events referencing users in a different tenant than the event's tenant_id
5. Skills with usage_events but author_id pointing to a user in a different tenant

## Solution

Create a DB integrity check service (`packages/db/src/services/integrity-check.ts`) that:
- Runs a set of consistency queries and returns a structured report
- Can be triggered via admin API endpoint or CLI script
- Optionally auto-repairs drifted counters (recalculate from source-of-truth tables)
- Logs discrepancies for audit trail
- Could run on a cron schedule (e.g., daily via `/api/cron/integrity-check`)
