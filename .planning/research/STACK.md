# Stack Research: v2.0 Skill Ecosystem Features

**Domain:** Review pipeline, conversational MCP discovery, fork-on-modify detection, admin review UI
**Researched:** 2026-02-08
**Confidence:** HIGH
**Scope:** Stack ADDITIONS only. Existing stack validated and unchanged (Next.js 16.1.6, PostgreSQL + pgvector, Drizzle ORM 0.42.0, Auth.js v5, MCP SDK 1.25.3, Anthropic SDK 0.72.1, Resend, Recharts, Playwright, vitest).

---

## Executive Summary

The v2.0 Skill Ecosystem features require **zero new npm dependencies**. Every capability maps directly onto existing stack components:

1. **Review Pipeline** (AI review -> author revision -> admin approval): Extends existing `skillReviews` table with status workflow, uses existing Anthropic SDK (`@anthropic-ai/sdk@0.72.1`) with `output_config.format.type: "json_schema"` (already working in `lib/ai-review.ts`), and existing notification + Resend email infrastructure.

2. **Conversational MCP Discovery** (semantic search -> recommend -> describe -> install -> guide): New MCP tools registered via existing `server.registerTool()` API in `@modelcontextprotocol/sdk@1.25.3`. Semantic search reuses the existing `skill_embeddings` table with pgvector HNSW index and Ollama/Voyage AI embedding pipeline.

3. **Fork-on-Modify Detection** (hash comparison MCP tool + web UI): New MCP tool using existing `content_hash` from `skill_versions` table. Web UI comparison page uses existing Next.js server actions + Tailwind CSS. No diff library needed -- SHA-256 hash comparison (already in `lib/content-hash.ts`) detects drift; content display is side-by-side text, not a character-level diff.

4. **Admin Review Page**: Extends existing admin layout (`/admin/` with role-based access via `isAdmin(session)`) with a new "Reviews" tab. Uses existing `nuqs` for URL state management and server actions pattern.

**Total new npm dependencies: ZERO.**

---

## Recommended Stack (No Changes)

### Existing Components Used As-Is

| Technology | Installed Version | v2.0 Feature Usage | Notes |
|------------|-------------------|---------------------|-------|
| `@anthropic-ai/sdk` | 0.72.1 | AI review generation with structured JSON output | `output_config.format` already working in `lib/ai-review.ts`. Same pattern for review pipeline. Latest available is 0.73.0 -- no breaking changes, update optional |
| `@modelcontextprotocol/sdk` | 1.25.3 | New tools: `recommend_skills`, `describe_skill`, `check_skill_drift` | `server.registerTool()` + `server.registerPrompt()` APIs used extensively. Latest available is 1.26.0 -- minor patch, update optional |
| `drizzle-orm` | 0.42.0 | Schema additions (review status columns, admin queries) | Stable. Latest available is 0.45.1 but 0.42.0 is proven in this codebase with 14 tables. No new features needed |
| `next` | 16.1.6 | New admin pages, review UI components, server actions | All v2.0 web features are standard Next.js App Router patterns |
| `zod` | 3.25.76 | Input validation for new MCP tools and server actions | Already used in all MCP tools and AI review schemas |
| `resend` | 6.9.1 | Email notifications for review status changes | Notification dispatch infrastructure built in Phase 33 |
| `nuqs` | 2.8.7 | URL state for admin review filters (status, date range) | Already used in analytics pages |
| PostgreSQL + pgvector | Installed with HNSW index | Semantic search for conversational discovery | `skill_embeddings` table with 768-dim vectors and cosine similarity already indexed |
| `crypto.subtle` | Web Crypto (built-in) | Content hash comparison for fork drift detection | `hashContent()` in `lib/content-hash.ts` already uses SHA-256 |

### Why No Version Bumps Are Needed

- **Anthropic SDK 0.72.1 vs 0.73.0**: The 0.73.0 release (2 days ago) is a patch. The `output_config.format.type: "json_schema"` feature used for AI reviews has been stable since 0.70.x. No functional difference for our use case.
- **MCP SDK 1.25.3 vs 1.26.0**: The 1.26.0 release (4 days ago) is a minor patch. `registerTool()` and `registerPrompt()` APIs are unchanged. v2 anticipated for Q1 2026 but v1.x remains the recommended production version.
- **Drizzle ORM 0.42.0 vs 0.45.1**: 0.45.1 includes RLS improvements and minor fixes. None are needed -- we use `pgPolicy` definitions (stable since 0.42.0) and standard CRUD queries. Upgrading mid-milestone risks regressions.

---

