# Project Research Summary

**Project:** EverySkill v2.0 — Skill Ecosystem Features
**Domain:** Internal AI skill marketplace with review pipeline, conversational discovery, fork-on-modify detection
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

EverySkill v2.0 extends the existing v1.5 marketplace (complete with CRUD, versioning, forking, AI review, semantic search, MCP tools, and notifications) by adding four critical ecosystem capabilities: a gated review pipeline (draft → AI review → admin approval → published), conversational MCP discovery (semantic search → recommend → describe → install → guide), fork-on-modify detection (hash comparison detects when local edits diverge from published versions), and an admin review UI. The research reveals a remarkable finding: **zero new npm dependencies required**. Every capability maps directly to existing stack components.

The recommended approach follows established patterns from Apple App Store (review workflow states), GitHub PR reviews (three-action model: approve/reject/request changes), and git divergence detection (SHA-256 content hash comparison). The critical architectural decision is to add a `status` column to the `skills` table with strict state machine transitions, while keeping the existing advisory AI review system separate from the new pipeline decision system. The review pipeline uses the existing Anthropic SDK for AI-generated quality gates, conversational discovery reuses the existing pgvector + Ollama semantic search infrastructure, and fork detection leverages the existing `contentHash` field from `skill_versions`.

Key risks center on query migration correctness (8 unguarded query paths must add `status = 'published'` filters to prevent pending skills from leaking into search results), MCP tool bypass (the MCP `create_skill` tool uses raw SQL and will bypass the pipeline unless explicitly updated), and embedding model consistency (conversational discovery must use the same Ollama `nomic-embed-text` model as stored skill embeddings, or vector comparisons will be mathematically invalid). Mitigation is straightforward: atomic migration with `DEFAULT 'published'`, systematic query path updates, and embedding model validation before building conversational features.

## Key Findings

### Recommended Stack

**Zero new dependencies.** All v2.0 features map onto the existing stack: Anthropic SDK 0.72.1 for AI reviews with structured JSON output, MCP SDK 1.25.3 for new tools (recommend_skills, describe_skill, check_skill_drift), Drizzle ORM 0.42.0 for schema additions (status column, review workflow metadata), pgvector + Ollama for semantic search, and the existing notification + Resend infrastructure for review status changes. Version bumps are optional (latest Anthropic is 0.73.0, MCP is 1.26.0, Drizzle is 0.45.1) but not required—the current versions support all needed features.

**Core technologies (unchanged):**
- **Anthropic SDK 0.72.1**: AI review generation with `output_config.format.type: "json_schema"` — already working in production for advisory reviews, same pattern for pipeline reviews
- **MCP SDK 1.25.3**: New tools via `server.registerTool()` API — 6 tools already registered, adding 4 more follows identical pattern
- **pgvector + Ollama (nomic-embed-text 768d)**: Semantic search backbone — existing `skill_embeddings` table with HNSW index, conversational discovery reuses exact pattern
- **Drizzle ORM 0.42.0**: Schema additions for `status` column and review workflow — no new features needed, stable with 14 existing tables
- **Resend + notification system**: Review status change notifications — existing types infrastructure, adds 5 new notification types

**Rejected alternatives:**
- State machine library (XState/Robot3): 5-state linear workflow doesn't justify 15KB+ library, simple switch statement suffices
- Diff library (jsdiff/diff2html): Fork drift detection needs boolean "changed or not", not character-level diff—side-by-side text display is sufficient for v2.0
- Vercel AI SDK: Already using Anthropic SDK directly with structured output, wrapper adds no value and creates API pattern confusion

### Expected Features

**Must have (review pipeline foundation):**
- Status field on skills: draft | pending_review | ai_reviewed | approved | rejected | changes_requested | published — enables lifecycle tracking
- Auto AI review on submission: Triggers automatically (not on-demand), transitions skill to ai_reviewed state when complete
- Admin review queue: Centralized view of pending skills with AI scores, diff view, approve/reject/request-changes actions
- Review notifications: Notify admins on submission, notify authors on approval/rejection/changes-requested decisions
- MCP semantic discovery: recommend_skills tool (semantic search via embeddings), describe_skill tool (full metadata), enhanced search_skills with similarity scores
- Fork drift detection: check_skill_status MCP tool (local hash vs DB hash), fork_skill MCP tool (create fork from modified content)

**Must have (UX polish):**
- Skill detail page access control: Pending/draft skills only visible to author/admin, others get 404
- Review queue pagination: 20 per page from day one, filter by status/category/date
- Reviewer notes: Admin can attach feedback explaining rejection or change requests
- Frontmatter stripping before hash comparison: Tracking hooks in frontmatter should not trigger false "modified" detection

