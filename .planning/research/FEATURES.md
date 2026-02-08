# Feature Landscape: v2.0 Skill Ecosystem

**Domain:** Internal AI skill marketplace -- review pipeline, conversational discovery, fork-on-modify detection, admin review UI
**Researched:** 2026-02-08
**Overall confidence:** HIGH (patterns well-established across App Store, GitHub PR, marketplace ecosystems; codebase primitives already exist)

## Context

EverySkill is at v1.5 with a complete internal skill marketplace: CRUD, versioning, forking, AI review (on-demand, advisory-only), semantic similarity via pgvector/Ollama, MCP tools (list, search, deploy, create), star ratings, quality badges, admin panel, notifications, and PostToolUse hook-based usage tracking.

v2.0 extends the ecosystem with four capabilities:

1. **Review pipeline** -- Transition from advisory AI review to gated publishing: create -> pending_review -> AI reviews -> author revises -> admin approves -> published
2. **Review UX** -- In-app review page, notification+modal, and MCP-first review (Claude returns review results inline)
3. **Conversational discovery** -- MCP semantic search -> recommend -> describe -> install -> guide usage, all within a conversation
4. **Fork-on-modify detection** -- MCP tool compares local file hash vs DB hash, prompts fork when drift detected

**Existing infrastructure being extended:**
- `skill_reviews` table with AI-generated quality/clarity/completeness scores (1-10), SHA-256 content hash comparison
- `skill_versions` table with immutable version records, content hashes, R2 storage URLs
- `skill_embeddings` table with pgvector HNSW index (768-dim Voyage AI/Ollama vectors)
- `notifications` table with type-based routing and email preferences
- `skills.forkedFromId` self-referential FK for fork tracking
- `skills.publishedVersionId` / `skills.draftVersionId` for draft/published lifecycle
- MCP `search_skills` tool with ILIKE relevance scoring
- MCP `deploy_skill` tool with frontmatter injection and local file save
- MCP `create_skill` tool that auto-publishes immediately (needs gating)
- `hashContent()` SHA-256 utility in `apps/web/lib/content-hash.ts`
- `generateSkillReview()` in `apps/web/lib/ai-review.ts` using Claude Sonnet structured output

---

## Table Stakes

Features users expect for a review pipeline, discovery flow, and fork detection system. Missing any of these means the v2.0 features feel incomplete.

### 1. Review Pipeline State Machine

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| `status` field on skills | Skills need a lifecycle state beyond published/draft | LOW | Schema migration |
| State transitions: draft -> pending_review -> in_review -> changes_requested -> approved -> published | Users expect a clear, predictable workflow modeled on App Store / GitHub PR review | MEDIUM | State machine logic |
| AI auto-review on submission | When author submits for review, AI review runs automatically (not on-demand) | LOW | Existing `generateSkillReview()` |
| Admin approve/reject/request-changes actions | Three-action model from GitHub PR reviews is the standard | MEDIUM | Admin authorization |
| Author revision cycle | Author receives feedback, edits, resubmits -- re-triggers AI review | MEDIUM | State transition logic |
| Review comments/notes | Admin can attach a text note explaining rejection or change request | LOW | New `reviewerNotes` field |

**Expected behavior (modeled on App Store + GitHub PR workflow):**

```
DRAFT ──submit──> PENDING_REVIEW ──auto-AI-review──> IN_REVIEW
                                                        |
                                    ┌───────────────────┼───────────────────┐
                                    v                   v                   v
                              APPROVED           CHANGES_REQUESTED      REJECTED
                                  |                   |
                                  v                   v
                              PUBLISHED         author edits, resubmits
                                              ──> PENDING_REVIEW (cycle)
```

**States (modeled on Apple App Store + GitHub):**
- `draft` -- Author is editing, not submitted for review
- `pending_review` -- Submitted, waiting for AI review to complete
- `in_review` -- AI review complete, awaiting admin decision
- `approved` -- Admin approved, ready to publish (or auto-publishes)
- `changes_requested` -- Admin wants modifications before approval
- `rejected` -- Admin rejected entirely (rare, for policy violations)
- `published` -- Live and visible to all users

**Why this specific state model:** Apple's App Store uses a similar flow (Waiting for Review -> In Review -> Approved/Rejected) and GitHub PRs use the three-action model (Comment, Approve, Request Changes). The combination gives authors clear expectations and admins clear actions. The `changes_requested` state is critical -- it differentiates "fix this and resubmit" from "this is rejected outright," which matches how 95% of review feedback works.

