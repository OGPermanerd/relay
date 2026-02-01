# Roadmap: Relay

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- ✅ **v1.1 Quality & Polish** - Phases 9-11 (shipped 2026-02-01)
- 🚧 **v1.2 UI Redesign** - Phases 12-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8) - SHIPPED 2026-01-31</summary>

See archived roadmap: .planning/milestones/v1.0-ROADMAP.md

**Summary:**
- Phase 1: Project Foundation (4 plans)
- Phase 2: Authentication (3 plans)
- Phase 3: MCP Integration (6 plans)
- Phase 4: Data Model & Storage (5 plans)
- Phase 5: Skill Publishing (3 plans)
- Phase 6: Discovery (4 plans)
- Phase 7: Ratings & Reviews (3 plans)
- Phase 8: Metrics & Analytics (5 plans)

Total: 33 plans completed in 120 minutes.

</details>

<details>
<summary>✅ v1.1 Quality & Polish (Phases 9-11) - SHIPPED 2026-02-01</summary>

See archived roadmap: .planning/milestones/v1.1-ROADMAP.md

**Summary:**
- Phase 9: Tag Filtering (1 plan)
- Phase 10: Quality Scorecards (4 plans)
- Phase 11: E2E Test Coverage (4 plans)

Total: 9 plans completed in 45 minutes.

</details>

### 🚧 v1.2 UI Redesign (In Progress)

**Milestone Goal:** Redesign the UI with a two-panel sortable table layout featuring inline expansion, one-click install, and full accessibility support.

#### Phase 12: Two-Panel Layout Foundation
**Goal**: Users see skills in a functional two-panel layout with sortable table and leaderboard
**Depends on**: Phase 11 (existing browse page serves as baseline)
**Requirements**: LAYT-01, TABL-01, TABL-04, TABL-05, TABL-10, LEAD-01, LEAD-02
**Success Criteria** (what must be TRUE):
  1. User sees skills table occupying left 2/3 of screen with leaderboard in right 1/3
  2. Table displays all six columns: skill name, days_saved, installs, date added, author handle, sparkline
  3. Table is sorted by days_saved descending by default
  4. User can type in search bar and see filtered results
  5. Leaderboard shows contributors with handle, total days_saved, contribution count, and latest date
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD
- [ ] 12-03: TBD

#### Phase 13: Interactive Sorting & Accordion
**Goal**: Users can interactively sort the table and expand rows to see skill details and install
**Depends on**: Phase 12
**Requirements**: TABL-02, TABL-03, TABL-06, TABL-07, TABL-08, TABL-09, LEAD-03
**Success Criteria** (what must be TRUE):
  1. User can click any column header to sort ascending, click again to sort descending
  2. Active sort column shows direction indicator (chevron up/down)
  3. User can click a row to expand inline accordion showing description and usage instructions
  4. Multiple rows can be expanded simultaneously without collapsing others
  5. User can click Install button in expanded row to copy skill to clipboard
  6. Sort state persists in URL (user can share sorted view via link)
  7. User can click a contributor in leaderboard to filter table to that author's skills
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD
- [ ] 13-03: TBD

#### Phase 14: Mobile & Accessibility Polish
**Goal**: Users can access all features via keyboard and mobile devices with full screen reader support
**Depends on**: Phase 13
**Requirements**: LAYT-02, A11Y-01, A11Y-02, A11Y-03
**Success Criteria** (what must be TRUE):
  1. On mobile viewport, panels stack vertically with skills table above leaderboard
  2. User can navigate entire table using only keyboard (Tab, Enter, Arrow keys)
  3. Accordion rows announce expanded/collapsed state to screen readers
  4. Sort indicators are announced to screen readers (aria-sort on columns)
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 33/33 | Complete | 2026-01-31 |
| 9. Tag Filtering | v1.1 | 1/1 | Complete | 2026-01-31 |
| 10. Quality Scorecards | v1.1 | 4/4 | Complete | 2026-01-31 |
| 11. E2E Test Coverage | v1.1 | 4/4 | Complete | 2026-02-01 |
| 12. Two-Panel Layout | v1.2 | 0/TBD | Not started | - |
| 13. Interactive Sorting & Accordion | v1.2 | 0/TBD | Not started | - |
| 14. Mobile & Accessibility | v1.2 | 0/TBD | Not started | - |

---

*Roadmap created: 2026-01-31*
*v1.1 completed: 2026-02-01*
*v1.2 phases added: 2026-02-01*
