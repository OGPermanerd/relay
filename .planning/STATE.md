# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** Skills get better as they pass through more hands, with real metrics proving that value.
**Current focus:** Phase 52 - Diagnostic Dashboard

## Current Position

Phase: 53 of 54 (Skill Recommendations)
Plan: 1 of 1 (complete)
Status: Phase complete
Last activity: 2026-02-14 -- Completed Phase 53 Plan 01 (AI Recommendation Engine)

Progress: [████████████░] 87%

## Milestones

- v1.0 MVP - 33 plans - shipped 2026-01-31
- v1.1 Quality & Polish - 9 plans - shipped 2026-02-01
- v1.2 UI Redesign - 12 plans - shipped 2026-02-02
- v1.3 AI Quality & Cross-Platform - 15 plans - shipped 2026-02-04
- v1.4 Employee Analytics & Remote MCP - 25 plans - shipped 2026-02-06
- v1.5 Production & Multi-Tenancy - 55 plans - shipped 2026-02-08
- v2.0 Skill Ecosystem - 23 plans - shipped 2026-02-08
- v3.0 AI Discovery & Workflow Intelligence - 21 plans - shipped 2026-02-13
- v4.0 Gmail Workflow Diagnostic - 6 phases, in progress (3/6 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 210
- Average duration: ~5 min (across milestones)
- Total execution time: ~10.6 hours

**Cumulative:**
- 210 plans across 53 phases and 9 milestones
- ~19,500 LOC TypeScript
- 8 days total development time

## Accumulated Context

### Decisions

All decisions archived in PROJECT.md Key Decisions table and milestone archives.

Key v4.0 research decisions:
- Auth.js v5 does NOT support incremental OAuth scopes -- Gmail needs SEPARATE OAuth flow
- Use `gmail.readonly` scope + `format: 'metadata'` (not `gmail.metadata` which blocks date filtering)
- Tokens in dedicated `gmail_tokens` table with AES-256-GCM encryption (not Auth.js accounts table)
- Two-pass categorization: rule-based first (~70%), AI for ambiguous ~30%
- Analyze and discard: raw metadata only in memory, persist only aggregate stats
- ~$0.17-0.20 per scan cost (Claude Haiku for classification)

Phase 51 key decisions:
- email_diagnostics table stores ONLY aggregates (JSONB), never individual email metadata
- estimated_hours_per_week stored as integer tenths (e.g., 125 = 12.5 hours)
- Gmail client uses format: 'metadata' with 5 specific headers, batches of 100
- Two-pass classifier: rules handle List-Unsubscribe, noreply@, calendar; AI handles rest
- Claude Haiku 4.5 for cost efficiency, batches of 75 emails per AI call
- Privacy-first AI input: domain only, truncated subject, no full addresses
- Time weights: newsletter 0.5min, automated-notification 0.3min, meeting-invite 2min, direct-message 3min, internal-thread 4min, vendor-external 3.5min, support-ticket 5min
- Server action processes 90 days / 5000 max messages entirely in-memory

Phase 52-01 key decisions:
- Horizontal BarChart layout for time-per-category (better label readability)
- Sort time bars descending by hours/week (most time-consuming first)
- Category colors consistent across PieChart and BarChart
- Empty state handling with dashed border pattern from usage-area-chart.tsx

Phase 53-01 key decisions:
- Claude Haiku 4.5 for cost-efficient query generation (not Sonnet)
- Filter to high-time categories only: >10% OR >30 min/week
- Generate 1-2 search queries per high-time category mapping email types to automation tasks
- Top 10 search results per query, deduplicate by skill ID
- Rank by projected weekly savings (category time × AI estimated savings percentage)
- Return top 5 recommendations with personalized reasoning explaining the match

### Pending Todos

- AI-Independence -- platform-agnostic skill translation (future milestone)
- Fix staging discover search without keywords (search area, 3 pending todos)
- Create aveone tenant and subdomain for staging branding/whitelabeling test

### Blockers/Concerns

- Gmail API requires Google Cloud Console configuration (enable Gmail API, add `gmail.readonly` scope)
- GMAIL_ENCRYPTION_KEY env var needed for AES-256-GCM token encryption -- ADDED to .env.local
- Google OAuth verification needed if serving >100 external users

## Session Continuity

Last session: 2026-02-14
Stopped at: Phase 53 complete (Skill Recommendations) -- AI engine ready for dashboard integration
Resume file: .planning/ROADMAP.md -- Phase 52 (Dashboard) and Phase 54 (Diagnostic Cron) remaining
