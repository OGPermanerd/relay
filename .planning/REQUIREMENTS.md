# Requirements: EverySkill v3.0

**Defined:** 2026-02-13
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v3.0 Requirements

Requirements for v3.0 AI Discovery & Workflow Intelligence. Each maps to roadmap phases.

### Visibility & Access Control

- [ ] **VIS-01**: User can set skill visibility to "tenant" (visible to all tenant members) or "personal" (visible only to author)
- [ ] **VIS-02**: User browsing skills sees only skills matching their visibility level (personal skills hidden from others)
- [ ] **VIS-03**: MCP search/recommend tools respect skill visibility filtering based on authenticated user
- [ ] **VIS-04**: Admin can stamp a published skill as "Company Approved" with a distinctive badge
- [ ] **VIS-05**: Company Approved skills appear in a dedicated section on the homepage
- [ ] **VIS-06**: Existing skills default to "tenant" visibility on migration (no behavior change)

### AI-Powered Discovery

- [ ] **DISC-01**: User can type a natural language query ("What are you trying to solve?") in a prominent search bar on the homepage
- [ ] **DISC-02**: System returns top-3 ranked skill recommendations with match rationale for each
- [ ] **DISC-03**: Search uses hybrid retrieval (pgvector semantic + tsvector full-text) merged via Reciprocal Rank Fusion
- [ ] **DISC-04**: System falls back gracefully to keyword search when intent is ambiguous or no semantic matches found
- [ ] **DISC-05**: Search results respect visibility scoping (personal skills hidden from non-authors)
- [ ] **DISC-06**: Search displays loading state with streaming feedback during processing

### MCP Tool Unification

- [ ] **MCP-01**: User can invoke a single `everyskill` MCP tool with sub-commands (search, install, describe) from any AI client
- [ ] **MCP-02**: The unified tool wraps existing MCP handlers without changing underlying functionality
- [ ] **MCP-03**: Tool description is crafted so AI clients proactively suggest invoking it for relevant queries

### Loom Video Integration

- [ ] **LOOM-01**: Author can add a Loom video URL when creating or editing a skill
- [ ] **LOOM-02**: Skill detail page displays an embedded Loom video player via oEmbed
- [ ] **LOOM-03**: System validates Loom URL format and fetches video metadata (title, duration, thumbnail) server-side
- [ ] **LOOM-04**: Video thumbnail appears on skill browse cards when a Loom URL is present

### User Preferences

- [ ] **PREF-01**: User has a preferences page to configure personal settings (preferred categories, default sort, notification preferences)
- [ ] **PREF-02**: Preferences are stored server-side in JSONB with Zod-validated schema and code-defined defaults
- [ ] **PREF-03**: Search ranking incorporates user preference boosts (preferred categories ranked higher)
- [ ] **PREF-04**: User can generate a CLAUDE.md file from their skill portfolio and preferences for cross-AI use
- [ ] **PREF-05**: Generated CLAUDE.md includes relevant skill references and personal workflow preferences

### Search Analytics

- [ ] **ANALYTICS-01**: System logs all search queries with result counts (fire-and-forget, no user-facing latency)
- [ ] **ANALYTICS-02**: Admin dashboard shows zero-result queries to identify skill gaps
- [ ] **ANALYTICS-03**: Admin dashboard shows most-searched terms and trending queries

### Homepage Redesign

- [ ] **HOME-01**: Homepage features a search-first hero layout with prominent natural language search bar
- [ ] **HOME-02**: Category pills below search bar enable quick filtered browsing
- [ ] **HOME-03**: "Company Recommended" section displays admin-stamped global skills
- [ ] **HOME-04**: Personalized "For You" section shows recommendations based on user preferences and usage history
- [ ] **HOME-05**: Trending skills and leaderboard redesigned as visual cards (not tables)
- [ ] **HOME-06**: Platform metrics displayed as condensed banner (not dominant)
- [ ] **HOME-07**: Homepage maintains sub-400ms TTFB p95 performance budget with caching for slow queries
- [ ] **HOME-08**: Research and present 2-3 homepage layout variants inspired by successful platforms (Atlassian Marketplace, Notion Templates, Slack App Directory) for evaluation before final implementation
- [ ] **HOME-09**: Selected variant is implemented with the ability to A/B test against current layout

## Future Requirements (v4+)

### Google Workspace Diagnostic

- **WORK-01**: Admin can connect tenant's Google Workspace via separate OAuth flow
- **WORK-02**: System syncs directory data (names, departments, titles) incrementally
- **WORK-03**: User can view screentime-style time analysis from Calendar/Drive/Gmail activity
- **WORK-04**: System recommends automatable tasks with matching skills and deployment plan

### Extended Visibility

- **XVIS-01**: Skills can be scoped to specific departments or teams
- **XVIS-02**: Department approval workflow for global skill stamping

### Extended Preferences

- **XPREF-01**: Multi-format preference export (.cursorrules, AGENTS.md)
- **XPREF-02**: Deep usage history analysis for personalized recommendations

### AI Independence

- **AIIND-01**: Training/assessment data storage per skill per LLM model
- **AIIND-02**: Token/cost benchmarking per skill per LLM
- **AIIND-03**: Quality scoring against golden outputs

### Education & Community

- **EDU-01**: Skills onboarding and training section
- **EDU-02**: Reddit-style user discussion threads
- **EDU-03**: News feed with recent skills and corp AI hub

## Out of Scope

| Feature | Reason |
|---------|--------|
| Chatbot/conversational multi-turn search | Research confirms marginal benefit for single-domain QA; adds complexity without proportional value |
| Google Workspace OAuth in v3.0 | 2-4 week verification blocker, value prop unvalidated; survey-first in v4 |
| Cross-tenant "global" skill visibility | Requires RLS modifications that complicate tenant isolation; defer to multi-org phase |
| Org structure upload | Requires Workspace integration for meaningful data |
| Role-based skill suggestions | Requires org structure data from Workspace sync |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| — | — | — |

**Coverage:**
- v3.0 requirements: 31 total
- Mapped to phases: 0
- Unmapped: 31 (pending roadmap)

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after initial definition*
