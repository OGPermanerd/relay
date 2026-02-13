# Roadmap: EverySkill

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- ✅ **v1.1 Quality & Polish** - Phases 9-11 (shipped 2026-02-01)
- ✅ **v1.2 UI Redesign** - Phases 12-14 (shipped 2026-02-02)
- ✅ **v1.3 AI Quality & Cross-Platform** - Phases 15-19 (shipped 2026-02-04)
- ✅ **v1.4 Employee Analytics & Remote MCP** - Phases 20-24 (shipped 2026-02-06)
- ✅ **v1.5 Production, Multi-Tenancy & Reliable Usage Tracking** - Phases 25-33 (shipped 2026-02-08)
- ✅ **v2.0 Skill Ecosystem** - Phases 34-39 (shipped 2026-02-08)
- 🚧 **v3.0 AI Discovery & Workflow Intelligence** - Phases 40-48 (in progress)

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

<details>
<summary>✅ v1.3 AI Quality & Cross-Platform (Phases 15-19) - SHIPPED 2026-02-04</summary>

See archived roadmap: .planning/milestones/v1.3-ROADMAP.md

**Summary:**
- Phase 15: Embeddings Foundation (4 plans)
- Phase 16: Similarity Detection (2 plans)
- Phase 17: AI Review Pipeline (3 plans)
- Phase 18: Fork-Based Versioning (2 plans)
- Phase 19: Cross-Platform Install (2 plans)

Total: 15 plans completed.

</details>

<details>
<summary>✅ v1.4 Employee Analytics & Remote MCP (Phases 20-24) - SHIPPED 2026-02-06</summary>

See archived roadmap: .planning/milestones/v1.4-ROADMAP.md

**Summary:**
- Phase 20: API Key Management (7 plans)
- Phase 21: Employee Usage Tracking (6 plans)
- Phase 22: Web Remote MCP (3 plans)
- Phase 23: Analytics Dashboard (7 plans)
- Phase 24: Extended MCP Search (2 plans)

Total: 25 plans completed.

</details>

<details>
<summary>✅ v1.5 Production, Multi-Tenancy & Reliable Usage Tracking (Phases 25-33) - SHIPPED 2026-02-08</summary>

See archived roadmap: .planning/milestones/v1.5-ROADMAP.md

**Summary:**
- Phase 25: Multi-Tenancy Schema & Audit Foundation (9 plans)
- Phase 26: Auth & Subdomain Routing (3 plans)
- Phase 27: Production Docker Deployment (4 plans)
- Phase 28: Hook-Based Usage Tracking (7 plans)
- Phase 29: Tenant-Scoped Analytics & MCP (3 plans)
- Phase 30: Branding & Navigation (7 plans)
- Phase 31: Skills & Upload Enhancements (6 plans)
- Phase 32: Admin Panel (6 plans)
- Phase 33: Email & Notifications (7 plans)

Total: 55 plans completed.

</details>

<details>
<summary>✅ v2.0 Skill Ecosystem (Phases 34-39) - SHIPPED 2026-02-08</summary>

See archived roadmap: .planning/milestones/v2.0-ROADMAP.md

**Summary:**
- Phase 34: Review Pipeline Foundation (5 plans)
- Phase 35: AI Review Integration (3 plans)
- Phase 36: Admin Review UI (3 plans)
- Phase 37: Review Notifications (4 plans)
- Phase 38: Conversational MCP Discovery (4 plans)
- Phase 39: Fork Detection (4 plans)

Total: 23 plans completed. 44 requirements across 6 categories.

</details>

### v3.0 AI Discovery & Workflow Intelligence (In Progress)

**Milestone Goal:** Transform EverySkill from a skill catalog into an intelligent discovery and adoption platform with visibility scoping, AI-powered search, video integration, user preferences, and a redesigned homepage.

