# Roadmap: Relay

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- ✅ **v1.1 Quality & Polish** - Phases 9-11 (shipped 2026-02-01)
- ✅ **v1.2 UI Redesign** - Phases 12-14 (shipped 2026-02-02)
- ✅ **v1.3 AI Quality & Cross-Platform** - Phases 15-19 (shipped 2026-02-04)
- ✅ **v1.4 Employee Analytics & Remote MCP** - Phases 20-24 (shipped 2026-02-06)

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

### ✅ v1.4 Employee Analytics & Remote MCP (Complete)

**Milestone Goal:** Transform Relay from an anonymous skill marketplace into an enterprise platform with employee-level attribution, usage analytics, and web-accessible MCP. The userId column in usage_events finally gets populated, and real metrics prove the value of skills passing through hands.

- [x] **Phase 20: API Key Management** - Employees and admins can create, manage, and revoke API keys that tie MCP sessions to identities
- [x] **Phase 21: Employee Usage Tracking** - Every MCP tool call and install event is attributed to the employee who performed it
- [x] **Phase 22: Web Remote MCP** - Claude.ai browser users can access Relay skills via Streamable HTTP transport
- [x] **Phase 23: Analytics Dashboard** - Org-wide and per-employee usage trends visible through charts and exportable data
- [x] **Phase 24: Extended MCP Search** - MCP search reaches parity with web search by matching author names and tags

## Phase Details

### Phase 20: API Key Management
**Goal**: Employees can authenticate their MCP sessions with personal API keys, enabling identity-aware skill usage
**Depends on**: Phase 19 (v1.3 complete)
**Requirements**: KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, KEY-06
**Success Criteria** (what must be TRUE):
  1. Employee can generate a personal API key from their profile page, seeing the full key exactly once at creation
  2. Admin can generate API keys for any employee and revoke any key immediately from the admin UI
  3. API key validation endpoint accepts a raw key, resolves it to a userId, and rejects revoked or expired keys
  4. Keys are stored as SHA-256 hashes with an `rlk_` prefix visible for identification -- raw key is never persisted
  5. Key rotation works: employee generates a new key while the old key remains valid during a configurable grace period
**Plans**: 6 plans (replanned for smaller scope per plan)

Plans:
- [x] 20-01-PLAN.md -- Crypto utils and admin helper (schema already done)
- [x] 20-02-PLAN.md -- DB service layer (validate, list, revoke, setExpiry)
- [x] 20-03-PLAN.md -- Validation endpoint and server actions
- [x] 20-04-PLAN.md -- ApiKeyManager client component
- [x] 20-05-PLAN.md -- Profile page integration + Playwright
- [x] 20-06-PLAN.md -- Admin page, admin component, and nav link
- [x] 20-07-PLAN.md -- Admin nav link + Playwright tests

### Phase 21: Employee Usage Tracking
**Goal**: Every MCP tool call and install event is attributed to the specific employee, with a personal dashboard showing their activity
**Depends on**: Phase 20 (API keys exist for userId resolution)
**Requirements**: TRK-01, TRK-02, TRK-03, TRK-04, INST-01, INST-02, INST-03
**Success Criteria** (what must be TRUE):
  1. When an employee has RELAY_API_KEY configured, every MCP tool call (search, list, deploy) records their userId in usage_events
  2. When no API key is configured, MCP tools continue working with anonymous tracking -- no breakage for existing users
  3. Install scripts send a callback to Relay on successful install, recording the employee, platform, OS, and skill
  4. The "My Usage" page shows an employee their personal skill usage history, frequency breakdown, and cumulative hours saved
  5. Install events distinguish between deploy intent (MCP deploy_skill) and confirmed installation (callback received)
**Plans**: 6 plans

Plans:
- [x] 21-01-PLAN.md -- MCP auth module + userId wiring into tool handlers
- [x] 21-02-PLAN.md -- Install callback endpoint + middleware exemption
- [x] 21-03-PLAN.md -- Install script callback addition (bash + PowerShell)
- [x] 21-04-PLAN.md -- Usage analytics aggregation queries (my-leverage.ts)
- [x] 21-05-PLAN.md -- My Skill Leverage tab UI on home page
- [x] 21-06-PLAN.md -- Playwright E2E verification