## Feature-by-Feature Stack Mapping

### Feature 1: Review Pipeline (AI Review -> Author Revision -> Admin Approval)

**What exists today:**
- `skill_reviews` table with AI-generated scores (quality/clarity/completeness), summary, suggestedDescription
- `lib/ai-review.ts` generates reviews via Anthropic `messages.create()` with JSON schema output
- `actions/ai-review.ts` server action: author requests review, content hash prevents duplicate reviews
- Reviews are advisory-only, one per skill, author can hide/show

**What needs to change (schema only, no new packages):**

| Change | Implementation | Using |
|--------|---------------|-------|
| Add `status` column to `skill_reviews` | `text("status").notNull().default("pending")` -- values: `pending`, `ai_reviewed`, `author_revised`, `approved`, `rejected` | Drizzle schema + migration |
| Add `adminReviewerId` column | `text("admin_reviewer_id").references(() => users.id)` | Drizzle schema |
| Add `adminNotes` column | `text("admin_notes")` -- admin's feedback when requesting revision | Drizzle schema |
| Add `reviewedAt` / `approvedAt` timestamps | Standard timestamp columns | Drizzle schema |
| Status transition server actions | `approveSkillReview()`, `rejectSkillReview()`, `requestRevision()` | Next.js server actions + `isAdmin(session)` guard |
| Notification on status change | `createNotification()` + `sendNotificationEmail()` | Existing notification + Resend infrastructure |
| AI review prompt enhancement | Add "admin perspective" scoring context to system prompt | Existing `lib/ai-review.ts` -- modify SYSTEM_PROMPT string |

**Why no state machine library (e.g., xstate, robot3):**
The review workflow has 5 states and ~6 transitions. A simple `switch` statement or lookup table in a server action handles this. XState adds 15KB+ for a linear workflow that doesn't need parallel states, guards, or history. The transitions are:
```
pending -> ai_reviewed (automatic after AI generates review)
ai_reviewed -> approved (admin approves)
ai_reviewed -> rejected (admin rejects with notes)
ai_reviewed -> author_revised (admin requests changes, author resubmits)
author_revised -> ai_reviewed (re-review on new content)
approved -> ai_reviewed (content changes after approval trigger re-review)
```

### Feature 2: Conversational MCP Discovery

**What exists today:**
- `search_skills` MCP tool: ILIKE text search across name/description/author/tags
- `list_skills` MCP tool: list all skills with optional category filter
- `deploy_skill` MCP tool: deploy skill to `~/.claude/skills/`
- `suggest_skills` MCP prompt: generic prompt to search and present results
- Semantic search via pgvector in `lib/similar-skills.ts` (web app only, NOT in MCP server)
- Ollama embedding generation via `lib/ollama.ts`

**What needs to be added (new MCP tools, no new packages):**

| New Tool | Purpose | Implementation |
|----------|---------|----------------|
| `recommend_skills` | Semantic similarity search from natural language | New tool in `apps/mcp/src/tools/recommend.ts`. Calls Ollama `/api/embed`, then SQL cosine similarity query against `skill_embeddings`. Reuses exact pattern from `lib/similar-skills.ts` `trySemanticSearch()` |
| `describe_skill` | Get full details of a skill before installing | New tool in `apps/mcp/src/tools/describe.ts`. Returns full skill metadata + content + review scores + similar skills. Single DB query with joins |
| `guide_skill` | Return usage guidance after installation | New tool in `apps/mcp/src/tools/guide.ts`. Returns skill content with contextual instructions. Simple DB fetch + formatted response |

**Why add `recommend_skills` instead of enhancing `search_skills`:**
- `search_skills` is ILIKE-based text matching (fast, always works, no model dependency)
- `recommend_skills` is semantic vector search (requires Ollama/embedding model running)
- Keeping them separate means semantic search failure doesn't break basic text search
- The MCP client (Claude) can try `recommend_skills` first, fall back to `search_skills`

**Semantic search in MCP server -- key integration point:**
The `recommend_skills` tool needs access to the Ollama embedding endpoint. Currently, embedding generation is in `apps/web/lib/ollama.ts` (web-only). For the MCP server:
- Option A: Duplicate the ~15-line `generateEmbedding()` function into `apps/mcp/src/lib/ollama.ts` (self-contained, no cross-package import issues)
- Option B: Move to `packages/db/src/services/` as a shared service
- **Recommendation: Option A** (duplicate). The MCP server is a standalone binary (`tsup` bundled). Cross-package imports of fetch-based code work but add build complexity. The function is tiny.

