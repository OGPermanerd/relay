# Phase 23: Analytics Dashboard - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins and employees can see org-wide usage trends, per-employee breakdowns, and export data to prove Relay's value. The dashboard visualizes usage_events data that's been accumulating since Phase 21. This phase delivers visualization and export — not new data collection.

</domain>

<decisions>
## Implementation Decisions

### Chart design
- Default time range: Last 30 days
- Time range selection: Preset buttons only (7d / 30d / 90d / 1y)
- Chart type: Area chart for usage trends
- Granularity: Auto-adjust based on selected range (daily for 7d, weekly for 90d, etc.)

### Data views & layout
- Organization: Tabbed interface with 3 tabs: Overview / Employees / Skills
- Overview tab:
  - 6 stat cards: Total hours saved, Active employees, Skills deployed, Deployments this period, Most used skill, Highest saver (employee)
  - Area chart showing usage trends below stat cards
- Employees tab:
  - Detailed table with columns: Name, Email, Skills used, Usage frequency, Hours saved, Last active, Top skill
  - All columns sortable by clicking headers
  - Clicking employee row drills down to individual activity detail view
- Skills tab:
  - Leaderboard cards showing top skills with visual rank indicators
  - Clicking a skill card drills down to skill analytics detail (which employees use it, usage over time, hours saved)

### Access & permissions
- Access: Everyone sees the same full org-wide analytics (no role-based filtering)
- Navigation: Analytics link in main nav, visible to all users
- Links: Employee names link to their profiles, skill names link to skill detail pages

### Export behavior
- Scope: Single full dump option (not per-view exports)
- Time filtering: Export respects current time range selection
- Filename: Descriptive format: `relay-analytics-2026-02-06.csv`
- Columns: All data fields, maximum detail (not just display columns)

### Claude's Discretion
- Exact stat card styling and icons
- Area chart colors and hover interactions
- Loading states and skeletons
- Employee detail view layout
- Skill analytics detail view layout
- Sort order defaults (probably by hours saved descending)
- How to handle empty state (no usage data yet)

</decisions>

<specifics>
## Specific Ideas

No specific product references mentioned — open to standard approaches.

Key UX flow: Overview gives the big picture → Employees tab lets you see who's getting value → Skills tab shows which skills drive that value. Each view can drill down for more detail.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-analytics-dashboard*
*Context gathered: 2026-02-06*
