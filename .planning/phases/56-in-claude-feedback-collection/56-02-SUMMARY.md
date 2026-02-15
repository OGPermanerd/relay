---
phase: 56-in-claude-feedback-collection
plan: 02
subsystem: mcp, ui
tags: [feedback, PostToolUse, hooks, frontmatter, sentiment, sparkline, drizzle, aggregation]

# Dependency graph
requires:
  - phase: 56-in-claude-feedback-collection
    plan: 01
    provides: skill_feedback table, insertFeedback DB service, /api/feedback endpoint
provides:
  - PostToolUse sync feedback prompt hook with smart frequency gating (first 3, then every 10th)
  - getSkillFeedbackStats query for 30-day aggregation and 14-day trend
  - FeedbackSentiment reusable client component
  - Feedback StatCard with amber sparkline on skill detail page
affects: [57-web-feedback-suggestions, 61-llm-judge-evaluation]

# Tech tracking
tech-stack:
  added: []
  patterns: [sync-hook-with-additionalContext, file-based-counter-gating, feedback-trend-sparkline]

key-files:
  created:
    - apps/web/lib/skill-feedback-stats.ts
    - apps/web/components/feedback-sentiment.tsx
  modified:
    - apps/mcp/src/tools/deploy.ts
    - apps/web/components/skill-detail.tsx
    - apps/web/app/(protected)/skills/[slug]/page.tsx

key-decisions:
  - "Sync hook uses printf with double-quoted shell strings to produce JSON additionalContext (avoids single-quote conflicts inside bash -c wrapper)"
  - "File-based counter at /tmp/everyskill-fb-{skillId}.cnt for session-persistent frequency gating without external dependencies"
  - "Skill names with single quotes are stripped (not escaped) for shell safety in hook frontmatter"
  - "FeedbackSentiment component created as standalone reusable component even though StatCard is used directly in skill-detail"
  - "Feedback StatCard uses amber (#f59e0b) trendColor to distinguish from other stat sparklines"

patterns-established:
  - "Sync PostToolUse hook pattern: file counter + conditional printf of hookSpecificOutput JSON with additionalContext"
  - "Feedback stats query pattern: parallel all-time + 30-day + 14-day trend with date-filling"

# Metrics
duration: 7min
completed: 2026-02-15
---

# Phase 56 Plan 02: Feedback Prompt Hook & Sentiment Display Summary

**PostToolUse sync hook with file-based counter gating (first 3 uses, then every 10th) and skill detail feedback StatCard with 30-day aggregation and amber sparkline trend**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-15T15:34:02Z
- **Completed:** 2026-02-15T15:41:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PostToolUse sync feedback prompt hook added to skill frontmatter with smart frequency gating
- getSkillFeedbackStats server-side query with all-time + 30-day + 14-day trend aggregation
- FeedbackSentiment reusable client component with color-coded percentage display
- Feedback StatCard in skill detail stats grid with amber sparkline (only renders when feedback exists)
- feedbackStats fetched in parallel with other skill detail data (zero perf overhead)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sync feedback prompt hook to deploy.ts frontmatter builder** - `dbaa860` (feat)
2. **Task 2: Create feedback stats query, sentiment component, and wire into skill detail page** - `8914344` (feat)

## Files Created/Modified
- `apps/mcp/src/tools/deploy.ts` - Added second PostToolUse hook (sync) with file-based counter and additionalContext prompt
- `apps/web/lib/skill-feedback-stats.ts` - getSkillFeedbackStats with all-time, 30-day, and 14-day trend queries
- `apps/web/components/feedback-sentiment.tsx` - Reusable client component with color-coded sentiment percentage
- `apps/web/components/skill-detail.tsx` - Added feedbackStats prop and Feedback StatCard with amber sparkline
- `apps/web/app/(protected)/skills/[slug]/page.tsx` - Added getSkillFeedbackStats to parallel data fetch and passed to SkillDetail

## Decisions Made
- Sync hook uses printf with double-quoted shell strings (not single-quoted) to avoid conflicts with `bash -c '...'` wrapper
- File-based counter at `/tmp/everyskill-fb-{skillId}.cnt` provides session-persistent gating without external dependencies
- Skill names with single quotes stripped for shell safety (not escaped, since escaping inside `bash -c '...'` is fragile)
- FeedbackSentiment component created as standalone even though StatCard is used directly -- provides reusable component for other contexts
- Amber trendColor (#f59e0b) distinguishes feedback sparkline from other stats (green=FTE, blue=uses, purple=users)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESLint no-useless-escape errors in printf escaping**
- **Found during:** Task 1
- **Issue:** Plan specified `\\\\\"` escape sequences which produced unnecessary escape warnings in template literals
- **Fix:** Rewrote printf to use double-quoted format string with `\\"` (matching existing tracking hook pattern on line 40)
- **Files modified:** apps/mcp/src/tools/deploy.ts
- **Verification:** ESLint passes cleanly, JSON output structure verified
- **Committed in:** dbaa860

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for passing pre-commit hooks. No scope creep.

## Issues Encountered
- skill-detail.tsx and page.tsx changes were already partially committed from a previous parallel execution (commit 02b96e2). The new files (skill-feedback-stats.ts, feedback-sentiment.tsx) were correctly committed as Task 2. All references resolve correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Feedback collection pipeline is complete end-to-end: MCP action + API endpoint + DB service + prompt hook + sentiment display
- PostToolUse hook prompts users for feedback with smart frequency gating
- Skill detail pages show feedback sentiment when feedback exists
- Ready for Phase 57 (web UI suggestions) and Phase 61 (LLM-as-judge evaluation)

---
*Phase: 56-in-claude-feedback-collection*
*Completed: 2026-02-15*
