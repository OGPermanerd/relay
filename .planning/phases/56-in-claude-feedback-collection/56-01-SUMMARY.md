---
phase: 56-in-claude-feedback-collection
plan: 01
subsystem: api, mcp
tags: [feedback, mcp, zod, rate-limiting, sanitization, drizzle, denormalized-aggregates]

# Dependency graph
requires:
  - phase: 55-schema-foundation-data-sanitization
    provides: skill_feedback table schema, sanitizePayload utility
provides:
  - insertFeedback DB service with denormalized aggregate updates
  - updateSkillFeedbackAggregates recalculation function
  - /api/feedback POST endpoint with Bearer auth, Zod validation, rate limiting
  - MCP handleFeedback action handler for in-Claude feedback
  - everyskill tool feedback action routing
affects: [57-web-feedback-suggestions, 60-token-cost-measurement]

# Tech tracking
tech-stack:
  added: []
  patterns: [feedback-insert-with-aggregate-update, mcp-action-with-direct-db-access]

key-files:
  created:
    - packages/db/src/services/skill-feedback.ts
    - apps/web/app/api/feedback/route.ts
    - apps/mcp/src/tools/feedback.ts
  modified:
    - packages/db/src/services/index.ts
    - apps/web/middleware.ts
    - apps/mcp/src/tools/everyskill.ts

key-decisions:
  - "MCP feedback handler does inline aggregate recalculation (same logic as DB service) since it inserts directly to DB"
  - "MCP uses lightweight comment sanitization (trim + truncate to 2000 chars) since it cannot import web app's sanitizePayload"
  - "API endpoint uses full sanitizePayload from web app lib for secret detection in comments"
  - "trackUsage called with skipIncrement:true for feedback (feedback should not increment skill totalUses)"

patterns-established:
  - "Feedback insert pattern: insert row then recalculate aggregates on parent skills table"
  - "MCP action pattern: check db, check tenantId, insert, update aggregates, track usage"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 56 Plan 01: Feedback Collection Pipeline Summary

**Feedback data service, /api/feedback endpoint, and MCP feedback action for thumbs up/down skill feedback with denormalized aggregate updates**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T15:23:24Z
- **Completed:** 2026-02-15T15:27:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- DB service with insertFeedback (insert + aggregate update) and updateSkillFeedbackAggregates (recalculation)
- /api/feedback POST endpoint following /api/track pattern: Bearer auth, Zod validation, rate limiting, comment sanitization
- MCP handleFeedback action for in-Claude feedback with direct DB insert and aggregate updates
- everyskill tool wired with feedback action, feedbackType and comment params added to schema
- Middleware exempts /api/feedback from session auth for external API access

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skill-feedback DB service with insert + aggregate update** - `735b509` (feat)
2. **Task 2: Create /api/feedback endpoint, add middleware exemption, create MCP feedback action handler, wire into everyskill tool** - `d962026` (feat)

## Files Created/Modified
- `packages/db/src/services/skill-feedback.ts` - insertFeedback and updateSkillFeedbackAggregates functions
- `packages/db/src/services/index.ts` - Added exports for new service
- `apps/web/app/api/feedback/route.ts` - POST endpoint with auth, validation, rate limiting, sanitization
- `apps/web/middleware.ts` - Added /api/feedback to exempt paths
- `apps/mcp/src/tools/feedback.ts` - MCP action handler for feedback submission
- `apps/mcp/src/tools/everyskill.ts` - Wired feedback action with feedbackType and comment params

## Decisions Made
- MCP feedback handler uses inline aggregate recalculation (same SQL logic as DB service) since it accesses DB directly
- MCP uses simple trim+truncate for comment sanitization (cannot import web app's sanitizePayload utility)
- API endpoint uses full sanitizePayload for secret detection in user-submitted comments
- trackUsage called with skipIncrement:true to avoid inflating skill totalUses from feedback submissions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Feedback pipeline is complete end-to-end (MCP action + API endpoint + DB service)
- Ready for Phase 57 (web UI feedback/suggestions) to build on insertFeedback service
- Ready for Phase 60 (token measurement) which also uses skill_feedback table adjacently

---
*Phase: 56-in-claude-feedback-collection*
*Completed: 2026-02-15*
