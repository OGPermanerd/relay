# Phase 13: Interactive Sorting & Accordion - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add interactivity to the skills table: sortable columns, expandable rows with skill details, one-click install via clipboard, and author filtering from the leaderboard. Users can share sorted/filtered views via URL.

</domain>

<decisions>
## Implementation Decisions

### Accordion Content
- Preview card style — similar to existing skill-card but inline, compact summary of all metadata
- Install button appears in both places: quick icon on collapsed row + full button inside accordion
- No animation — content appears instantly when row is clicked
- Expanded rows get subtle background highlight (e.g., blue-50) to indicate state

### Sort Interaction
- Two-state toggle: first click = descending (most useful first), second click = ascending
- All columns sortable except Sparkline (Skill Name, Days Saved, Installs, Date Added, Author)
- Chevrons always visible on sortable column headers, filled/highlighted for active sort
- Client-side sort — table re-sorts instantly, no loading state

### Install Button
- Copies MCP config JSON to clipboard (ready-to-paste for claude_desktop_config.json)
- Button text changes to "Copied!" for 2 seconds, then reverts to "Install"
- Clicking Install increments the skill's install/usage count (track as metric)
- Row-level quick install uses download arrow icon

### Leaderboard Filtering
- Clicking author adds to existing filters (stacks with search/category/tags)
- Active author filter shown in both places: removable chip in filter bar + highlighted row in leaderboard
- Either clicking the chip X or clicking the highlighted leaderboard row clears the filter
- Author filter persists in URL (?author=user-id) for shareable filtered views

### Claude's Discretion
- Exact chevron icon choice and sizing
- Accordion content layout within the preview card style
- How to handle edge cases (no description, missing fields)

</decisions>

<specifics>
## Specific Ideas

- Install copies MCP config JSON since browser security prevents direct config file modification
- This matches patterns from Smithery and other MCP server directories
- URL state includes both sort params and author filter for complete shareable views

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-interactive-sorting-accordion*
*Context gathered: 2026-02-01*
