# Domain Pitfalls: Review Pipeline, Conversational Discovery, Fork-on-Modify Detection

**Domain:** Adding review/approval pipeline, conversational AI discovery, and fork modification detection to an existing instant-publish skill marketplace
**Project:** EverySkill v2.0
**Researched:** 2026-02-08
**Overall confidence:** HIGH (derived from direct codebase analysis of ~14,700 LOC across 33 shipped phases)

---

## Critical Pitfalls

Mistakes that cause data corruption, broken user experience, or require rewrites.

---

### Pitfall 1: Existing Skills Have No Status Column -- Query Migration Is the Real Risk

**What goes wrong:** The `skills` table has no `status` column. Every skill is implicitly "published." The only publish signal is `publishedVersionId IS NOT NULL`, but this check exists in only 6 of 15+ skill query paths. Adding a review pipeline requires a `status` enum (e.g., `draft | pending_review | approved | rejected | published`), and the migration must update every query path or pending-review skills will leak into public listings.

**Why it happens:** The schema was designed for instant-publish. Status-awareness was never part of the query layer.

**Consequences:**
- If you add `status` with no DEFAULT, existing skills get NULL and vanish from any query that filters `WHERE status = 'published'`.
- If you add `status DEFAULT 'published'` but forget to update a query, pending-review skills leak into search results and MCP tool output.
- If you add status but only update the web app queries, MCP tools remain unguarded (see Pitfall 2).

**Specific query paths from codebase audit:**

| Query Path | Has Published Filter? | Risk |
|---|---|---|
| `apps/web/lib/search-skills.ts` -- searchSkills() | NO | HIGH -- main listing page |
| `apps/web/lib/similar-skills.ts` -- checkSimilarSkills() | NO | MEDIUM -- pending skills appear as duplicates |
| `apps/web/lib/similar-skills.ts` -- findSimilarSkillsByName() | NO | MEDIUM -- pending skills in similarity panel |
| `apps/web/app/(protected)/skills/[slug]/page.tsx` | NO | HIGH -- direct URL to pending skill |
| `packages/db/src/services/search-skills.ts` -- searchSkillsByQuery() | NO | HIGH -- used by MCP search_skills |
| `packages/db/src/services/skill-forks.ts` -- getTopForks() | NO | LOW -- forks of pending skills |
| `apps/mcp/src/tools/list.ts` -- list_skills handler | NO | HIGH -- MCP returns all skills |
| `apps/mcp/src/tools/search.ts` -- search_skills handler | NO | HIGH -- delegates to searchSkillsByQuery |
| `apps/web/app/actions/admin-skills.ts` -- getAdminSkills() | NO | OK -- admin should see all statuses |
| `apps/web/lib/trending.ts` | YES | OK |
| `apps/web/lib/leaderboard.ts` | YES | OK |
| `apps/web/lib/platform-stats.ts` | YES | OK |
| `apps/web/lib/user-stats.ts` | YES | OK |
| `apps/web/lib/my-leverage.ts` | YES | OK |
| `apps/web/app/(protected)/users/[id]/page.tsx` | YES | OK |

**Prevention:**
1. Add the `status` column with `DEFAULT 'published'` so existing skills automatically get the correct status. New submissions should explicitly set `status = 'pending_review'`.
2. Add `WHERE status = 'published'` to ALL 8 unguarded query paths identified above BEFORE exposing the new submission flow.
3. Migration must be atomic: `ALTER TABLE skills ADD COLUMN status TEXT NOT NULL DEFAULT 'published'`. One statement, no backfill needed.
4. After migration, validate: `SELECT count(*) FROM skills WHERE status != 'published'` must return 0.

**Detection:** After adding status filters, compare skill counts in the UI before and after. Counts should be identical for the initial migration (all existing skills are published).

**Phase:** Must be the FIRST phase. Every other v2.0 feature depends on status existing.

---

### Pitfall 2: MCP Create Tool Bypasses the Review Pipeline