**Phase Numbering:**
- Integer phases (40, 41, ...): Planned milestone work
- Decimal phases (40.1, 40.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 40: Visibility Scoping** - Skill access control with tenant/personal visibility levels
- [ ] **Phase 41: Loom Video Integration** - Video demos on skill pages and browse cards
- [ ] **Phase 42: MCP Tool Unification** - Single `everyskill` tool with sub-commands for external discovery
- [ ] **Phase 43: User Preferences** - Server-side preference storage with CLAUDE.md export
- [ ] **Phase 44: Admin Global Skills** - Company Approved badge and admin stamping workflow
- [ ] **Phase 45: Hybrid Search & Discovery** - AI-powered intent search with semantic + full-text fusion
- [ ] **Phase 46: Search Analytics** - Query logging and admin dashboard for search insights
- [ ] **Phase 47: Homepage Research** - Competitive analysis and layout variant evaluation
- [ ] **Phase 48: Homepage Redesign** - Search-first hero with personalization and curated sections

#### Phase 40: Visibility Scoping
**Goal**: Users control who can see their skills, and the platform enforces visibility boundaries everywhere
**Depends on**: Nothing (foundation phase)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-06
**Success Criteria** (what must be TRUE):
  1. User can set a skill's visibility to "tenant" or "personal" when creating or editing it
  2. User browsing skills never sees another user's personal skills — only their own personal skills and all tenant-visible skills appear
  3. MCP search and recommend tools return only skills the authenticated user is allowed to see
  4. All existing skills have "tenant" visibility after migration, with no change in browse behavior
**Plans:** 4 plans

Plans:
- [x] 40-01-PLAN.md — Schema, migration, and visibility filter helpers
- [x] 40-02-PLAN.md — Apply visibility to all web read/query paths
- [x] 40-03-PLAN.md — Visibility UI selector and write path integration
- [x] 40-04-PLAN.md — MCP tools visibility enforcement

#### Phase 41: Loom Video Integration
**Goal**: Authors can add video demos to skills, and viewers watch them inline
**Depends on**: Nothing (parallel with Phase 40, 42)
**Requirements**: LOOM-01, LOOM-02, LOOM-03, LOOM-04
**Success Criteria** (what must be TRUE):
  1. Author can paste a Loom URL when creating or editing a skill, with format validation and error feedback
  2. Skill detail page displays a responsive embedded Loom video player that loads metadata (title, duration) from oEmbed
  3. Skill browse cards show a video thumbnail badge when a Loom URL is present, distinguishing video-equipped skills at a glance
**Plans:** 2 plans

Plans:
- [ ] 41-01-PLAN.md — Schema, migration, Loom utility library, Zod validation, and form field
- [ ] 41-02-PLAN.md — LoomEmbed component, detail page integration, and browse/trending indicators

#### Phase 42: MCP Tool Unification
**Goal**: Users discover and interact with EverySkill through a single, well-described MCP tool
**Depends on**: Nothing (parallel with Phase 40, 41)
**Requirements**: MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):
  1. User can invoke `everyskill` as a single MCP tool with sub-commands (search, install, describe) from any AI client
  2. All existing MCP functionality (search, recommend, install, describe, review, drift check) works identically through the unified tool wrapper
  3. AI clients proactively suggest the `everyskill` tool when users ask skill-related questions, due to the tool description being crafted for discoverability
**Plans**: TBD

Plans:
- [ ] 42-01: TBD

#### Phase 43: User Preferences
**Goal**: Users configure personal settings that persist server-side and export as portable AI configuration
**Depends on**: Nothing (can run parallel with 40-42)
**Requirements**: PREF-01, PREF-02, PREF-04, PREF-05
**Success Criteria** (what must be TRUE):
  1. User can access a preferences page to set preferred categories, default sort order, and notification preferences
  2. Preferences are stored server-side in JSONB with Zod validation, code-defined defaults, and immediate effect (no localStorage)
  3. User can generate a CLAUDE.md file from their skill portfolio and preferences, containing relevant skill references and personal workflow settings
**Plans:** 3 plans

Plans:
- [ ] 43-01-PLAN.md — Schema, service, migration, and shared Zod defaults
- [ ] 43-02-PLAN.md — Settings layout, preferences form, and profile page links
- [ ] 43-03-PLAN.md — CLAUDE.md export server action and preview/download UI

#### Phase 44: Admin Global Skills
**Goal**: Admins curate a set of company-endorsed skills with visible badges
**Depends on**: Phase 40 (visibility infrastructure must exist)
**Requirements**: VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. Admin can stamp any published skill as "Company Approved" via a dedicated action, and a distinctive badge appears on the skill card and detail page
  2. Company Approved skills appear in a dedicated "Company Recommended" section that is visually distinct from other skill listings
**Plans**: TBD

Plans:
- [ ] 44-01: TBD

#### Phase 45: Hybrid Search & Discovery
**Goal**: Users describe what they need in natural language and get intelligent, ranked skill recommendations
**Depends on**: Phase 40 (visibility-aware search), Phase 43 (preference-boosted ranking)
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, PREF-03
**Success Criteria** (what must be TRUE):
  1. User can type a natural language query in a prominent search bar and receive top-3 ranked skill recommendations with match rationale for each
  2. Search uses hybrid retrieval (pgvector semantic + tsvector full-text) merged via Reciprocal Rank Fusion, producing better results than either method alone
  3. When intent is ambiguous or no semantic matches meet threshold, search falls back gracefully to keyword results without errors
  4. Search results never include skills the user should not see (respects personal/tenant visibility scoping)
  5. User sees streaming loading feedback during search processing, and results from preferred categories rank higher
**Plans**: TBD

Plans:
- [ ] 45-01: TBD
- [ ] 45-02: TBD
- [ ] 45-03: TBD

