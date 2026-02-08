# Architecture Patterns

**Domain:** Skill marketplace ecosystem -- review pipeline, conversational MCP discovery, fork detection, admin review UI
**Researched:** 2026-02-08
**Confidence:** HIGH (based on direct codebase analysis of all referenced files)

## Current Architecture Snapshot

Before specifying new components, here is the verified state of what exists.

### Existing Data Layer (packages/db)

| Table | Key Columns | Relevant to v2.0 |
|-------|-------------|-------------------|
| `skills` | id, tenantId, name, slug, content, publishedVersionId, draftVersionId, forkedFromId, authorId, contentHash (via versions) | YES -- needs `status` column for review pipeline |
| `skill_versions` | id, skillId, version (sequential), contentHash, contentUrl, createdBy | YES -- contentHash is the fork-detection anchor |
| `skill_reviews` | id, skillId, requestedBy, categories (JSONB), summary, reviewedContentHash, modelName | YES -- currently author-initiated AI review only; needs admin review concept |
| `skill_embeddings` | id, skillId, embedding (vector 768d), inputHash | YES -- semantic search backbone for conversational discovery |
| `notifications` | id, userId, type, title, message, actionUrl, metadata, isRead | YES -- new notification types needed |
| `users` | id, tenantId, email, role (admin/member) | YES -- RBAC already exists |

### Existing MCP Tools (apps/mcp/src/tools/)

| Tool | Handler | Notes |
|------|---------|-------|
| `list_skills` | list.ts | Returns id, name, description, category, hoursSaved |
| `search_skills` | search.ts | ILIKE search with field-weighted relevance scoring |
| `deploy_skill` | deploy.ts | Fetches skill, injects frontmatter hooks, auto-saves to ~/.claude/skills/ |
| `create_skill` | create.ts | Creates skill + version, publishes immediately, auto-saves |
| `confirm_install` | confirm-install.ts | Post-install tracking |
| `log_skill_usage` | log-usage.ts | DEPRECATED -- PostToolUse hooks handle this |

### Existing Server Actions (apps/web/app/actions/)

| Action | File | Notes |
|--------|------|-------|
| `checkAndCreateSkill` | skills.ts | Similarity check + create + auto-review, publishes immediately |
| `requestAiReview` | ai-review.ts | Author-only, on-demand, advisory |
| `forkSkill` | fork-skill.ts | Creates copy with `forkedFromId` set |
| `getAdminSkills` / `deleteSkillAdminAction` / `bulkMergeSkillsAction` | admin-skills.ts | Admin skill management |

### Key Existing Patterns

1. **Raw SQL for MCP tools**: MCP tools use `db.execute(sql\`...\`)` due to node16 moduleResolution constraints. All new MCP tools must follow this pattern.
2. **Fire-and-forget side effects**: Embedding generation, AI review are non-blocking (`.catch(() => {})`).
3. **Content hashing**: `hashContent()` in `apps/web/lib/content-hash.ts` uses Web Crypto SHA-256. Same pattern in MCP `create.ts`. The `skill_versions.content_hash` column stores this.
4. **RBAC**: `isAdmin(session)` checks `session.user.role === "admin"`. Admin layout at `/admin/` with nav items.
5. **Tenant isolation**: RLS policies on every table. `DEFAULT_TENANT_ID` hardcoded. Connection-level `app.current_tenant_id`.
6. **Notification system**: `createNotification()` service, types: `grouping_proposal | trending_digest | platform_update`. Bell UI + Resend email.

---

## Recommended Architecture for v2.0

### Component Overview

```
                  MCP Client (Claude Code)
                       |
          +------------+-------------+
          |            |             |
   search_skills  recommend_skill  update_skill
   (enhanced)     (NEW)           (NEW)
          |            |             |
          +-----+------+----+-------+
                |            |
          Semantic Search   Fork Detection
          (pgvector)        (hash compare)
                |            |
                v            v
          +------------------+--------+
          |   packages/db             |
          |   skills table            |
          |   + status column (NEW)   |
          |   skill_versions table    |
          |   + contentHash           |
          +-----|---------------------+
                |
    +-----------+-----------+
    |                       |
Admin Review Queue      Author Notification
(NEW: /admin/review)    (review_decision type)
    |
    v
Approve/Reject/Request Changes
    |
    v
Status transition + notification dispatch
```

---

## Component Boundaries

### Component 1: Review Pipeline State Machine