**What goes wrong:** The MCP `create_skill` tool (`apps/mcp/src/tools/create.ts`) uses raw SQL to insert skills and immediately sets `published_version_id`. It reimplements slug generation, content hashing, and frontmatter building independently from the web app. After adding a review pipeline to the web UI, skills created via MCP will still publish instantly.

**Why it happens:** The MCP server is a standalone app with duplicated logic. Line 14 comments: "self-contained -- MCP server runs standalone." It has its own `generateSlug()`, `hashContent()`, and `buildHookFrontmatter()`.

**Consequences:**
- Skills created via MCP bypass review entirely -- they go straight to published status.
- If `status` column has no DEFAULT or is NOT NULL without DEFAULT, the MCP INSERT will fail with a constraint violation, breaking all MCP-based skill creation.
- If `status` has `DEFAULT 'published'`, MCP-created skills silently skip the pipeline -- a back door.
- Users who want to avoid review learn to use the MCP tool instead of the web UI.

**Prevention:**
1. When adding the status column, use `DEFAULT 'published'` initially to keep MCP working without breaking.
2. In a subsequent step within the same phase, update the MCP `create_skill` handler's raw SQL to explicitly set `status = 'pending_review'` and remove the `UPDATE skills SET published_version_id = ...` line.
3. The MCP tool should return a different message: "Skill submitted for review" instead of "Skill created and published!"
4. Long-term: extract shared creation logic into `packages/db/src/services/skill-create.ts` to eliminate duplication.

**Detection:** After enabling the review pipeline, create a skill via MCP and verify it does NOT appear in `search_skills` results (it should be in pending_review status).

**Phase:** Same phase as status column migration. The MCP INSERT is at `apps/mcp/src/tools/create.ts` lines 145-148 and the publish is at lines 184-186.

---

### Pitfall 3: AI Review Has Dual Identity -- Advisory vs Pipeline Gate

**What goes wrong:** The existing AI review system (`skill_reviews` table, `apps/web/lib/ai-review.ts`) was designed as an advisory, author-triggered, fire-and-forget feature. Repurposing it as a pipeline gate (blocking publish until AI review passes) introduces fundamental data model conflicts:

1. **`requestedBy` assumes author-initiated.** In a pipeline, the system triggers review automatically. The `requestedBy` field would need to reference a system user or be nullable.
2. **Unique constraint `(tenant_id, skill_id)` limits to one review per skill.** A pipeline needs history: submitted -> AI reviewed -> rejected -> revised -> re-reviewed -> approved. The upsert in `skill-reviews.ts` line 52 replaces previous reviews, destroying the audit trail.
3. **`isVisible` toggle lets authors hide reviews.** In a gate context, authors hiding the rejection that blocks their skill creates a confusing UX.
4. **`autoGenerateReview()` in `skills.ts` (line 110) runs fire-and-forget with `.catch(() => {})`.** If this becomes the pipeline gate, a swallowed error means the skill never gets reviewed and sits in limbo permanently.
5. **Review scores are advisory (1-10 scale).** There is no pass/fail threshold. The pipeline needs a binary decision: approve or reject (possibly with a "needs human review" middle state).

**Consequences:**
- Skills stuck in "pending_review" forever if the AI call fails (currently swallowed).
- Review history lost because upsert replaces previous review.
- No audit trail for compliance (who approved what, when).
- Author can hide the gating review via the existing `toggleAiReviewVisibility` action.
- No distinction between "AI passed," "AI failed," "AI review could not run," and "human override."

**Prevention:**
1. **Keep `skill_reviews` for advisory reviews.** Create a SEPARATE `review_decisions` table for the pipeline that tracks: `skillId`, `versionId`, `reviewerType` (ai/admin), `decision` (approve/reject/needs_changes), `reason`, `reviewerId`, `createdAt`. Insert-only, no upsert. Immutable for audit.
2. **Pipeline AI review must NOT be fire-and-forget.** Use `try/catch` with explicit error states. If the AI call fails, set a `review_status = 'ai_review_failed'` state and notify admins.
3. **Define a scoring threshold for auto-approve.** For example: if all three category scores >= 7, auto-approve. If any score < 4, auto-reject. Otherwise, flag for human review.
4. **Do NOT reuse `autoGenerateReview()` for pipeline gating.** Write a new function with proper error propagation and decision logic.