**Implementation note:** The `skills` table already has `publishedVersionId` and `draftVersionId` columns. The `status` field governs the skill-level lifecycle. A skill in `changes_requested` still has its `draftVersionId` pointing to the version under review, and the author creates a new version when resubmitting.

**Confidence:** HIGH -- This state machine maps directly to Apple App Store submission statuses and GitHub PR review states, both well-documented systems.

### 2. Automatic AI Review on Submission

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| AI review triggers on submit-for-review | Authors should not manually request AI review before submitting | LOW | Existing `generateSkillReview()` |
| Review results stored and displayed inline | Author sees quality/clarity/completeness scores immediately | LOW | Existing `skill_reviews` table |
| Minimum score threshold for auto-approval (optional) | High-scoring skills skip manual review | MEDIUM | Configurable threshold in tenant settings |
| Content hash comparison skips re-review if unchanged | Do not waste API calls re-reviewing identical content | LOW | Existing `reviewedContentHash` field |

**Expected behavior:** Author clicks "Submit for Review." The system transitions the skill to `pending_review`, fires `generateSkillReview()` asynchronously, and transitions to `in_review` when the AI review completes. The AI review results (scores, suggestions, suggested description) are visible to both the author and the admin reviewer.

**Optional auto-approval gate:** If all three category scores (quality, clarity, completeness) are >= 7 (configurable per tenant), the skill auto-transitions to `approved` without admin intervention. This reduces admin workload for high-quality submissions. Skills below the threshold require manual admin review.

**Confidence:** HIGH -- The existing `generateSkillReview()` function already produces structured output. The only change is triggering it automatically instead of on-demand.

### 3. Admin Review Queue and Dashboard

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Review queue page listing skills in `in_review` state | Admins need a centralized view of pending reviews | MEDIUM | New admin page |
| Skill diff view (previous version vs submitted version) | Admins need to see what changed, not read the entire skill | HIGH | Version comparison logic |
| Approve / Request Changes / Reject actions | Three-action model per GitHub PR reviews | MEDIUM | State transition actions |
| Reviewer notes text field | Admin explains their decision | LOW | Text input |
| Review history (audit trail) | Who reviewed what, when, with what decision | MEDIUM | Review event records |
| Queue filtering (by category, author, AI score) | Admins with many pending reviews need triage tools | LOW | Query parameters |
| Bulk approve for high-scoring skills | When AI scores are all 8+, approve multiple at once | LOW | Bulk action UI |

**Expected behavior (modeled on Reddit/Higher Logic moderation queues + GitHub PR review):**

The admin review page shows a queue of skills in `in_review` status, sorted by submission date (oldest first). Each item shows:
- Skill name, author, category, submission date
- AI review scores (quality/clarity/completeness as color-coded badges)
- AI-generated summary
- "View" button that opens the full skill content with diff highlighting

When an admin reviews a skill, they see:
- Side-by-side or inline diff between the previous published version and the submitted version
- AI review scores and suggestions
- A text area for reviewer notes
- Three action buttons: Approve, Request Changes, Reject

On action:
- **Approve:** Status -> `approved`, `publishedVersionId` updated, author notified
- **Request Changes:** Status -> `changes_requested`, reviewer notes saved, author notified with specific feedback
- **Reject:** Status -> `rejected`, reviewer notes saved, author notified with reason

**Confidence:** HIGH -- Content moderation queues with approve/reject/request-changes are standardized across platforms (Reddit, Zendesk, Stream, Higher Logic). The three-action model from GitHub is widely understood.

### 4. Review Notifications

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Notify author when AI review completes | Author should know their review is ready | LOW | Existing notification system |
| Notify admin when skill enters `in_review` | Admin needs to know there's work to do | LOW | Existing notification system |
| Notify author on approve/reject/request-changes | Author needs the decision and feedback | LOW | Existing notification system |
| Notification type: `skill_review` | Fits into existing type-based notification routing | LOW | New notification type |
| Email notification for review decisions | Critical decisions should reach email, not just in-app bell | LOW | Existing email notification system |

**Expected behavior:** The notification system already supports types (`grouping_proposal`, `trending_digest`, `platform_update`). Adding `skill_review_submitted`, `skill_review_complete`, `skill_approved`, `skill_changes_requested`, `skill_rejected` as new types integrates with existing notification preferences. Authors can opt out of email notifications for reviews if they prefer in-app only.

