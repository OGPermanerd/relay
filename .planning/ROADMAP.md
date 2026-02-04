# Roadmap: Relay

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- ✅ **v1.1 Quality & Polish** - Phases 9-11 (shipped 2026-02-01)
- ✅ **v1.2 UI Redesign** - Phases 12-14 (shipped 2026-02-02)
- ✅ **v1.3 AI Quality & Cross-Platform** - Phases 15-19 (shipped 2026-02-04)

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

<details>
<summary>✅ v1.2 UI Redesign (Phases 12-14) - SHIPPED 2026-02-02</summary>

See archived roadmap: .planning/milestones/v1.2-ROADMAP.md

**Summary:**
- Phase 12: Two-Panel Layout Foundation (3 plans)
- Phase 13: Interactive Sorting & Accordion (4 plans)
- Phase 14: Mobile & Accessibility Polish (5 plans)

Total: 12 plans completed.

</details>

### ✅ v1.3 AI Quality & Cross-Platform (Shipped 2026-02-04)

**Milestone Goal:** Add AI-driven skill review, semantic duplicate detection, fork-based versioning, and cross-platform install support.

- [x] **Phase 15: Embeddings Foundation** - Vector embeddings infrastructure for semantic search
- [x] **Phase 16: Similarity Detection** - Advisory duplicate warnings on publish
- [x] **Phase 17: AI Review Pipeline** - On-demand AI quality reviews
- [x] **Phase 18: Fork-Based Versioning** - Create attributed skill variants
- [x] **Phase 19: Cross-Platform Install** - Multi-platform MCP config generation

## Phase Details

### Phase 15: Embeddings Foundation
**Goal**: Enable semantic search by generating and storing vector embeddings for all skill content
**Depends on**: Phase 14 (v1.2 complete)
**Requirements**: EMB-01, EMB-02, EMB-03, EMB-04
**Success Criteria** (what must be TRUE):
  1. New skills automatically receive vector embeddings on publish
  2. Existing skills have embeddings (backfill complete, verifiable via database query)
  3. System can query similar skills by vector similarity (internal function works)
  4. Embedding generation handles all skill formats (prompts, workflows, configs)
**Plans**: 4 plans

Plans:
- [x] 15-01-PLAN.md — Schema and pgvector infrastructure
- [x] 15-02-PLAN.md — Voyage AI embedding service
- [x] 15-03-PLAN.md — Hook embeddings into publish flow
- [x] 15-04-PLAN.md — Backfill existing skills

### Phase 16: Similarity Detection
**Goal**: Users see advisory warnings about similar existing skills when publishing
**Depends on**: Phase 15 (embeddings infrastructure)
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04
**Success Criteria** (what must be TRUE):
  1. User sees top 3 similar skills with similarity percentages when publishing a new skill
  2. User can dismiss similarity warning and publish anyway
  3. Skill detail page shows "Similar Skills" section with related skills
  4. Similarity detection does not block publishing (advisory only)
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md — Similar skills on publish flow (SIM-01, SIM-02, SIM-03)
- [x] 16-02-PLAN.md — Similar skills section on detail page (SIM-04)

### Phase 17: AI Review Pipeline
**Goal**: Users can trigger AI-powered quality reviews for skills
**Depends on**: Phase 15 (embeddings for context)
**Requirements**: REV-01, REV-02, REV-03
**Success Criteria** (what must be TRUE):
  1. User can click "Get AI Review" button on skill detail page
  2. Review displays structured feedback (functionality score, quality score, improvement suggestions)
  3. Review results are persisted and visible on subsequent visits
  4. Review clearly marked as advisory (not blocking)
**Plans**: 3 plans

Plans:
- [x] 17-01-PLAN.md — Schema, service layer, and SDK installation
- [x] 17-02-PLAN.md — AI review generation library and server action
- [x] 17-03-PLAN.md — Tab UI, score display, and review trigger flow

### Phase 18: Fork-Based Versioning
**Goal**: Users can create attributed variants of existing skills
**Depends on**: Phase 14 (independent of AI features)
**Requirements**: FORK-01, FORK-02, FORK-03, FORK-04
**Success Criteria** (what must be TRUE):
  1. User can fork any skill, creating a copy with "Forked from X" attribution displayed
  2. Parent skill shows fork count
  3. User can view list of all forks for any skill
  4. Forked skill inherits parent's tags and category automatically
**Plans**: 2 plans

Plans:
- [x] 18-01-PLAN.md — Schema, service layer, fork action (FORK-01, FORK-04)
- [x] 18-02-PLAN.md — Fork UI: button, attribution, forks section (FORK-02, FORK-03)

### Phase 19: Cross-Platform Install
**Goal**: Users can install skills on any supported Claude platform
**Depends on**: Phase 14 (independent of AI features)
**Requirements**: INST-01, INST-02, INST-03, INST-04
**Success Criteria** (what must be TRUE):
  1. User can copy MCP config for Claude Code (existing, verified working)
  2. User can copy MCP config for Claude Desktop with correct OS-specific paths
  3. Platform selection modal appears before copy, showing available platforms
  4. System auto-detects user's OS and pre-selects appropriate platform
**Plans**: 2 plans

Plans:
- [x] 19-01-PLAN.md — Platform modal, config generation, OS detection, install scripts
- [x] 19-02-PLAN.md — Integration into all install entry points and E2E tests

## Progress

**Execution Order:**
Phases 15-17 must execute in order (embeddings enables similarity and AI review).
Phases 18-19 can execute in parallel with 16-17 after Phase 15.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 33/33 | Complete | 2026-01-31 |
| 9. Tag Filtering | v1.1 | 1/1 | Complete | 2026-01-31 |
| 10. Quality Scorecards | v1.1 | 4/4 | Complete | 2026-01-31 |
| 11. E2E Test Coverage | v1.1 | 4/4 | Complete | 2026-02-01 |
| 12. Two-Panel Layout | v1.2 | 3/3 | Complete | 2026-02-01 |
| 13. Interactive Sorting & Accordion | v1.2 | 4/4 | Complete | 2026-02-01 |
| 14. Mobile & Accessibility | v1.2 | 5/5 | Complete | 2026-02-01 |
| 15. Embeddings Foundation | v1.3 | 4/4 | Complete | 2026-02-02 |
| 16. Similarity Detection | v1.3 | 2/2 | Complete | 2026-02-03 |
| 17. AI Review Pipeline | v1.3 | 3/3 | Complete | 2026-02-04 |
| 18. Fork-Based Versioning | v1.3 | 2/2 | Complete | 2026-02-04 |
| 19. Cross-Platform Install | v1.3 | 2/2 | Complete | 2026-02-04 |

## Coverage Validation

**v1.3 Requirements: 19 total**

| Category | Requirements | Phase | Count |
|----------|--------------|-------|-------|
| Embeddings | EMB-01, EMB-02, EMB-03, EMB-04 | 15 | 4 |
| Similarity | SIM-01, SIM-02, SIM-03, SIM-04 | 16 | 4 |
| AI Review | REV-01, REV-02, REV-03 | 17 | 3 |
| Fork Model | FORK-01, FORK-02, FORK-03, FORK-04 | 18 | 4 |
| Install | INST-01, INST-02, INST-03, INST-04 | 19 | 4 |

**Mapped: 19/19** - All requirements covered, no orphans.

---
*Roadmap created: 2026-01-31*
*v1.1 completed: 2026-02-01*
*v1.2 completed: 2026-02-02*
*v1.3 roadmap added: 2026-02-02*
