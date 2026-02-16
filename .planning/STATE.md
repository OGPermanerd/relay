# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Protect and grow your IP. Fast. Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** v6.0 IP Dashboard & Skills Portfolio -- Phase 68 (Pre-LLM History)

## Current Position

Phase: 68 of 68 (Pre-LLM History)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-16 -- Completed 68-02-PLAN.md (artifact upload UI and portfolio integration)

Progress: [############################..] 95% (244 plans across 68 phases, 10 milestones)

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production & Multi-Tenancy - 55 plans - shipped 2026-02-08
- v2.0 Skill Ecosystem - 23 plans - shipped 2026-02-08
- v3.0 AI Discovery & Workflow Intelligence - 21 plans - shipped 2026-02-13
- v4.0 Gmail Workflow Diagnostic - 17 plans - shipped 2026-02-14
- v5.0 Feedback, Training & Benchmarking - 18 plans - shipped 2026-02-15
- v6.0 IP Dashboard & Skills Portfolio - 7 phases, 12/TBD plans - in progress

## Performance Metrics

**Velocity:**
- Total plans completed: 244
- Average duration: ~5 min (across milestones)
- Total execution time: ~12.1 hours

**Cumulative:**
- 244 plans across 68 phases and 10 milestones
- ~50,000 LOC TypeScript across 386 files
- 16 days total development time

## Accumulated Context

### Decisions

All prior decisions archived in PROJECT.md Key Decisions table and milestone archives.

v6.0 decisions:
- IP dashboard placement: new page under /leverage (follows existing analytics pattern)
- Portfolio page: new /portfolio route (not extension of existing /profile)
- No new schema for IPDASH phases (all SQL aggregation on existing tables)
- New schema needed only for PORT-06 (work_artifacts table)
- Three separate SQL queries merged by month for quality trends (not complex JOIN)
- Hours saved = SUM(hours_saved * total_uses) from skills denormalized aggregates
- Rating normalized 1-5 to 0-100 scale (multiply by 20)
- Hero stat cards are all-time cumulative; quality trends chart respects TimeRangeSelector
- Multi-line chart uses connectNulls for months with partial data across series
- IP risk: numeric severity (3/2/1) for SQL MAX aggregation, mapped to string risk levels in TypeScript
- IP risk thresholds: HIGH_USAGE_THRESHOLD=10, CRITICAL_USAGE_THRESHOLD=50 as named constants
- IP risk UI: threshold constants inlined in client component (server-only module can't be imported at runtime in "use client")
- IP valuation: HOURLY_RATE=$150, replacement cost = base * complexity * quality with clamped multipliers
- averageRating normalized from 0-500 to 0-1; null defaults to 0.6; quality multiplier [0.5, 1.0]
- Complexity multiplier uses log10(contentLength/1000), clamped [1.0, 2.0]
- jsPDF dynamically imported in click handler to keep page bundle small
- Hero stat grid: 5 columns with "Estimated IP Value" first
- Valuation table shows top 20 by replacement cost; CSV export includes all skills
- Portfolio queries use FILTER (WHERE) conditional aggregation for single-pass visibility breakdown
- Contribution ranking uses only tenant-visible skills (visibility='tenant'), matching leaderboard
- Rank labels: percentile-based for teams >20, ordinal for teams <=20
- Portfolio page: border-l-4 accent cards (green portable, blue company) for IP ownership breakdown
- Portfolio ranking subtitle: percentile context for large teams, ordinal context for small teams
- Impact timeline: UNION ALL combines creations, forks, suggestions with SUM() OVER window function for cumulative hours
- Impact calculator: FILTER WHERE conditional aggregation for single-pass creation/fork counts
- Suggestions have 0 hours_impact in timeline but appear as events
- ComposedChart pattern: Area for continuous series + Scatter for categorical event markers
- E2E tests for data-dependent sections: heading.or(emptyState) conditional assertion pattern
- Resume shares: revoke-and-replace pattern (one active share per user)
- Resume visibility: includeCompanySkills toggle filters personal-only vs all skills
- work_artifacts: 50-artifact limit per user enforced at server action level
- work_artifacts: dynamic SET clause via sql.join for partial updates in updateWorkArtifact
- work_artifacts: suggestedSkillIds as TEXT[] for future AI skill linking
- Quality tier computed per-skill via calculateQualityScore with total_ratings subquery
- Resume UI: search param approach (?include=company) for server-side visibility toggle
- Shared ResumeView component for both auth and public pages (isPublic prop controls footer)
- ResumeShareControls uses router.push on toggle to trigger full server re-render
- Artifact parser: .txt/.md/.json/.eml with 5MB limit, 100K char truncation; other types metadata-only
- Upload form: client-side file parsing before server action (File objects not sent to server)
- Pre-Platform Work section placed before Your Skills in portfolio layout
- Artifact scatter series: amber #d97706 to differentiate from suggestion events #f59e0b

### Pending Todos

See STATE.md from v5.0 for full list. Key items for v6.0:
- Skill visibility: expose all 4 levels in upload form
- Default skill visibility scope to company-visible (tenant)

### Blockers/Concerns

None yet. v6.0 is primarily SQL aggregation + new pages on existing data.

## Session Continuity

Last session: 2026-02-16
Stopped at: Phase 68, Plan 2 complete -- artifact upload UI and portfolio integration. Plan 03 remains (AI skill linking).
Resume file: .planning/phases/68-pre-llm-history/68-02-SUMMARY.md
