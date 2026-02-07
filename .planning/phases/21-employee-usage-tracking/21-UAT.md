---
status: complete
phase: 21-employee-usage-tracking
source: [21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md, 21-04-SUMMARY.md, 21-05-SUMMARY.md, 21-06-SUMMARY.md]
started: 2026-02-06T18:00:00Z
updated: 2026-02-06T18:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Home Page Browse/Leverage Tabs
expected: The home page shows two tabs: "Browse Skills" and "My Leverage". Browse Skills is active by default, showing the familiar trending skills, leaderboard, and navigation cards. Clicking "My Leverage" switches the view and updates the URL to ?view=leverage.
result: pass

### 2. My Leverage - Skills Used Section
expected: The My Leverage tab shows a "Skills Used" section with 4 stat cards (Skills Used, FTE Hours Saved, Total Actions, Most Used) and a timeline list of usage events. Each event shows an action badge (color-coded by type), category badge, hours saved, and relative timestamp. A "Load More" button appears for pagination.
result: pass
note: User suggested adding cumulative sparkline area charts as future enhancement

### 3. My Leverage - Skills Created Section
expected: Below Skills Used, a "Skills Created" section shows 4 stat cards (Skills Published, Hours Saved by Others, Unique Users, Avg Rating) and a list of skills you've created with their usage metrics. If you haven't created or used skills, empty states are shown.
result: pass

### 4. Direct URL Navigation to Leverage Tab
expected: Navigating directly to /?view=leverage loads the My Leverage tab content without needing to click the tab. Switching back to Browse Skills removes the URL parameter and shows browse content.
result: pass

### 5. Install Callback Endpoint
expected: The install scripts (bash and PowerShell) generated from the install modal now include a callback that reports back to the Relay server after successful installation. The callback is non-blocking — install succeeds even if the callback fails.
result: issue
reported: "The powershell script failed install with JSON parse error: SyntaxError: Expected property name or '}' in JSON at position 4 (line 2 column 3). The node -e command parsing the config file crashes visibly instead of being silently caught. Install itself succeeded but error output is shown to user."
severity: major

### 6. MCP Anonymous Nudge
expected: When using MCP tools (search, list, deploy) without a EVERYSKILL_API_KEY configured, tools work normally (anonymous tracking). Every 5th anonymous call, a gentle nudge message appears suggesting the user set up an API key. When a key IS configured, a one-time confirmation message appears on first use.
result: skipped
reason: Cannot test until a skill is installed via MCP

### 7. MCP Employee Attribution
expected: When EVERYSKILL_API_KEY is configured in the MCP environment, every tool call (search, list, deploy) records the employee's userId in usage_events. This data feeds into the My Leverage view and analytics dashboard.
result: skipped
reason: Cannot test until a skill is installed via MCP

## Summary

total: 7
passed: 4
issues: 1
pending: 0
skipped: 2

## Gaps

- truth: "Install callback is non-blocking — install succeeds even if the callback fails, with no visible errors"
  status: failed
  reason: "User reported: PowerShell install script shows JSON parse error from node -e command when extracting EVERYSKILL_API_KEY from config. The config file likely has non-standard JSON (unquoted keys or comments). Error is visible to user even though install itself succeeds."
  severity: major
  test: 5
  root_cause: "PowerShell word-splits unquoted $Existing variable when passing multi-line JSON to node -e. Line 53 of generated script uses $Existing without quotes, unlike bash which uses \"$EXISTING\"."
  artifacts:
    - path: "apps/web/lib/install-script.ts"
      issue: "Line 53: $Existing not quoted in node -e call"
  missing:
    - "Quote $Existing as \"$Existing\" in PowerShell node -e call"
  debug_session: ".planning/debug/powershell-json-parse-error.md"