**Confidence:** HIGH -- The notification infrastructure is already built (notifications table, preferences, email dispatch). This is adding new notification types to an existing system.

### 5. Conversational Discovery via MCP

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Semantic search MCP tool | Natural language queries like "help me write better code reviews" | MEDIUM | Existing pgvector embeddings |
| Skill recommendation based on context | "Based on what you're working on, try these skills" | HIGH | Context analysis from conversation |
| Skill detail retrieval via MCP | "Tell me more about that skill" -- returns full description, ratings, usage stats | LOW | New MCP tool or extend search |
| Guided install flow via MCP | "Install it" triggers deploy_skill with contextual instructions | LOW | Existing deploy_skill tool |
| Usage guidance after install | "Here's how to use this skill: ..." | LOW | Return skill content as guidance |

**Expected behavior (modeled on conversational recommendation systems):**

The MCP interface enables a multi-turn discovery conversation:

```
User: "I need help with database migrations"
Claude: [calls search_skills with semantic query]
       "I found 3 relevant skills:
        1. Database Migration Helper (Gold, 45 uses) - Automates Drizzle migration generation
        2. Schema Review Workflow (Silver, 23 uses) - Reviews schema changes for anti-patterns
        3. SQL Query Optimizer (Bronze, 12 uses) - Optimizes slow queries
        Want to know more about any of these?"

User: "Tell me more about #1"
Claude: [calls get_skill_details]
       "Database Migration Helper:
        - Author: Jane D.
        - Quality: 8.5/10, Clarity: 9/10, Completeness: 7.5/10
        - Description: Analyzes your current schema and generates...
        Want me to install it?"

User: "Yes, install it"
Claude: [calls deploy_skill]
       "Installed to ~/.claude/skills/database-migration-helper.md
        To use it, just describe the migration you need..."
```

**Key design principle:** The MCP tools should return enough context for Claude to have a natural conversation about skills without requiring the user to visit the web UI. Search results should include ratings, usage stats, and quality tier so Claude can make informed recommendations.

**New MCP tools needed:**
- `get_skill_details` -- Returns full skill metadata (description, scores, author, usage stats, similar skills)
- `recommend_skills` -- Given a natural language description of what the user needs, returns ranked recommendations using semantic similarity (pgvector cosine distance)

**Existing tools enhanced:**
- `search_skills` -- Add semantic search mode alongside ILIKE (use embeddings when available)
- `deploy_skill` -- Already handles installation; add usage guidance in response

**Confidence:** HIGH for the tool design, MEDIUM for semantic search quality. The pgvector infrastructure exists but the MCP `search_skills` tool currently uses ILIKE only (the web UI has full-text search with `websearch_to_tsquery`). Adding semantic search to MCP requires calling the embedding service from the MCP app, which currently only runs in the web app.

### 6. Fork-on-Modify Detection

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| MCP tool: `check_skill_status` | Compare local file hash to DB hash | MEDIUM | New MCP tool |
| Local file hash computation | SHA-256 of local `.claude/skills/{slug}.md` | LOW | fs.readFile + crypto |
| DB hash lookup by skill ID | Query `skill_versions.contentHash` for published version | LOW | Existing schema |
| Drift detection result | "modified" / "current" / "unknown" (no local file) | LOW | Hash comparison |
| Fork prompt on drift | "Your local copy has been modified. Fork as a new skill?" | LOW | MCP response message |
| One-step fork via MCP | `fork_skill` MCP tool creates fork from modified content | MEDIUM | Extend existing fork action |
| Web UI drift indicator | Skill detail page shows "local copy modified" if hash mismatch detected | MEDIUM | API endpoint for hash check |

**Expected behavior (modeled on git divergence detection):**

When a user has installed a skill and later modified it locally, the system should detect this drift:

```
User: "Check if my skills are up to date"
Claude: [calls check_skill_status for each installed skill]
       "2 skills have been modified locally:
        - Code Review Automation: modified (different from published v3)
        - Git PR Workflow: current (matches published v2)

        Would you like to fork the modified skills as your own versions?"

User: "Yes, fork Code Review Automation"
Claude: [calls fork_skill with local content]
       "Created 'Code Review Automation (Fork)' with your modifications.
        Your fork is now published and tracking separately."
```

