# Phase 21: Employee Usage Tracking - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Attribute every MCP tool call and install event to the employee who performed it via API key resolution. Surface personal usage data in a "My Skill Leverage" view on the home page with two sections: Skills Used and Skills Created. Install scripts report back via HTTP POST callback. Anonymous usage continues working with periodic nudges to set up a key.

</domain>

<decisions>
## Implementation Decisions

### My Skill Leverage page
- Name: "My Skill Leverage" (not "My Usage")
- Location: Tabbed view on the home page — toggle between "Browse Skills" and "My Leverage"
- Two sections: **Skills Used** and **Skills Created**, each with its own summary stats + timeline
- Timeline entries are rich: skill name, action (search/deploy/install), timestamp, category badge, hours saved
- Summary stat cards above each timeline (total skills, total hours saved, most-used skill, etc.)
- Skills Created stats: hours saved by others + adoption metrics (usage count, unique users, avg rating per skill)
- Time range: all time with "Load more" button to page back through history
- FTE hours saved is the dominant metric throughout

### Install callback flow
- HTTP POST to `/api/install-callback` — same pattern as validate-key endpoint
- Payload: API key, skill ID, platform, OS, client version
- Server validates API key, resolves userId, then calls `trackUsage()` internally
- Distinguishes deploy intent (MCP deploy_skill) from confirmed installation (callback received)
- On failure to reach Relay: silent fail, log locally for potential future data gathering
- No retry — install succeeds regardless of callback outcome

### Anonymous fallback behavior
- MCP tools work identically with or without API key
- When no API key: userId stays null (current behavior), tracking still happens
- Periodic nudge every 5 anonymous uses: appended text block to tool response — "Tip: Set up an API key on your Relay profile to track your personal skill leverage"
- First authenticated use shows subtle confirmation: "Tracking active for name@company.com"
- After first confirmation, authenticated use is invisible (no further messaging)

### Attribution granularity
- Every MCP tool call is a separate usage_event (search, list, deploy) — keep current granularity
- FTE hours saved per employee: use the employee's own review estimate when available, fall back to creator's timeSavedMinutes
- Creator impact: sum of ALL uses of their skills x timeSavedMinutes (including their own self-usage)
- MCP server resolves API key to userId via DB service directly (import validateApiKey from @everyskill/db/services/api-keys) — no HTTP overhead

### Claude's Discretion
- Exact stat card layout and which 3-4 summary metrics to show per section
- Tab component implementation (URL state with nuqs vs local state)
- Timeline pagination batch size
- Nudge message wording
- How to count anonymous uses for the nudge threshold (server-side counter vs metadata)

</decisions>

<specifics>
## Specific Ideas

- "My Skill Leverage" framing emphasizes personal impact, not just raw activity
- Two-sided view (used vs created) tells the full story of an employee's contribution
- FTE hours saved should be the hero metric — it's what proves Relay's value
- Install callback follows the same `trackUsage()` pattern as existing MCP tool tracking
- Silent fail with local logging on install callbacks — don't break installs for analytics

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-employee-usage-tracking*
*Context gathered: 2026-02-05*
