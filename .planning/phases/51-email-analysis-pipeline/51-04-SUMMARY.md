---
phase: 51-email-analysis-pipeline
plan: 04
subsystem: api
tags: [typescript, anthropic-claude, gmail-api, aggregation, privacy-first]

# Dependency graph
requires:
  - phase: 51-01
    provides: "email_diagnostics table and service layer"
  - phase: 51-02
    provides: "Gmail metadata fetcher using OAuth tokens"
  - phase: 51-03
    provides: "Email classifier with rule-based + AI pipeline"
provides:
  - "Time estimation utilities with configurable per-category weights"
  - "Aggregation engine computing category breakdown, pattern insights, hours/week"
  - "Server action orchestrating fetch -> classify -> aggregate -> save pipeline"
  - "Privacy-first in-memory processing (raw metadata never persisted)"
affects: [52-diagnostic-dashboard, 53-skill-recommendations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-memory aggregate-only processing (privacy pattern)"
    - "Server action orchestration of multi-step data pipelines"
    - "Configurable time estimation with weight-based modeling"

key-files:
  created:
    - apps/web/lib/email-time-estimator.ts
    - apps/web/lib/diagnostic-aggregator.ts
    - apps/web/app/actions/email-diagnostic.ts
  modified: []

key-decisions:
  - "Time weights based on industry research: newsletters 0.5min, direct messages 3min, support tickets 5min"
  - "Pattern insights compute busiest hour (0-23) and day of week from message timestamps"
  - "Server action processes 90 days / 5000 max messages entirely in-memory before saving aggregates"
  - "Raw email metadata (From, Subject, Date) never persisted - only category counts and time estimates stored"

patterns-established:
  - "Privacy-first aggregation: fetch raw data, compute stats, discard raw data, store only aggregates"
  - "Server actions as orchestration layer for multi-service pipelines"
  - "Configurable estimation models using weight-based heuristics"

# Metrics
duration: 8min
completed: 2026-02-14
---

# Phase 51 Plan 04: Email Analysis Pipeline Summary

**Complete in-memory email analysis pipeline: fetch → classify → estimate → aggregate → save, with privacy-first aggregate-only storage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-14T18:15:00Z
- **Completed:** 2026-02-14T18:23:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Time estimation with DEFAULT_TIME_WEIGHTS per category (0.3-5 min per email)
- Aggregator computing category breakdown with counts, percentages, estimated minutes
- Pattern insights deriving busiest hour (0-23) and busiest day from message timestamps
- Server action orchestrating full pipeline: fetch 90 days → classify → aggregate → save statistics only
- Privacy-first design: raw email metadata processed entirely in-memory, never persisted

## Task Commits

Each task was committed atomically:

1. **Task 1: Create time estimation and aggregation utilities** - `140f2c6` (feat)
2. **Task 2: Create email diagnostic server action** - `e240f25` (feat)

## Files Created/Modified

- `apps/web/lib/email-time-estimator.ts` - Time estimation with configurable per-category weights (newsletter 0.5min, direct-message 3min, support-ticket 5min), estimateTimeSpent and estimateHoursPerWeek functions
- `apps/web/lib/diagnostic-aggregator.ts` - Aggregate statistics computation: category breakdown with counts/percentages/time, pattern insights with busiest hour/day, weekly hours estimate
- `apps/web/app/actions/email-diagnostic.ts` - Server action orchestrating fetch → classify → aggregate → save pipeline, with error handling for GmailNotConnectedError and GmailTokenRevokedError

## Decisions Made

**Time weight model:** Used industry research-based weights per category:
- Newsletters: 0.5 min (quick scan/delete)
- Automated notifications: 0.3 min (quick review)
- Meeting invites: 2 min (read + calendar check)
- Direct messages: 3 min (read + thoughtful response)
- Internal threads: 4 min (read context + contribute)
- Vendor/external: 3.5 min (read + response + context switch)
- Support tickets: 5 min (diagnosis + detailed response)

**Pattern insights:** Computed busiest hour (0-23) and busiest day of week from message timestamps. Left averageResponseTimeHours and threadDepthAverage as null/0 (TODO for future enhancement).

**Privacy model:** Raw email metadata (From, Subject, Date) processed entirely in-memory within server action. Only aggregate statistics (category counts, percentages, time estimates, pattern insights) persisted to database. Raw metadata never stored.

**Error handling:** Specific error messages for GmailNotConnectedError (guide user to connect Gmail) and GmailTokenRevokedError (guide user to reconnect). Generic fallback for unexpected errors.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Uses existing ANTHROPIC_API_KEY from previous phases.

## Next Phase Readiness

**Ready for Phase 52 (Diagnostic Dashboard):**
- `runEmailDiagnostic()` server action available for UI integration
- Returns `AggregateResults` type with category breakdown, pattern insights, hours/week
- Error handling provides user-friendly messages for UI display
- Aggregate data structure matches schema from Phase 51-01

**Blockers/Concerns:** None. Pipeline complete and ready for UI consumption.

## Self-Check: PASSED

All files verified:
- FOUND: apps/web/lib/email-time-estimator.ts
- FOUND: apps/web/lib/diagnostic-aggregator.ts
- FOUND: apps/web/app/actions/email-diagnostic.ts

All commits verified:
- FOUND: 140f2c6 (Task 1: time estimator + aggregator)
- FOUND: e240f25 (Task 2: server action orchestrator)

---
*Phase: 51-email-analysis-pipeline*
*Completed: 2026-02-14*