**Hash comparison logic:**
1. MCP tool reads local file at `~/.claude/skills/{slug}.md`
2. Strips frontmatter (tracking hooks, metadata) before hashing -- compare content only
3. Computes SHA-256 of stripped content
4. Queries DB for the skill's `publishedVersionId` -> `skill_versions.contentHash`
5. Compares hashes: match = "current", mismatch = "modified"

**Critical design decision: Strip frontmatter before comparison.** The deploy_skill tool injects tracking hooks into frontmatter. The author's original content is stored separately. If the user modifies only the skill content (not the frontmatter), that should be detected. If the frontmatter was regenerated with a new tracking URL but content is identical, that should NOT trigger a fork prompt.

**Web UI integration:** The skill detail page can show a "Check for local modifications" button that calls an API endpoint. This is secondary to the MCP flow -- most users will interact with skills via Claude, not the web UI.

**Confidence:** HIGH -- Content hash comparison is a well-established pattern (git, SBOM integrity verification, file integrity monitoring). The existing `contentHash` field on `skill_versions` and `hashContent()` utility provide the foundation.

### 7. MCP-First Review Experience

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| `review_skill` MCP tool | Author triggers review from within Claude conversation | MEDIUM | New MCP tool wrapping `generateSkillReview()` |
| Inline review results in conversation | Claude presents scores, suggestions, and recommended actions | LOW | Structured MCP response |
| `submit_for_review` MCP tool | Author submits skill for admin review via MCP | LOW | New MCP tool, state transition |
| Review status check via MCP | "What's the status of my submitted skills?" | LOW | Query skills by author + status |

**Expected behavior:**

```
User: "Review my code review automation skill before I submit it"
Claude: [calls review_skill]
       "AI Review Results for 'Code Review Automation':
        - Quality: 8/10 - Well-structured with clear steps
        - Clarity: 6/10 - Some jargon could be simplified
          Suggestion: Replace 'LGTM heuristics' with 'approval criteria'
        - Completeness: 7/10 - Missing error handling guidance
          Suggestion: Add a section on what to do when review comments conflict

        Overall: Good quality. Address clarity suggestions before submitting.
        Ready to submit for admin review?"

User: "Submit it"
Claude: [calls submit_for_review]
       "Submitted for review. You'll be notified when an admin reviews it."
```

**Why MCP-first matters:** EverySkill is a tool for Claude users. The primary interaction surface is the Claude conversation, not the web UI. Review, submission, and status checks should all be available without leaving the conversation.

**Confidence:** HIGH -- This is a natural extension of the existing MCP tool pattern. The AI review logic already exists; wrapping it in an MCP tool is straightforward.

---

## Differentiators

Features that set EverySkill apart from basic prompt marketplaces. Not required for v2.0 launch but high-value.

### Auto-Approval for High-Quality Skills

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Configurable score threshold (e.g., all categories >= 8) | Reduces admin workload for obviously good skills | LOW | Tenant setting |
| Auto-approve bypasses admin queue | Fast-tracks quality content | LOW | State transition shortcut |
| Audit trail notes "auto-approved by AI" | Transparency about automated decisions | LOW | Review record metadata |

**Why valuable:** PromptBase manually reviews every submission, which does not scale. FlowGPT has no review, which leads to quality variance. Auto-approval for high-scoring skills is the middle ground -- maintains quality without bottlenecking on admin availability.

### Suggested Edits (Apply AI Suggestions)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Apply suggestion" button for AI review suggestions | One-click improvement, like GitHub suggested changes | MEDIUM | Edit + re-save |
| Inline diff preview before applying | Author sees exactly what changes | MEDIUM | Diff rendering |
| Apply suggested description | One-click to adopt AI's improved description | LOW | Field update |

**Why valuable:** GitHub's "Apply suggestion" feature on PR reviews dramatically improved review UX. Authors can adopt improvements without manually editing. This is especially powerful for clarity/completeness suggestions where the AI can generate improved text.

### Skill Compatibility Check

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Check if skill's required tools are available | "This skill uses Bash and Write tools -- both available" | MEDIUM | Tool capability introspection |
| Warn about unsupported features | "This skill requires MCP server X which is not installed" | MEDIUM | Dependency declaration |
| Suggest prerequisites | "Install X before using this skill" | LOW | Response metadata |

