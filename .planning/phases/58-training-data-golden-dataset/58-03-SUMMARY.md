---
phase: 58-training-data-golden-dataset
plan: 03
subsystem: api
tags: [training-data, usage-capture, consent-gating, sanitization, fire-and-forget]

# Dependency graph
requires:
  - phase: 58-training-data-golden-dataset
    plan: 01
    provides: createTrainingExample DB service, trainingDataCaptureEnabled site setting, trainingDataConsent user preference
provides:
  - Consent-gated usage capture in /api/track route
  - captureUsageAsTraining helper with dual consent checks and sanitization
affects: [58-02 training data UI, settings pages, MCP hook data flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual consent gating (tenant + user), fire-and-forget usage capture]

key-files:
  created: []
  modified:
    - apps/web/app/api/track/route.ts

key-decisions:
  - "PREFERENCES_DEFAULTS already had trainingDataConsent from Plan 01 -- no redundant update needed"
  - "captureUsageAsTraining uses void prefix for fire-and-forget (same pattern as insertTokenMeasurement)"
  - "Captured training examples start as status=pending for author review before promotion"

patterns-established:
  - "Dual consent gating: check tenant setting first (cached), then user preference, bail early on either"
  - "Usage capture sanitization: sanitizePayload on both input and output before DB insert"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 58 Plan 03: Usage Capture with Consent Gating Summary

**Consent-gated usage capture in /api/track route: dual tenant+user checks, sanitized snippets, fire-and-forget training example creation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T16:53:41Z
- **Completed:** 2026-02-15T16:55:37Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- captureUsageAsTraining helper function with dual consent gating (tenant trainingDataCaptureEnabled + user trainingDataConsent)
- Input and output snippets sanitized via sanitizePayload before storage (strips secrets, API keys, tokens)
- Fire-and-forget pattern (void promise) ensures /api/track returns 200 immediately without waiting for capture
- Training examples created with source="usage_capture" and status="pending" for author review

## Task Commits

Each task was committed atomically:

1. **Task 1: Usage capture with consent gating in track route** - `aee2edb` (feat)

## Files Created/Modified
- `apps/web/app/api/track/route.ts` - Added captureUsageAsTraining helper and consent-gated call after token measurement block

## Decisions Made
- PREFERENCES_DEFAULTS in user-preferences.ts already contained trainingDataConsent:false from Plan 01 -- skipped redundant update (plan step 1 was already done)
- Used void prefix for fire-and-forget (matches existing insertTokenMeasurement pattern in same file)
- Captured examples start as "pending" status so skill authors can review before approving

## Deviations from Plan

None - plan executed exactly as written. (The PREFERENCES_DEFAULTS update from step 1 was already applied by Plan 01, so it was correctly a no-op.)

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Usage capture pipeline complete: MCP hook sends snippets to /api/track, route captures them as training examples when consent is given
- Training data UI (Plan 02) can display usage-captured examples alongside manually submitted golden examples
- Admin can toggle training_data_capture_enabled in site settings to control tenant-wide capture

## Self-Check: PASSED

All files verified present. Commit hash aee2edb confirmed in git log. Key patterns (captureUsageAsTraining, trainingDataCaptureEnabled, trainingDataConsent, sanitizePayload) all present in track route.

---
*Phase: 58-training-data-golden-dataset*
*Completed: 2026-02-15*