**Responsibility:** Manage skill lifecycle status transitions with validation rules.
**Communicates with:** skills table (new `status` column), notification service, admin review queue.

#### Schema Change: Add `status` to `skills` table

```typescript
// New column on skills table
status: text("status").notNull().default("published"),
// Values: "draft" | "pending_review" | "ai_reviewed" | "approved" | "rejected" | "changes_requested" | "published"
```

**Why `text` not `pgEnum`:** The existing codebase uses `text` columns with application-layer validation for status fields (e.g., `skill_messages.status`, `notifications.type`). Only `users.role` uses `pgEnum`. Staying with `text` is consistent and avoids migration complexity when adding new states later.

**Why add to `skills` not a new table:** Status is an intrinsic property of the skill, read on every skill query (list, search, detail). A JOIN would add overhead for zero benefit. The `skill_reviews` table already has the AI review data; `status` is the workflow control field.

#### State Transitions

```
                  create_skill
                      |
                      v
                   [draft]
                      |
            author submits for review
                      |
                      v
               [pending_review]
                      |
            AI review runs automatically
                      |
                      v
                [ai_reviewed]
                      |
         +------------+------------+
         |            |            |
  admin approves  admin rejects  admin requests changes
         |            |            |
         v            v            v
    [approved]   [rejected]  [changes_requested]
         |                        |
  admin publishes        author resubmits
         |                        |
         v                        v
    [published]            [pending_review]
```

#### Transition Rules (Application Layer)

| From | To | Who | Trigger |
|------|----|-----|---------|
| (new) | draft | author | `create_skill` (MCP or web) |
| draft | pending_review | author | Submit for review |
| pending_review | ai_reviewed | system | Auto-runs after submission |
| ai_reviewed | approved | admin | Admin approves |
| ai_reviewed | rejected | admin | Admin rejects |
| ai_reviewed | changes_requested | admin | Admin requests changes |
| approved | published | admin | Admin publishes (or auto-publish if configured) |
| changes_requested | pending_review | author | Author resubmits |
| rejected | draft | author | Author revises |

**Implementation location:** New service `packages/db/src/services/skill-lifecycle.ts`

```typescript
// packages/db/src/services/skill-lifecycle.ts
export type SkillStatus =
  | "draft"
  | "pending_review"
  | "ai_reviewed"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "published";

const VALID_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["ai_reviewed"],
  ai_reviewed: ["approved", "rejected", "changes_requested"],
  approved: ["published"],
  rejected: ["draft"],
  changes_requested: ["pending_review"],
  published: ["pending_review"], // re-review after edit
};

export async function transitionSkillStatus(
  skillId: string,
  toStatus: SkillStatus,
  actorId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch current status
  // 2. Validate transition is legal
  // 3. Update skills.status
  // 4. Write audit log
  // 5. Dispatch notification to relevant party
}
```

#### Backward Compatibility

Existing skills have no `status` column. The migration must:
1. Add `status` column with default `"published"` (all existing skills are already published).
2. No data backfill needed -- the default handles it.
3. Existing queries (list, search, deploy) need a WHERE clause filter: `status = 'published'` for public-facing queries. Admin queries show all statuses.

**Impact on existing code:**
- `search_skills` (MCP + web): Add `WHERE status = 'published'` filter
- `list_skills` (MCP): Add `WHERE status = 'published'` filter
- `deploy_skill` (MCP): Add `WHERE status = 'published'` filter
- `getAdminSkills()`: Show all statuses, add status to returned fields
- `checkAndCreateSkill()`: Change to set `status = 'draft'` instead of auto-publishing

---

### Component 2: Admin Review Page

**Responsibility:** Queue-based admin interface for reviewing, approving, rejecting, and requesting changes on skills.
**Communicates with:** skill-lifecycle service, skill_reviews table (AI review data), skill_versions table (diff view), notification service.

#### Route Structure

```
apps/web/app/(protected)/admin/review/
  page.tsx          -- Review queue (list of pending skills)
  [skillId]/
    page.tsx        -- Individual review page (diff view, AI review summary, actions)
```

#### New Admin Nav Item

Add to `adminNavItems` in `apps/web/app/(protected)/admin/layout.tsx`:
```typescript
{ label: "Review", href: "/admin/review" },
```

#### Review Queue Page (`/admin/review`)

**Data source:** New server action `getReviewQueue()` in `apps/web/app/actions/admin-review.ts`.

