---
plan: 28-05
phase: 28
status: complete
subsystem: usage-tracking
tags: [frontmatter, hooks, PostToolUse, HMAC, tracking]
dependency-graph:
  requires: [28-02]
  provides: [PostToolUse-hook-injection]
  affects: [28-06]
tech-stack:
  patterns: [YAML-frontmatter-hooks, HMAC-signed-payloads, async-shell-hooks]
key-files:
  modified:
    - apps/web/app/actions/skills.ts
decisions:
  - Shell hook uses jq with grep fallback for tool_name extraction
  - HMAC-SHA256 signature computed from full JSON payload
  - Retry once after 5s on non-200 response
metrics:
  duration: ~2min
  completed: 2026-02-08
---

# Phase 28 Plan 05: PostToolUse Hook Injection Summary

**One-liner:** buildEverySkillFrontmatter injects PostToolUse shell hooks with HMAC-signed async tracking curl

## What Was Done

Modified `buildEverySkillFrontmatter()` in `apps/web/app/actions/skills.ts` to inject a `hooks` section into the YAML frontmatter of every published skill. The hook fires on every PostToolUse event in Claude Code, capturing tool usage metadata and sending it to the tracking endpoint.

### Hook Behavior

1. Reads PostToolUse JSON from stdin (tool_name, tool_input, tool_response)
2. Extracts `tool_name` using jq with bash grep fallback for environments without jq
3. Builds JSON payload: `{skill_id, tool_name, ts, hook_event}`
4. Computes HMAC-SHA256 signature using `$EVERYSKILL_API_KEY`
5. Fires async curl POST to tracking endpoint with Bearer auth and HMAC header
6. Retries once after 5s on non-200 response
7. Logs failures to `/tmp/everyskill-track.log` silently
8. Always returns exit code 0 (never blocks Claude Code)

### Tracking URL Resolution

- Production: `https://${NEXT_PUBLIC_ROOT_DOMAIN}/api/track`
- Development: `http://localhost:2000/api/track`

## Files Modified

- `apps/web/app/actions/skills.ts` -- `buildEverySkillFrontmatter()` expanded from 4 YAML fields to full hook-enabled frontmatter

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PostToolUse hooks to buildEverySkillFrontmatter | fc5d838 | apps/web/app/actions/skills.ts |

## Verification

- TypeScript compilation: PASSED (zero errors)
- ESLint: PASSED (zero errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint no-useless-escape in shell grep pattern**

- **Found during:** Task 1 commit
- **Issue:** `\\\"` in single-quoted JS string triggered ESLint no-useless-escape (the `\"` after `\\` is unnecessary since `"` doesn't need escaping in single quotes)
- **Fix:** Changed `\\\"` to `\\"` which produces identical output (`\"`) without the unnecessary escape
- **Files modified:** apps/web/app/actions/skills.ts
- **Commit:** fc5d838

## Self-Check: PASSED
