---
phase: 55-schema-foundation-data-sanitization
plan: 01
subsystem: database
tags: [drizzle, postgres, schema, rls, migrations, feedback, tokens, benchmarks]

# Dependency graph
requires:
  - phase: 25-multi-tenancy
    provides: tenants table and RLS pattern
  - phase: 01-foundation
    provides: skills, users, skill_versions tables
provides:
  - skill_feedback table for user feedback on skills
  - token_measurements table for token usage/cost tracking
  - benchmark_runs and benchmark_results tables for model comparison
  - 3 denormalized aggregate columns on skills table
  - All TypeScript types exported from @everyskill/db
affects: [56-feedback-collection-api, 57-token-measurement-pipeline, 58-training-data-pipeline, 59-cost-estimation-engine, 60-mcp-feedback-integration, 61-benchmark-runner]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-FK disambiguation with relationName, idempotent RLS policy creation with DO block]

key-files:
  created:
    - packages/db/src/schema/skill-feedback.ts
    - packages/db/src/schema/token-measurements.ts
    - packages/db/src/schema/benchmark-runs.ts
    - packages/db/src/migrations/0030_create_skill_feedback.sql
    - packages/db/src/migrations/0031_create_token_measurements.sql
    - packages/db/src/migrations/0032_create_benchmark_tables.sql
    - packages/db/src/migrations/0033_add_feedback_aggregates_to_skills.sql
  modified:
    - packages/db/src/schema/skills.ts
    - packages/db/src/schema/index.ts
    - packages/db/src/relations/index.ts

key-decisions:
  - "usageEventId is plain text with NO FK due to uuid/text type mismatch with usage_events table"
  - "Two user FKs on skill_feedback (userId and reviewedBy) disambiguated with relationName: reviewedFeedback"
  - "benchmark_runs and benchmark_results in same schema file since results depend on runs"
  - "Idempotent RLS policy creation using DO block with pg_policies check (not plain CREATE POLICY)"

patterns-established:
  - "Multi-FK disambiguation: use relationName on both the one() and many() sides for tables with multiple refs to same parent"
  - "Idempotent migration pattern: DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies...) THEN CREATE POLICY... END IF; END $$;"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 55 Plan 01: Schema Foundation & Data Sanitization Summary

**4 new database tables (skill_feedback, token_measurements, benchmark_runs, benchmark_results) with RLS, indexes, Drizzle relations, and 3 denormalized aggregate columns on skills**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T14:31:06Z
- **Completed:** 2026-02-15T14:35:19Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Created skill_feedback table with 5 indexes supporting thumbs, suggestions, training examples, and bug reports
- Created token_measurements table with 4 indexes for tracking token usage, cost, and latency per model
- Created benchmark_runs and benchmark_results tables with cascade deletes for multi-model skill comparison
- Added totalFeedback, positiveFeedbackPct, avgTokenCostMicrocents denormalized columns to skills table
- All 4 tables have tenant_id NOT NULL with tenant_isolation RLS policy
- Full Drizzle relation graph defined with proper disambiguation for multi-FK references
- 4 SQL migrations applied successfully (0030-0033), verified idempotent

## Task Commits

Each task was committed atomically:

1. **Task 1: Create schema files + update skills + barrel export** - `1546fd4` (feat)
2. **Task 2: Write SQL migrations and run them** - `a636157` (feat)
3. **Task 3: Define Drizzle relations + verify TypeScript** - `0388de2` (feat)

## Files Created/Modified
- `packages/db/src/schema/skill-feedback.ts` - skill_feedback table definition with SkillFeedback/NewSkillFeedback types
- `packages/db/src/schema/token-measurements.ts` - token_measurements table definition with TokenMeasurement/NewTokenMeasurement types
- `packages/db/src/schema/benchmark-runs.ts` - benchmark_runs + benchmark_results table definitions with all 4 types
- `packages/db/src/schema/skills.ts` - Added 3 denormalized aggregate columns
- `packages/db/src/schema/index.ts` - Added 3 new barrel re-exports
- `packages/db/src/relations/index.ts` - 4 new relation definitions + 3 updated existing relations
- `packages/db/src/migrations/0030_create_skill_feedback.sql` - CREATE TABLE + 5 indexes + RLS
- `packages/db/src/migrations/0031_create_token_measurements.sql` - CREATE TABLE + 4 indexes + RLS
- `packages/db/src/migrations/0032_create_benchmark_tables.sql` - 2 CREATE TABLEs + 6 indexes + 2 RLS policies
- `packages/db/src/migrations/0033_add_feedback_aggregates_to_skills.sql` - ALTER TABLE skills ADD 3 columns

## Decisions Made
- usageEventId stored as plain text without FK constraint due to uuid/text type mismatch with usage_events table
- skill_feedback reviewer relation disambiguated with `relationName: "reviewedFeedback"` pattern
- Both benchmark tables in single schema file since benchmark_results references benchmark_runs
- Used idempotent DO block for RLS policy creation (pg_policies check) instead of plain CREATE POLICY

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All foundation tables ready for service layer development in subsequent phases
- Types exported and available for import across the monorepo
- Relations enable Drizzle query builder `.with()` for eager loading feedback, measurements, and benchmarks

---
*Phase: 55-schema-foundation-data-sanitization*
*Completed: 2026-02-15*