### Trending and Personalized Recommendations

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Trending this week" in MCP responses | Surface popular new skills | LOW | Query by recent usage growth |
| "Based on your usage" recommendations | Personalized from user's install/usage history | HIGH | Collaborative filtering |
| "Similar to skills you use" | Content-based filtering via embeddings | MEDIUM | Existing pgvector similarity |

### Review Analytics Dashboard

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Average time to review | Track admin responsiveness | LOW | Timestamp deltas |
| Approval/rejection rates | Quality trend monitoring | LOW | Status counts |
| Common rejection reasons | Help authors improve upfront | MEDIUM | Text analysis of reviewer notes |
| AI score distribution | Understand overall skill quality | LOW | Aggregation query |

---

## Anti-Features

Features to explicitly NOT build. Tempting but counterproductive.

| Anti-Feature | Why Tempting | Why Problematic | Do Instead |
|--------------|-------------|-----------------|------------|
| **Mandatory review for all edits** | "Quality control on every change" | Creates friction for minor typo fixes. Authors will avoid updating skills if every edit requires re-review. Updates to published skills should only trigger re-review if content changes substantially (hash comparison). | Re-review only when content hash changes. Metadata-only edits (tags, description) skip review. |
| **Multiple reviewer approval** | "More eyes = better quality" | This is an internal tool, not a regulatory pipeline. Requiring 2+ approvers creates bottlenecks. One admin approval is sufficient. | Single admin approval. Add optional "second opinion" for disputed cases later if needed. |
| **Real-time collaborative editing during review** | "Google Docs-style review" | Massive frontend complexity (CRDT, OT, WebSocket). Skills are markdown files -- not documents. The edit-submit-review cycle is sufficient. | Author edits locally, resubmits. Reviewer adds notes. Async workflow. |
| **AI-generated skill improvements** | "AI should auto-fix the skill" | Rewriting author content without consent is overstepping. AI should suggest, not modify. Auto-applying changes violates author ownership. | AI suggests specific improvements. Author chooses what to apply. "Apply suggestion" button for one-click adoption. |
| **Blocking deploy of unreviewed skills** | "Only approved skills should be installable" | Overly restrictive for an internal tool. Authors should be able to deploy their own drafts for personal testing. Only the "published" (visible to others) status should require review. | Draft skills deployable by author only. Published status requires review approval. |
| **Complex permission model for reviewers** | "Separate reviewer role from admin" | YAGNI at current scale. Admins are reviewers. Adding a separate reviewer role means role management UI, permission checks, etc. | Admins review skills. If the team grows, add a reviewer role later. |
| **Webhook notifications to external systems** | "Post to Slack when a skill is approved" | Out of scope for v2.0. Internal notification system is sufficient. Webhook integrations add authentication complexity, retry logic, and failure handling. | In-app + email notifications. Add Slack integration in a future milestone. |
| **Full-text search in MCP tool** | "Use PostgreSQL websearch_to_tsquery in MCP" | The MCP app runs standalone without access to the web app's search infrastructure. Full-text search requires the database connection and tsvector index. | Use ILIKE search for MCP (already works), add semantic search via embedding endpoint. The web UI already has full-text search. |

---

## Feature Dependencies

```
[Review State Machine] (#1)
    |--modifies--> skills table (add status column)
    |--modifies--> create_skill MCP tool (default to draft, not auto-publish)
    |--blocks----> Admin Review Queue (#3)
    |--blocks----> Review Notifications (#4)
    |--blocks----> MCP Review Tools (#7)

[Auto AI Review on Submit] (#2)
    |--requires--> [Review State Machine] (#1)
    |--reuses----> generateSkillReview() (existing)
    |--reuses----> skill_reviews table (existing)
    |--modifies--> skill_reviews to track review-pipeline context (not just advisory)

[Admin Review Queue] (#3)
    |--requires--> [Review State Machine] (#1)
    |--requires--> [Auto AI Review] (#2) for AI scores display
    |--modifies--> admin panel (new /admin/reviews page)
    |--reuses----> skill_versions for diff view
    |--reuses----> isAdmin() authorization (existing)

[Review Notifications] (#4)
    |--requires--> [Review State Machine] (#1)
    |--reuses----> notifications table (existing, add new types)
    |--reuses----> notification-preferences (existing)
    |--reuses----> email dispatch (existing)

[Conversational Discovery] (#5)
    |--independent of--> Review Pipeline (#1-4)
    |--reuses----> skill_embeddings + pgvector (existing)
    |--reuses----> search_skills MCP tool (existing, enhanced)
    |--creates---> get_skill_details MCP tool (new)
    |--creates---> recommend_skills MCP tool (new)
    |--modifies--> deploy_skill response (add usage guidance)

[Fork-on-Modify Detection] (#6)
    |--independent of--> Review Pipeline (#1-4)
    |--independent of--> Conversational Discovery (#5)
    |--reuses----> skill_versions.contentHash (existing)
    |--reuses----> hashContent() utility (existing)
    |--reuses----> forkSkill() server action (existing)
    |--creates---> check_skill_status MCP tool (new)
    |--creates---> fork_skill MCP tool (new, wraps existing forkSkill)

[MCP Review Tools] (#7)
    |--requires--> [Review State Machine] (#1)
    |--reuses----> generateSkillReview() (existing)
    |--creates---> review_skill MCP tool (new)
    |--creates---> submit_for_review MCP tool (new)
    |--creates---> check_review_status MCP tool (new)
```