**MCP Prompt enhancement:**
The existing `suggest_skills` prompt can be enhanced with a multi-step instruction that guides the LLM through: recommend -> describe -> deploy -> guide. This is a prompt text change, not a code change.

### Feature 3: Fork-on-Modify Detection

**What exists today:**
- `skills.forkedFromId` column tracks parent-child fork relationships
- `skill_versions.contentHash` stores SHA-256 hash of content at each version
- `lib/content-hash.ts` has `hashContent()` using Web Crypto API
- `skill-forks.ts` service: `getForkCount()`, `getTopForks()`, `getParentSkill()`
- Fork UI shows fork count and parent link on skill detail page

**What needs to be added (no new packages):**

| Change | Implementation | Using |
|--------|---------------|-------|
| `check_skill_drift` MCP tool | Compare installed skill's content hash against latest published hash in DB | New tool in `apps/mcp/src/tools/check-drift.ts`. Takes `skillId` + local content hash. Returns drift status + changed fields |
| Content hash in deploy response | Include `contentHash` in `deploy_skill` response so MCP client can track it | Modify existing `apps/mcp/src/tools/deploy.ts` to include hash in response payload |
| Fork drift indicator on web UI | Badge on skill detail page showing "upstream changed" | Server component comparing `contentHash` of fork's published version vs parent's published version. Pure SQL query |
| "View Changes" comparison page | Side-by-side view of fork content vs parent content | New Next.js page at `/skills/[slug]/compare`. Server component fetches both contents. Tailwind CSS grid for side-by-side |

**Why no diff library (e.g., diff, diff2html, jsdiff):**
Fork drift detection answers "has it changed?" (boolean), not "what exactly changed?" (character-level diff). The use case is:
1. User installs a skill via MCP
2. User modifies it locally
3. `check_skill_drift` compares content hashes: match = no drift, mismatch = drift detected
4. If drift detected, tool returns link to web UI comparison page
5. Web UI shows full text of both versions side-by-side (not a diff)

Character-level diffing is a Phase 3+ enhancement if user research shows it's needed. For v2.0, side-by-side content display is sufficient and requires zero dependencies.

### Feature 4: Admin Review Page

**What exists today:**
- Admin layout at `/admin/` with tabs: Settings, Skills, Merge, API Keys, Compliance
- `isAdmin(session)` guard in `lib/admin.ts`
- `adminNavItems` array in admin layout (easy to extend)
- Admin skills table component (`AdminSkillsTable`)
- `nuqs` for URL state in admin pages

**What needs to be added (no new packages):**

| Change | Implementation | Using |
|--------|---------------|-------|
| "Reviews" tab in admin nav | Add `{ label: "Reviews", href: "/admin/reviews" }` to `adminNavItems` | Existing admin layout pattern |
| `/admin/reviews` page | Server component listing skills with pending/in-review status | Next.js page + Drizzle query joining `skill_reviews` with `skills` and `users` |
| Review detail panel | Click-to-expand showing AI scores, author content, admin actions | Client component with existing Tailwind patterns |
| Filter by status | `nuqs` searchParams for status filter | Existing `nuqs` pattern from analytics pages |
| Approve/Reject/Request Revision actions | Form actions calling server actions with admin auth check | Existing server action pattern + `isAdmin(session)` |
| Bulk actions (optional) | Select multiple reviews, bulk approve | Standard checkbox + form submission pattern |

---

## Schema Changes Summary

All schema changes use Drizzle ORM 0.42.0 migration capabilities already in use.

### Modified Tables

**`skill_reviews` (add columns):**
```typescript
status: text("status").notNull().default("pending"),
// Values: "pending" | "ai_reviewed" | "author_revised" | "approved" | "rejected"
adminReviewerId: text("admin_reviewer_id").references(() => users.id),
adminNotes: text("admin_notes"),
reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
approvedAt: timestamp("approved_at", { withTimezone: true }),
```

**`skills` (no schema change needed):**
- `forkedFromId` already exists for fork tracking
- `content` + `contentHash` (via `skill_versions`) already exist for drift detection
- No new columns needed

### New Indexes

```sql
-- Review pipeline queries
CREATE INDEX idx_skill_reviews_status ON skill_reviews(tenant_id, status);
CREATE INDEX idx_skill_reviews_admin ON skill_reviews(admin_reviewer_id);

-- Fork drift detection
CREATE INDEX idx_skills_forked_from ON skills(forked_from_id) WHERE forked_from_id IS NOT NULL;
```

### Migration Count

One migration file covering all column additions and indexes. Estimated: `0013_add_review_pipeline.sql` (following existing migration numbering).

