---
phase: 60-token-cost-measurement
plan: 02
subsystem: mcp
tags: [hooks, transcript, tokens, shell, yaml, frontmatter, posttooluse]

# Dependency graph
requires:
  - phase: 55-schema-foundation-data-sanitization
    provides: token_measurements table schema
provides:
  - Enriched PostToolUse hook that captures model_name, input_tokens, output_tokens from Claude transcript
  - Transcript-parsing shell code embedded in YAML frontmatter for deployed skills
affects: [60-01 (api/track endpoint receives enriched payload), 60-03 (UI displays token cost data)]

# Tech tracking
tech-stack:
  added: []
  patterns: [portable transcript JSONL parsing via tail+jq (no tac for macOS), conditional JSON payload building in shell]

key-files:
  created: []
  modified: [apps/mcp/src/tools/deploy.ts]

key-decisions:
  - "Use tail -n 100 + jq select + tail -1 instead of tac for macOS portability"
  - "Token fields are optional in payload -- omitted when transcript unavailable"
  - "input_tokens and output_tokens sent as numbers (not strings) in JSON payload"
  - "Parse .message.model and .message.usage from JSONL entries (Claude transcript format)"

patterns-established:
  - "Portable transcript parsing: tail -n 100 | jq -c 'select(.message.model != null) | .message' | tail -1"
  - "Conditional JSON building in shell: build base string, append optional fields before closing brace"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 60 Plan 02: PostToolUse Hook Token Capture Summary

**PostToolUse hook extended to parse Claude transcript JSONL for model name and token counts, with portable shell (no tac) and graceful degradation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T15:23:38Z
- **Completed:** 2026-02-15T15:26:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extended buildHookFrontmatter() to extract transcript_path from PostToolUse stdin
- Added portable JSONL parsing (tail -n 100 + jq select + tail -1) to find last assistant message with model data
- Conditional payload enrichment: model_name, input_tokens, output_tokens included only when available
- Graceful degradation verified: payload sent without token fields when transcript is missing or unreadable
- Shell tested end-to-end with mock JSONL transcript -- produces valid JSON with correct token values

## Task Commits

Each task was committed atomically:

1. **Task 1: Add transcript parsing to PostToolUse hook frontmatter** - `fd3c7f7` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/deploy.ts` - Extended buildHookFrontmatter() with transcript_path parsing, model/token extraction, and conditional payload building

## Decisions Made
- Used `tail -n 100 | jq -c 'select(.message.model != null) | .message' | tail -1` instead of `tac | grep -m1` for macOS portability (tac is GNU-only)
- Token fields omitted from payload when transcript unavailable (not set to 0 or "unknown") -- cleaner for downstream Zod validation
- Input/output tokens sent as JSON numbers, not strings, matching the token_measurements schema integer columns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing type error in `apps/web/lib/sanitize-payload.ts` causes web build to fail, but MCP package builds cleanly in isolation. Not related to this change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PostToolUse hook now sends enriched payload with model_name, input_tokens, output_tokens to /api/track
- Plan 01 (/api/track extension) needs to accept these new optional fields and insert into token_measurements
- Plan 03 (UI) can display cost data once Plans 01 and 02 are both deployed
- Skills must be re-deployed to get the updated hook (existing deployed skills continue working without token data)

## Self-Check: PASSED

- All files exist (deploy.ts, 60-02-SUMMARY.md)
- Commit fd3c7f7 verified in git log
- All key content verified: transcript_path, model_name, input_tokens, output_tokens, portable tail

---
*Phase: 60-token-cost-measurement*
*Completed: 2026-02-15*
