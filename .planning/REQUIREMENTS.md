# Requirements: EverySkill v2.0 — Skill Ecosystem

**Defined:** 2026-02-08
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v2.0 Requirements

Requirements for the Skill Ecosystem milestone. Each maps to roadmap phases starting from Phase 34.

### Review Pipeline

- [ ] **RVPL-01**: Skill creation sets status to `draft` instead of auto-publishing
- [ ] **RVPL-02**: Author can submit a draft skill for review, transitioning status to `pending_review`
- [x] **RVPL-03**: AI review triggers automatically on submit-for-review with explicit error handling (not fire-and-forget)
- [x] **RVPL-04**: AI review completion transitions skill to `ai_reviewed` status
- [ ] **RVPL-05**: State machine enforces valid transitions: draft → pending_review → ai_reviewed → approved/rejected/changes_requested → published
- [ ] **RVPL-06**: All 8+ existing skill query paths filter by `status = 'published'` to prevent pending skills from appearing in search/browse
- [ ] **RVPL-07**: MCP `create_skill` tool creates skills as `draft` with response message explaining review process
- [ ] **RVPL-08**: MCP `list_skills` and `search_skills` only return published skills
- [ ] **RVPL-09**: Skill detail page shows 404 for non-author/non-admin users when skill is not published
- [ ] **RVPL-10**: Existing published skills retain `published` status after migration (backward compatible)
- [x] **RVPL-11**: Skills with all AI review scores >= configurable threshold auto-approve (skip admin queue)
- [ ] **RVPL-12**: Author can view their own draft/pending/rejected skills on a "My Skills" page

### Admin Review

- [x] **ADMR-01**: Admin review queue page at `/admin/reviews` lists skills with pending review status
- [x] **ADMR-02**: Review queue supports pagination (20 per page) and filtering by status/category/date
- [x] **ADMR-03**: Admin can approve a skill, transitioning it to `approved` then `published` with publishedVersionId set
- [x] **ADMR-04**: Admin can reject a skill with required notes explaining the reason
- [x] **ADMR-05**: Admin can request changes with feedback notes, transitioning to `changes_requested`
- [x] **ADMR-06**: Admin review page shows AI review scores (quality/clarity/completeness) to inform decision
- [x] **ADMR-07**: Admin review page shows skill content with diff view against previous version (if exists)
- [x] **ADMR-08**: Review decisions stored immutably for audit trail (reviewer, action, timestamp, notes)
- [x] **ADMR-09**: Review queue count shown in admin sidebar/nav

### Review Notifications

- [x] **RVNT-01**: Admins notified (in-app + email) when a skill is submitted for review
- [x] **RVNT-02**: Author notified (in-app + email) when skill is approved
- [x] **RVNT-03**: Author notified (in-app + email) when skill is rejected (includes admin notes)
- [x] **RVNT-04**: Author notified (in-app + email) when changes are requested (includes admin feedback)
- [x] **RVNT-05**: Author notified (in-app + email) when skill is published
- [x] **RVNT-06**: Review notifications grouped under single preference toggle (reviewNotificationsEmail/InApp)
- [x] **RVNT-07**: Notification bell UI handles new review notification types with appropriate icons and action URLs

### MCP Discovery

- [ ] **DISC-01**: `recommend_skills` MCP tool performs semantic search using Ollama embeddings + pgvector cosine similarity
- [ ] **DISC-02**: `describe_skill` MCP tool returns full skill details including AI review scores, ratings, usage stats, and similar skills
- [ ] **DISC-03**: `guide_skill` MCP tool returns usage guidance and contextual instructions after skill installation
- [ ] **DISC-04**: `search_skills` enhanced with richer metadata (ratings, quality tier, install count) in responses
- [ ] **DISC-05**: Semantic search falls back gracefully to ILIKE text search when Ollama is unavailable
- [ ] **DISC-06**: Semantic search only returns published skills (status filter in vector queries)

### MCP Review Tools

- [x] **MCPR-01**: `review_skill` MCP tool triggers AI review from within Claude conversation, returns scores and suggestions
- [x] **MCPR-02**: `submit_for_review` MCP tool submits a draft skill for admin review via MCP
- [x] **MCPR-03**: `check_review_status` MCP tool returns current review status of author's submitted skills

### Fork Detection

