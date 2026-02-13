# Domain Pitfalls: AI Discovery, Workspace Intelligence, Visibility Scoping

**Domain:** Adding Google Workspace integration, visibility scoping, AI intent search, Loom video embeds, homepage redesign, and personal preferences to an existing multi-tenant skill marketplace
**Project:** EverySkill v3.0
**Researched:** 2026-02-13
**Overall confidence:** HIGH (direct codebase analysis of ~17,000 LOC, verified external API constraints)

---

## Critical Pitfalls

Mistakes that cause data leakage, broken authentication, or require rewrites.

---

### Pitfall 1: Google Workspace API OAuth Scope Escalation Breaks Existing Auth Flow

**What goes wrong:** EverySkill currently uses Google OAuth with minimal scopes (openid, email, profile) configured in `apps/web/auth.config.ts`. Adding Google Workspace Directory API requires additional scopes like `https://www.googleapis.com/auth/admin.directory.user.readonly`. This creates three compounding problems:

1. **Scope escalation triggers re-consent for ALL users.** Adding Directory API scopes to the Google provider's `authorization.params.scope` in `auth.config.ts` means every user sees a new consent screen on next login. Many will be confused or decline, thinking they've been hacked.

2. **Directory API requires admin-level scopes.** The `admin.directory.user.readonly` scope only works for users who are Google Workspace admins, or for service accounts with Domain-Wide Delegation. Regular users authenticating via OAuth cannot read the company directory. The current auth flow authenticates individual users -- it cannot query the directory on their behalf.