**Defer to post-v2.0:**
- Auto-approval threshold: High-scoring skills (all categories >= 8) skip manual review—nice optimization but not blocking
- "Apply suggestion" UI: One-click to adopt AI review suggestions—valuable but complex, defer to later phase
- Skill compatibility checks: Tool introspection to warn about missing dependencies—requires capability discovery
- Personalized recommendations: Requires usage history analysis and collaborative filtering—defer until sufficient usage volume
- Web UI drift indicator: MCP-first fork detection is sufficient for v2.0, web UI secondary

### Architecture Approach

The architecture extends existing patterns with minimal disruption. The review pipeline adds a `status` column to `skills` with a pure-function state machine in a new `skill-lifecycle.ts` service, keeping transitions as a data structure (not code logic) for auditability. Admin review UI extends the existing `/admin/` layout with a new "Reviews" tab following the established admin page pattern. Conversational discovery adds 3 new MCP tools (recommend, describe, guide) that reuse the existing semantic search logic from `trySemanticSearch()` in `similar-skills.ts`, adapted to MCP's raw SQL pattern (node16 moduleResolution prevents Drizzle query builder imports). Fork detection adds 2 MCP tools (check-status, update) that leverage the existing `contentHash` field from `skill_versions`, with a critical architectural decision to strip frontmatter before hashing to avoid false positives from tracking hook changes.

**Major components:**
1. **skill-lifecycle.ts service** — State machine for status transitions (draft → pending_review → ai_reviewed → approved/rejected/changes_requested → published), validates transitions via lookup table, dispatches notifications on state changes
2. **Admin review pages** — Queue at `/admin/review` (list pending skills with AI scores), detail at `/admin/review/[skillId]` (diff view, actions), extends existing admin layout with nuqs URL state pattern
3. **MCP semantic discovery tools** — recommend_skills (embedding query + pgvector cosine search), describe_skill (full metadata with reviews/stats/similar), guide_skill (usage instructions post-install)
4. **MCP fork detection tools** — check_skill_status (local file hash vs DB hash comparison), update_skill (push modifications as new version if author, fork if not)
5. **Review notification dispatcher** — Extends existing notification types with review_submitted/approved/rejected/changes_requested, groups all review notifications under single preference toggle

### Critical Pitfalls

1. **Existing skills have no status column—query migration correctness** — 8 of 15 skill query paths lack published filters (search-skills.ts, similar-skills.ts, MCP list/search tools, skill detail page). Adding `status` column without updating all queries causes pending skills to leak into search results or existing skills to vanish. **Prevention:** Migration uses `DEFAULT 'published'` (all existing skills auto-tagged), then systematically add `WHERE status = 'published'` to all 8 paths before exposing new submission flow.

2. **MCP create tool bypasses review pipeline** — MCP `create_skill` tool uses raw SQL and currently sets `published_version_id` immediately, creating a back door around the review pipeline. **Prevention:** Update MCP raw SQL to set `status = 'pending_review'` and remove immediate publish, change response message to "Skill submitted for review" instead of "Skill created and published."

3. **AI review has dual identity—advisory vs pipeline gate** — Existing `skill_reviews` table designed for author-initiated, fire-and-forget advisory reviews. Repurposing as pipeline gate creates conflicts: `requestedBy` assumes author (not system), unique constraint `(tenant_id, skill_id)` destroys audit trail on resubmission, `isVisible` toggle lets authors hide blocking reviews, fire-and-forget error handling means failed reviews cause skills to stuck in limbo. **Prevention:** Keep `skill_reviews` advisory, create separate `review_decisions` table for pipeline (insert-only, immutable audit), pipeline AI review must NOT be fire-and-forget (explicit error states).

