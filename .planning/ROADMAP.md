# Roadmap: Relay

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- 🚧 **v1.1 Quality & Polish** - Phases 9-11 (in progress)

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

### 🚧 v1.1 Quality & Polish (In Progress)

**Milestone Goal:** Fix tech debt from v1.0 and add quality scorecards to surface high-value skills.

- [x] **Phase 9: Tag Filtering** - Complete backend for existing tag UI
- [ ] **Phase 10: Quality Scorecards** - Calculate and display quality badges
- [ ] **Phase 11: E2E Test Coverage** - Validate authenticated user flows

## Phase Details

### Phase 9: Tag Filtering
**Goal:** Users can filter skills by tags to find relevant content faster
**Depends on:** Phase 8 (v1.0 complete)
**Requirements:** TAG-01, TAG-02, TAG-03
**Success Criteria** (what must be TRUE):
  1. User sees a list of available tags on the browse page
  2. User can select one or more tags to filter the skill list
  3. Tag filtering works together with category dropdown and search input
  4. Selecting tags updates URL state (shareable filtered views)
**Plans:** 1 plan

Plans:
- [x] 09-01-PLAN.md — Add tags column and implement backend filtering

### Phase 10: Quality Scorecards
**Goal:** Users can identify high-quality skills through visible quality badges
**Depends on:** Phase 9
**Requirements:** QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. Skills with sufficient data display Gold/Silver/Bronze badges on cards and detail pages
  2. User can filter skills by quality tier (e.g., show only Gold skills)
  3. User can sort skills by quality score
  4. User can view quality breakdown (see what factors contributed to badge)
  5. New skills without enough data show "Unrated" state instead of misleading badge
**Plans:** TBD

Plans:
- [ ] 10-01: [TBD during planning]

### Phase 11: E2E Test Coverage
**Goal:** Authenticated user flows are validated through automated browser tests
**Depends on:** Phase 10
**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. E2E test logs in and successfully uploads a skill with metadata
  2. E2E test logs in and submits a rating with comment and time saved
  3. E2E test searches for skills and verifies results update
  4. E2E test navigates to user profile and verifies contribution stats display
  5. All E2E tests pass in CI pipeline
**Plans:** TBD

Plans:
- [ ] 11-01: [TBD during planning]

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 33/33 | Complete | 2026-01-31 |
| 9. Tag Filtering | v1.1 | 1/1 | Complete | 2026-01-31 |
| 10. Quality Scorecards | v1.1 | 0/? | Not started | - |
| 11. E2E Test Coverage | v1.1 | 0/? | Not started | - |

---

*Roadmap created: 2026-01-31 for v1.1 milestone*
