# Requirements: Relay v1.4

**Defined:** 2026-02-05
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v1.4 Requirements

Requirements for Employee Analytics & Remote MCP milestone. Each maps to roadmap phases.

### API Key Management

- [x] **KEY-01**: Admin can generate API keys for employees via web UI
- [x] **KEY-02**: API keys stored as SHA-256 hashes with prefix for identification
- [x] **KEY-03**: Key validation endpoint resolves API key to userId
- [x] **KEY-04**: Admin can revoke API keys immediately
- [x] **KEY-05**: Employee can generate their own API key from profile page
- [x] **KEY-06**: Key rotation with configurable expiry and grace period for old keys

### Per-Employee Usage Tracking

- [x] **TRK-01**: MCP tools include userId in every trackUsage() call when API key is configured
- [x] **TRK-02**: API key resolves to userId on each MCP request
- [x] **TRK-03**: Graceful degradation — anonymous tracking if no API key configured (backward compatible)
- [x] **TRK-04**: "My Usage" page showing individual employee's skill usage, frequency, and hours saved

### Install Analytics

- [x] **INST-01**: Install callback endpoint receives confirmation from shell install scripts
- [x] **INST-02**: Install events tracked per platform, OS, employee, and skill
- [x] **INST-03**: Install vs. deploy intent distinction (deploy_skill event vs. confirmed install)

### Analytics Dashboard

- [x] **DASH-01**: Org-wide usage trends chart (skills used over time)
- [x] **DASH-02**: Per-employee usage table (skills used, frequency, hours saved)
- [x] **DASH-03**: Top skills by usage with employee breakdown
- [x] **DASH-04**: Export usage data to CSV

### Web Remote MCP

- [x] **RMCP-01**: Streamable HTTP MCP endpoint hosted in Next.js via mcp-handler
- [x] **RMCP-02**: Bearer token authentication using same API keys as stdio
- [x] **RMCP-03**: Same tools available via HTTP as stdio (list, search, deploy)
- [x] **RMCP-04**: CORS configuration for Claude.ai browser access

### Extended Search

- [ ] **SRCH-01**: MCP search matches author name in addition to skill name/description
- [ ] **SRCH-02**: MCP search matches skill tags in addition to skill name/description

## Future Requirements

Deferred to subsequent milestones.

### Team Analytics

- **TEAM-01**: Department/team-level usage aggregation
- **TEAM-02**: Manager view of direct reports' usage
- **TEAM-03**: Usage streak tracking and engagement metrics

### Advanced Key Management

- **AKEY-01**: Bulk key generation for department onboarding
- **AKEY-02**: Key usage audit log
- **AKEY-03**: Rate limiting per API key

## Out of Scope

| Feature | Reason |
|---------|--------|
| OAuth for MCP auth | MCP spec says stdio should use env credentials, not OAuth; API keys are simpler |
| Upstream sync notifications for forks | High complexity, deferred from v1.3 |
| Real-time analytics (WebSocket) | Batch/refresh sufficient for internal dashboard |
| HR system integration for team data | Requires external system access; manual mapping if needed |
| Tracking what's inside skill prompts used | Privacy concern — track usage frequency, not content |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| KEY-01 | Phase 20 | Complete |
| KEY-02 | Phase 20 | Complete |
| KEY-03 | Phase 20 | Complete |
| KEY-04 | Phase 20 | Complete |
| KEY-05 | Phase 20 | Complete |
| KEY-06 | Phase 20 | Complete |
| TRK-01 | Phase 21 | Complete |
| TRK-02 | Phase 21 | Complete |
| TRK-03 | Phase 21 | Complete |
| TRK-04 | Phase 21 | Complete |
| INST-01 | Phase 21 | Complete |
| INST-02 | Phase 21 | Complete |
| INST-03 | Phase 21 | Complete |
| DASH-01 | Phase 23 | Complete |
| DASH-02 | Phase 23 | Complete |
| DASH-03 | Phase 23 | Complete |
| DASH-04 | Phase 23 | Complete |
| RMCP-01 | Phase 22 | Complete |
| RMCP-02 | Phase 22 | Complete |
| RMCP-03 | Phase 22 | Complete |
| RMCP-04 | Phase 22 | Complete |
| SRCH-01 | Phase 24 | Pending |
| SRCH-02 | Phase 24 | Pending |

**Coverage:**
- v1.4 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*
