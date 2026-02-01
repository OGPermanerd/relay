# Requirements: Relay

**Defined:** 2026-02-01
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v1.2 Requirements

Requirements for UI redesign focused on simplicity, gamification, and performance.

### Skills Table

- [x] **TABL-01**: User sees skills in a sortable table occupying left 2/3 of screen
- [ ] **TABL-02**: User can click column header to sort ascending, click again to sort descending
- [ ] **TABL-03**: Table shows sort direction indicator (chevron) on active column
- [x] **TABL-04**: Table displays columns: skill name, days_saved, installs, date added, author handle, sparkline
- [x] **TABL-05**: Default sort is days_saved descending
- [ ] **TABL-06**: User can click row to expand inline accordion showing description and usage instructions
- [ ] **TABL-07**: Multiple rows can be expanded simultaneously
- [ ] **TABL-08**: User can click "Install" button to copy skill to clipboard with MCP config
- [ ] **TABL-09**: Sort state persists in URL (shareable links)
- [x] **TABL-10**: User can search skills via search bar above table

### Leaderboard

- [x] **LEAD-01**: User sees contributor leaderboard in right 1/3 of screen
- [x] **LEAD-02**: Leaderboard shows: handle, total days_saved, # contributions, latest contribution date
- [ ] **LEAD-03**: User can click contributor to filter skills table to that author

### Layout

- [x] **LAYT-01**: Two-panel layout with responsive behavior
- [ ] **LAYT-02**: Mobile view stacks panels vertically (skills above leaderboard)

### Accessibility

- [ ] **A11Y-01**: Table is keyboard navigable (Tab, Enter, Arrow keys)
- [ ] **A11Y-02**: Accordion rows have proper ARIA attributes (aria-expanded, hidden)
- [ ] **A11Y-03**: Sort indicators are screen reader accessible (aria-sort)

## Future Requirements

Deferred to later milestones.

### Versioning & Contribution

- **VERS-01**: Version history shows all versions with author, date, and per-version metrics
- **VERS-02**: User can view and diff any historical version
- **VERS-03**: User can fork any skill and publish as new version

### Community

- **COMM-01**: User can create and curate skill collections
- **COMM-02**: User can subscribe to skills for update notifications

## Out of Scope

| Feature | Reason |
|---------|--------|
| Virtualization | Not needed at <100 rows; monitor and add if scale increases |
| TanStack Table | Overkill for single-column sort; shadcn/ui Table sufficient |
| Pagination | Research indicates continuous scroll preferred for tables with expansion |
| Auto-collapse accordion | UX anti-pattern per NN/g research |
| Direct MCP invocation from web | Browser security prevents; clipboard copy is best available pattern |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TABL-01 | Phase 12 | Complete |
| TABL-02 | Phase 13 | Pending |
| TABL-03 | Phase 13 | Pending |
| TABL-04 | Phase 12 | Complete |
| TABL-05 | Phase 12 | Complete |
| TABL-06 | Phase 13 | Pending |
| TABL-07 | Phase 13 | Pending |
| TABL-08 | Phase 13 | Pending |
| TABL-09 | Phase 13 | Pending |
| TABL-10 | Phase 12 | Complete |
| LEAD-01 | Phase 12 | Complete |
| LEAD-02 | Phase 12 | Complete |
| LEAD-03 | Phase 13 | Pending |
| LAYT-01 | Phase 12 | Complete |
| LAYT-02 | Phase 14 | Pending |
| A11Y-01 | Phase 14 | Pending |
| A11Y-02 | Phase 14 | Pending |
| A11Y-03 | Phase 14 | Pending |

**Coverage:**
- v1.2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-01*
*Traceability updated: 2026-02-01*