- [ ] **FORK-01**: `check_skill_status` MCP tool compares local file content hash against DB published version hash
- [ ] **FORK-02**: Hash comparison strips YAML frontmatter before hashing (tracking hooks should not trigger false drift)
- [ ] **FORK-03**: `update_skill` MCP tool pushes local modifications back as new version (if author) or creates fork (if not author)
- [ ] **FORK-04**: `forkedAtContentHash` column stored on skills at fork time as anchor for modification detection
- [ ] **FORK-05**: Fork creation updated to create skill_version record and set proper status (not orphaned)
- [ ] **FORK-06**: Web UI on skill detail page shows drift indicator when fork has diverged from parent
- [ ] **FORK-07**: Web UI side-by-side comparison page at `/skills/[slug]/compare` shows fork content vs parent content

## Future Requirements

Deferred to post-v2.0. Tracked but not in current roadmap.

### Quality Automation

- **QUAL-01**: "Apply suggestion" button to adopt individual AI review suggestions with one click
- **QUAL-02**: Inline diff preview before applying AI suggestions
- **QUAL-03**: Skill compatibility check (required tools/MCP servers available)

### Personalization

- **PERS-01**: "Trending this week" in MCP recommendation responses
- **PERS-02**: "Based on your usage" personalized recommendations
- **PERS-03**: "Similar to skills you use" content-based filtering

### Review Analytics

- **RVAN-01**: Average time to review metric on admin dashboard
- **RVAN-02**: Approval/rejection rate trends
- **RVAN-03**: Common rejection reason analysis
- **RVAN-04**: AI score distribution visualization

### Advanced RBAC

- **RBAC-01**: Separate reviewer role (can approve/reject but not admin settings)
- **RBAC-02**: Review assignment to specific reviewers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mandatory review for all edits | Creates friction for minor fixes; only content-changing updates trigger re-review |
| Multiple reviewer approval | Internal tool, not regulatory pipeline; single admin sufficient |
| Real-time collaborative editing | CRDT/OT complexity for markdown files is overkill; async edit-submit cycle sufficient |
| AI-generated skill rewrites | AI suggests, never modifies; author ownership preserved |
| Blocking deploy of unreviewed skills | Authors should test their own drafts; only "published" visibility requires review |
| Webhook notifications to external systems | In-app + email sufficient for v2.0; Slack integration deferred |
| Character-level diff rendering | Side-by-side text display sufficient; jsdiff/diff2html add complexity for uncertain value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RVPL-01 | Phase 34 | Done |
| RVPL-02 | Phase 34 | Done |
| RVPL-03 | Phase 35 | Done |
| RVPL-04 | Phase 35 | Done |
| RVPL-05 | Phase 34 | Done |
| RVPL-06 | Phase 34 | Done |
| RVPL-07 | Phase 34 | Done |
| RVPL-08 | Phase 34 | Done |
| RVPL-09 | Phase 34 | Done |
| RVPL-10 | Phase 34 | Done |
| RVPL-11 | Phase 35 | Done |
| RVPL-12 | Phase 34 | Done |
| ADMR-01 | Phase 36 | Done |
| ADMR-02 | Phase 36 | Done |
| ADMR-03 | Phase 36 | Done |
| ADMR-04 | Phase 36 | Done |
| ADMR-05 | Phase 36 | Done |
| ADMR-06 | Phase 36 | Done |
| ADMR-07 | Phase 36 | Done |
| ADMR-08 | Phase 36 | Done |
| ADMR-09 | Phase 36 | Done |
| RVNT-01 | Phase 37 | Done |
| RVNT-02 | Phase 37 | Done |
| RVNT-03 | Phase 37 | Done |
| RVNT-04 | Phase 37 | Done |
| RVNT-05 | Phase 37 | Done |
| RVNT-06 | Phase 37 | Done |
| RVNT-07 | Phase 37 | Done |
| DISC-01 | Phase 38 | Pending |
| DISC-02 | Phase 38 | Pending |
| DISC-03 | Phase 38 | Pending |
| DISC-04 | Phase 38 | Pending |
| DISC-05 | Phase 38 | Pending |
| DISC-06 | Phase 38 | Pending |
| MCPR-01 | Phase 35 | Done |
| MCPR-02 | Phase 35 | Done |
| MCPR-03 | Phase 35 | Done |
| FORK-01 | Phase 39 | Pending |
| FORK-02 | Phase 39 | Pending |
| FORK-03 | Phase 39 | Pending |
| FORK-04 | Phase 39 | Pending |
| FORK-05 | Phase 39 | Pending |
| FORK-06 | Phase 39 | Pending |
| FORK-07 | Phase 39 | Pending |

**Coverage:**
- v2.0 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-02-08*
*Last updated: 2026-02-08 after roadmap creation*