---

## New MCP Tools Summary

All tools use `server.registerTool()` from `@modelcontextprotocol/sdk@1.25.3`.

| Tool Name | Input Schema | Output | DB Queries |
|-----------|--------------|--------|------------|
| `recommend_skills` | `{ query: string, limit?: number }` | Semantic search results with similarity scores | Ollama `/api/embed` + pgvector cosine query |
| `describe_skill` | `{ skillId: string }` | Full skill details + review + similar skills | 3 queries (skill, review, similar) |
| `guide_skill` | `{ skillId: string }` | Usage instructions + content | 1 query (skill content) |
| `check_skill_drift` | `{ skillId: string, localContentHash: string }` | `{ drifted: boolean, remoteHash: string, compareUrl: string }` | 1 query (skill_versions latest hash) |

**File structure:**
```
apps/mcp/src/tools/
  recommend.ts      # NEW - semantic search
  describe.ts       # NEW - full skill details
  guide.ts          # NEW - usage guidance
  check-drift.ts    # NEW - fork drift detection
  search.ts         # EXISTING - text search (unchanged)
  list.ts           # EXISTING - list skills (unchanged)
  deploy.ts         # EXISTING - deploy skill (minor: add contentHash to response)
  create.ts         # EXISTING - create skill (unchanged)
  confirm-install.ts # EXISTING - confirm install (unchanged)
  log-usage.ts      # EXISTING - log usage (unchanged)
  index.ts          # EXISTING - add imports for new tools
```

---

## Alternatives Considered and Rejected

| Category | Decision | Alternative | Why Not |
|----------|----------|-------------|---------|
| State machine | Simple switch/lookup | XState / Robot3 | 5 states, 6 transitions. XState adds 15KB+ for a linear workflow. Overkill |
| Diff library | SHA-256 hash comparison | jsdiff / diff2html | v2.0 needs "changed or not", not character-level diff. Side-by-side display suffices |
| AI review model | Keep `claude-sonnet-4` (existing) | Claude Haiku for cost | Reviews are quality-critical. Sonnet's structured output is battle-tested in this codebase. Cost is ~$0.003/review |
| Semantic search in MCP | Duplicate Ollama client in MCP app | Shared package import | MCP server is standalone binary (tsup bundled). Cross-package fetch code adds build complexity for 15 lines |
| MCP Resources | Use tools for discovery | Register skills as MCP resources | Tools are the right primitive -- discovery is an action (search/filter), not passive data exposure. Resources suit static reference data |
| Review notification | In-app + email (existing) | WebSocket push | Notification polling + in-app bell UI already built in Phase 33. WebSocket adds infrastructure for low-frequency events |
| Admin UI framework | Tailwind + server components | Shadcn/ui / Radix | Admin pages are simple tables + forms. Existing admin pages use plain Tailwind. Adding a component library mid-project is disruptive |
| Version bump | Stay on current versions | Upgrade Drizzle to 0.45.1 | Zero features in 0.45.1 that we need. Upgrading mid-milestone risks subtle regressions across 14 tables |
| Version bump | Stay on MCP SDK 1.25.3 | Upgrade to 1.26.0 | Patch release with no API changes relevant to our usage. Stable is good |

---

## What NOT to Add

| Technology | Why Skip It | Risk If Added |
|------------|-------------|---------------|
| `xstate` or `robot3` | 5-state linear workflow. A switch statement is 20 lines | Over-engineering; debugging state chart configs takes longer than the logic |
| `jsdiff` / `diff2html` | Fork drift is boolean (hash match/mismatch). Character diff is a future enhancement | Adds bundle weight, complexity, and an API surface for a feature that may not be needed |
| `@ai-sdk/anthropic` (Vercel AI SDK) | Already using `@anthropic-ai/sdk` directly with structured output. Vercel AI SDK is a wrapper that adds streaming abstractions we don't need | Two competing Anthropic clients in one project; different API patterns; confusion |
| `bullmq` / `pg-boss` | Review status changes are synchronous server actions. Email sending via Resend is already fire-and-forget | Queue infrastructure for 10 events/day is absurd overhead |
| WebSocket library | Notification polling via server actions already works. Review status changes are infrequent (minutes-to-hours cadence) | Persistent connections, reconnection logic, server memory overhead for low-frequency events |
| `react-diff-viewer` | Character-level diff rendering in React. Not needed for v2.0 side-by-side display | 40KB+ library for a feature not in scope |
| Shadcn/ui components | Admin pages use plain Tailwind (consistent with existing 5 admin pages). Adding a component library mid-project breaks visual consistency | Style conflicts, learning curve, inconsistent UI between old and new admin pages |
| `drizzle-orm` upgrade | 0.42.0 is battle-tested with 14 tables, RLS policies, pgvector custom types, and 12 migrations | 0.45.1 may have subtle behavior changes in query builder or migration generation |