**Detection:** Remove the Anthropic API key and submit a skill. It should enter an error state ("AI review could not be completed"), not silently publish or get stuck.

**Phase:** Design the pipeline data model before building the admin UI. The admin UI depends on the data structure being correct.

---

### Pitfall 4: Notification System Is Not Extensible for Review Events

**What goes wrong:** The notification system has a hardcoded type union: `"grouping_proposal" | "trending_digest" | "platform_update"` in `CreateNotificationParams`. The database column is plain `text` (no enum). The notification preferences table has per-type boolean columns: `groupingProposalEmail`, `groupingProposalInApp`, `trendingDigest`, `platformUpdatesEmail`, `platformUpdatesInApp`.

Adding review notifications (skill_submitted, review_approved, review_rejected, review_needs_changes) requires:
- Expanding the TypeScript union (easy).
- Adding preference columns for each new type (schema migration, awkward scaling).
- Updating the notification bell UI to handle new types (rendering, icons, action URLs).
- Deciding who receives each notification type (author vs admin vs reviewer).

**Consequences:**
- If you add notification types but not preference columns, users cannot opt out of review notifications.
- If you add a column per type, notification_preferences grows to 12+ boolean columns -- a schema smell.
- If the notification bell component does not handle unknown types, it may crash or show raw text.

**Prevention:**
1. Add TWO preference columns for all review notifications: `reviewNotificationsEmail` (boolean, default true) and `reviewNotificationsInApp` (boolean, default true). Do not add per-type columns for every review event.
2. Add the new notification types to the TypeScript union: `"skill_submitted" | "review_approved" | "review_rejected" | "review_needs_changes"`.
3. Ensure the notification bell component has a default rendering path for unknown types (graceful degradation, not crash).
4. Review notifications should follow the existing fire-and-forget pattern -- notification delivery should NOT block the review pipeline.

**Detection:** After adding review notifications, check the notification preferences page renders the new options. Send a review notification when user has no preference row -- should use defaults, not crash.

**Phase:** Add notification types in the review pipeline phase, not the admin UI phase. The pipeline triggers notifications, so the types must exist first.

---

## Moderate Pitfalls

---

### Pitfall 5: Fork Creates an Orphaned Skill with No Version Record

**What goes wrong:** The `forkSkill()` action (`apps/web/app/actions/fork-skill.ts`) creates a new skill row by copying the parent's content, but:
- It does NOT create a `skill_versions` record (no R2 upload, no contentUrl).
- It does NOT set `publishedVersionId` (left as NULL).
- It does NOT trigger AI review.
- It does NOT check for similar skills (unlike the main create action).

Currently this "works" because listings don't filter by `publishedVersionId`. But when the review pipeline is added:
- Forked skills have no version to review.
- The pipeline expects a version record to compare content hashes.
- If listings start filtering by status, forked skills with NULL `publishedVersionId` either vanish (if treated as unpublished) or bypass the pipeline (if defaulted to published).

**Prevention:**
1. When adding the status column, forked skills should get `status = 'draft'` or `status = 'pending_review'`.
2. The fork action should be updated to create a version record (matching the pattern in `checkAndCreateSkill`).
3. Decide the UX: fork -> edit page (draft) vs fork -> submit for review (pending_review). The current redirect to the skill detail page is wrong for either path.
4. If forks bypass review (acceptable for internal-only use), make this an explicit policy, not an accidental gap.

**Detection:** Fork a skill after the pipeline is live. Verify the fork appears in the admin review queue (if forks require review) or is clearly marked as draft (if forks start as drafts).

**Phase:** Address when updating the status column and query filters. Fork is a creation path that needs pipeline integration.

---

### Pitfall 6: Semantic Similarity Uses Ollama Locally -- Conversational Discovery Must Use the Same Model

**What goes wrong:** The current embedding pipeline uses Ollama (`nomic-embed-text`, 768 dimensions) running locally. Conversational discovery needs to embed user queries in real-time for vector search. If the discovery feature uses a different embedding model (e.g., Anthropic, Voyage AI, OpenAI), the vectors will be in incompatible mathematical spaces. You cannot compare an Ollama embedding against a Voyage AI embedding -- they are not in the same vector space.

