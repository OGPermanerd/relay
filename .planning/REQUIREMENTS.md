# Requirements: Relay

**Defined:** 2026-01-31
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFR-01**: E2E browser automation testing (Playwright) validates served pages automatically

### Authentication

- [ ] **AUTH-01**: User can authenticate via Google Workspace SSO restricted to company domain
- [ ] **AUTH-02**: User profile displays name, avatar (from Google), and contribution statistics
- [ ] **AUTH-03**: Leaderboard shows top contributors by skills shared, ratings received, and FTE Days Saved generated

### Discovery

- [ ] **DISC-01**: User can search skills via full-text search across names, descriptions, and tags
- [ ] **DISC-02**: Skill cards display name, author, rating, total uses, and FTE Days Saved with sparkline
- [ ] **DISC-03**: User can browse skills by category and filter by tags
- [ ] **DISC-04**: Trending section surfaces skills with high recent usage velocity

### Skills

- [ ] **SKIL-01**: User can upload skill with metadata: name, description, category, tags, usage instructions, estimated time saved per use
- [ ] **SKIL-02**: System accepts multiple skill formats: Claude Code skills, prompts, workflows, agent configs
- [ ] **SKIL-03**: User can view skill detail page with full metadata and usage statistics

### Ratings & Metrics

- [ ] **RATE-01**: User can rate skill 1-5 stars after use with optional comment
- [ ] **RATE-02**: User can submit time-saved estimate as part of review (overrides creator estimate when available)
- [ ] **RATE-03**: FTE Days Saved displays at skill level (uses x estimated hours) and platform aggregate
- [ ] **RATE-04**: Dashboard shows total contributors, total downloads, total uses, total FTE Days Saved

### MCP Integration

- [ ] **MCP-01**: MCP server exposes skill search/list operations to Claude
- [ ] **MCP-02**: User can deploy skill to local Claude environment via one-click from MCP
- [ ] **MCP-03**: MCP server automatically tracks usage when deployed skills are run

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Versioning & Contribution

- **VERS-01**: Version history shows all versions with author, date, and per-version metrics
- **VERS-02**: Commit comments required on each version explaining changes
- **VERS-03**: User can view and diff any historical version
- **VERS-04**: User can fork any skill, modify it, and publish as new version (wiki-style contribution)

### Advanced Metrics

- **METR-01**: Quality scorecards auto-calculate maturity level (Gold/Silver/Bronze)
- **METR-02**: Usage analytics dashboard shows installs, active usage, time saved over time

### Community

- **COMM-01**: User can create and curate skill collections for teams or use cases
- **COMM-02**: User can subscribe to skills or authors for update notifications
- **COMM-03**: Preview mode shows skill content before installation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Smart search with AI | HIGH complexity, requires vector DB; defer until search is proven pain point |
| Related skills recommendations | Requires substantial usage data and ML infrastructure |
| Skill dependencies | Adds complexity; most skills standalone; wait for demand |
| Review prompts in Claude | v2 MCP feature; adds complexity |
| Skill creation scaffolding via MCP | v2 MCP feature; focus v1 on deploy/track |
| Similarity/duplicate detection | v2 feature; basic search sufficient to start |
| Paid skills/monetization | Internal marketplace; value measured in FTE Days Saved, not revenue |
| Approval workflows | Kills contribution velocity; metrics drive quality instead |
| Private skills | Fragments discovery; all skills public within org |
| Real-time collaboration | Skills are versioned artifacts, not live documents |
| Complex permission hierarchies | Simple model: all visible, edit requires account |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 8 | Pending |
| DISC-01 | Phase 6 | Complete |
| DISC-02 | Phase 6 | Complete |
| DISC-03 | Phase 6 | Complete |
| DISC-04 | Phase 8 | Pending |
| SKIL-01 | Phase 5 | Complete |
| SKIL-02 | Phase 4 | Complete |
| SKIL-03 | Phase 5 | Complete |
| RATE-01 | Phase 7 | Complete |
| RATE-02 | Phase 7 | Complete |
| RATE-03 | Phase 8 | Pending |
| RATE-04 | Phase 8 | Pending |
| MCP-01 | Phase 3 | Pending |
| MCP-02 | Phase 3 | Pending |
| MCP-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 - RATE-01, RATE-02 complete (Phase 7)*
