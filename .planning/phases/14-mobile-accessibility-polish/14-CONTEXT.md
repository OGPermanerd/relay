# Phase 14: Mobile & Accessibility Polish - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the two-panel skills table and leaderboard fully accessible via keyboard navigation and screen readers, with responsive stacking on mobile viewports. Users can navigate, expand, and install skills using only keyboard or touch.

</domain>

<decisions>
## Implementation Decisions

### Responsive Breakpoints
- Stack panels below 640px (sm) — only phones get single column
- Skills table appears first (above leaderboard) when stacked
- Keep all table columns on mobile, enable horizontal scroll
- 44px minimum touch targets (Apple HIG standard)

### Keyboard Navigation
- Tab moves row-by-row through the table (not cell-by-cell)
- Enter on focused row navigates to skill detail page
- Focusing a row automatically expands its accordion (no separate key)
- When focus leaves a row, its accordion auto-collapses
- Full grid navigation with arrow keys (Up/Down between rows, Left/Right between cells)
- Custom focus ring matching brand (blue ring, consistent with hover/active states)

### Mobile Interactions
- Tapping a row expands accordion (same as desktop click)
- Leaderboard is collapsible on mobile
- Leaderboard default state: expanded for first 5 user logins, auto-collapses after 5 seconds; after 5th login, starts collapsed
- Swipe row left/right to quick-install (copies MCP config without expanding)

### Claude's Discretion
- Screen reader announcement text for sort changes
- ARIA attributes implementation details
- Exact swipe gesture threshold and animation
- How to track "first 5 logins" (localStorage or user preference)

</decisions>

<specifics>
## Specific Ideas

- Keyboard behavior mirrors "roving tabindex" pattern for data grids
- Focus-to-expand creates a preview experience without requiring extra keystrokes
- Swipe-to-install matches common mobile quick-action patterns (email swipe actions)
- Leaderboard collapse onboarding: introduce the feature to new users, then get out of the way

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-mobile-accessibility-polish*
*Context gathered: 2026-02-01*