**Consequences:**
- Conversational search returns irrelevant results because query embeddings and stored skill embeddings use different models.
- If you switch ALL embeddings to a cloud model, you must re-embed every existing skill (data migration).
- Voyage AI has tight rate limits (documented in project memory). Re-embedding hundreds of skills at once will hit rate limits.

**Prevention:**
1. Conversational discovery MUST use the same embedding model as stored skill embeddings (currently `nomic-embed-text` via Ollama). Embed the user's query with Ollama, search against stored Ollama embeddings.
2. The conversational response generation (natural language answers referencing search results) is a separate concern -- this CAN use the Anthropic API. The architecture is: embed query (Ollama) -> vector search (pgvector) -> generate response (Anthropic).
3. If switching to cloud embeddings, plan a re-embedding migration as a separate phase. Budget for rate limits: batch at 10-20 skills per minute for Voyage AI.
4. The `siteSettings.ollamaModel` determines the embedding model. Conversational discovery must read and use this setting, not hardcode a model.

**Detection:** Before implementing, verify Ollama can embed query strings with acceptable latency for interactive use (~50ms local is fine). If Ollama is down, the conversational discovery feature should degrade gracefully (fall back to full-text search, not crash).

**Phase:** Address in the conversational discovery phase. Decide embedding strategy before building the conversation UI.

---

### Pitfall 7: No Parent Content Hash Stored at Fork Time -- Cannot Detect Modification

**What goes wrong:** Fork-on-modify detection requires knowing whether a forked skill's content has diverged from its parent AT THE TIME OF FORKING. The current fork system:
- Records `forkedFromId` on the new skill (parent link exists).
- Copies `parent.content` to the fork (content is duplicated).
- Does NOT store the parent's content hash at fork time.
- Does NOT record which version of the parent was forked.

To detect modification, you need: `fork_current_content_hash != parent_content_hash_at_fork_time`. Without storing the parent's hash at fork time, you would have to compare against the parent's CURRENT content -- but the parent may have been updated since the fork, creating false positives (fork shows as "modified" when only the parent changed).

**Prevention:**
1. Add `forkedAtContentHash` column to the `skills` table (nullable, only populated for forks). When forking, compute `hashContent(parent.content)` and store it.
2. Modification detection: `hashContent(fork.content) !== fork.forkedAtContentHash`.
3. Do NOT compare against the parent's current content hash. The comparison must be against the SNAPSHOT at fork time.
4. Update `forkSkill()` action to compute and store this hash.
5. Consider also storing `forkedAtVersionId` if version records exist for the parent, for richer diff capabilities.

