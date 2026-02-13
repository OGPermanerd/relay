---
phase: 47-homepage-research
plan: 01
subsystem: research
tags: [homepage, research, layout-variants, marketplace]

# Dependency graph
requires: []
provides:
  - "Homepage layout variant selection: Hybrid A+B (Marketplace Hub + Category Tiles)"
affects: [48]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Search-first hero with large category tiles and curated collections"]

key-files:
  created:
    - .planning/phases/47-homepage-research/47-RESEARCH.md
  modified: []

key-decisions:
  - "Selected Hybrid A+B variant: Marketplace Hub search-first hero combined with large category tiles from Category Gallery"
  - "Research covered 6 platforms: Atlassian Marketplace, Notion Templates, Slack App Directory, VS Code Extensions, Chrome Web Store, Figma Community"
  - "Variant C (Personalized Dashboard) rejected — sidebar overkill for 4 categories, empty state problem"

patterns-established:
  - "Homepage layout: search hero → category tiles → curated collection cards → compact stats"

# Metrics
duration: 5min
completed: 2026-02-13
---

# Phase 47 Plan 01: Homepage Research Summary

**Homepage layout variant research and selection**

## Performance

- **Duration:** 5 min (research + evaluation)
- **Completed:** 2026-02-13
- **Tasks:** 2 (verification + decision checkpoint)
- **Files created:** 1

## Accomplishments
- Researched 6 marketplace platforms (Atlassian, Notion, Slack, VS Code, Chrome, Figma)
- Produced 3 detailed layout variants with ASCII wireframes, pros/cons, data mappings
- Created 10-criteria comparison matrix
- **User selected: Hybrid A+B — Marketplace Hub with large category tiles**

## Selected Variant: Hybrid A+B

Combines the best of Variant A (Marketplace Hub) and Variant B (Category Gallery):

1. **Search-first hero** — prominent discovery search bar as focal point
2. **Large category tiles** — 4-column grid (Prompts, Workflows, Agents, MCP Tools) with skill counts
3. **Company Recommended** — horizontal card row of admin-stamped skills
4. **Trending Now** — horizontal card row of trending skills
5. **Compact stats bar** — platform metrics as inline banner (not dominant)
6. **Top Contributors + Mini Leverage** — leaderboard + personal stats widget

## Decisions Made
- Hybrid A+B selected over pure Variant A (stronger visual hierarchy with category tiles)
- Variant C (Personalized Dashboard with sidebar) rejected — overkill for 4 categories
- My Leverage becomes compact widget with link to dedicated page (removes empty-state problem)
- Grid cards preferred over horizontal scroll carousels for desktop accessibility

## Next Phase Readiness
- Phase 48 (Homepage Redesign) can now proceed with the Hybrid A+B specification
- All data sources exist: discoverSkills, getCompanyApprovedSkills, getTrendingSkills, getLeaderboard, getPlatformStats
- One new query needed: per-category skill counts (trivial SQL)

---
*Phase: 47-homepage-research*
*Completed: 2026-02-13*