```typescript
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  // SELECT from skills WHERE status IN ('pending_review', 'ai_reviewed')
  // JOIN skill_reviews for AI score summary
  // JOIN users for author name
  // ORDER BY: ai_reviewed first (ready for human), then pending_review, then by createdAt ASC
}
```

**UI columns:** Skill name, author, status, AI score (avg of quality/clarity/completeness), submitted date, action buttons.

#### Individual Review Page (`/admin/review/[skillId]`)

**Layout:**

```
+-----------------------------------------------+
| Skill: "Git PR Review Automation"              |
| Author: jane@acme.com | Submitted: Feb 8 2026 |
+-----------------------------------------------+
| AI Review Summary                              |
| Quality: 8/10 | Clarity: 7/10 | Complete: 9/10|
| "Well-structured workflow with clear steps..." |
+-----------------------------------------------+
| Content Diff (if resubmission)                 |
| [unified diff view of previous vs current]     |
+-----------------------------------------------+
| Admin Notes (optional textarea)                |
| [                                            ] |
+-----------------------------------------------+
| [Approve] [Reject] [Request Changes]           |
+-----------------------------------------------+
```

**Diff view:** Compare `skill_versions` entries. For first submission, show content only (no diff). For resubmissions after `changes_requested`, diff the previous version against the new submission.

#### New Server Actions (`apps/web/app/actions/admin-review.ts`)

```typescript
export async function approveSkill(skillId: string, notes?: string): Promise<void>
export async function rejectSkill(skillId: string, reason: string): Promise<void>
export async function requestChanges(skillId: string, feedback: string): Promise<void>
```

Each action:
1. Validates admin role via `isAdmin(session)`
2. Calls `transitionSkillStatus()`
3. Dispatches notification to skill author
4. Writes audit log entry
5. `revalidatePath("/admin/review")`

---

### Component 3: Conversational MCP Discovery

**Responsibility:** Multi-turn semantic search with recommend, describe, install, guide flow.
**Communicates with:** skill_embeddings (pgvector), skills table, deploy_skill handler.

#### New MCP Tool: `recommend_skill`

**Purpose:** Semantic search using pgvector embeddings, returning richer results than `search_skills` (which uses ILIKE).

```typescript
// apps/mcp/src/tools/recommend.ts
server.registerTool("recommend_skill", {
  description: "Find skills semantically similar to a description of what you need. " +
    "Better than search_skills for vague or conceptual queries. " +
    "Returns skills ranked by relevance with similarity scores.",
  inputSchema: {
    description: z.string().min(5).describe(
      "Describe what you're trying to accomplish (e.g., 'automate code review feedback')"
    ),
    category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional(),
    limit: z.number().min(1).max(10).default(5),
  },
});
```

**Implementation approach:** Reuse the existing `trySemanticSearch()` logic from `apps/web/lib/similar-skills.ts`, but adapted for MCP's raw SQL pattern.

```typescript
// Core query (raw SQL for MCP compatibility)
const results = await db.execute(sql`
  SELECT s.id, s.name, s.slug, s.description, s.category, s.hours_saved,
         s.total_uses, s.average_rating,
         ROUND(100 * (1 - (se.embedding <=> ${vectorStr}::vector) / 2))::int AS similarity_pct
  FROM skill_embeddings se
  JOIN skills s ON s.id = se.skill_id
  WHERE s.status = 'published'
    AND (se.embedding <=> ${vectorStr}::vector) < ${threshold}
  ORDER BY se.embedding <=> ${vectorStr}::vector
  LIMIT ${limit}
`);
```

**Embedding generation in MCP context:** The MCP server currently has no embedding generation capability. Options:

1. **Call Ollama from MCP** (recommended): The MCP server runs on the same host as Ollama. Port the `generateEmbedding()` function from `apps/web/lib/ollama.ts` into `apps/mcp/src/lib/embedding.ts`. This avoids an HTTP round-trip to the web server.

2. **Call web API endpoint**: Add an `/api/embed` endpoint. Adds HTTP latency and auth complexity.

**Recommendation:** Option 1. The MCP server already imports from `@everyskill/db` and has direct DB access. Adding an Ollama client is trivial -- it is a single `fetch()` call.

**Ollama config for MCP:** The Ollama URL and model are stored in `site_settings` table. The MCP server can read these via `getSiteSettings()` from `@everyskill/db`.

#### Enhanced `search_skills`

