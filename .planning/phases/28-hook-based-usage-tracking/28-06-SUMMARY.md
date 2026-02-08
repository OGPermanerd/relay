---
plan: 28-06
phase: 28
status: complete
subsystem: usage-tracking
tags: [deploy, hooks, PostToolUse, deprecation, frontmatter]
dependency-graph:
  requires: [28-05]
  provides: [deploy-time-hook-injection, log-usage-deprecation]
  affects: []
tech-stack:
  patterns: [hook-compliance-check, deploy-time-frontmatter-injection]
key-files:
  modified:
    - apps/mcp/src/tools/deploy.ts
    - apps/mcp/src/tools/log-usage.ts
decisions:
  - MCP deploy defaults tracking URL to production (everyskill.ai) not localhost
  - log_skill_usage kept registered but returns deprecation notice for backward compat
metrics:
  duration: ~3min
  completed: 2026-02-08
---

# Phase 28 Plan 06: Deploy-Time Hook Compliance and log_skill_usage Deprecation Summary

**One-liner:** deploy.ts injects PostToolUse hooks at deploy time; log_skill_usage deprecated as hooks handle tracking automatically

## What Was Done

### Task 1: Hook Compliance Check in deploy.ts

Added three helper functions to `apps/mcp/src/tools/deploy.ts`:

- `buildHookFrontmatter(skillId, skillName, category, hoursSaved)` -- generates full YAML frontmatter with PostToolUse shell hooks, identical structure to `buildEverySkillFrontmatter` in skills.ts but self-contained for MCP app. Defaults tracking URL to `https://everyskill.ai/api/track` (production-facing MCP).
- `hasTrackingHooks(content)` -- regex check for existing `hooks:\n  PostToolUse:` in content frontmatter.
- `stripFrontmatter(content)` -- removes existing `---\n...\n---\n` prefix before re-injection.

Modified `handleDeploySkill` to:
1. Check if skill content already has tracking hooks via `hasTrackingHooks()`
2. If missing, build new frontmatter with hooks and prepend to stripped content
3. For stdio transport, deliver hook-enriched content; for HTTP, use original
4. Updated deploy instructions to say "Usage tracking is automatic via PostToolUse hooks" instead of telling users to call `log_skill_usage`

### Task 2: Deprecate log_skill_usage

Updated `apps/mcp/src/tools/log-usage.ts`:
- Marked description as `[DEPRECATED]`
- Handler returns deprecation notice with `deprecated: true` flag
- Removed `trackUsage` and `getUserId` imports (no longer needed)
- Tool still registered for backward compatibility with older MCP configurations

## Files Modified

- `apps/mcp/src/tools/deploy.ts` -- added hook helpers, deploy-time hook injection, updated instructions
- `apps/mcp/src/tools/log-usage.ts` -- deprecated tool, removed tracking logic

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add hook compliance check to deploy.ts | 8b102f3 | apps/mcp/src/tools/deploy.ts |
| 2 | Deprecate log_skill_usage MCP tool | 3004414 | apps/mcp/src/tools/log-usage.ts |

## Verification

- TypeScript compilation: PASSED (zero new errors; pre-existing packages/db module resolution errors and implicit any on `s` parameter unchanged)
- ESLint: PASSED (zero errors on both modified files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint unused-vars on deprecated handler parameters**

- **Found during:** Task 2
- **Issue:** `skillId` and `action` destructured params unused after removing trackUsage call, triggering `@typescript-eslint/no-unused-vars`
- **Fix:** Renamed to `_skillId` and `_action` with destructuring aliases
- **Files modified:** apps/mcp/src/tools/log-usage.ts
- **Commit:** 3004414

## Self-Check: PASSED
