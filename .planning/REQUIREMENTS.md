# Requirements: EverySkill v4.0 Gmail Workflow Diagnostic

**Defined:** 2026-02-14
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v4.0 Requirements

Requirements for Gmail Workflow Diagnostic milestone. Each maps to roadmap phases.

### Gmail Connection

- [ ] **GMAIL-01**: User can connect Gmail via OAuth from settings page (separate flow from login)
- [ ] **GMAIL-02**: Gmail OAuth tokens are encrypted at rest with AES-256-GCM in dedicated table
- [ ] **GMAIL-03**: User can disconnect Gmail and all tokens are immediately deleted
- [ ] **GMAIL-04**: UI shows connection status and scope-gated access (connected/not connected)
- [ ] **GMAIL-05**: OAuth tokens auto-refresh on expiry with race-condition-safe handling
- [ ] **GMAIL-06**: Admin can enable/disable Gmail diagnostic feature per tenant

### Email Analysis

- [ ] **ANAL-01**: System fetches 90 days of email headers via Gmail API (using `gmail.readonly` + `format: 'metadata'`)
- [ ] **ANAL-02**: Emails are categorized via rule-based pass (newsletters, notifications, internal, external, meetings)
- [ ] **ANAL-03**: Ambiguous emails (~30%) are classified by Claude AI with structured output
- [ ] **ANAL-04**: Time estimation per category using transparent heuristic model (category-weighted base time x thread depth x reply factor)
- [ ] **ANAL-05**: Raw email metadata is never persisted — only aggregate statistics stored
- [ ] **ANAL-06**: Diagnostic results stored as aggregate snapshot (counts, percentages, time estimates per category)

### Dashboard

- [ ] **DASH-01**: Diagnostic dashboard page shows email category breakdown chart (Recharts)
- [ ] **DASH-02**: Time-per-category visualization with "screentime" style presentation
- [ ] **DASH-03**: Total estimated email time per week displayed prominently
- [ ] **DASH-04**: User can re-run diagnostic to get fresh analysis

### Skill Recommendations

- [ ] **RECO-01**: AI matches email categories to existing EverySkill skills with reasoning
- [ ] **RECO-02**: Top recommendations shown with personalized explanation ("You spend X hrs/week on Y — this skill automates that")
- [ ] **RECO-03**: Each recommendation includes one-click install link (existing install flow)

### Deployment Plan

- [ ] **PLAN-01**: Ranked skill adoption list ordered by estimated time savings (highest ROI first)
- [ ] **PLAN-02**: Cumulative FTE Days Saved projection chart showing expected savings over time
- [ ] **PLAN-03**: Sequential adoption order suggesting which skill to try first

### Cleanup

- [ ] **CLEAN-01**: DEFAULT_TENANT_ID resolved from session in all code paths (18+ files)

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Extended Workspace Integration

- **GWORK-01**: Google Calendar integration for meeting time analysis
- **GWORK-02**: Google Drive integration for document collaboration patterns
- **GWORK-03**: Periodic re-analysis with progress tracking over time
- **GWORK-04**: Historical trend comparison ("You saved 2hrs/week since deploying these skills")

### AI Independence

- **AIIND-01**: Store training/assessment data per skill per LLM
- **AIIND-02**: Benchmarking tool (token count, cost estimation, quality scoring per LLM)
- **AIIND-03**: Translate/port skills to other LLMs (Google, Llama, on-prem)

### Education & Community

- **EDU-01**: Skills onboarding and training content
- **EDU-02**: Reddit-style user discussion threads
- **EDU-03**: News feed with recent skills and corp AI hub

## Out of Scope

| Feature | Reason |
|---------|--------|
| Reading email body content | Privacy risk; headers provide sufficient signal for categorization |
| Persistent email data storage | Privacy-first: analyze and discard only |
| Google Calendar/Drive in v4.0 | Scope containment; Gmail provides highest value signal |
| Public OAuth consent screen | Internal user type sufficient for enterprise Workspace deployment |
| Custom NLP/ML pipeline | Claude AI provides better accuracy than rule-based NLP at acceptable cost |
| Real-time email monitoring | Batch analysis sufficient; streaming adds complexity without clear value |
| Org structure upload | Independent feature; defer to separate milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 49 | Pending |
| GMAIL-01 | Phase 50 | Pending |
| GMAIL-02 | Phase 50 | Pending |
| GMAIL-03 | Phase 50 | Pending |
| GMAIL-04 | Phase 50 | Pending |
| GMAIL-05 | Phase 50 | Pending |
| GMAIL-06 | Phase 50 | Pending |
| ANAL-01 | Phase 51 | Pending |
| ANAL-02 | Phase 51 | Pending |
| ANAL-03 | Phase 51 | Pending |
| ANAL-04 | Phase 51 | Pending |
| ANAL-05 | Phase 51 | Pending |
| ANAL-06 | Phase 51 | Pending |
| DASH-01 | Phase 52 | Pending |
| DASH-02 | Phase 52 | Pending |
| DASH-03 | Phase 52 | Pending |
| DASH-04 | Phase 52 | Pending |
| RECO-01 | Phase 53 | Pending |
| RECO-02 | Phase 53 | Pending |
| RECO-03 | Phase 53 | Pending |
| PLAN-01 | Phase 54 | Pending |
| PLAN-02 | Phase 54 | Pending |
| PLAN-03 | Phase 54 | Pending |

**Coverage:**
- v4.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after roadmap creation*