### Critical Path

```
Phase 1: Review Pipeline Foundation
    Status field migration + state machine logic
    Auto AI review on submit
    (Must be first -- all review features depend on status field)

Phase 2: Admin Review UX
    Admin review queue page
    Diff view (version comparison)
    Approve/reject/request-changes actions
    Review notifications (all types)
    (Requires Phase 1 state machine)

Phase 3: Conversational Discovery
    get_skill_details MCP tool
    recommend_skills MCP tool (semantic search in MCP)
    Enhanced search_skills with semantic mode
    (Independent of Phase 1-2, can partially parallel)

Phase 4: Fork-on-Modify Detection
    check_skill_status MCP tool
    fork_skill MCP tool
    Web UI drift indicator
    (Independent of Phase 1-3, can partially parallel)

Phase 5: MCP Review Integration
    review_skill MCP tool
    submit_for_review MCP tool
    check_review_status MCP tool
    (Requires Phase 1 state machine, benefits from Phase 2 admin UX)
```

---

## MVP Recommendation

### Must Have for v2.0

**Review Pipeline (build first -- foundation for everything):**
- [ ] `status` column on `skills` table: draft | pending_review | in_review | changes_requested | approved | rejected | published
- [ ] State transition functions with authorization checks (who can transition to what)
- [ ] `create_skill` MCP tool defaults to `draft` status instead of auto-publishing
- [ ] Web UI "Submit for Review" button on draft skills
- [ ] Auto-trigger `generateSkillReview()` on submit-for-review
- [ ] Transition to `in_review` when AI review completes

**Admin Review Queue (build second -- enables admin workflow):**
- [ ] `/admin/reviews` page with queue of `in_review` skills
- [ ] Skill diff view (compare submitted version to previous published version)
- [ ] Approve / Request Changes / Reject action buttons
- [ ] Reviewer notes text field
- [ ] Review decision stored with audit trail (who, when, action, notes)

**Review Notifications (build with admin queue):**
- [ ] Notification types: `skill_review_submitted`, `skill_approved`, `skill_changes_requested`, `skill_rejected`
- [ ] Notify author on all review decisions
- [ ] Notify admins when new skill enters `in_review`
- [ ] Email notifications for review decisions (respecting preferences)

**Conversational Discovery (build third -- independent track):**
- [ ] `get_skill_details` MCP tool (full metadata: scores, author, usage, similar skills)
- [ ] `recommend_skills` MCP tool (semantic search via embedding endpoint)
- [ ] Enhanced `search_skills` to return richer metadata (ratings, quality tier, install count)
- [ ] Usage guidance text in `deploy_skill` response

**Fork-on-Modify Detection (build fourth -- independent track):**
- [ ] `check_skill_status` MCP tool (local hash vs DB hash comparison)
- [ ] `fork_skill` MCP tool (create fork from local modified content)
- [ ] Frontmatter stripping before hash comparison (ignore tracking hooks)

### Defer to Post-v2.0

