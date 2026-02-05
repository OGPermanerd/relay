---
phase: 21-employee-usage-tracking
plan: 04
subsystem: analytics
tags: [sql, aggregation, drizzle, raw-queries, my-leverage]
dependency-graph:
  requires: []
  provides: [my-leverage-queries, skills-used-api, skills-created-api]
  affects: [21-05, 21-06]
tech-stack:
  added: []
  patterns: [raw-sql-via-drizzle, coalesce-fallback-chain, window-function-pagination]
key-files:
  created:
    - apps/web/lib/my-leverage.ts
  modified: []
decisions:
  - id: D-21-04-01
    description: "COALESCE chain: rating hours_saved_estimate -> skill hours_saved -> 1"
    rationale: "Provides most accurate FTE estimate with graceful fallback"
metrics:
  duration: ~1 min
  completed: 2026-02-05
---

# Phase 21 Plan 04: My Leverage Aggregation Queries Summary

**One-liner:** Raw SQL aggregation queries for personal usage timeline, usage stats, created skills impact, and creation stats with COALESCE FTE fallback chain.

## What Was Done

### Task 1: Create my-leverage.ts with aggregation queries

Created `apps/web/lib/my-leverage.ts` with 4 exported functions following the exact pattern from `leaderboard.ts` (db.execute with raw SQL, cast results via `as unknown as Record<string, unknown>[]`):

1. **`getSkillsUsed(userId, limit, offset)`** - Paginated timeline of usage events with skill details. Uses `COUNT(*) OVER()` window function for total count without separate query. LEFT JOINs ratings for per-user hours_saved_estimate.

2. **`getSkillsUsedStats(userId)`** - Aggregate stats: total unique skills, total hours saved (with COALESCE chain through ratings), total actions, most-used skill (via correlated subquery).

3. **`getSkillsCreated(userId)`** - Published skills by author with impact metrics: total uses, hours per use, total hours saved, unique users, average rating (divided by 100.0 from stored integer).

4. **`getSkillsCreatedStats(userId)`** - Aggregate creation stats: skills published, hours saved by others, unique users, average rating.

All functions include `if (!db)` guard returning empty defaults.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D-21-04-01 | COALESCE chain: `r.hours_saved_estimate -> s.hours_saved -> 1` | Rating-level estimate is most accurate (user reported), then creator estimate, then default 1 hour |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation: `npx tsc --noEmit` passed with zero errors
- Grep for `db.execute`: found exactly 4 calls as expected

## Commits

| Hash | Message |
|------|---------|
| ce1c863 | feat(21-04): create my-leverage.ts with aggregation queries |

## Next Phase Readiness

- `my-leverage.ts` is ready for consumption by 21-05 (page components) and 21-06 (UI integration)
- No blockers identified