#### Phase 46: Search Analytics
**Goal**: Admins understand search behavior and identify skill gaps from query data
**Depends on**: Phase 45 (search infrastructure must exist to generate query logs)
**Requirements**: ANALYTICS-01, ANALYTICS-02, ANALYTICS-03
**Success Criteria** (what must be TRUE):
  1. All search queries are logged with result counts in a fire-and-forget manner that adds no perceptible latency to search
  2. Admin dashboard displays zero-result queries, highlighting terms where users searched but found nothing (skill gap signals)
  3. Admin dashboard displays most-searched terms and trending queries, sorted by frequency and recency
**Plans**: TBD

Plans:
- [ ] 46-01: TBD

#### Phase 47: Homepage Research
**Goal**: Data-driven evaluation of homepage layout options before committing to implementation
**Depends on**: Nothing (research phase, no technical dependencies)
**Requirements**: HOME-08
**Success Criteria** (what must be TRUE):
  1. 2-3 homepage layout variants are researched and presented, each inspired by a successful platform (Atlassian Marketplace, Notion Templates, Slack App Directory) with annotated screenshots and rationale
  2. User evaluates variants and selects one for implementation, with clear documentation of what was chosen and why
**Plans**: TBD

Plans:
- [ ] 47-01: TBD

#### Phase 48: Homepage Redesign
**Goal**: The homepage becomes the intelligent entry point that surfaces discovery, curation, and personalization
**Depends on**: Phase 44 (Company Approved section), Phase 45 (search-first hero), Phase 43 (personalized "For You"), Phase 47 (selected variant)
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-07, HOME-09
**Success Criteria** (what must be TRUE):
  1. Homepage features a search-first hero layout with prominent natural language search bar and category pills for quick filtered browsing
  2. "Company Recommended" section displays admin-stamped skills, and "For You" section shows personalized recommendations based on user preferences and usage
  3. Trending skills and leaderboard appear as visual cards (not tables), with platform metrics displayed as a condensed banner
  4. Homepage maintains sub-400ms TTFB at p95 with caching for slow queries (recommendations, trending, platform stats)
  5. Selected homepage variant is implemented with the ability to A/B test against the current layout
**Plans**: TBD

Plans:
- [ ] 48-01: TBD
- [ ] 48-02: TBD
- [ ] 48-03: TBD

#### Dependency Graph

```
Phase 40 (Visibility) ──┬──> Phase 44 (Admin Global) ──> Phase 48 (Homepage)
                         │                                    ^
                         └──> Phase 45 (Hybrid Search) ──────┤
                                   ^           │              │
Phase 43 (Preferences) ───────────┘           v              │
                                   Phase 46 (Analytics)      │
                                                              │
Phase 41 (Loom) ─────── (independent)                        │
Phase 42 (MCP) ──────── (independent)                        │
Phase 47 (Homepage Research) ────────────────────────────────┘
```

**Parallel execution opportunities:**
- Wave 1: Phases 40, 41, 42, 43 (all independent — zero shared files)
- Wave 2: Phases 44, 45 (both depend on 40; 45 also depends on 43)
- Wave 3: Phases 46, 47 (46 depends on 45; 47 is independent research)
- Wave 4: Phase 48 (integration — depends on 44, 45, 43, 47)

## Progress

**Execution Order:**
Phases execute respecting dependencies: 40/41/42/43 (parallel) -> 44/45 -> 46/47 -> 48

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 33/33 | Complete | 2026-01-31 |
| 9-11 | v1.1 | 9/9 | Complete | 2026-02-01 |
| 12-14 | v1.2 | 12/12 | Complete | 2026-02-02 |
| 15-19 | v1.3 | 15/15 | Complete | 2026-02-04 |
| 20-24 | v1.4 | 25/25 | Complete | 2026-02-06 |
| 25-33 | v1.5 | 55/55 | Complete | 2026-02-08 |
| 34-39 | v2.0 | 23/23 | Complete | 2026-02-08 |
| 40. Visibility Scoping | v3.0 | 4/4 | Complete | 2026-02-13 |
| 41. Loom Video | v3.0 | 0/2 | Planned | - |
| 42. MCP Unification | v3.0 | 0/TBD | Not started | - |
| 43. User Preferences | v3.0 | 0/3 | Planned | - |
| 44. Admin Global Skills | v3.0 | 0/TBD | Not started | - |
| 45. Hybrid Search | v3.0 | 0/TBD | Not started | - |
| 46. Search Analytics | v3.0 | 0/TBD | Not started | - |
| 47. Homepage Research | v3.0 | 0/TBD | Not started | - |
| 48. Homepage Redesign | v3.0 | 0/TBD | Not started | - |

**Total: 175 plans completed across 39 phases and 8 milestones (v1.0-v2.0). v3.0: 9 phases planned.**

---
*Roadmap created: 2026-01-31*
*v1.0 completed: 2026-01-31*
*v1.1 completed: 2026-02-01*
*v1.2 completed: 2026-02-02*
*v1.3 completed: 2026-02-04*
*v1.4 completed: 2026-02-06*
*v1.5 completed: 2026-02-08*
*v2.0 completed: 2026-02-08*
*v3.0 roadmap added: 2026-02-13*