The existing `search_skills` tool uses ILIKE. Enhance it to try semantic search first (like `checkSimilarSkills` does on the web side), falling back to ILIKE.

```typescript
// Modified search.ts handler
export async function handleSearchSkills({ query, category, limit, userId, skipNudge }) {
  // 1. Try semantic search first (if Ollama available + enabled)
  const semanticResults = await trySemanticSearch(query, category, limit);
  if (semanticResults && semanticResults.length > 0) {
    // Return with matchType: "semantic" and similarity scores
    return formatResults(semanticResults, query, "semantic");
  }

  // 2. Fall back to existing ILIKE search
  const results = await searchSkillsByQuery({ query, category, limit, tenantId });
  return formatResults(results, query, "text");
}
```

#### Conversational Flow (Multi-Turn)

MCP tools are stateless by design. Multi-turn conversation is managed by the LLM (Claude), not the MCP server. The architecture pattern:

```
User: "I need help with code review automation"
  -> Claude calls recommend_skill(description: "code review automation")
  -> MCP returns top 5 matches with descriptions

User: "Tell me more about the first one"
  -> Claude already has the skill ID from previous response
  -> Claude constructs response from cached data in context

User: "Install it"
  -> Claude calls deploy_skill(skillId: "<id from earlier>")
  -> MCP saves file locally

User: "How do I use it?"
  -> Claude reads the installed skill file from ~/.claude/skills/<slug>.md
  -> Claude provides usage guidance based on skill content
```

**No server-side session state needed.** Claude maintains conversation context. Each MCP call is independent and idempotent.

---

### Component 4: Fork-on-Modify Detection

**Responsibility:** When a user modifies a locally-installed skill, detect the modification and offer to fork or push an update.
**Communicates with:** skill_versions (contentHash), MCP tools, fork creation flow.

#### Detection Mechanism

The skill file on disk includes frontmatter with `everyskill_skill_id`. When a user modifies it:

1. User runs the MCP tool (e.g., `update_skill` or a new `check_skill` tool).
2. MCP reads the local file, extracts `everyskill_skill_id` from frontmatter.
3. MCP hashes the local file content (stripping frontmatter) using SHA-256.
4. MCP queries the DB for the skill's latest `content_hash` from `skill_versions`.
5. If hashes differ, the skill has been modified locally.

#### New MCP Tool: `update_skill`

```typescript
// apps/mcp/src/tools/update.ts
server.registerTool("update_skill", {
  description: "Push local modifications to a skill back to EverySkill. " +
    "Reads the skill file from disk, detects changes via hash comparison, " +
    "and creates either an update (if you're the author) or a fork (if you're not).",
  inputSchema: {
    filePath: z.string().describe("Path to the modified skill file"),
  },
});
```

**Handler flow:**

```typescript
async function handleUpdateSkill({ filePath, userId }) {
  // 1. Read file from disk
  const content = fs.readFileSync(filePath, "utf-8");

  // 2. Extract skill ID from frontmatter
  const skillId = extractFrontmatterField(content, "everyskill_skill_id");
  if (!skillId) return error("No everyskill_skill_id in frontmatter");

  // 3. Strip frontmatter for hashing
  const rawContent = stripFrontmatter(content);
  const localHash = await hashContent(rawContent);

  // 4. Fetch remote skill and latest version hash
  const skill = await db.execute(sql`
    SELECT s.id, s.author_id, s.name, s.slug, s.status,
           sv.content_hash AS remote_hash
    FROM skills s
    LEFT JOIN skill_versions sv ON sv.id = s.published_version_id
    WHERE s.id = ${skillId}
  `);

  if (!skill[0]) return error("Skill not found in marketplace");

  // 5. Compare hashes
  if (localHash === skill[0].remote_hash) {
    return { message: "Skill is up to date, no changes detected" };
  }

  // 6. Determine action: update or fork
  if (skill[0].author_id === userId) {
    // Author: create new version + submit for review
    return createNewVersion(skillId, rawContent, userId);
  } else {
    // Non-author: offer fork
    return offerFork(skillId, skill[0].name, rawContent, userId);
  }
}
```

**Author update path:**
1. Create new `skill_versions` entry with incremented version number.
2. Upload content to R2 (if configured).
3. Set `skills.draftVersionId` to new version.
4. Transition status to `pending_review` (if review pipeline enabled).
5. Return success message with skill URL.