### Phase 22: Web Remote MCP
**Goal**: Claude.ai browser users can discover, search, and deploy Relay skills through a Streamable HTTP MCP endpoint
**Depends on**: Phase 20 (bearer token auth uses same API keys)
**Requirements**: RMCP-01, RMCP-02, RMCP-03, RMCP-04
**Success Criteria** (what must be TRUE):
  1. A Streamable HTTP endpoint at `/api/mcp/[transport]` serves MCP protocol requests from Claude.ai
  2. Bearer token authentication validates the same `rlk_` API keys used by stdio, rejecting invalid or revoked keys with 401
  3. All three MCP tools (list, search, deploy) work identically over HTTP as they do over stdio
  4. CORS headers allow Claude.ai origin while rejecting unauthorized origins
**Plans**: 3 plans

Plans:
- [x] 22-01-PLAN.md -- Foundation: deps, middleware exemption, handler refactor for userId param
- [x] 22-02-PLAN.md -- MCP HTTP route handler with auth, tools, CORS, rate limiter
- [x] 22-03-PLAN.md -- Connect to Claude.ai UI + Playwright E2E tests

### Phase 23: Analytics Dashboard
**Goal**: Admins and employees can see org-wide usage trends, per-employee breakdowns, and export data to prove Relay's value
**Depends on**: Phase 21 (needs populated userId data in usage_events)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Analytics overview page shows an org-wide usage trends chart with skills used over time (daily/weekly/monthly)
  2. Per-employee usage table lists each employee with their skills used count, usage frequency, and total hours saved
  3. Top skills view shows the most-used skills ranked by usage count with a breakdown of which employees use each
  4. Any analytics view can be exported to CSV with a single click
**Plans**: 7 plans

Plans:
- [x] 23-01-PLAN.md -- SQL analytics queries (overview stats, employee usage, skill usage, export data)
- [x] 23-02-PLAN.md -- Recharts setup and area chart + time range selector components
- [x] 23-03-PLAN.md -- Employees tab with sortable table and detail modal
- [x] 23-04-PLAN.md -- Skills tab with leaderboard cards and analytics modal
- [x] 23-05-PLAN.md -- Overview tab (stat cards + chart) and CSV export functionality
- [x] 23-06-PLAN.md -- Analytics page and nav link integration
- [x] 23-07-PLAN.md -- Playwright E2E tests

### Phase 24: Extended MCP Search
**Goal**: MCP search matches the same fields as web search, so employees find skills by author name or tag regardless of client
**Depends on**: Phase 20 (needs MCP infrastructure, but functionally independent)
**Requirements**: SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. Searching for an author's name via MCP returns that author's skills, even if the name does not appear in the skill title or description
  2. Searching for a tag via MCP returns skills with that tag, even if the tag does not appear in the skill title or description
**Plans**: 2 plans

Plans:
- [x] 24-01-PLAN.md -- Shared search service with ILIKE + field-weighted scoring
- [x] 24-02-PLAN.md -- Wire MCP stdio + web remote MCP to shared service, update tests

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 33/33 | Complete | 2026-01-31 |
| 9-11 | v1.1 | 9/9 | Complete | 2026-02-01 |
| 12-14 | v1.2 | 12/12 | Complete | 2026-02-02 |
| 15-19 | v1.3 | 15/15 | Complete | 2026-02-04 |
| 20. API Key Management | v1.4 | 7/7 | Complete | 2026-02-05 |
| 21. Employee Usage Tracking | v1.4 | 6/6 | Complete | 2026-02-05 |
| 22. Web Remote MCP | v1.4 | 3/3 | Complete | 2026-02-05 |
| 23. Analytics Dashboard | v1.4 | 7/7 | Complete | 2026-02-06 |
| 24. Extended MCP Search | v1.4 | 2/2 | Complete | 2026-02-06 |

**Total: 94 plans completed across 24 phases and 5 milestones**

---
*Roadmap created: 2026-01-31*
*v1.1 completed: 2026-02-01*
*v1.2 completed: 2026-02-02*
*v1.3 completed: 2026-02-04*
*v1.4 roadmap added: 2026-02-05*
*v1.4 completed: 2026-02-06*