4. **Fork-on-modify detection needs parent hash at fork time** — Current fork system copies content but doesn't store parent's content hash at fork time. Without this anchor, modification detection compares against parent's CURRENT hash (not fork-point hash), creating false positives when parent updates. **Prevention:** Add `forkedAtContentHash` column, populate on fork with `hashContent(parent.content)`, compare fork's current hash against this anchor (not parent's current hash).

5. **Embedding model consistency for semantic search** — Existing embeddings use Ollama `nomic-embed-text` (768d). Conversational discovery must use the same model for query embedding or vector comparisons are mathematically invalid (cannot compare Ollama embedding against Voyage/Anthropic embedding—different vector spaces). **Prevention:** Conversational discovery embeds user queries with Ollama (duplicate 15-line client code into MCP app), semantic search only on same-model embeddings, response generation can use Anthropic (separate concern).

## Implications for Roadmap

Based on research, suggested phase structure follows dependency chain from foundation (status column) → admin workflow (review UI) → independent features (discovery, fork detection):

### Phase 1: Review Pipeline Foundation
**Rationale:** Status column blocks everything—no other v2.0 feature works without it. Schema migration, state machine logic, and query path updates must be atomic to avoid skills vanishing or pending skills leaking.
**Delivers:** `status` column on skills with `DEFAULT 'published'`, skill-lifecycle service with state transition validation, all 8 unguarded query paths updated with status filters, MCP create_skill updated to create drafts instead of auto-publishing.
**Addresses:** Status field (table stakes), backward compatibility for existing skills, MCP bypass prevention.
**Avoids:** Pitfall 1 (query migration correctness), Pitfall 2 (MCP bypass), establishes foundation for Pitfall 3 prevention.

### Phase 2: AI Review Integration
**Rationale:** Auto AI review must happen before admin UI (admin needs AI scores to inform decisions). Separating advisory reviews from pipeline decisions prevents data model conflicts.
**Delivers:** Auto-trigger `generateSkillReview()` on submit-for-review (not fire-and-forget, explicit error handling), transition to ai_reviewed when complete, new review_decisions table for pipeline (separate from advisory skill_reviews), scoring threshold logic for auto-approve/reject/needs-human-review.
**Uses:** Existing Anthropic SDK with structured output (proven in lib/ai-review.ts), existing skill_reviews schema for AI data.
**Avoids:** Pitfall 3 (dual identity of AI review), Pitfall 11 (race between AI and admin), Pitfall 13 (fire-and-forget in critical paths).

### Phase 3: Admin Review UI
**Rationale:** Depends on Phase 1 (status field) and Phase 2 (AI review data). Admin workflow needs completed AI reviews to display scores and make informed decisions.
**Delivers:** Admin review queue at /admin/review with pagination/filtering/sorting, individual review page with diff view and three-action model (approve/reject/request-changes), reviewer notes text field, review decision audit trail.
**Implements:** Admin review page component, admin-review.ts server actions, review notification dispatch.
**Avoids:** Pitfall 10 (pagination from day one), Pitfall 11 (optimistic locking for race conditions), Pitfall 8 (skill detail page access control).

### Phase 4: Review Notifications
**Rationale:** Can build in parallel with Phase 3 admin UI. Notification dispatch is independent of UI rendering, uses existing infrastructure.
**Delivers:** 5 new notification types (review_submitted, approved, rejected, changes_requested, skill_published), notification dispatch on state transitions, group all review notifications under single preference toggle (reviewNotificationsEmail/InApp).
**Uses:** Existing notification service, Resend email dispatch, notification preferences system.
**Avoids:** Pitfall 4 (notification system extensibility)—groups types instead of adding column per type.

### Phase 5: Conversational MCP Discovery
**Rationale:** Independent of review pipeline (Phases 1-4). Can build in parallel with Phase 3-4. Depends only on existing pgvector + Ollama infrastructure.
**Delivers:** recommend_skills MCP tool (semantic search with Ollama embedding + pgvector cosine query), describe_skill MCP tool (full metadata + reviews + similar skills), enhanced search_skills with semantic mode and richer metadata, usage guidance in deploy_skill response.
**Implements:** Recommend, describe, guide MCP tools, Ollama client in MCP context (duplicate 15-line embedding function).
**Avoids:** Pitfall 6 (embedding model consistency)—uses same Ollama model, Pitfall 16 (status filter in vector search).

### Phase 6: Fork-on-Modify Detection
**Rationale:** Independent of all other phases. Can build in parallel. Depends only on existing contentHash and fork infrastructure.
**Delivers:** check_skill_status MCP tool (local hash vs DB hash comparison), update_skill MCP tool (new version if author, fork if not), forkedAtContentHash column on skills, frontmatter stripping before hash comparison.
**Implements:** Check-status and update MCP tools, fork hash anchor.
**Avoids:** Pitfall 7 (parent hash at fork time), Pitfall 4 (frontmatter hash comparison), Pitfall 5 (fork orphaned skills).

### Phase Ordering Rationale

- **Phases 1-2 are sequential dependencies:** Status column must exist before AI review can transition states, AI review must complete before admin sees results.
- **Phase 3-4 can partially parallel:** Admin UI and notifications share same state transitions but UI rendering and email dispatch are independent paths.
- **Phases 5-6 are fully parallel:** Conversational discovery and fork detection depend only on existing infrastructure (embeddings, contentHash), not on review pipeline. Can ship independently or together.
- **No cross-phase blocking:** Review pipeline (1-4) and discovery/fork (5-6) have zero shared code paths beyond the status filter in search queries.

Critical path: Phase 1 → Phase 2 → Phase 3 (admin can review) → Phase 4 (notifications complete loop). Phases 5-6 can ship before, during, or after 3-4 depending on business priority.

### Research Flags

Phases with standard patterns (skip /gsd:research-phase):
- **Phase 1-2 (Review pipeline):** Apple App Store and GitHub PR review patterns are exhaustively documented. State machine transitions are data structure, not complex logic.
- **Phase 3 (Admin UI):** Extends existing admin layout, no new patterns. Diff view is side-by-side text (not character-level), no new libraries.
- **Phase 4 (Notifications):** Adds types to existing notification infrastructure, proven pattern from Phase 33.
- **Phase 5 (Conversational discovery):** Reuses existing semantic search logic from similar-skills.ts, MCP tool pattern proven across 6 existing tools.
- **Phase 6 (Fork detection):** SHA-256 hash comparison is established pattern (git, SBOM), existing contentHash field provides anchor.

Phases likely needing validation (not research):
- **Phase 2 (AI review integration):** Test Anthropic SDK error handling under rate limit/API failure conditions (current code uses fire-and-forget, pipeline must propagate errors).
- **Phase 5 (Conversational discovery):** Validate Ollama embedding latency for interactive use (~50ms local is acceptable, >200ms needs optimization or fallback).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every feature verified against existing codebase files. Zero new dependencies claim validated by tracing each capability to installed package. |
| Features | HIGH | Review pipeline patterns sourced from Apple App Store (official docs) and GitHub PR reviews (verified behavior). Conversational discovery matches Smithery.ai and Claude Skills patterns. Fork detection uses standard git divergence logic. |
| Architecture | HIGH | Based on direct analysis of 14,700 LOC across 33 shipped phases. All component boundaries verified against existing service layer, MCP tool patterns, admin layout structure. |
| Pitfalls | HIGH | Derived from codebase audit identifying 8 unguarded query paths, MCP raw SQL patterns, existing AI review fire-and-forget usage. All 16 pitfalls reference specific file paths and line numbers from source code. |

**Overall confidence:** HIGH

### Gaps to Address

- **Ollama embedding latency for conversational use:** Existing embeddings are fire-and-forget (batch). Interactive conversational discovery requires sub-200ms embedding generation. Validate Ollama performance with GPU acceleration before committing to semantic search as primary discovery method. Fallback: ILIKE text search already works.

- **Review decision audit table schema:** Research recommends separate review_decisions table but doesn't specify exact schema. During Phase 2 planning, define: columns (skillId, versionId, reviewerType, decision, reason, reviewerId, createdAt), indexes (for admin history queries), retention policy (immutable forever or time-boxed).

- **Auto-approval scoring threshold:** Research suggests "all categories >= 7" for auto-approve but this is arbitrary. During Phase 2, analyze distribution of existing AI review scores to set data-driven thresholds (e.g., if 90% of published skills score 6+, threshold should be 6, not 7).

- **Admin review queue SLA tracking:** Research mentions review analytics dashboard as differentiator (average time to review, approval rates). Not blocking for v2.0 but plan where this data lives—review_decisions table should store timestamps for SLA calculation later.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Direct inspection of 18 schema files, 11 service files, 6 MCP tool files, 9 server action files, 12 query path files (total ~14,700 LOC verified)
- **Stack verification:** package.json dependencies (Anthropic SDK 0.72.1, MCP SDK 1.25.3, Drizzle ORM 0.42.0), lib/ai-review.ts (structured output usage confirmed line 127), apps/mcp/src/server.ts (registerTool pattern confirmed across 6 tools)
- **Apple App Store review workflow:** https://developer.apple.com/help/app-store-connect/reference/app-and-submission-statuses (complete state reference)
- **GitHub PR reviews:** https://docs.github.com/articles/about-pull-request-reviews (three-action model: comment/approve/request-changes)
- **NPM Registry:** @modelcontextprotocol/sdk (latest 1.26.0), @anthropic-ai/sdk (latest 0.73.0), drizzle-orm (latest 0.45.1)—confirmed current versions support all needed features

### Secondary (MEDIUM confidence)
- **Content moderation queues:** Stream dashboard design patterns (https://getstream.io/moderation/docs/dashboard/reviewing-content/), Reddit moderation queue (bulk actions, filtering), Higher Logic moderation (rejection notifications)
- **Prompt marketplace quality:** PromptBase vs FlowGPT review (godofprompt.ai/blog/critical-review-popular-prompt-marketplace-platforms)—manual review vs no review comparison
- **File hashing integrity:** SHA-256 comparison patterns (sasa-software.com/learning/what-is-file-hashing-in-cybersecurity), SBOM content-addressable references (ENISA SBOM analysis PDF)

### Tertiary (LOW confidence, needs validation)
- **Conversational discovery latency:** Ollama embedding speed for interactive use—no benchmarks available, must test in-situ during Phase 5
- **AI review auto-approval threshold:** "All categories >= 7" threshold is inference from App Store quality expectations, not data-driven. Validate against historical score distribution.

---
*Research completed: 2026-02-08*
*Ready for roadmap: yes*