**Non-author fork path:**
1. Create new skill with `forkedFromId = originalSkillId`.
2. Copy content, set author to current user.
3. Start in `draft` status.
4. Return fork URL + message explaining the fork.

#### New MCP Tool: `check_skill_status`

Lightweight tool to check if a local skill file has diverged from the marketplace version.

```typescript
server.registerTool("check_skill_status", {
  description: "Check if a locally installed skill has been modified compared to the marketplace version.",
  inputSchema: {
    filePath: z.string().describe("Path to the skill file to check"),
  },
});
```

Returns: `{ modified: boolean, localHash, remoteHash, isAuthor, canUpdate, canFork }`.

---

### Component 5: Notification Integration

**Responsibility:** Dispatch notifications for review pipeline events.
**Communicates with:** notification service, notification_preferences service.

#### New Notification Types

Add to the `notifications.type` domain:

| Type | Recipient | When |
|------|-----------|------|
| `review_submitted` | all admins | Author submits skill for review |
| `review_approved` | skill author | Admin approves |
| `review_rejected` | skill author | Admin rejects (includes reason) |
| `changes_requested` | skill author | Admin requests changes (includes feedback) |
| `skill_published` | skill author | Admin publishes approved skill |

**Implementation:** Extend `CreateNotificationParams.type` union in `packages/db/src/services/notifications.ts`:

```typescript
export type NotificationType =
  | "grouping_proposal"
  | "trending_digest"
  | "platform_update"
  | "review_submitted"
  | "review_approved"
  | "review_rejected"
  | "changes_requested"
  | "skill_published";
```

**Admin notification dispatch:** When a skill is submitted for review, find all users with `role = 'admin'` in the tenant and create a notification for each. This uses existing `getUserNotifications` infrastructure -- no new service needed.

---

## Data Flow Changes

### Current Flow: Skill Creation

```
Author -> checkAndCreateSkill() -> INSERT skills (published immediately)
                                -> INSERT skill_versions
                                -> Upload to R2
                                -> Fire-and-forget: embedding + AI review
```

### New Flow: Skill Creation with Review Pipeline

```
Author -> checkAndCreateSkill() -> INSERT skills (status = 'draft')
                                -> INSERT skill_versions (v1)
                                -> Upload to R2
                                -> Fire-and-forget: embedding
       -> submitForReview()     -> UPDATE skills SET status = 'pending_review'
                                -> Notify admins (review_submitted)
                                -> Fire-and-forget: AI review
       [AI review completes]    -> UPDATE skills SET status = 'ai_reviewed'
       [Admin reviews]          -> UPDATE skills SET status = 'approved'/'rejected'/'changes_requested'
                                -> Notify author
       [Admin publishes]        -> UPDATE skills SET status = 'published', publishedVersionId = latest
                                -> Notify author (skill_published)
```

### Current Flow: MCP Skill Search

```
Claude -> search_skills(query) -> ILIKE search -> return results
```

### New Flow: MCP Semantic Search

```
Claude -> search_skills(query) -> Ollama embed(query) -> pgvector cosine search
                                  (fallback: ILIKE)    -> return results + similarity %
       -> recommend_skill(desc) -> Ollama embed(desc) -> pgvector cosine search
                                                       -> return ranked results
```

### Current Flow: MCP Create Skill

```
Claude -> create_skill(data) -> INSERT skills (published immediately)
                              -> INSERT skill_versions
                              -> Auto-save to ~/.claude/skills/
```

### New Flow: MCP Create + Update

```
Claude -> create_skill(data) -> INSERT skills (status = 'draft')
                              -> INSERT skill_versions
                              -> Auto-save to ~/.claude/skills/
       -> update_skill(path) -> Read local file
                              -> Hash comparison against skill_versions.content_hash
                              -> If author: new version + submit for review
                              -> If not author: create fork
```

---

## Integration Points (New vs Modified)

### New Files

| File | Type | Purpose |
|------|------|---------|
| `packages/db/src/services/skill-lifecycle.ts` | Service | State machine for skill status transitions |
| `apps/mcp/src/tools/recommend.ts` | MCP Tool | Semantic search via pgvector |
| `apps/mcp/src/tools/update.ts` | MCP Tool | Push local modifications back |
| `apps/mcp/src/tools/check-status.ts` | MCP Tool | Check local vs remote hash |
| `apps/mcp/src/lib/embedding.ts` | Library | Ollama client for MCP context |
| `apps/web/app/actions/admin-review.ts` | Server Action | Admin review queue + actions |
| `apps/web/app/(protected)/admin/review/page.tsx` | Page | Review queue UI |
| `apps/web/app/(protected)/admin/review/[skillId]/page.tsx` | Page | Individual review page |
| `apps/web/components/review-queue-table.tsx` | Component | Review queue data table |
| `apps/web/components/review-detail.tsx` | Component | Review detail with diff view |
| DB migration | Migration | Add `status` column to skills |