- [ ] Auto-approval for high-scoring skills (nice-to-have, not blocking)
- [ ] Suggested edits / "Apply suggestion" UI (valuable but complex)
- [ ] Skill compatibility checks (requires tool introspection)
- [ ] Personalized recommendations (requires usage history analysis)
- [ ] Review analytics dashboard (valuable but not blocking)
- [ ] Web UI drift indicator (MCP-first is sufficient for v2.0)
- [ ] Bulk approve actions (optimize later based on queue volume)
- [ ] MCP review tools -- review_skill, submit_for_review, check_review_status (defer to after admin queue is working)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Review state machine (status field + transitions) | HIGH (enables quality control) | MEDIUM | LOW | P0 |
| Auto AI review on submit | HIGH (immediate quality feedback) | LOW | LOW | P0 |
| Admin review queue page | HIGH (admin workflow) | MEDIUM | LOW | P0 |
| Skill diff view | HIGH (review quality) | HIGH | MEDIUM | P0 |
| Approve/reject/request-changes actions | HIGH (admin workflow) | MEDIUM | LOW | P0 |
| Review notifications | MEDIUM (author awareness) | LOW | LOW | P0 |
| get_skill_details MCP tool | HIGH (discovery UX) | LOW | LOW | P0 |
| recommend_skills MCP tool | HIGH (discovery value) | MEDIUM | MEDIUM | P0 |
| check_skill_status MCP tool | HIGH (fork detection) | MEDIUM | LOW | P0 |
| fork_skill MCP tool | MEDIUM (fork UX) | MEDIUM | LOW | P0 |
| Reviewer notes | MEDIUM (feedback quality) | LOW | LOW | P1 |
| Review history audit trail | MEDIUM (accountability) | LOW | LOW | P1 |
| Enhanced search_skills metadata | MEDIUM (discovery quality) | LOW | LOW | P1 |
| Auto-approval threshold | MEDIUM (admin efficiency) | LOW | LOW | P2 |
| "Apply suggestion" UI | MEDIUM (author UX) | HIGH | MEDIUM | P2 |
| MCP review/submit tools | MEDIUM (MCP-first UX) | MEDIUM | LOW | P2 |
| Web UI drift indicator | LOW (web secondary to MCP) | MEDIUM | LOW | P3 |
| Personalized recommendations | LOW (requires usage volume) | HIGH | HIGH | P3 |

---

## Technical Reference: Review Pipeline Patterns

### State Transition Authorization Matrix

| Current State | Action | Who Can Do It | Next State |
|--------------|--------|---------------|------------|
| draft | submit_for_review | author | pending_review |
| pending_review | (auto: AI review completes) | system | in_review |
| in_review | approve | admin | approved/published |
| in_review | request_changes | admin | changes_requested |
| in_review | reject | admin | rejected |
| changes_requested | submit_for_review | author | pending_review |
| rejected | submit_for_review | author | pending_review |
| approved | publish | author or admin | published |
| published | unpublish | author or admin | draft |

### Review Quality Scoring (Existing, Reused)

The existing AI review produces three scores (1-10):
- **Quality:** Does it work well and produce good results?
- **Clarity:** Is it clear, well-written, and easy to reuse?
- **Completeness:** Is it thorough and self-contained?

These scores inform the admin's decision but do not block any action. The admin can approve a low-scoring skill or reject a high-scoring one based on policy considerations.

### Content Hash Comparison for Fork Detection

```
Local file: ~/.claude/skills/{slug}.md
    |
    v
Strip YAML frontmatter (everything between --- markers)
    |
    v
SHA-256 hash of remaining content
    |
    v
Compare to skill_versions.contentHash WHERE id = skills.publishedVersionId
    |
    v
Match? -> "current" (no drift)
Mismatch? -> "modified" (drift detected, prompt fork)
```

**Important:** The `contentHash` in `skill_versions` is computed from the content stored in R2, which may or may not include frontmatter. The fork detection tool must normalize both sides (strip frontmatter from both local and DB content) before comparison. If DB stores content without frontmatter, only strip from local.

---

## Sources

