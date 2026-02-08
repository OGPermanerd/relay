# Roadmap: Relay

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- ✅ **v1.1 Quality & Polish** - Phases 9-11 (shipped 2026-02-01)
- ✅ **v1.2 UI Redesign** - Phases 12-14 (shipped 2026-02-02)
- ✅ **v1.3 AI Quality & Cross-Platform** - Phases 15-19 (shipped 2026-02-04)
- ✅ **v1.4 Employee Analytics & Remote MCP** - Phases 20-24 (shipped 2026-02-06)
- ✅ **v1.5 Production, Multi-Tenancy & Reliable Usage Tracking** - Phases 25-33 (shipped 2026-02-08)
- 🚧 **v2.0 Skill Ecosystem** - Phases 34-39 (in progress)

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

### v2.0 Skill Ecosystem (In Progress)

**Milestone Goal:** Transform skill publishing from instant-publish to a quality-gated pipeline with AI review, author revision, and admin approval -- plus conversational discovery via MCP and fork-on-modify detection. 44 requirements across 6 categories.

- [x] **Phase 34: Review Pipeline Foundation** - Status column, state machine, query guards, and author workflow ✓
- [x] **Phase 35: AI Review Integration** - Auto AI review on submission, MCP review tools, auto-approve threshold ✓
- [x] **Phase 36: Admin Review UI** - Queue, diff view, approve/reject/request-changes actions, audit trail ✓
- [x] **Phase 37: Review Notifications** - 7 new notification types for the review lifecycle ✓
- [x] **Phase 38: Conversational MCP Discovery** - Semantic search, recommend, describe, and guide tools ✓
- [ ] **Phase 39: Fork Detection** - Hash comparison, update_skill, web UI drift indicators

## Phase Details

### Phase 34: Review Pipeline Foundation
**Goal**: Skills enter a gated lifecycle instead of auto-publishing -- authors create drafts, submit for review, and only published skills appear in search/browse
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: RVPL-01, RVPL-02, RVPL-05, RVPL-06, RVPL-07, RVPL-08, RVPL-09, RVPL-10, RVPL-12
**Success Criteria** (what must be TRUE):
  1. Creating a skill (web or MCP) puts it in `draft` status -- it does not appear in search, browse, or public skill listings
  2. Author can submit a draft for review, and the state machine enforces valid transitions (draft -> pending_review -> ai_reviewed -> approved/rejected/changes_requested -> published)
  3. All existing published skills retain `published` status after migration -- zero regression in search results or skill visibility
  4. Non-author, non-admin users see a 404 when visiting a skill that is not published
  5. Authors can view all their own skills (draft, pending, rejected, published) on a "My Skills" page
**Plans:** 5 plans

Plans:
- [x] 34-01-PLAN.md -- Schema + state machine + migration
- [x] 34-02-PLAN.md -- Creation paths set status='draft'
- [x] 34-03-PLAN.md -- Query guards (18 public query paths)
- [x] 34-04-PLAN.md -- Access control, My Skills badges, submit-for-review
- [x] 34-05-PLAN.md -- Build verification and E2E tests

### Phase 35: AI Review Integration
**Goal**: Submitting a skill for review automatically triggers AI analysis with explicit error handling, and authors/admins can trigger and check reviews via MCP
**Depends on**: Phase 34
**Requirements**: RVPL-03, RVPL-04, RVPL-11, MCPR-01, MCPR-02, MCPR-03
**Success Criteria** (what must be TRUE):
  1. When a skill transitions to `pending_review`, AI review runs automatically (not fire-and-forget) and transitions the skill to `ai_reviewed` on completion
  2. If AI review fails (API error, rate limit), the skill remains in `pending_review` with a visible error state -- it does not get stuck in limbo
  3. Skills with all AI review scores at or above a configurable threshold auto-approve without entering the admin queue
  4. From a Claude conversation, a user can trigger AI review (`review_skill`), submit a draft for admin review (`submit_for_review`), and check the status of their submitted skills (`check_review_status`)
**Plans:** 3 plans

Plans:
- [x] 35-01-PLAN.md -- Schema statusMessage column + auto-approve threshold logic
- [x] 35-02-PLAN.md -- Submit-for-review pipeline with inline AI review + error UI
- [x] 35-03-PLAN.md -- MCP tools (review_skill, submit_for_review, check_review_status)

### Phase 36: Admin Review UI
**Goal**: Tenant admins can efficiently review submitted skills with full context (AI scores, content diff) and take approve/reject/request-changes actions
**Depends on**: Phase 34, Phase 35
**Requirements**: ADMR-01, ADMR-02, ADMR-03, ADMR-04, ADMR-05, ADMR-06, ADMR-07, ADMR-08, ADMR-09
**Success Criteria** (what must be TRUE):
  1. `/admin/reviews` shows a paginated queue (20 per page) of skills awaiting review, filterable by status, category, and date
  2. Each review page shows the skill content, AI review scores (quality/clarity/completeness), and a diff view against the previous version if one exists
  3. Admin can approve (publishes the skill), reject (with required notes), or request changes (with feedback) -- each action is a single click plus optional/required notes
  4. Every review decision is stored immutably for audit trail (reviewer, action, timestamp, notes) and cannot be modified after the fact
  5. The admin sidebar shows the count of skills awaiting review
**Plans:** 3 plans