### Modified Files

| File | Change | Reason |
|------|--------|--------|
| `packages/db/src/schema/skills.ts` | Add `status` column | Review pipeline status tracking |
| `packages/db/src/services/notifications.ts` | Extend type union | New notification types |
| `apps/mcp/src/tools/index.ts` | Import new tools | Register recommend, update, check-status |
| `apps/mcp/src/tools/search.ts` | Add semantic search path | Enhanced search with embedding fallback |
| `apps/mcp/src/tools/create.ts` | Change default status | Skills created as `draft` instead of published |
| `apps/mcp/src/tools/deploy.ts` | Add status filter | Only deploy `published` skills |
| `apps/mcp/src/tools/list.ts` | Add status filter | Only list `published` skills |
| `apps/web/app/actions/skills.ts` | Change default status | Create as `draft`, add `submitForReview` action |
| `apps/web/app/(protected)/admin/layout.tsx` | Add nav item | "Review" link in admin nav |
| `packages/db/src/relations/index.ts` | No change needed | Existing relations cover the needs |

---

## Patterns to Follow

### Pattern 1: State Machine as Pure Functions

**What:** Define valid transitions as a data structure, validate before executing.
**When:** Any status field with constrained transitions.
**Example:**

```typescript
// packages/db/src/services/skill-lifecycle.ts
const VALID_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["ai_reviewed"],
  ai_reviewed: ["approved", "rejected", "changes_requested"],
  approved: ["published"],
  rejected: ["draft"],
  changes_requested: ["pending_review"],
  published: ["pending_review"],
};

export function canTransition(from: SkillStatus, to: SkillStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

**Why:** Prevents invalid state, makes rules auditable, easy to test.

### Pattern 2: MCP Tools Use Raw SQL

**What:** All MCP tool database queries use `db.execute(sql\`...\`)`, not Drizzle query builder.
**When:** Any code in `apps/mcp/src/`.
**Why:** node16 moduleResolution prevents importing Drizzle schema objects in some paths. Existing MCP tools follow this pattern. Consistency prevents subtle import errors.

### Pattern 3: Fire-and-Forget for Non-Critical Side Effects

**What:** Embedding generation, AI review, notification dispatch use `.catch(() => {})`.
**When:** Side effects that should not block the primary operation.
**Example:**

```typescript
// After creating skill version
generateSkillEmbedding(skillId, name, description).catch(() => {});
autoGenerateReview(skillId, name, description, content, category, userId, tenantId).catch(() => {});
notifyAdminsOfSubmission(skillId, tenantId).catch(() => {});
```

**Why:** Existing pattern throughout the codebase. Skill creation must never fail because Ollama is down or notification dispatch throws.

### Pattern 4: Admin Guard at Action Level

**What:** Every admin action validates `isAdmin(session)` at the top. Page-level guards redirect.
**When:** Any admin-only functionality.
**Example:**

```typescript
// Server action
export async function approveSkill(skillId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }
  // ... action logic
}

// Page component
export default async function ReviewPage() {
  const session = await auth();
  if (!isAdmin(session)) redirect("/");
  // ... page rendering
}
```

### Pattern 5: Notification Dispatch Helper

**What:** Centralize notification creation for review events in a single helper.
**When:** Any review status transition.
**Example:**

```typescript
// packages/db/src/services/skill-lifecycle.ts or apps/web/lib/review-notifications.ts
export async function notifyReviewEvent(
  event: "submitted" | "approved" | "rejected" | "changes_requested" | "published",
  skillId: string,
  skillName: string,
  tenantId: string,
  recipientId: string,
  adminNote?: string
): Promise<void> {
  const templates = {
    submitted: {
      title: `New skill for review: ${skillName}`,
      message: `A skill "${skillName}" has been submitted for review.`,
      type: "review_submitted" as const,
    },
    approved: {
      title: `Skill approved: ${skillName}`,
      message: `Your skill "${skillName}" has been approved.${adminNote ? ` Note: ${adminNote}` : ""}`,
      type: "review_approved" as const,
    },
    // ... etc
  };

  await createNotification({
    tenantId,
    userId: recipientId,
    ...templates[event],
    actionUrl: `/skills/${skillId}`,
  });
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Review Pipeline State in skill_reviews

**What:** Using the `skill_reviews` table to track review pipeline state.
**Why bad:** `skill_reviews` is for AI-generated quality reviews (scores, suggestions). The review pipeline status is a workflow state machine concern. Conflating them makes queries complex and semantics ambiguous. Is `skill_reviews` empty because no AI review ran, or because no admin review happened?
**Instead:** Add `status` to `skills` table. Keep `skill_reviews` for AI review data only. Admin review decisions are captured as status transitions + audit log entries + optional admin notes (in notifications metadata or a new `admin_review_notes` text column).

### Anti-Pattern 2: Server-Side MCP Session State

**What:** Maintaining conversation context in the MCP server for multi-turn discovery.
**Why bad:** MCP tools are stateless by design. Adding session state creates complexity (session cleanup, memory leaks, race conditions) with zero benefit, because the LLM already maintains conversation context.
**Instead:** Return rich enough data in each tool response that the LLM can reference previous results. Include skill IDs, names, and descriptions in every response so Claude can construct follow-up tool calls.

### Anti-Pattern 3: Blocking Skill Creation on Review Pipeline

**What:** Making `create_skill` (MCP) wait for AI review or admin approval before returning.
**Why bad:** MCP tool calls should complete quickly. An AI review takes 5-10 seconds, admin review takes hours/days.
**Instead:** Create skill synchronously, start review pipeline asynchronously. Return immediately with status `draft` and a message explaining next steps.

### Anti-Pattern 4: Hash Comparison on Frontmatter-Included Content

**What:** Hashing the full file content (including frontmatter) for fork detection.
**Why bad:** Frontmatter contains metadata that changes between installs (tracking URLs, etc). Two identical skill contents with different frontmatter would appear as different.
**Instead:** Always strip frontmatter before hashing. The existing `stripFrontmatter()` function handles this. The `skill_versions.content_hash` should be the hash of content WITHOUT frontmatter.

**IMPORTANT NOTE:** The current `create.ts` MCP tool hashes content WITH frontmatter (`contentWithFrontmatter`). This is a latent bug that must be fixed as part of the fork-detection work. All content hashes should use stripped content.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Review queue | Single page, admin checks manually | Filter by status, sort by date, paginate | Queue routing, multiple reviewers, SLA tracking |
| Semantic search | Ollama local, <50ms per query | Ollama with GPU, HNSW index tuning | Dedicated vector DB (Pinecone/Weaviate), cached embeddings |
| Fork detection | Hash compare per tool call | Same -- O(1) lookup | Same -- indexed hash comparison |
| Notifications | Direct DB insert | Batch notification dispatch | Message queue (Redis/SQS), async workers |
| Admin review | Single admin per tenant | RBAC roles: reviewer vs admin | Review assignment, load balancing |

---

## Migration Strategy

### Database Migration

Single migration file: `packages/db/src/migrations/XXXX-add-skill-status.ts`

```sql
ALTER TABLE skills ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
CREATE INDEX skills_status_idx ON skills (status);
CREATE INDEX skills_tenant_status_idx ON skills (tenant_id, status);
```

**Default `'published'`** ensures all existing skills remain visible. New skills will be created with explicit `'draft'` status by updated code.

### Backward Compatibility for MCP Clients

Existing MCP clients using `create_skill` will get skills created as `draft` instead of `published`. The tool response should clearly communicate this:

```json
{
  "success": true,
  "skill": { "id": "...", "status": "draft" },
  "message": "Skill created as draft. Submit for review to make it available in the marketplace.",
  "nextStep": "Use the submit_for_review action or visit the web UI to submit."
}
```

**Feature flag consideration:** For a gradual rollout, add a `reviewPipelineEnabled` boolean to `site_settings`. When false, `create_skill` continues to publish immediately. When true, new skills start as `draft`. This allows per-tenant opt-in.

---

## Suggested Build Order

Based on dependency analysis:

### Phase 1: Review Pipeline Foundation
1. **DB migration** -- Add `status` column to skills (blocks everything)
2. **skill-lifecycle.ts service** -- State machine logic (blocks admin review)
3. **Update existing queries** -- Add `status = 'published'` filters to search/list/deploy (blocks nothing, but critical for correctness once status exists)

### Phase 2: Admin Review UI
4. **admin-review.ts server actions** -- getReviewQueue, approveSkill, rejectSkill, requestChanges (depends on Phase 1)
5. **Admin review page + components** -- Queue + detail pages (depends on actions)
6. **Notification dispatch for review events** -- Extend notification types (depends on lifecycle service)

### Phase 3: MCP Enhancements
7. **recommend_skill MCP tool** -- Semantic search (depends on nothing new, uses existing embeddings)
8. **Enhanced search_skills** -- Add semantic search path (depends on recommend_skill's embedding logic)
9. **update_skill MCP tool** -- Fork detection + push changes (depends on Phase 1 for draft status)
10. **check_skill_status MCP tool** -- Lightweight hash comparison (depends on update_skill patterns)
11. **Update create_skill** -- Create as draft, review pipeline integration (depends on Phase 1)

### Phase 4: Integration Polish
12. **Author notification UX** -- Review decision modal/page (depends on Phase 2 notifications)
13. **Feature flag** -- reviewPipelineEnabled in site_settings (depends on Phase 1)

**Rationale for ordering:**
- Phase 1 is the foundation -- without `status`, nothing else works correctly.
- Phase 2 builds the admin side -- without a way to approve/reject, the pipeline is incomplete.
- Phase 3 adds MCP tools -- these can work independently of the admin UI (a skill can be created as draft even without admin review capability, though it would be stuck).
- Phase 4 polishes the integration points and adds configuration.

---

## Sources

- All findings based on direct codebase analysis of the following files:
  - `packages/db/src/schema/skills.ts` -- skills table with publishedVersionId, draftVersionId, forkedFromId
  - `packages/db/src/schema/skill-versions.ts` -- contentHash column for integrity
  - `packages/db/src/schema/skill-reviews.ts` -- AI review categories, reviewedContentHash
  - `packages/db/src/schema/skill-embeddings.ts` -- pgvector 768d, HNSW index
  - `packages/db/src/schema/notifications.ts` -- type, actionUrl, metadata
  - `packages/db/src/schema/users.ts` -- role: admin/member enum
  - `packages/db/src/services/skill-reviews.ts` -- upsertSkillReview, getSkillReview
  - `packages/db/src/services/skill-forks.ts` -- getForkCount, getTopForks, getParentSkill
  - `packages/db/src/services/search-skills.ts` -- ILIKE search with relevance scoring
  - `packages/db/src/services/notifications.ts` -- createNotification, getUserNotifications
  - `packages/db/src/services/skill-embeddings.ts` -- upsertSkillEmbedding
  - `packages/db/src/services/skill-merge.ts` -- merge skills transaction
  - `packages/db/src/client.ts` -- DEFAULT_TENANT_ID, connection-level RLS
  - `packages/db/src/relations/index.ts` -- all relation definitions
  - `apps/mcp/src/tools/*.ts` -- all 6 existing MCP tools
  - `apps/mcp/src/auth.ts` -- userId/tenantId resolution from API key
  - `apps/mcp/src/server.ts` -- McpServer instance, suggest_skills prompt
  - `apps/mcp/src/tracking/events.ts` -- usage tracking
  - `apps/web/app/actions/skills.ts` -- checkAndCreateSkill, createSkill
  - `apps/web/app/actions/ai-review.ts` -- requestAiReview
  - `apps/web/app/actions/fork-skill.ts` -- forkSkill
  - `apps/web/app/actions/admin-skills.ts` -- getAdminSkills, deleteSkillAdminAction
  - `apps/web/app/actions/notifications.ts` -- getMyNotifications, markRead
  - `apps/web/app/(protected)/admin/layout.tsx` -- admin nav items
  - `apps/web/app/(protected)/admin/skills/page.tsx` -- admin skills page
  - `apps/web/middleware.ts` -- subdomain routing, auth check
  - `apps/web/lib/admin.ts` -- isAdmin check
  - `apps/web/lib/ai-review.ts` -- Anthropic SDK, structured output review
  - `apps/web/lib/content-hash.ts` -- SHA-256 hashing
  - `apps/web/lib/embedding-generator.ts` -- Ollama integration
  - `apps/web/lib/similar-skills.ts` -- semantic + ILIKE similarity search
  - `apps/web/lib/ollama.ts` -- Ollama API client