3. **Auth.js v5 stores tokens in the `accounts` table.** The current schema (`packages/db/src/schema/auth.ts`) stores `access_token`, `refresh_token`, and `scope`. The access token expires after 1 hour. Auth.js v5 does NOT implement token refresh out of the box -- there are numerous open issues about this (GitHub discussions #3016, #3940, #8205). Without `access_type: "offline"` and a custom refresh implementation, the stored tokens become useless after 60 minutes.

**Why it happens:** Developers assume "we already have Google OAuth, adding more scopes is trivial." In reality, Google Workspace Admin APIs are a completely different authorization tier from basic OAuth login.

**Consequences:**
- If scopes are added naively to the Google provider, every existing user must re-consent. Users who don't re-consent will have their sessions invalidated or see errors.
- If you try to call Directory API with a regular user's access token, you get 403 Forbidden. This will appear to work in development (where the developer is a Workspace admin) and break in production (where most users are not).
- If tokens expire after 1 hour and aren't refreshed, any background sync jobs that use the stored token fail silently.
- The 8-hour JWT session maxAge (SOC2-04 compliance, `auth.config.ts` line 28) outlives the Google access token. The session is valid but the Google token is expired.

**Prevention:**
1. **Do NOT add Workspace scopes to the user OAuth flow.** Use a separate service account with Domain-Wide Delegation for Directory API access. This requires the tenant's Google Workspace admin to grant DWD to a service account in the Google Admin Console -- this is a tenant onboarding step, not a per-user flow.
2. **Store the service account credentials per tenant.** Add a `workspace_credentials` table or encrypted columns on the `tenants` table. Each tenant's admin configures their Workspace connection via an admin settings page.
3. **If you must use user tokens for any Workspace feature:** add `access_type: "offline"` to the Google provider configuration, implement token refresh in the JWT callback following the Auth.js refresh token rotation guide, and handle the re-consent UX with an explanation screen.
4. **Never mix the user auth token with the Workspace sync token.** The user logs in with basic scopes; the Workspace sync uses a service account.

**Detection:** After implementing, remove the service account credentials for a tenant. The login flow should still work perfectly. Workspace features should degrade gracefully with a "Connect Google Workspace" prompt in admin settings.

**Phase:** Must be designed before any Workspace feature is built. The authentication architecture decision cascades to every Workspace-dependent feature.

**Confidence:** HIGH -- verified against [Auth.js refresh token rotation guide](https://authjs.dev/guides/refresh-token-rotation), [Google DWD docs](https://support.google.com/a/answer/162106), and [Directory API scope docs](https://developers.google.com/workspace/admin/directory/v1/guides/authorizing).

---

### Pitfall 2: Visibility Scoping Without RLS Enforcement Causes Cross-Scope Data Leakage

**What goes wrong:** Adding visibility scopes (e.g., `public`, `team`, `private`, `department`) to skills creates a new dimension of access control on top of the existing tenant isolation. The current RLS policies on every table check ONLY `tenant_id = current_setting('app.current_tenant_id', true)`. They know nothing about visibility or the requesting user.

If visibility scoping is implemented only at the application layer (WHERE clauses in queries), any missed query path leaks skills across scopes. The codebase has 15+ query paths for skills (as audited in v2.0 research). Every one of them needs visibility filtering.

**Why it happens:** Developers think "RLS handles isolation" and add visibility as a simple WHERE clause. But RLS handles TENANT isolation. Visibility within a tenant is a different concern. The defense-in-depth approach requires both.

**Specific risk surface in the current codebase:**

| Query Path | Needs Visibility Filter | Risk If Missed |
|---|---|---|
| `apps/web/lib/search-skills.ts` -- searchSkills() | YES | Private skills appear in search results |
| `packages/db/src/services/search-skills.ts` -- searchSkillsByQuery() | YES | MCP exposes private skills |
| `packages/db/src/services/semantic-search.ts` -- semanticSearchSkills() | YES | AI discovery recommends private skills |
| `apps/web/lib/trending.ts` -- getTrendingSkills() | YES | Private skills appear in trending |
| `apps/web/lib/leaderboard.ts` | YES | Private skill usage inflates leaderboard |
| `apps/web/lib/platform-stats.ts` | MAYBE | Private skills inflate org metrics |
| `apps/web/app/(protected)/skills/[slug]/page.tsx` | YES | Direct URL to private skill visible to others |
| `apps/mcp/src/tools/list.ts` | YES | MCP lists private skills |
| `apps/mcp/src/tools/search.ts` | YES | MCP search returns private skills |
| `apps/web/lib/similar-skills.ts` | YES | Private skills in similarity panel |
| `apps/web/app/actions/search.ts` -- quickSearch() | YES | Quick search dropdown shows private skills |

**Consequences:**
- A user marks a skill as "private" expecting only they can see it. Another user finds it via search, trending, or direct URL.
- A department-scoped skill leaks to other departments via semantic search (vector queries don't filter by visibility).
- MCP tools have no concept of the requesting user's department/team, so they cannot filter by visibility without new parameters.

**Prevention:**
1. **Add a `visibility` column to `skills` table** with values: `public` (default, visible to all in tenant), `team` (visible to author's team), `private` (author-only), `department` (visible to author's department). Default to `public` so existing skills are unaffected.
2. **Create a reusable visibility filter function** -- `buildVisibilityFilter(userId, userTeam?, userDepartment?)` -- that returns a SQL condition. Import this in EVERY query path.
3. **Do NOT use RLS for visibility.** RLS policies cannot access the requesting user's ID (only `app.current_tenant_id` is set at connection level). Adding `app.current_user_id` to every connection would require threading the user ID through `withTenant()` -- possible but risky for the connection pool.
4. **For the semantic search path:** the visibility filter must be applied AFTER vector similarity scoring, as a WHERE clause on the JOIN with skills. The `semanticSearchSkills()` function at `packages/db/src/services/semantic-search.ts` line 58 already joins `skillEmbeddings` to `skills` -- add the visibility filter to the WHERE clause alongside the existing `status = 'published'` check.
5. **Migration for existing skills:** `ALTER TABLE skills ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'`. All existing skills become public. No data loss.
6. **MCP tools need a visibility parameter or must default to `public` only.** The MCP user context has `userId` (resolved from API key in `apps/mcp/src/auth.ts`). Pass this through to queries for visibility filtering.

**Detection:** Create a private skill, then search for it as a different user. It must not appear. Repeat for semantic search, trending, MCP tools, and direct URL access. Automate this as an E2E test.

**Phase:** Visibility schema and filter function should be a SINGLE phase done before any feature that depends on scoped content. The filter function is a prerequisite for AI intent search, homepage personalization, and team-based features.

**Confidence:** HIGH -- cross-tenant leakage patterns verified via [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c).

---

### Pitfall 3: AI Intent Search Hallucinating Skill Recommendations

**What goes wrong:** AI-powered search that interprets user intent ("I need help writing performance reviews") and recommends skills can hallucinate recommendations -- suggesting skills that don't exist, conflating two skills into one, or fabricating capabilities. The current search architecture uses pgvector semantic search + PostgreSQL full-text search. Adding an LLM layer on top to "interpret intent" creates a new failure mode: the LLM generates a confident natural-language response about skills that don't match what the vector search actually returned.

**Why it happens:** The LLM receives search results and is asked to synthesize a recommendation. If the search results are poor matches (low similarity scores), the LLM fills gaps with plausible-sounding but fabricated information. It might say "the 'Performance Review Writer' skill handles 360 feedback and calibration" when the actual skill only generates basic review paragraphs.

**Consequences:**
- Users trust AI recommendations and install skills that don't do what the AI described.
- If the AI recommends a skill by name that doesn't exist (hallucinated from training data), clicking the link 404s, destroying trust.
- Users report bugs because the skill "doesn't work as described" -- the AI described capabilities the skill doesn't have.
- In an enterprise context, misleading AI recommendations about internal tools can cause workflow disruptions.

**Prevention:**
1. **Ground ALL recommendations in actual search results.** The architecture must be: user query -> embed query (same model as stored embeddings) -> vector search (pgvector) -> return TOP N results with similarity scores -> LLM synthesizes response ONLY from those N results. The LLM must not invent skills.
2. **Include a similarity score threshold.** If the best match has similarity < 0.3, the response should be "No relevant skills found. Try creating one?" not a hallucinated recommendation. The current `semanticSearchSkills()` returns similarity scores -- enforce a minimum.
3. **Template the LLM prompt to constrain output.** Provide search results as structured data (name, description, slug, similarity) and instruct: "Only recommend skills from the provided list. Do not invent or embellish capabilities beyond what the description states."
4. **Always link to the actual skill page.** Every recommendation must include a clickable link to `/skills/[slug]`. If the LLM mentions a skill, it must use the slug from the search results. Verify programmatically that mentioned slugs exist.
5. **Show the raw search results alongside the AI summary.** This lets users verify the AI's claims and builds trust. Pattern: AI summary at top, then "Skills matching your query:" with the actual result cards.
6. **Use the existing Anthropic integration pattern from `apps/web/lib/ai-review.ts`** -- structured JSON output with Zod validation. Define a response schema: `{ recommendations: [{ skillSlug, reason, confidence }], summary }`. Parse and validate before rendering.

**Detection:** Query for a topic where no skills exist. The AI should say "no matching skills" not fabricate recommendations. Query for a topic where skills exist but are weak matches. The AI should qualify its recommendations ("partially related") not oversell them.

**Phase:** AI intent search phase. Design the grounding architecture before building the UI.

**Confidence:** HIGH -- [RAG hallucination mitigation patterns](https://arxiv.org/html/2510.24476v1) well-documented; enterprise context analysis from [Glean](https://www.glean.com/perspectives/when-llms-hallucinate-in-enterprise-contexts-and-how-contextual-grounding).

---

### Pitfall 4: DEFAULT_TENANT_ID Hardcoded in 30+ Files Collides with New Features

**What goes wrong:** `DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000"` is hardcoded in 30+ files across the codebase (verified via grep -- apps/web actions, MCP tools, E2E tests, lib files). Every new v3.0 feature (Workspace integration, visibility scoping, AI search, preferences) will need tenant context. If the pattern continues, new files will copy-paste the hardcoded string, and the eventual migration to dynamic tenant resolution becomes exponentially harder.

The specific danger for v3.0: **Workspace integration is inherently multi-tenant** (each tenant connects to their own Google Workspace). If the Workspace sync service uses `DEFAULT_TENANT_ID`, it will store all tenants' directory data in a single namespace, creating cross-tenant data leakage of employee information.

**Files currently hardcoding DEFAULT_TENANT_ID (from codebase audit):**

| Category | Count | Examples |
|---|---|---|
| Server actions | 8 | skills.ts, fork-skill.ts, ratings.ts, api-keys.ts, skill-messages.ts, notification-preferences.ts |
| API routes | 3 | install-callback, dev-login, mcp transport |
| MCP tools | 5 | create.ts, update-skill.ts, submit-for-review.ts, review-skill.ts, tracking/events.ts |
| Lib files | 1 | embedding-generator.ts |
| E2E tests | 7 | auth.setup.ts, fork-skill, install, mcp-usage-tracking, skill-rating, ai-review, delete-skill, my-skills |
| Admin pages | 3 | admin/layout.tsx, admin/reviews/[skillId]/page.tsx, admin/reviews/page.tsx |
| DB client | 1 | packages/db/src/client.ts (connection-level setting) |

**Prevention:**
1. **For v3.0 new code: ALWAYS resolve tenant from session.** Use `session.user.tenantId` (available since Phase 26) instead of `DEFAULT_TENANT_ID`. The JWT callback in `apps/web/auth.ts` already injects `tenantId`.
2. **Create a `resolveTenantId(session)` helper** that returns `session.user.tenantId` and throws if missing. Use this in all new server actions and services. Never fall back to DEFAULT_TENANT_ID in new code.
3. **For Workspace integration specifically:** the service account credentials, sync state, and directory cache MUST be keyed by `tenantId`. A Workspace sync job takes `tenantId` as a parameter, not a global.
4. **For new DB services:** accept `tenantId` as a required parameter (not optional with DEFAULT fallback). This is the pattern used in `upsertSkillEmbedding()` -- follow it consistently.
5. **Do NOT attempt to migrate all 30+ existing files in v3.0.** That's a separate cleanup. Just prevent new proliferation.

**Detection:** After v3.0 development, grep for `"default-tenant-000"` in new files. Count should be zero in newly created files.

**Phase:** Enforced from the start of v3.0. Not a separate phase -- a coding standard for all phases.

**Confidence:** HIGH -- verified via direct codebase grep.

---

## Moderate Pitfalls

---

### Pitfall 5: Google Workspace Directory Sync Rate Limits and Data Freshness

**What goes wrong:** The Google Workspace Directory API has specific rate limits: 2,400 queries per minute per user per project (verified from [official docs](https://developers.google.com/workspace/admin/directory/v1/limits)). A full directory sync for a large organization (5,000+ users) requires paginated LIST calls (500 users per page max). The sync is needed to populate team/department/manager data for visibility scoping and people search.

Three problems arise:

1. **Initial sync storms.** When a new tenant connects their Workspace, the first sync fetches all users. For 5,000 users = 10 API calls, no problem. For 50,000 users = 100 API calls. But if 10 tenants onboard simultaneously, you hit the per-project quota.

2. **Stale data drift.** If sync runs daily, a user who changed departments today won't see correct visibility scoping until tomorrow. Skills scoped to "my department" use yesterday's department assignment.

3. **Partial sync failures.** If the sync crashes midway (token expired, rate limit hit, service account revoked), you have a partially updated directory. Some users have fresh data, others have stale data. Visibility scoping based on stale department data shows wrong results.

**Prevention:**
1. **Implement incremental sync, not full sync.** Use the Directory API's `orderBy=email&pageToken` with a stored last-sync timestamp. On subsequent syncs, only fetch users modified since the last sync (use the `customField` or `updatedMin` parameter if available, otherwise compare cached vs fetched).
2. **Queue sync jobs per tenant.** Use a simple database-backed queue (a `workspace_sync_jobs` table with status, tenant_id, last_page_token). Process one tenant at a time. If rate-limited, back off and resume from the last page token.
3. **Store sync metadata.** For each tenant: `lastFullSyncAt`, `lastIncrementalSyncAt`, `syncStatus` (idle, in_progress, failed, rate_limited), `totalUsersSync`. Show this on the admin Workspace settings page.
4. **Handle partial failures gracefully.** If sync fails midway, do NOT clear old data. Keep the existing directory data and mark the sync as failed. Show "Directory data may be outdated" in the UI. Resume from the last page token on retry.
5. **Cache directory data in EverySkill's database.** Create a `workspace_users` table with: `tenantId`, `googleUserId`, `email`, `name`, `department`, `manager`, `team`, `title`, `syncedAt`. This is the source of truth for visibility scoping -- never query Google's API at request time.

**Detection:** Mock the Directory API to return errors after 50% of records. Verify the sync saves what it got and doesn't lose previously synced data. Verify visibility scoping works with partial data (users not yet synced default to `public` visibility skills only).

**Phase:** Workspace integration phase. Sync infrastructure must be built before visibility scoping can use department/team data.

**Confidence:** MEDIUM -- rate limits verified from official docs; incremental sync patterns are common practice but specific API behavior (updatedMin parameter) needs verification at implementation time.

---

### Pitfall 6: Loom Embed SDK Staleness and Video Availability

**What goes wrong:** The `@loomhq/loom-embed` npm package was last published 2 years ago (v1.7.0). Loom was acquired by Atlassian in 2023. The SDK stability is uncertain. If EverySkill stores Loom URLs in skill descriptions and renders them as embedded players, three failure modes emerge:

1. **SDK breaks on Loom infrastructure changes.** A stale SDK that hasn't been updated in 2 years may stop working if Loom changes their embed endpoints, authentication, or player markup. There's no active maintenance signal.

2. **Video deletion/privacy changes.** A skill references a Loom video. The video creator deletes it, makes it private, or leaves the organization. The embed shows a broken player with "Video not available." The skill looks broken even though the text content is fine.

3. **Loom access requires authentication.** If Loom videos are set to "team only" or "logged-in users only," the embedded player may prompt for Loom authentication inside the EverySkill page, creating a confusing dual-login UX. The viewer needs both an EverySkill session AND a Loom session.

**Prevention:**
1. **Use Loom's oEmbed endpoint, not the npm SDK.** Call `https://www.loom.com/v1/oembed?url={loomUrl}` at render time to get the embed HTML. This is more resilient to SDK deprecation. If oEmbed fails, fall back to a simple link with thumbnail.
2. **Cache oEmbed responses.** Store the oEmbed HTML in the database alongside the Loom URL. Re-validate periodically (e.g., daily cron). If oEmbed returns an error on re-validation, flag the skill as having a broken video and notify the author.
3. **Detect Loom URLs via regex, don't require special input.** Skills already have markdown content. Detect `https://www.loom.com/share/*` URLs in content and auto-embed. This avoids a special "add Loom video" UI -- just paste the URL.
4. **Handle broken embeds gracefully.** If the oEmbed call fails or the video is unavailable, render a gray placeholder with "Video unavailable" and a link to the original URL. Do NOT crash the skill detail page.
5. **CSP headers.** Loom embeds use iframes from `*.loom.com`. Ensure the Content-Security-Policy allows `frame-src https://*.loom.com`. Check `apps/web/next.config.ts` for existing CSP rules.
6. **Consider making Loom integration generic.** Support any oEmbed provider (Loom, YouTube, Vimeo) by detecting URLs and calling the appropriate oEmbed endpoint. This avoids vendor lock-in to Loom specifically.

**Detection:** Embed a Loom video in a skill, then delete the video on Loom. The skill page should show a graceful fallback, not a broken iframe or JavaScript error. Test with a private Loom video -- verify the embed shows "sign in to Loom" or a fallback, not a blank player.

**Phase:** Loom integration phase. Should be a lightweight feature, not a large phase.

**Confidence:** MEDIUM -- SDK staleness verified via [npm](https://www.npmjs.com/package/@loomhq/loom-embed); oEmbed endpoint availability confirmed via [Loom developer docs](https://dev.loom.com/docs/embed-sdk/api). Loom's long-term embed strategy under Atlassian is LOW confidence.

---

### Pitfall 7: Homepage Redesign Performance Regression from Additional Data Fetching

**What goes wrong:** The current homepage (`apps/web/app/(protected)/page.tsx`) already fetches 8 parallel queries in `Promise.all()` on every page load:

```
getPlatformStats(), getPlatformStatTrends(), getTrendingSkills(6),
getLeaderboard(5), getSkillsUsed(user.id), getSkillsUsedStats(user.id),
getSkillsCreated(user.id), getSkillsCreatedStats(user.id)
```

A v3.0 homepage redesign with AI-powered features will want to add: personalized recommendations (AI intent search), recent activity feed, team skills, workspace diagnostics, "skills your colleagues use," and department trending. Each of these is another database query or AI API call. Adding 4-5 more queries doubles the homepage data fetching.

**Why it happens:** Server components in Next.js make it easy to fetch everything in parallel. But "parallel" doesn't mean "free" -- each query competes for database connections, and the page doesn't render until ALL parallel queries resolve. The slowest query determines page load time.

**Consequences:**
- Homepage Time To First Byte (TTFB) increases from ~200ms to 500ms+ as queries multiply.
- If the AI recommendation call takes 2+ seconds (Anthropic API latency), the entire homepage is blocked.
- Database connection pool exhaustion: each parallel query uses a connection. 8 queries * N concurrent users approaches the postgres connection limit.
- The existing homepage queries don't use tenant scoping from the session (they rely on connection-level `app.current_tenant_id`). Adding visibility-scoped queries on top means some queries use RLS and some don't -- inconsistent behavior.

**Prevention:**
1. **Separate static and dynamic content.** Platform stats, trending, and leaderboard change slowly -- cache them for 5 minutes (use React's `unstable_cache` or a simple in-memory cache). Personal data (my leverage, recommendations) must be fresh.
2. **Move AI recommendations to client-side loading.** Render the homepage with static + personal data. Then load AI recommendations asynchronously via a client component that calls a server action after mount. This prevents AI latency from blocking the page.
3. **Implement Suspense boundaries.** Wrap non-critical sections (recommendations, activity feed) in `<Suspense fallback={<Skeleton />}>`. This allows the critical content to render first.
4. **Set a budget: max 10 parallel queries on homepage.** If a new feature needs homepage data, it must either replace an existing query or be loaded asynchronously.
5. **Monitor database connection pool.** The current `postgres()` client in `packages/db/src/client.ts` uses default pool size (probably 10). With 8+ queries per page load, concurrent users will exhaust the pool quickly. Consider increasing `max` or implementing query batching.

**Detection:** Measure TTFB before and after the redesign. Set a performance budget: homepage TTFB must be under 400ms for the 95th percentile. Load test with 20 concurrent users.

**Phase:** Homepage redesign phase. Performance budgets should be set before adding new data sources.

**Confidence:** HIGH -- verified from direct analysis of `apps/web/app/(protected)/page.tsx` showing 8 parallel queries.

---

### Pitfall 8: Visibility Scoping Requires Department/Team Data That Doesn't Exist Yet

**What goes wrong:** Implementing `team` and `department` visibility scopes requires knowing which team/department each user belongs to. This data doesn't exist in the EverySkill database. The `users` table (`packages/db/src/schema/users.ts`) has only: `id`, `tenantId`, `email`, `role`, `name`, `emailVerified`, `image`, `createdAt`, `updatedAt`. No `department`, `team`, `manager`, or organizational unit fields.

If visibility scoping is built before the Workspace directory sync populates this data, the `team` and `department` scopes are unusable. Skills set to "team only" would be invisible to everyone (because no users have a team assigned), or visible to everyone (if the filter falls back to `public` when team data is missing).

**Why it happens:** Developers plan the visibility feature and the Workspace sync as separate workstreams. Visibility scoping is "simpler" and gets prioritized first. But it depends on data that only Workspace sync provides.

**Consequences:**
- Users set skills to "department" visibility. No one can see them because department data hasn't been synced yet.
- If the visibility filter falls back to `public` when user has no department, all "department" skills become public -- the opposite of the intended behavior.
- If the visibility filter falls back to `author-only` when department data is missing, legitimate team members can't see the skill.
- The fallback behavior is a UX landmine regardless of which direction you choose.

**Prevention:**
1. **Phase dependency: Workspace sync MUST ship before visibility scoping uses `team` or `department`.** Visibility scoping phase 1 should only support `public` and `private`. Phase 2 adds `team` and `department` after Workspace sync is live.
2. **Add organizational fields to the users table** (or a separate `user_profiles` table): `department`, `team`, `managerId`, `title`. Populate these from Workspace sync.
3. **For tenants without Workspace integration:** allow manual team/department assignment in admin settings. This is a fallback for non-Google organizations.
4. **The visibility filter must handle NULL department/team gracefully.** If `user.department IS NULL` and a skill has `visibility = 'department'`, the user should NOT see the skill (conservative default). Show a message: "Connect Google Workspace to access department-scoped skills."

**Detection:** Create a skill with "department" visibility before any Workspace sync. Verify it's only visible to the author. Then sync the Workspace. Verify department members can now see it.

**Phase:** Visibility scoping must be phased: Phase 1 (public/private), Phase 2 (team/department, requires Workspace sync).

**Confidence:** HIGH -- verified from direct schema analysis showing no organizational fields on users table.

---

### Pitfall 9: Embedding Model Transition from Ollama to Cloud Provider Invalidates All Vectors

**What goes wrong:** The current embedding pipeline uses Ollama locally (`nomic-embed-text`, 768 dimensions) via `apps/web/lib/ollama.ts`. AI intent search needs embeddings at request time for query matching. If the v3.0 plan switches to a cloud embedding provider (Voyage AI, OpenAI) for better quality or to eliminate the local Ollama dependency, ALL existing skill embeddings become incompatible. You cannot mix embeddings from different models -- they exist in different vector spaces.

The `skill_embeddings` table (`packages/db/src/schema/skill-embeddings.ts`) stores `modelName` and `dimensions`, but the HNSW index at line 59 is hardcoded to `vector(768)`. Switching to a model with different dimensions (e.g., OpenAI `text-embedding-3-small` at 1536 dimensions) requires rebuilding the table and index.

**Why it happens:** The embedding model seems like a swappable implementation detail, but it's actually a data commitment. Every existing embedding is bound to the model that created it.

**Consequences:**
- Switching models without re-embedding: semantic search returns garbage results (comparing vectors from different spaces).
- Re-embedding all skills: requires one API call per skill. With Voyage AI rate limits (documented in project memory as "tight"), re-embedding 500 skills could take 30+ minutes.
- If the column is `vector(768)` and the new model outputs 1536 dimensions, inserts fail with a dimension mismatch error.
- During migration, there's a window where some skills have old embeddings and some have new ones. Search quality degrades.

**Prevention:**
1. **Decide the embedding model BEFORE building AI intent search.** If staying with Ollama, ensure Ollama is reliable enough for production (it requires the local server to be running -- see `startOllama()` function). If switching to cloud, plan the re-embedding migration.
2. **If switching models:** add a `modelVersion` or `modelName` check to the search query. Only compare embeddings with the same model. During migration, run both old and new embeddings in parallel, merging results.
3. **Re-embedding migration strategy:** batch process skills during off-peak hours. Use the existing `inputHash` field to skip skills that haven't changed. Process in groups of 10-20 with exponential backoff on rate limit errors.
4. **Consider Voyage AI `voyage-3-lite`** (1024 dimensions, lower cost) as a balance between quality and compatibility. This requires a schema migration: `ALTER TABLE skill_embeddings ALTER COLUMN embedding TYPE vector(1024)` and dropping/recreating the HNSW index.
5. **If staying with Ollama:** ensure the Ollama service is managed by systemd and auto-starts. The current `startOllama()` function in `ollama.ts` spawns the process ad-hoc, which is fragile for a production service.

**Detection:** After switching models, run a known-good query (e.g., "project management automation") and verify the top results make sense. Compare results before and after the model switch.

**Phase:** Decide in the AI intent search research/design phase. Execute the migration (if needed) as the first task of the AI search implementation phase.

**Confidence:** HIGH -- vector space incompatibility is well-established; Voyage AI rate limits verified from project memory.

---

### Pitfall 10: Personal Preferences Creating Data Model Complexity and Sync Conflicts

**What goes wrong:** "Personal preferences" (preferred categories, notification settings, UI customization, default search filters, pinned skills, bookmarks) creates a sprawling data model. The current `notification_preferences` table already has 7+ boolean columns per user. Adding preferences for search, UI, content, and workspace creates either:

1. **One wide table** with 20+ columns, most nullable, requiring schema migrations for each new preference.
2. **A JSON column** (`preferences JSONB`) that's flexible but untyped, hard to query, and prone to schema drift.
3. **Multiple tables** (notification_prefs, search_prefs, ui_prefs, content_prefs) that must all be fetched and kept in sync.

**Why it happens:** Preferences seem simple. "Just add a column." But they proliferate rapidly and each new feature wants its own preferences.

**Consequences:**
- If using a wide table: every new preference requires a migration. The table grows to 30+ columns. Default values for new columns must be set carefully or existing users get null preferences.
- If using JSONB: TypeScript types and database schema diverge. A type says `preferences.searchDefaults.categories: string[]` but the database might have an older shape without that key.
- If using multiple tables: the homepage needs 3-4 preference queries, adding to the performance problem (Pitfall 7).
- Sync conflicts if preferences can be set from multiple places (web UI, MCP tool, admin override). Which write wins?

**Prevention:**
1. **Use a single `user_preferences` table with a JSONB `data` column.** Define the shape with a Zod schema in TypeScript for runtime validation. The schema serves as the source of truth for what preferences exist and their defaults.
2. **Define defaults in code, not the database.** When reading preferences, merge the stored JSONB with a `DEFAULT_PREFERENCES` constant. New preferences automatically get defaults without migration.
3. **Version the preferences schema.** Add a `schemaVersion` field inside the JSONB. When reading, if `schemaVersion < CURRENT_VERSION`, migrate the shape in-memory and write back.
4. **Fetch preferences ONCE per page load** and pass via React context or server component props. Do NOT fetch preferences in every component.
5. **Keep `notification_preferences` separate** -- it already exists and works. Don't try to merge it into the new preferences system.
6. **The `user_preferences` table needs `tenantId` and RLS** like every other table. Import from session, not DEFAULT_TENANT_ID.

**Detection:** Add a new preference type to the Zod schema without a migration. Verify existing users get the default value. Verify users with stored preferences don't lose their existing settings.

**Phase:** Personal preferences should be its own small phase, early in v3.0. Other features (search defaults, UI customization) depend on the preferences infrastructure.

**Confidence:** HIGH -- preference architecture patterns are well-established; JSONB + Zod is the standard approach for flexible schemas.

---

### Pitfall 11: Homepage Redesign Breaking Existing User Workflows

**What goes wrong:** The current homepage has an established layout: welcome message, search bar, stat cards, trending skills, leaderboard, "Your Impact" section, and a My Leverage tab. Users who have been using EverySkill have muscle memory for these elements. A redesign that moves or removes elements disrupts workflows.

Specific risks:
- **Search bar relocation.** The `SearchWithDropdown` component is prominently placed. Moving it behind a tab or into a header breaks the "land on homepage, immediately search" flow.
- **Removing stat cards.** Executives who share FTE Years Saved screenshots in presentations will be unhappy if the metric moves or changes format.
- **Tab structure change.** The `HomeTabs` component separates "Browse" and "My Leverage." If these are reorganized, bookmarked tab states break.
- **Adding AI recommendations that push existing content below the fold.** If the AI recommendation section is added above trending skills, users who scroll to trending will now have to scroll further.

**Prevention:**
1. **Additive, not disruptive.** Add new sections (AI recommendations, workspace diagnostics, team activity) BELOW existing content. Don't remove or reorder what's already there in the initial redesign.
2. **Keep the search bar in the same position** (below welcome, above stats). If enhancing search with AI intent, make the enhancement IN the existing search bar (e.g., "Ask anything" placeholder text, AI-powered dropdown results) rather than adding a separate AI search section.
3. **Feature flags for new homepage sections.** Wrap new sections in a feature flag so they can be toggled per tenant or rolled back quickly.
4. **Test with actual users before full rollout.** The project has demo datasets ("Avenue One" with 100 users, 50 skills). Load the redesigned homepage with real data and screenshot for review before deploying.

**Detection:** Load the redesigned homepage. Verify: (1) search bar is visible without scrolling, (2) stat cards are visible without scrolling, (3) existing URLs and tab states still work.

**Phase:** Homepage redesign phase. Should be one of the later phases, after the underlying features (AI search, workspace, preferences) exist.

**Confidence:** HIGH -- based on direct analysis of current homepage layout.

---

### Pitfall 12: Workspace Integration Privacy -- Reading Employee Data Without Consent Framework

**What goes wrong:** Google Workspace Directory API returns employee data: names, email addresses, departments, managers, phone numbers, photos, organizational hierarchy. Storing this in EverySkill creates privacy obligations:

1. **GDPR compliance.** If any tenant has EU employees, storing their organizational data requires a legal basis (usually legitimate interest or consent). The data subject has right to access, rectification, and deletion of their data.
2. **Employee surveillance perception.** Even if the intent is benign (populate department for visibility scoping), employees may perceive directory sync as surveillance. "Why does EverySkill know my manager and department?"
3. **Data minimization.** GDPR requires collecting only necessary data. If you only need department for visibility scoping, don't store phone numbers, photos, and physical addresses.

**Consequences:**
- A tenant in the EU stores employee data without DPIA (Data Protection Impact Assessment). Regulatory risk.
- An employee requests data deletion under GDPR. You need to delete their directory data from EverySkill while keeping their user account and skill ownership intact.
- A Workspace admin revokes EverySkill's service account access. All cached directory data becomes stale with no way to refresh. If the data isn't purged, it's retained without authorization.

**Prevention:**
1. **Collect ONLY what you need.** For v3.0 features, the minimum is: `email`, `name`, `department`, `team/orgUnit`, `managerId`. Do NOT store phone numbers, photos, physical addresses, or custom fields.
2. **Display a clear admin consent screen** during Workspace connection: "EverySkill will sync your organization's directory to enable team-based skill sharing. The following data will be stored: [list]. Data is refreshed daily and can be disconnected at any time."
3. **Implement a "disconnect" button** in admin settings that: revokes the service account, deletes ALL cached directory data for that tenant, and resets visibility scopes that depend on directory data (department/team skills fall back to public).
4. **Add a data retention policy.** If a tenant disconnects Workspace, purge directory data within 30 days. If a user is removed from the directory on the next sync, mark their directory data as `deletedAt` and purge after 30 days.
5. **Log all directory sync operations** in the existing audit log (`packages/db/src/services/audit.ts`). Track what data was synced and when, for compliance reporting.

**Detection:** Connect a tenant's Workspace, verify only necessary fields are stored. Disconnect Workspace, verify directory data is purged. Check that a user's EverySkill account still works after their directory data is purged.

**Phase:** Workspace integration phase. Consent UI and data minimization must be designed before the sync is implemented.

**Confidence:** MEDIUM -- GDPR requirements verified via [Google Workspace GDPR compliance guides](https://support.google.com/a/answer/2888485); specific DPIA requirements depend on jurisdiction and data processed.

---

## Minor Pitfalls

---

### Pitfall 13: Loom Embed Content Security Policy Conflict

**What goes wrong:** Loom embeds use iframes that load from `https://www.loom.com/embed/*`. If the Next.js app has a Content-Security-Policy header that restricts `frame-src`, Loom embeds will be silently blocked by the browser. The page renders fine but the iframe shows a blank rectangle. No JavaScript error, no visible error message -- just empty space where the video should be.

**Prevention:**
1. Check `apps/web/next.config.ts` for existing CSP headers. If none exist, this is not a problem yet but will be when CSP is added.
2. When adding CSP (or if it exists), ensure `frame-src` includes `https://www.loom.com https://*.loom.com`.
3. Also allow `https://www.youtube.com` and `https://player.vimeo.com` if supporting generic oEmbed.
4. Test in both development and production -- CSP headers may differ between environments.

**Detection:** Open browser DevTools Network tab. If a Loom embed shows blank, check Console for CSP violation messages.

**Phase:** Loom integration phase. A small config task.

**Confidence:** HIGH -- standard CSP behavior.

---

### Pitfall 14: AI Intent Search Latency Destroys Search UX

**What goes wrong:** The current search flow is fast: user types -> server action `quickSearch()` runs ILIKE query -> results in <100ms. Adding AI intent search means: user types -> embed query (Ollama ~50ms local, or cloud API ~200ms) -> vector search (~50ms) -> LLM interprets results (~1-3s Anthropic API) -> render. Total latency: 1.5-3.5 seconds for an "intent-aware" search.

Users expect search to be instant. A 3-second delay on every keystroke is unacceptable. Even debounced to 500ms, the AI search adds perceptible lag.

**Prevention:**
1. **Keep keyword search as the primary, instant path.** The existing `SearchWithDropdown` + `quickSearch()` action should remain the default search experience. AI intent search is a SEPARATE feature for when keyword search doesn't find what the user needs.
2. **Trigger AI search explicitly, not on every keystroke.** Options: (a) "Ask AI" button next to search bar, (b) AI search triggers only after keyword search returns 0 results, (c) dedicated "AI Discovery" page separate from quick search.
3. **Show keyword results instantly, then enhance with AI.** Render keyword results in <100ms. If the user waits, show AI-enhanced results after 1-2 seconds as an additional section ("AI also suggests...").
4. **Cache AI search results.** Same query string -> same results. Use a short-lived cache (5 minutes) keyed by `tenantId + query`. This avoids re-running the LLM for repeated searches.
5. **Stream the AI response.** If using Anthropic's streaming API, show the AI recommendation as it generates, rather than waiting for the full response. The existing `ai-review.ts` does NOT use streaming -- this would be new.

**Detection:** Measure search latency with and without AI. Set a budget: keyword search < 200ms, AI-enhanced search < 3s. If AI search exceeds 3s, it should timeout and fall back to keyword-only results.

**Phase:** AI intent search phase. Performance budgets must be set during design.

**Confidence:** HIGH -- latency estimates based on known Anthropic API response times and existing search performance.

---

### Pitfall 15: Visibility Column Migration Interacts with Status Column

**What goes wrong:** The `skills` table already has a `status` column (added in v2.0) that determines publishing state. Adding a `visibility` column creates two overlapping access control dimensions:

- `status = 'published'` AND `visibility = 'public'` -> visible to all in tenant
- `status = 'published'` AND `visibility = 'private'` -> visible to author only
- `status = 'pending_review'` AND `visibility = 'team'` -> not visible to anyone yet (not published)
- `status = 'draft'` AND `visibility = 'department'` -> meaningless (draft skills aren't visible regardless)

The interaction creates a 4x5 matrix of states. Developers will write queries that check one but not the other.

**Prevention:**
1. **Define a clear precedence rule:** `status` takes precedence over `visibility`. If `status != 'published'`, the skill is invisible regardless of visibility setting. Visibility only matters for published skills.
2. **Document this rule in code comments** on both the `status` and `visibility` column definitions.
3. **The reusable visibility filter function (from Pitfall 2) must check BOTH:** `WHERE status = 'published' AND (visibility = 'public' OR (visibility = 'private' AND author_id = :userId) OR ...)`.
4. **Don't allow setting visibility during review.** The visibility setting is only meaningful once the skill is published. Allow setting it during creation (as a preference for after approval), but enforce it only on published skills.

**Detection:** Create a skill with `visibility = 'team'` and `status = 'pending_review'`. No one (not even team members) should see it. After approval, team members should see it.

**Phase:** Visibility scoping phase, after status column is stable.

**Confidence:** HIGH -- direct schema analysis.

---

### Pitfall 16: MCP Tools Have No Concept of Visibility or Workspace Context

**What goes wrong:** The MCP server (`apps/mcp/`) authenticates users via API key (`apps/mcp/src/auth.ts`), which resolves to a `userId` and `tenantId`. But MCP tools have no concept of:
- The requesting user's department or team (needed for visibility filtering)
- Whether the tenant has Workspace integration enabled
- What visibility scope the user can access

The MCP `search_skills` tool delegates to `searchSkillsByQuery()` in `packages/db/src/services/search-skills.ts`, which has no visibility parameter. After adding visibility scoping to the web app, MCP would still return all skills regardless of visibility.

**Prevention:**
1. **Add a `userId` parameter to search service functions.** The visibility filter needs to know who is asking.
2. **Resolve user's department/team from the cached directory data** using their `userId`. If no directory data exists (tenant hasn't connected Workspace), default to showing only `public` skills.
3. **Update MCP search tools to pass the authenticated userId** through to the search function. The user ID is already available from API key validation.
4. **Consider adding a `visibility` filter parameter to MCP search tools** so MCP clients can explicitly request "show me only my private skills" or "show me team skills."

**Detection:** Create a private skill via the web UI. Search for it via MCP as a different user. It must not appear.

**Phase:** Needs to be addressed in the same phase as visibility scoping. MCP is a first-class access path.

**Confidence:** HIGH -- verified from direct analysis of MCP tools.

---

### Pitfall 17: Workspace Diagnostics Exposing Cross-Tenant Usage Patterns

**What goes wrong:** "Workspace diagnostics" features (e.g., "Your team uses 15% fewer skills than the org average") require aggregating usage data across users within a tenant. If the aggregation queries don't scope to the requesting user's tenant, they could include data from other tenants, especially given that `DEFAULT_TENANT_ID` is the connection-level default.

Worse: if diagnostics show "top skills in your department" and the department assignment comes from Workspace sync, a bug in the sync that assigns users to the wrong tenant's departments creates cross-tenant data exposure.

**Prevention:**
1. **All diagnostic queries MUST accept `tenantId` as a required parameter.** Never rely on connection-level RLS for aggregate queries.
2. **Diagnostic data should be pre-computed and cached per tenant,** not computed at request time. A daily cron job computes diagnostics per tenant and stores results in a `workspace_diagnostics` table with `tenantId` foreign key.
3. **Workspace sync must validate that the synced users belong to the correct tenant.** Cross-reference email domains: a user synced from Google Workspace for tenant A should have an email domain matching tenant A's configured domain.
4. **Never show individual user data in diagnostics** -- only aggregates. "Your department used 150 skills this month" not "John used 30 skills, Jane used 20."

**Detection:** Create two tenants. Sync Workspace data for both. View diagnostics for tenant A. Verify no data from tenant B appears.

**Phase:** Workspace diagnostics phase (one of the later v3.0 phases).

**Confidence:** HIGH -- multi-tenant aggregate query pitfalls are well-documented.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Workspace Auth Design | Pitfall 1: OAuth scope escalation | Use service account with DWD, not user OAuth |
| Workspace Auth Design | Pitfall 4: DEFAULT_TENANT_ID in new code | Use session.user.tenantId, create resolveTenantId() helper |
| Workspace Directory Sync | Pitfall 5: Rate limits and partial failures | Incremental sync, per-tenant queuing, resume from last page |
| Workspace Directory Sync | Pitfall 12: Privacy without consent | Collect only necessary data, admin consent screen |
| Visibility Scoping (Phase 1) | Pitfall 2: Cross-scope data leakage | Reusable visibility filter in ALL 11+ query paths |
| Visibility Scoping (Phase 1) | Pitfall 15: Status + visibility interaction | Status takes precedence, filter checks both |
| Visibility Scoping (Phase 2) | Pitfall 8: No department/team data | Depends on Workspace sync; defer team/dept scopes until data exists |
| AI Intent Search | Pitfall 3: Hallucinated recommendations | Ground in actual search results, similarity threshold, structured output |
| AI Intent Search | Pitfall 9: Embedding model transition | Decide model before building; plan re-embedding if switching |
| AI Intent Search | Pitfall 14: Search latency | Keep keyword search instant, AI search explicit or async |
| Loom Integration | Pitfall 6: SDK staleness | Use oEmbed, not npm SDK; handle broken embeds gracefully |
| Loom Integration | Pitfall 13: CSP blocks iframes | Add frame-src for loom.com |
| Homepage Redesign | Pitfall 7: Performance regression | Cache slow queries, async AI, Suspense boundaries |
| Homepage Redesign | Pitfall 11: Breaking existing workflows | Additive changes, keep search bar position, feature flags |
| Personal Preferences | Pitfall 10: Data model sprawl | JSONB + Zod schema, code-defined defaults |
| MCP Tools | Pitfall 16: No visibility awareness | Add userId to search services, update MCP tools |
| Workspace Diagnostics | Pitfall 17: Cross-tenant aggregation leakage | Per-tenant pre-computed diagnostics, domain validation |
| All New Code | Pitfall 4: DEFAULT_TENANT_ID proliferation | Never hardcode in new files, always resolve from session |

---

## Sources

### Primary -- Direct Codebase Audit
- Auth config: `apps/web/auth.config.ts` (73 lines -- Google OAuth, JWT sessions, 8h maxAge, domain-scoped cookies)
- Auth setup: `apps/web/auth.ts` (162 lines -- signIn callback, JWT tenantId injection, token refresh gap)
- OAuth tokens: `packages/db/src/schema/auth.ts` (accounts table with access_token, refresh_token, scope)
- Middleware: `apps/web/middleware.ts` (104 lines -- subdomain extraction, tenant header injection, cookie-based auth)
- Skills schema: `packages/db/src/schema/skills.ts` (87 lines -- no visibility column, RLS on tenant_id only)
- Users schema: `packages/db/src/schema/users.ts` (47 lines -- no department, team, manager fields)
- Embeddings: `packages/db/src/schema/skill-embeddings.ts` (70 lines -- vector(768), HNSW index, tenant RLS)
- Semantic search: `packages/db/src/services/semantic-search.ts` (86 lines -- cosine distance, no visibility filter)
- Keyword search: `apps/web/lib/search-skills.ts` (211 lines -- full-text + ILIKE, no visibility filter)
- Quick search: `apps/web/app/actions/search.ts` (31 lines -- delegates to searchSkills)
- Homepage: `apps/web/app/(protected)/page.tsx` (255 lines -- 8 parallel queries in Promise.all)
- Embedding generator: `apps/web/lib/embedding-generator.ts` (50 lines -- Ollama, DEFAULT_TENANT_ID hardcoded)
- AI review: `apps/web/lib/ai-review.ts` (307 lines -- Anthropic SDK, structured JSON output)
- Ollama client: `apps/web/lib/ollama.ts` (137 lines -- local server management, spawn/systemctl)
- Site settings: `packages/db/src/schema/site-settings.ts` (46 lines -- embedding config per tenant)
- Tenant context: `packages/db/src/tenant-context.ts` (26 lines -- withTenant transaction wrapper)
- DB client: `packages/db/src/client.ts` (59 lines -- connection-level DEFAULT_TENANT_ID)
- MCP auth: `apps/mcp/src/auth.ts` (resolves userId from API key, no department/team context)
- Tenants: `packages/db/src/schema/tenants.ts` (26 lines -- no Workspace credentials)
- Notification preferences: `packages/db/src/schema/notification-preferences.ts` (per-type boolean columns)
- DEFAULT_TENANT_ID grep: 30+ files across codebase (see Pitfall 4 table)

### External
- [Auth.js Refresh Token Rotation Guide](https://authjs.dev/guides/refresh-token-rotation) -- Token refresh implementation for NextAuth v5
- [Google Domain-Wide Delegation](https://support.google.com/a/answer/162106) -- Service account setup for Workspace API access
- [Google Directory API Scopes](https://developers.google.com/workspace/admin/directory/v1/guides/authorizing) -- Required OAuth scopes for directory operations
- [Google Directory API Rate Limits](https://developers.google.com/workspace/admin/directory/v1/limits) -- 2,400 queries/min/user/project, 500 users/page max
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c) -- RLS failure patterns
- [Tenant Isolation in Multi-Tenant Systems](https://securityboulevard.com/2025/12/tenant-isolation-in-multi-tenant-systems-architecture-identity-and-security/) -- Defense-in-depth approaches
- [RAG Hallucination Mitigation Survey](https://arxiv.org/html/2510.24476v1) -- Grounding techniques for retrieval-augmented generation
- [Enterprise LLM Hallucinations](https://www.glean.com/perspectives/when-llms-hallucinate-in-enterprise-contexts-and-how-contextual-grounding) -- Contextual grounding in enterprise search
- [GDPR Compliance for Google Workspace](https://support.google.com/a/answer/2888485) -- Privacy requirements for directory data
- [Google Workspace API User Data Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy) -- Data minimization and consent requirements
- [Loom Embed SDK API](https://dev.loom.com/docs/embed-sdk/api) -- oEmbed and embed methods
- [@loomhq/loom-embed npm](https://www.npmjs.com/package/@loomhq/loom-embed) -- Last published 2 years ago, v1.7.0
- [Loom SDK Changelog](https://sdkchangelog.loom.com/) -- Record SDK package renaming, deprecations
- [pgvector Performance Benchmarks](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/) -- HNSW performance at scale
- [GitHub: NextAuth Google Refresh Token Issues](https://github.com/nextauthjs/next-auth/discussions/3016) -- Known issues with offline access + JWT sessions