Plans:
- [x] 36-01-PLAN.md -- Review decisions schema, migration, service, and query functions
- [x] 36-02-PLAN.md -- Server actions, review queue page, and admin nav badge
- [x] 36-03-PLAN.md -- Review detail page with AI scores, diff view, and action forms

### Phase 37: Review Notifications
**Goal**: Authors and admins receive timely in-app and email notifications at every stage of the review lifecycle
**Depends on**: Phase 34, Phase 35
**Requirements**: RVNT-01, RVNT-02, RVNT-03, RVNT-04, RVNT-05, RVNT-06, RVNT-07
**Success Criteria** (what must be TRUE):
  1. When a skill is submitted for review, all tenant admins receive an in-app notification and email
  2. When an admin approves, rejects, or requests changes on a skill, the author receives an in-app notification and email with the admin's notes
  3. All review notification types are grouped under a single preference toggle -- users can disable review notifications in one action
  4. The notification bell correctly renders new review notification types with appropriate icons and action URLs that link to the relevant skill or review page
**Plans:** 4 plans

Plans:
- [x] 37-01-PLAN.md -- Schema, migration, type union, getAdminsInTenant, preference service
- [x] 37-02-PLAN.md -- Email template and notifyReviewEvent dispatch function
- [x] 37-03-PLAN.md -- Wiring dispatch into submit-for-review and admin-reviews actions
- [x] 37-04-PLAN.md -- Preferences form UI and notification bell icons

### Phase 38: Conversational MCP Discovery
**Goal**: Users can discover skills through natural conversation in Claude -- semantic search, detailed descriptions, and post-install guidance
**Depends on**: Nothing (independent of review pipeline; uses existing embedding infrastructure)
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06
**Success Criteria** (what must be TRUE):
  1. `recommend_skills` performs semantic search using Ollama embeddings + pgvector cosine similarity and returns relevant published skills ranked by relevance
  2. `describe_skill` returns comprehensive skill details including AI review scores, ratings, usage stats, similar skills, and install instructions
  3. `guide_skill` returns contextual usage guidance and implementation instructions after a skill is installed
  4. Semantic search gracefully falls back to ILIKE text search when Ollama is unavailable, and only returns published skills regardless of search method
**Plans:** 4 plans

Plans:
- [x] 38-01-PLAN.md -- Semantic search service + Ollama client for MCP
- [x] 38-02-PLAN.md -- recommend_skills MCP tool with semantic search + ILIKE fallback
- [x] 38-03-PLAN.md -- describe_skill + guide_skill MCP tools
- [x] 38-04-PLAN.md -- Enhanced search_skills with rating/usage/tier metadata

### Phase 39: Fork Detection
**Goal**: Users know when their local skill copy has diverged from the published version and can push changes back or create forks
**Depends on**: Nothing (independent of review pipeline; uses existing fork and contentHash infrastructure)
**Requirements**: FORK-01, FORK-02, FORK-03, FORK-04, FORK-05, FORK-06, FORK-07
**Success Criteria** (what must be TRUE):
  1. `check_skill_status` MCP tool compares a local file's content hash against the DB published version and reports whether the skill has diverged
  2. Hash comparison strips YAML frontmatter before hashing so that tracking hook changes do not trigger false drift detection
  3. `update_skill` MCP tool pushes local modifications back as a new version (if the user is the author) or creates a fork (if not), with proper skill_version records and review status
  4. The web UI shows a drift indicator on fork detail pages when the fork has diverged from its parent, and a `/skills/[slug]/compare` page shows side-by-side content comparison
**Plans**: TBD

## Progress

**Execution Order:**
Phase 34 must be first (everything depends on the status column). Phase 35 depends on 34. Phases 36 and 37 depend on 34-35 but can run in parallel with each other. Phases 38 and 39 are fully independent of the review pipeline and can run at any time.

Critical path: 34 -> 35 -> 36 (admin can review). Parallel tracks: 37 (notifications), 38 (discovery), 39 (fork detection).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 33/33 | Complete | 2026-01-31 |
| 9-11 | v1.1 | 9/9 | Complete | 2026-02-01 |
| 12-14 | v1.2 | 12/12 | Complete | 2026-02-02 |
| 15-19 | v1.3 | 15/15 | Complete | 2026-02-04 |
| 20-24 | v1.4 | 25/25 | Complete | 2026-02-06 |
| 25-33 | v1.5 | 55/55 | Complete | 2026-02-08 |
| 34. Review Pipeline Foundation | v2.0 | 5/5 | Complete | 2026-02-08 |
| 35. AI Review Integration | v2.0 | 3/3 | Complete | 2026-02-08 |
| 36. Admin Review UI | v2.0 | 3/3 | Complete | 2026-02-08 |
| 37. Review Notifications | v2.0 | 4/4 | Complete | 2026-02-08 |
| 38. Conversational MCP Discovery | v2.0 | 4/4 | Complete | 2026-02-08 |
| 39. Fork Detection | v2.0 | 0/TBD | Not started | - |

**Total: 171 plans completed across 38 phases and 7 milestones (v1.0-v1.5, v2.0 in progress).**

---
*Roadmap created: 2026-01-31*
*v1.1 completed: 2026-02-01*
*v1.2 completed: 2026-02-02*
*v1.3 completed: 2026-02-04*
*v1.4 completed: 2026-02-06*
*v1.5 completed: 2026-02-08*
*v2.0 roadmap added: 2026-02-08*
*Phase 34 completed: 2026-02-08*