### Review Pipeline Patterns (HIGH confidence)
- [Apple App Store: App and Submission Statuses](https://developer.apple.com/help/app-store-connect/reference/app-and-submission-statuses) -- Complete state reference
- [GitHub: About Pull Request Reviews](https://docs.github.com/articles/about-pull-request-reviews) -- Three-action review model
- [GitHub PR Reviews: Comment vs Approve vs Request Changes](https://dev.to/msnmongare/github-pr-reviews-comment-vs-approve-vs-request-changes-when-to-use-each-1ph2) -- When to use each action
- [Approval Workflow Best Practices](https://zipboard.co/blog/collaboration/content-review-and-approval-best-practices-tools-automation/) -- Review pipeline design

### Content Moderation Queues (HIGH confidence)
- [Stream: Reviewing Content](https://getstream.io/moderation/docs/dashboard/reviewing-content/) -- Dashboard design patterns
- [Reddit: Moderation Queue](https://support.reddithelp.com/hc/en-us/articles/15484440494356-Moderation-Queue) -- Queue management
- [Higher Logic: Moderation Queue](https://support.higherlogic.com/hc/en-us/articles/360032694632-Manage-Your-Site-s-Moderation-Queue) -- Bulk actions, rejection notifications

### Prompt Marketplace Quality (MEDIUM confidence)
- [PromptBase and FlowGPT Review](https://www.godofprompt.ai/blog/critical-review-popular-prompt-marketplace-platforms) -- Quality control comparison
- [FlowGPT Review](https://skywork.ai/blog/flowgpt-review-2025-community-prompt-multimodel-chat/) -- Community-driven vs curated approaches
- [Promptfoo: LLM Rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) -- Automated quality scoring

### Conversational Discovery (MEDIUM confidence)
- [Claude Skills Explained](https://claude.com/blog/skills-explained) -- Skill discovery and loading mechanism
- [Smithery: MCP Server Marketplace](https://smithery.ai/) -- MCP tool discovery patterns
- [Glean: AI-Based Enterprise Search](https://www.glean.com/blog/the-definitive-guide-to-ai-based-enterprise-search-for-2025) -- Semantic search + conversational interfaces

### Fork Detection (HIGH confidence)
- [File Hashing for Integrity](https://www.sasa-software.com/learning/what-is-file-hashing-in-cybersecurity/) -- SHA-256 comparison patterns
- [Git Divergence Detection](https://labex.io/tutorials/git-how-to-check-if-a-git-branch-has-diverged-from-remote-560038) -- Divergence detection patterns
- [ENISA: SBOM Landscape Analysis](https://www.enisa.europa.eu/sites/default/files/2025-12/SBOM%20Analysis%20-%20Towards%20an%20Implementation%20Guide_v1.20-Published.pdf) -- Content-addressable references via hashing

### Existing Codebase (HIGH confidence)
- `/home/dev/projects/relay/packages/db/src/schema/skills.ts` -- Skills schema with publishedVersionId, draftVersionId, forkedFromId
- `/home/dev/projects/relay/packages/db/src/schema/skill-reviews.ts` -- AI review schema with categories, contentHash
- `/home/dev/projects/relay/packages/db/src/schema/skill-versions.ts` -- Version records with contentHash
- `/home/dev/projects/relay/packages/db/src/schema/skill-embeddings.ts` -- pgvector embeddings (768-dim, HNSW index)
- `/home/dev/projects/relay/packages/db/src/schema/notifications.ts` -- Notification types and preferences
- `/home/dev/projects/relay/apps/web/lib/ai-review.ts` -- generateSkillReview() with structured output
- `/home/dev/projects/relay/apps/web/lib/content-hash.ts` -- hashContent() SHA-256 utility
- `/home/dev/projects/relay/apps/web/lib/search-skills.ts` -- Full-text + ILIKE search with quality scoring
- `/home/dev/projects/relay/apps/web/app/actions/ai-review.ts` -- On-demand AI review action
- `/home/dev/projects/relay/apps/web/app/actions/fork-skill.ts` -- Fork skill action with embedding generation
- `/home/dev/projects/relay/apps/mcp/src/tools/search.ts` -- MCP search tool (ILIKE only)
- `/home/dev/projects/relay/apps/mcp/src/tools/create.ts` -- MCP create tool (auto-publishes, needs gating)
- `/home/dev/projects/relay/apps/mcp/src/tools/deploy.ts` -- MCP deploy with frontmatter injection
- `/home/dev/projects/relay/packages/db/src/services/skill-embeddings.ts` -- Embedding upsert/query

---

*Feature research for: EverySkill v2.0 Skill Ecosystem -- Review Pipeline, Conversational Discovery, Fork-on-Modify Detection*
*Researched: 2026-02-08*
*Confidence: HIGH for review pipeline and fork detection (well-established patterns, existing codebase primitives), MEDIUM for conversational discovery (semantic search quality depends on embedding coverage and MCP-to-embedding service bridge)*