**Detection:** Create a fork, don't modify it, verify it's NOT flagged as modified. Modify the fork's content, verify it IS flagged. Modify the PARENT's content, verify the fork is still NOT flagged (the fork hasn't changed relative to its fork point).

**Phase:** Address when building fork-on-modify detection. Requires schema migration + fork action update.

---

### Pitfall 8: Skill Detail Page Has No "Pending Review" UX State

**What goes wrong:** The skill detail page (`apps/web/app/(protected)/skills/[slug]/page.tsx`) renders a full skill page with install button, fork button, rating form, reviews section, similar skills, and AI review tab. If a skill is pending review:
- The install button should be hidden (can't install an unapproved skill).
- The fork button should be hidden (can't fork an unapproved skill).
- The rating form should be hidden (can't rate what you can't use).
- A "Pending Review" or "Under Review" banner should show to the author.
- The page should return 404 for non-author, non-admin users.

Currently the page fetches by slug with no access control -- any user with the URL can view any skill.

**Prevention:**
1. After fetching the skill by slug, check `skill.status`:
   - `'published'`: render normally (current behavior).
   - `'pending_review'` or `'draft'`: check if current user is the author or admin. If not, call `notFound()`.
   - For author/admin: render a restricted view with a status banner and no install/fork/rate buttons.
2. Do NOT put this access control in middleware -- it requires a database query for the skill's status. Handle it in the page component.
3. This must ship in the same phase as the status column migration. If status exists but the detail page doesn't check it, users can view pending skills via direct URL.

**Detection:** Submit a skill for review, then access it via direct URL as a different (non-admin) user. Should get 404.

**Phase:** Same phase as status column and query filters.

---

### Pitfall 9: Conversation State Bloat in Multi-Turn Discovery

**What goes wrong:** Conversational discovery implies multi-turn interactions. This requires managing conversation state. Common mistakes:
- Sending the full conversation history to the LLM on every turn (cost and latency grow linearly).
- Persisting conversations in the database when they're ephemeral.
- Re-embedding the full conversation instead of just the refined query.
- Not setting a max conversation length, leading to unbounded API costs.

**Prevention:**
1. Use client-side React state for conversation history in the initial implementation. No new database table needed.
2. Send only the last 3-4 messages as context to the LLM (sliding window). The LLM's job is to reformulate the user's current intent, not recall the full history.
3. Embed ONLY the user's latest refined query for vector search, not the full conversation. The LLM generates the search query from conversation context.
4. Set a max conversation length (e.g., 10 turns) with a clear message: "Start a new conversation to continue exploring."
5. Budget: assume ~1,000 tokens per turn, 5 turns average = 5,000 tokens per conversation. At Claude Sonnet pricing, this is negligible, but monitor.

**Detection:** Test with 20+ turn conversations. Verify response latency stays under 3 seconds. Monitor Anthropic API token usage per conversation.

**Phase:** Address when building the conversational discovery UI.

---

### Pitfall 10: Admin Review Queue Without Pagination or Filtering Breaks at Scale

**What goes wrong:** Building an admin review queue that loads all pending skills at once works for 5-10 pending skills but breaks at scale. If 50+ skills are submitted for review simultaneously (e.g., after a bulk import or a team onboarding), the review page becomes slow and unusable.

**Prevention:**
1. Build the review queue with pagination from day one (e.g., 20 per page).
2. Add filters: by status (pending_review, rejected, needs_changes), by category, by submission date.
3. Add sorting: newest first (default), oldest first (for clearing backlogs).
4. Show a count of pending reviews in the admin sidebar or dashboard.
5. Reuse existing pagination patterns from the skills listing page.

**Detection:** Seed 100 skills with `status = 'pending_review'` and verify the admin review page loads in under 2 seconds.

**Phase:** Admin review UI phase.

---

### Pitfall 11: Race Condition Between Auto-Review and Admin Review

**What goes wrong:** When a skill is submitted, the AI auto-review runs asynchronously. If an admin opens the review queue and acts on the skill before the AI review completes, there's a race condition:
- Admin approves while AI review is still running. AI review completes and... overwrites the admin decision? Gets ignored? Creates a conflict?
- Admin rejects while AI review was about to auto-approve. The skill's status becomes inconsistent.

**Prevention:**
1. The review pipeline should have clear state transitions: `pending_review -> ai_reviewing -> ai_reviewed -> (auto_approved | needs_human_review | auto_rejected)`. Admin action is only available in `ai_reviewed` or `needs_human_review` states.
2. If the AI review has not completed, show "AI review in progress" in the admin UI and disable the approve/reject buttons.
3. Use optimistic locking: the admin's approve/reject action should check that the skill's `review_status` hasn't changed since the page loaded. If it has, show a "Status has changed, please refresh" message.
4. If AI review auto-approves, no admin action is needed. Only skills that fail AI review or are flagged for human review appear in the admin queue.

**Detection:** Submit a skill, immediately open the admin review queue, and try to approve before the AI review completes. The UI should either block the action or handle the race gracefully.

**Phase:** Review pipeline logic phase (before admin UI).

---

## Minor Pitfalls

---

### Pitfall 12: The `content` Column Is DEPRECATED but Still Primary

**What goes wrong:** `skills.content` has a comment: "DEPRECATED: Will be removed after migration to R2 storage." But it's still the primary content source for AI review, fork creation, MCP tools, and skill display. Building new pipeline features on a deprecated column creates more code to migrate when R2 becomes primary.

**Prevention:** Accept the debt. Build v2.0 on the `content` column. Abstracting content access behind a `getSkillContent(skillId)` function would be ideal but is not worth the refactor for v2.0. Just be aware that R2 migration will touch pipeline code later.

**Phase:** Not blocking. Acknowledge, don't fix.

---

### Pitfall 13: Fire-and-Forget Pattern in Pipeline-Critical Paths

**What goes wrong:** The codebase uses `.catch(() => {})` extensively for embedding generation and AI review. In the review pipeline, some operations MUST succeed or the skill enters an error state. Applying fire-and-forget to pipeline-critical operations creates silent failures.

**Specific danger zones:**
- `autoGenerateReview(...).catch(() => {})` in `skills.ts` line 299 -- if this is the pipeline gate, failure = stuck skill.
- `generateSkillEmbedding(...).catch(() => {})` in `skills.ts` line 288 -- if embedding is needed for conversational discovery, failure = skill is undiscoverable.

**Prevention:**
1. Classify each fire-and-forget call as "pipeline-critical" or "advisory."
2. Pipeline-critical: use `try/catch` with explicit error state transitions, admin notifications on failure.
3. Advisory (embedding enrichment after review, similarity panel): keep fire-and-forget.
4. The pipeline review function should NEVER use `.catch(() => {})`. It should propagate errors to the caller, which sets the skill's review_status accordingly.

**Detection:** Temporarily disable the Anthropic API key and submit a skill. The skill should enter a clear error state, not disappear into limbo.

**Phase:** Review pipeline logic phase.

---

### Pitfall 14: RBAC Is Binary (admin/member) -- No Reviewer Role

**What goes wrong:** The current role system is `user_role` pgEnum with values `admin` and `member`. The `isAdmin()` function checks `session.user.role === "admin"`. Adding a review pipeline likely needs a reviewer role -- someone who can approve/reject skills but doesn't have full admin access (tenant settings, user management).

Without a reviewer role, every reviewer must be a full admin, violating least-privilege.

**Prevention:**
1. For v2.0, gate reviews behind `isAdmin()`. Admins can review. This avoids a schema migration for the role enum.
2. If a separate reviewer role is needed later, add it to the enum: `ALTER TYPE user_role ADD VALUE 'reviewer'`. Create `canReview(session)` that checks `role === 'admin' || role === 'reviewer'`.
3. Do NOT inline role checks in server actions -- always use helper functions.

**Detection:** Verify that a member cannot access the admin review UI. Verify that an admin can.

**Phase:** Can be deferred. Start with admin-only review in v2.0.

---

### Pitfall 15: DEFAULT_TENANT_ID Hardcoded Proliferation

**What goes wrong:** `DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000"` is hardcoded in 18+ files. New review pipeline services will likely copy-paste this pattern, making the eventual dynamic tenant resolution harder.

**Prevention:** For new v2.0 code, import `DEFAULT_TENANT_ID` from `@everyskill/db` rather than re-declaring the string. Always accept `tenantId` as a parameter in new services (the existing `upsertSkillReview` does this correctly).

**Detection:** After v2.0 development, `grep -r "default-tenant-000" --include="*.ts" | wc -l` should not increase significantly.

**Phase:** Not blocking. Follow existing import pattern.

---

### Pitfall 16: Conversational Discovery Bypassing Status Filter

**What goes wrong:** If conversational discovery uses the existing `trySemanticSearch()` function from `similar-skills.ts`, it will search ALL skill embeddings regardless of status. The vector search query (lines 58-69) joins `skill_embeddings` to `skills` but has no status filter. Pending or rejected skills would appear in conversational discovery results.

**Prevention:**
1. Add `AND s.status = 'published'` to the vector search SQL in `trySemanticSearch()`.
2. OR create a new discovery-specific search function that includes the status filter.
3. The existing `checkSimilarSkills()` and `findSimilarSkillsByName()` also need this filter (they search all skills).

**Detection:** Submit a skill for review (pending status), then use conversational discovery to search for it by description. It should NOT appear.

**Phase:** Same phase as status column migration (for the filter) and conversational discovery (for the new search function).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Status column migration | Pitfall 1: Existing skills vanish or pending skills leak into listings | Use `DEFAULT 'published'`, update ALL 8 unguarded query paths |
| Status column migration | Pitfall 2: MCP bypasses pipeline | Update MCP raw SQL to include status column |
| Status column migration | Pitfall 5: Fork creates orphaned skill | Update fork action to set status and create version record |
| Status column migration | Pitfall 8: Skill detail page shows pending skills | Add status-aware access control to detail page |
| Review pipeline data model | Pitfall 3: Advisory review table reused for gating | Separate tables: advisory reviews vs pipeline decisions |
| Review pipeline logic | Pitfall 11: Race between AI review and admin action | State machine with clear transitions, optimistic locking |
| Review pipeline logic | Pitfall 13: Fire-and-forget in critical paths | Explicit error handling for pipeline AI review |
| Review notifications | Pitfall 4: Notification types not extensible | Group review notifications under two preference columns |
| Admin review UI | Pitfall 10: No pagination in review queue | Build with pagination from day one |
| Admin review UI | Pitfall 14: No reviewer role | Start with admin-only, defer reviewer role |
| Conversational discovery | Pitfall 6: Incompatible embedding models | Use same Ollama model for query and stored vectors |
| Conversational discovery | Pitfall 9: Conversation state bloat | Client-side state, sliding window, max turns |
| Conversational discovery | Pitfall 16: Vector search returns non-published skills | Add status filter to semantic search queries |
| Fork-on-modify detection | Pitfall 7: No parent hash at fork time | Add `forkedAtContentHash` column |
| All new code | Pitfall 15: Hardcoded tenant ID | Import from `@everyskill/db`, accept tenantId as parameter |
| All new code | Pitfall 12: Building on deprecated content column | Accept debt, build on `content` column |

---

## Sources

### Primary -- Direct Codebase Audit
- Schema: `packages/db/src/schema/skills.ts` (lines 32-84), `skill-reviews.ts` (lines 43-76), `notifications.ts` (lines 12-44), `notification-preferences.ts` (lines 17-46), `skill-embeddings.ts` (lines 35-67), `skill-versions.ts` (lines 11-42), `users.ts` (lines 14-41)
- Server actions: `apps/web/app/actions/skills.ts` (503 lines, checkAndCreateSkill + createSkill + autoGenerateReview), `ai-review.ts` (159 lines), `fork-skill.ts` (92 lines), `admin-skills.ts` (127 lines), `notifications.ts` (62 lines)
- Services: `packages/db/src/services/notifications.ts`, `skill-reviews.ts`, `skill-forks.ts`, `search-skills.ts`
- MCP tools: `apps/mcp/src/tools/create.ts` (272 lines -- raw SQL INSERT with immediate publish), `list.ts`, `search.ts`
- Query paths audited: `apps/web/lib/search-skills.ts`, `similar-skills.ts`, `trending.ts`, `leaderboard.ts`, `platform-stats.ts`, `user-stats.ts`, `my-leverage.ts`
- AI review: `apps/web/lib/ai-review.ts` (Anthropic SDK, JSON schema output, structured review generation)
- Embedding: `apps/web/lib/embedding-generator.ts` (Ollama, nomic-embed-text, fire-and-forget)
- Skill detail page: `apps/web/app/(protected)/skills/[slug]/page.tsx` (232 lines -- no status check, full render for all skills)

### External
- [Five problems with the traditional content review process](https://medium.com/@filestage/five-problems-with-the-traditional-content-review-process-and-how-to-fix-them-f4a2a7a27ad3) -- Content approval workflow pitfalls
- [Advanced Publishing Workflows | Payload CMS](https://payloadcms.com/enterprise/publishing-workflows) -- Pipeline state management patterns
- [Avoiding AI Pitfalls in 2026 -- ISACA](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents) -- AI reliability in production workflows
- [Modernising Publishing Workflows](https://www.thinslices.com/insights/modernising-publishing-workflows-for-performance-and-agility) -- Migration from instant-publish to approval workflows