---

## Integration Points

### Cross-Feature Dependencies

```
Review Pipeline
  |-- uses: Anthropic SDK (AI review generation)
  |-- uses: Notification infrastructure (status change alerts)
  |-- uses: Resend (email on approval/rejection)
  |-- used by: Admin Review Page (admin sees review queue)

Conversational Discovery
  |-- uses: Ollama/Voyage AI embeddings (semantic search)
  |-- uses: skill_embeddings table + pgvector (vector search)
  |-- uses: deploy_skill tool (after recommend -> describe -> deploy)
  |-- independent: No dependency on review pipeline

Fork Drift Detection
  |-- uses: content_hash from skill_versions (hash comparison)
  |-- uses: forkedFromId from skills (parent-child relationship)
  |-- independent: No dependency on review pipeline or discovery

Admin Review Page
  |-- uses: Review Pipeline (displays review queue)
  |-- uses: Admin layout + isAdmin guard (access control)
  |-- uses: nuqs (URL state for filters)
```

### Build Order Recommendation

1. **Review Pipeline schema + server actions** (foundation -- other features don't depend on it, but admin page does)
2. **Admin Review Page** (depends on review pipeline schema)
3. **Conversational MCP Discovery** (independent -- can be built in parallel with review pipeline)
4. **Fork Drift Detection** (independent -- can be built in parallel)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Zero new dependencies | HIGH | Every feature maps to existing packages. Verified by tracing each capability to installed code |
| Review pipeline schema | HIGH | Extends existing `skill_reviews` table with standard Drizzle columns. Same pattern as all 14 existing tables |
| Anthropic SDK structured output | HIGH | Already working in production (`lib/ai-review.ts` line 127-129). Same API for enhanced review prompts |
| MCP tool registration | HIGH | 6 tools already registered via `server.registerTool()`. New tools follow identical pattern |
| Semantic search in MCP server | MEDIUM | Duplicating Ollama client code is straightforward, but MCP server's access to Ollama depends on network configuration (Ollama runs on same host). Need to verify Ollama URL accessibility from MCP process |
| Fork drift hash comparison | HIGH | `hashContent()` already in `lib/content-hash.ts`. `content_hash` stored in `skill_versions`. Pure comparison logic |
| Admin review page | HIGH | Extends existing admin layout with proven pattern (5 admin pages already exist) |
| No diff library needed | MEDIUM | Assumption that side-by-side text display is sufficient. If user research shows character-level diff is essential, `jsdiff` can be added in a later phase |

---

## Sources

### Codebase Verification (HIGH Confidence)
- `apps/web/lib/ai-review.ts` -- Anthropic SDK `output_config.format` usage confirmed at line 127
- `apps/mcp/src/server.ts` -- MCP SDK `registerTool()` and `registerPrompt()` APIs confirmed
- `apps/mcp/src/tools/` -- 6 existing tool implementations confirming registration pattern
- `packages/db/src/schema/skill-reviews.ts` -- Current review schema with `ReviewCategories` interface
- `packages/db/src/schema/skills.ts` -- `forkedFromId` column confirmed at line 67
- `packages/db/src/schema/skill-versions.ts` -- `contentHash` column confirmed at line 26
- `apps/web/lib/content-hash.ts` -- `hashContent()` SHA-256 implementation confirmed
- `apps/web/lib/similar-skills.ts` -- pgvector cosine similarity query pattern confirmed
- `apps/web/lib/ollama.ts` -- Ollama embedding API client (15 lines, duplicatable)
- `apps/web/app/(protected)/admin/layout.tsx` -- Admin nav items array, `isAdmin()` guard

### NPM Registry (HIGH Confidence)
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- Latest 1.26.0 (4 days ago), installed 1.25.3
- [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) -- Latest 0.73.0 (2 days ago), installed 0.72.1
- [drizzle-orm](https://www.npmjs.com/drizzle-orm) -- Latest 0.45.1 (2 months ago), installed 0.42.0

### MCP SDK Documentation (HIGH Confidence)
- [TypeScript SDK Server Docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- `registerTool()`, `registerPrompt()`, `registerResource()` APIs, structured content responses

---

*Stack research for: EverySkill v2.0 -- Skill Ecosystem Features*
*Researched: 2026-02-08*
