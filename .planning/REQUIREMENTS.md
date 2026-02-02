# Requirements: Relay v1.3

**Defined:** 2026-02-02
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v1.3 Requirements

Requirements for v1.3 AI Quality & Cross-Platform release. Each maps to roadmap phases.

### Embeddings Foundation

- [ ] **EMB-01**: System generates vector embeddings for skill content using Voyage AI
- [ ] **EMB-02**: Embeddings stored in PostgreSQL using pgvector extension
- [ ] **EMB-03**: Existing skills backfilled with embeddings on migration
- [ ] **EMB-04**: New skills automatically embedded on publish

### AI Review

- [ ] **REV-01**: User can trigger AI review from skill detail page
- [ ] **REV-02**: Review displays structured feedback (functionality score, quality score, improvement suggestions)
- [ ] **REV-03**: Review results stored in database with timestamp

### Similarity Detection

- [ ] **SIM-01**: System shows top 3 similar skills when user publishes new skill
- [ ] **SIM-02**: Similar skills display similarity percentage (e.g., "87% similar")
- [ ] **SIM-03**: User can bypass similarity warning and publish anyway
- [ ] **SIM-04**: "Similar skills" section displayed on skill detail page

### Fork Model

- [ ] **FORK-01**: User can fork a skill, creating a copy with "Forked from X" attribution
- [ ] **FORK-02**: Parent skill displays fork count
- [ ] **FORK-03**: User can view list of all forks for a skill
- [ ] **FORK-04**: Forked skills inherit parent's tags and category

### Cross-Platform Install

- [ ] **INST-01**: User can copy MCP config for Claude Code (existing functionality)
- [ ] **INST-02**: User can copy MCP config for Claude Desktop with OS-specific paths
- [ ] **INST-03**: System detects user's OS (macOS/Windows/Linux) for instructions
- [ ] **INST-04**: Platform selection modal allows choosing target platform before copy

## v1.4 Requirements

Deferred to future release. Tracked but not in current roadmap.

### AI Review Enhancements

- **REV-04**: Security vulnerability detection (prompt injection, data leaks)
- **REV-05**: Review history with before/after comparison
- **REV-06**: Batch review for author's skills
- **REV-07**: Review-triggered quality badge upgrade

### Similarity Enhancements

- **SIM-05**: Category-scoped similarity comparison
- **SIM-06**: Admin dashboard for duplicate management

### Fork Enhancements

- **FORK-05**: Upstream change notifications
- **FORK-06**: Fork comparison diff view
- **FORK-07**: "Best fork" highlighting by rating

### Install Enhancements

- **INST-05**: Installation verification callbacks
- **INST-06**: Install analytics per platform
- **INST-07**: Claude.ai web remote MCP integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auto-review on every publish | Cost scaling issues; bottleneck; use on-demand instead |
| Blocking duplicate detection | False positives frustrate users; advisory only |
| Auto-merge forks | Merge conflicts complex; breaks customizations |
| Real-time similarity scoring | Expensive embedding calls; check on publish only |
| AI auto-fix | Users lose understanding; may introduce bugs |
| VS Code extension | Separate project, not part of this milestone |
| Claude.ai web remote MCP | Requires Anthropic partnership; defer to v1.4+ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EMB-01 | Phase 15 | Pending |
| EMB-02 | Phase 15 | Pending |
| EMB-03 | Phase 15 | Pending |
| EMB-04 | Phase 15 | Pending |
| REV-01 | Phase 17 | Pending |
| REV-02 | Phase 17 | Pending |
| REV-03 | Phase 17 | Pending |
| SIM-01 | Phase 16 | Pending |
| SIM-02 | Phase 16 | Pending |
| SIM-03 | Phase 16 | Pending |
| SIM-04 | Phase 16 | Pending |
| FORK-01 | Phase 18 | Pending |
| FORK-02 | Phase 18 | Pending |
| FORK-03 | Phase 18 | Pending |
| FORK-04 | Phase 18 | Pending |
| INST-01 | Phase 19 | Pending |
| INST-02 | Phase 19 | Pending |
| INST-03 | Phase 19 | Pending |
| INST-04 | Phase 19 | Pending |

**Coverage:**
- v1.3 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after roadmap creation*
