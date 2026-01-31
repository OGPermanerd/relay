# Requirements: Relay

**Defined:** 2026-01-31
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v1.1 Requirements

Requirements for quality & polish release. Fixes tech debt and adds quality scorecards.

### Tag Filtering

- [x] **TAG-01**: User can see available tags extracted from skills in the catalog
- [x] **TAG-02**: User can filter skills by selecting one or more tags
- [x] **TAG-03**: Tag filtering combines with category and search filters

### E2E Testing

- [ ] **TEST-01**: E2E test validates skill upload flow (authenticated)
- [ ] **TEST-02**: E2E test validates skill rating flow
- [ ] **TEST-03**: E2E test validates skill browsing and search
- [ ] **TEST-04**: E2E test validates user profile page

### Quality Scorecards

- [ ] **QUAL-01**: System calculates quality score based on ratings, usage, and documentation completeness
- [ ] **QUAL-02**: Skills display quality badge (Gold/Silver/Bronze) on cards and detail pages
- [ ] **QUAL-03**: User can filter/sort by quality tier
- [ ] **QUAL-04**: Quality criteria are transparent (user can see why a skill earned its badge)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Versioning & Contribution

- **VERS-01**: Version history shows all versions with author, date, and per-version metrics
- **VERS-02**: Commit comments required on each version explaining changes
- **VERS-03**: User can view and diff any historical version
- **VERS-04**: User can fork any skill, modify it, and publish as new version (wiki-style contribution)

### Advanced Metrics

- **METR-01**: Usage analytics dashboard shows installs, active usage, time saved over time

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
| Skill creation scaffolding via MCP | v2 MCP feature; focus on deploy/track |
| Similarity/duplicate detection | v2 feature; basic search sufficient |
| Paid skills/monetization | Internal marketplace; value measured in FTE Days Saved, not revenue |
| Approval workflows | Kills contribution velocity; metrics drive quality instead |
| Private skills | Fragments discovery; all skills public within org |
| Skill health indicators | Deferred to v1.2; focus v1.1 on scorecards |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TAG-01 | Phase 9 | Complete |
| TAG-02 | Phase 9 | Complete |
| TAG-03 | Phase 9 | Complete |
| TEST-01 | Phase 11 | Pending |
| TEST-02 | Phase 11 | Pending |
| TEST-03 | Phase 11 | Pending |
| TEST-04 | Phase 11 | Pending |
| QUAL-01 | Phase 10 | Pending |
| QUAL-02 | Phase 10 | Pending |
| QUAL-03 | Phase 10 | Pending |
| QUAL-04 | Phase 10 | Pending |

**Coverage:**
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 - TAG-01, TAG-02, TAG-03 complete (Phase 9)*
