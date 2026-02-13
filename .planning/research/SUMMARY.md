# Project Research Summary

**Project:** EverySkill v3.0 — AI Discovery & Workflow Intelligence
**Domain:** Multi-tenant AI skill marketplace with Google Workspace integration, visibility scoping, intent search, video integration
**Researched:** 2026-02-13
**Confidence:** HIGH (core patterns), MEDIUM (Google Workspace integration complexity)

## Executive Summary

EverySkill v3.0 extends the existing multi-tenant skill marketplace with eight capabilities that transform it from a catalog into an intelligent discovery and adoption platform. The research reveals a clear foundation-first architecture: visibility scoping is the bedrock that must be built before AI-powered features can safely operate. Google Workspace integration represents the highest-risk, highest-value feature, requiring separate OAuth flows and careful privacy handling. The recommended approach prioritizes quick wins (Loom video integration, MCP tool unification) in parallel with foundational work (visibility scoping, user preferences), followed by the intelligence layer (AI intent search, workspace diagnostics), and culminating in the homepage redesign that ties everything together.

The core technical insight is that v3.0 adds capabilities without requiring stack replacement. Five new npm packages (3 Google API clients, 2 Vercel AI SDK packages) extend the existing Next.js + pgvector + Anthropic infrastructure. The existing Drizzle ORM patterns, RLS policies, and multi-tenancy architecture remain intact. The main architectural risk is the hardcoded `DEFAULT_TENANT_ID` in 30+ files — new code must never continue this pattern.

Critical risks center on data isolation: visibility scoping without comprehensive query filtering causes cross-scope leakage (11+ query paths identified); Google Workspace integration without proper OAuth separation breaks existing auth flows; AI intent search without grounding in actual results hallucinates recommendations. The mitigation strategy is defense-in-depth: RLS for tenant isolation, application-layer visibility filters in every query path, structured output with Zod validation for LLM responses, and separate OAuth flows for Workspace scopes.

## Key Findings

### Recommended Stack

**Stack additions: 5 new npm packages, 0 existing changes.** The research validates the existing Next.js 16.1.6 + PostgreSQL + pgvector foundation and identifies minimal, high-value extensions. Google Workspace integration uses individual `@googleapis/*` packages (drive, calendar, gmail — 4.3MB total) rather than the monolithic 200MB `googleapis` package. AI intent search adds Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) for streaming conversational UX, while keeping the existing `@anthropic-ai/sdk` for batch operations. Loom integration requires zero dependencies — oEmbed endpoint via HTTP fetch is simpler and more maintainable than the stale `@loomhq/loom-embed` SDK.

**Core technologies:**
- **@googleapis/drive, calendar, gmail (^20.1.0, ^14.2.0, ^16.1.1):** Directory metadata for visibility scoping — individual packages share transitive deps, 98% smaller than monolith
- **Vercel AI SDK (ai@^6.0.86, @ai-sdk/anthropic@^3.0.43):** Streaming search chat with tool calls — coexists with existing Anthropic SDK, eliminates ~80% of streaming boilerplate
- **Loom oEmbed (no package):** Server-side metadata fetch + responsive iframe embed — avoids 45KB client-side SDK for functionality achievable in 20 lines

### Expected Features

**Must have (table stakes):**
- **Visibility scoping (3 levels):** `tenant` (default, current behavior), `personal` (author-only), defer `global` (cross-tenant) to later phase — RLS handles tenant isolation, application-layer filters handle visibility within tenant
- **AI intent search (semantic + keyword hybrid):** Natural language query "What are you trying to solve?" returns top-3 skills via Reciprocal Rank Fusion (RRF k=60) merging pgvector cosine + full-text search — NO conversational multi-turn (research confirms marginal benefit for single-domain QA)
- **Loom video integration:** Optional `loomUrl` field on skills, oEmbed for metadata, responsive iframe embed on detail page — video thumbnails in browse cards
- **MCP tool unification:** Single `everyskill` tool with search/install/describe sub-commands wrapping existing 16 MCP handlers — clean external discovery surface

**Should have (competitive):**
- **Admin-stamped global skills:** Department head + admin two-level approval workflow, "Company Approved" badge — separate from existing 7-status content review lifecycle
- **Personal preference extraction:** JSONB preferences storage with Zod schema for defaults, CLAUDE.md generation from user's skill portfolio — NO programmatic Claude.ai Projects API (doesn't exist)
- **Homepage redesign:** Search-first hero replacing metrics-first layout, personalized recommendations, company-approved section — additive changes preserving existing stat cards and leaderboard positions

**Defer (v2+ or validate-first):**
- **Google Workspace diagnostic:** Highest risk — requires separate OAuth flow (NOT via Auth.js), Directory API with admin setup, privacy/GDPR compliance, rate limit handling — build manual "time allocation survey" first to validate value prop before OAuth integration
- **Personalized "For You" section:** Requires usage history analysis and preference learning — defer until visibility + preferences ship and generate data
- **Department approval workflow:** Start with admin-only global stamping — add department chain if org structure demands it
- **Multi-format preference export:** Start with CLAUDE.md only — add .cursorrules and AGENTS.md based on user demand

### Architecture Approach

The recommended architecture is **foundation, intelligence, experience** layered. Visibility scoping modifies the existing skills schema and adds application-layer filters to all 11+ query paths — this is prerequisite infrastructure. Google Workspace integration uses a separate OAuth flow (custom API routes, not Auth.js) storing encrypted tokens in a new `workspace_tokens` table, with a `workspace_profiles` cache for directory metadata. AI intent search layers hybrid retrieval (RRF fusion) with optional Claude Haiku intent classification (parallel, sub-500ms timeout) on top of existing pgvector and full-text indexes. The homepage redesign is the integration point that surfaces all capabilities.

**Major components:**
1. **Visibility scoping service** — reusable `buildVisibilityFilter(userId, department?)` applied in every search/browse query path including MCP tools — status takes precedence (only published skills respect visibility)
2. **Workspace OAuth integration** — custom `/api/workspace/connect` and `/callback` routes, AES-256-GCM token encryption, per-tenant service account credentials — completely independent of user auth flow
3. **Hybrid search with RRF** — parallel full-text + semantic retrieval, Reciprocal Rank Fusion merge, optional preference boost — grounded recommendations via structured Zod-validated LLM output
4. **User preferences infrastructure** — single `user_preferences` table with JSONB data + Zod schema, code-defined defaults, server-authoritative (not localStorage) for search ranking
5. **Homepage personalization service** — aggregates recommendations, recent usage, saved searches, department highlights with graceful degradation when optional integrations unavailable

### Critical Pitfalls

1. **Google Workspace OAuth scope escalation breaks existing auth** — Adding Directory API scopes to the Google SSO provider in `auth.config.ts` forces re-consent for all users, and Directory API requires admin-level access that regular users don't have. Auth.js v5 does NOT support incremental authorization. **Prevention:** Use separate OAuth flow via custom API routes with service account + Domain-Wide Delegation for Directory access, stored per-tenant. User login and Workspace sync use different OAuth grants.

2. **Visibility scoping without comprehensive query filtering causes cross-scope data leakage** — The existing RLS policies check only `tenant_id`. Adding visibility as application-layer WHERE clauses works, but 11+ query paths exist (search, semantic search, trending, leaderboard, MCP tools, similar skills, direct URL access). Missing visibility filter in ANY path leaks private skills. **Prevention:** Create reusable `buildVisibilityFilter(userId, userDept?)` function imported in ALL query paths. Status takes precedence — only published skills respect visibility. MCP tools need userId parameter for filtering.

3. **AI intent search hallucinating skill recommendations** — LLM synthesizing search results can fabricate capabilities or non-existent skills if results are poor matches. The existing pgvector semantic search returns similarity scores but no LLM interpretation layer exists. **Prevention:** Ground ALL recommendations in actual search results. Use similarity threshold (min 0.3). Template prompt with structured output (Zod schema: `{recommendations: [{skillSlug, reason, confidence}]}`). Show raw results alongside AI summary. Link every recommendation to actual `/skills/[slug]`.

4. **DEFAULT_TENANT_ID hardcoded in 30+ files collides with multi-tenant Workspace sync** — Grep reveals hardcoded `"default-tenant-000-0000-000000000000"` in server actions, MCP tools, lib files, E2E tests. Workspace integration is inherently multi-tenant (each tenant connects their own Google Workspace). If Workspace sync uses DEFAULT_TENANT_ID, it merges all tenants' directory data into one namespace. **Prevention:** New v3.0 code must ALWAYS resolve tenant from `session.user.tenantId`. Create `resolveTenantId(session)` helper that throws if missing. Workspace credentials and directory cache keyed by `tenantId` parameter (required, not optional with DEFAULT fallback).

5. **Workspace directory sync rate limits and partial failures** — Google Directory API: 2,400 queries/min/user/project. Full sync for 5,000 users = 10 API calls (no problem), but 50,000 users = 100 calls. Simultaneous tenant onboarding hits quota. Partial sync failures leave stale data. **Prevention:** Incremental sync (not full), database-backed job queue per tenant with `lastPageToken` resume point, cache directory in `workspace_profiles` table (never query Google API at request time), store sync metadata (`lastFullSyncAt`, `syncStatus`, `totalUsersSynced`).

## Implications for Roadmap

Based on research, suggested phase structure follows dependency ordering and risk isolation:

### Phase 1: Foundation Layer (Parallel Execution)
**Rationale:** These three features have zero dependencies on each other and establish prerequisites for later phases. Visibility scoping is the most critical — every feature built after it depends on proper access control. Loom and MCP are quick wins that deliver value immediately.

**Delivers:**
- Visibility scoping schema (`visibility` column: tenant/personal/global, defer global implementation) + reusable filter service
- Loom video integration (`loomUrl` field, oEmbed metadata, responsive iframe embed component)
- MCP tool unification (single `everyskill` tool wrapping existing 16 handlers with sub-commands)

**Addresses:** Table stakes features — visibility control, video demos, external discovery
**Avoids:** Pitfall 2 (cross-scope leakage via comprehensive filtering), Pitfall 13 (CSP for Loom embeds)
**Research needed:** SKIP (established patterns, direct schema changes)

### Phase 2: User Preferences & Search Enhancement
**Rationale:** Preferences infrastructure is needed for AI intent search's preference-boosted ranking. Both can build after visibility scoping ships (search must filter by visibility). Hybrid search extends existing full-text + semantic indexes without replacing them.

**Delivers:**
- User preferences table (JSONB storage with Zod schema, code-defined defaults)
- Hybrid search service (RRF k=60 fusion of full-text + pgvector semantic results)
- Optional intent classification (Claude Haiku, <500ms timeout, graceful degradation)
- Search history tracking (fire-and-forget, 90-day retention)

**Uses:** Vercel AI SDK for structured LLM output, existing pgvector + Voyage AI embeddings
**Implements:** Preference boost layer (applied after RRF), visibility filtering in hybrid search path
**Avoids:** Pitfall 3 (hallucination via grounding + similarity thresholds), Pitfall 14 (latency via parallel fetch + caching)
**Research needed:** SKIP for hybrid search (RRF is standard), LIGHT for intent classifier (prompt engineering validation during implementation)

### Phase 3: Workspace Integration (High-Risk, Validate-First)
**Rationale:** Independent of search features but required for department-based visibility (deferred). Highest complexity due to OAuth, privacy, and rate limits. Build in isolation with feature flag.

**Delivers:**
- Separate Workspace OAuth flow (custom `/api/workspace/connect` + `/callback` routes)
- Token encryption (AES-256-GCM) and secure storage (`workspace_tokens` table per tenant)
- Directory sync service (incremental, paginated, resume-from-last-page)
- Cached directory profiles (`workspace_profiles` table with email, name, department, title, orgUnitPath)
- Admin Workspace settings page (connect/disconnect, sync status, data minimization consent)

**Uses:** Individual `@googleapis/*` packages (drive, calendar, gmail)
**Avoids:** Pitfall 1 (separate OAuth, not Auth.js scope expansion), Pitfall 5 (incremental sync + job queue), Pitfall 12 (privacy via data minimization + admin consent screen)
**Research needed:** MEDIUM — OAuth verification process (2-4 weeks Google review), Directory API behavior (updatedMin parameter), GDPR compliance specifics depend on jurisdiction

### Phase 4: Admin-Stamped Global Skills
**Rationale:** Requires visibility scoping (Phase 1) to distinguish global from tenant scopes. Can build before or in parallel with Workspace sync — does NOT require department approval workflow initially.

**Delivers:**
- "Stamp as global" admin action on published skills
- Global approval status field (separate from existing 7-status content lifecycle)
- "Company Approved" badge component
- "Company Recommended" homepage section

**Addresses:** Competitive feature — governance and curation for enterprise adoption
**Avoids:** Pitfall 15 (status + visibility interaction — status takes precedence)
**Research needed:** SKIP (enterprise approval patterns well-documented)

### Phase 5: Homepage Redesign (Integration Phase)
**Rationale:** Requires visibility scoping (Phase 1), hybrid search (Phase 2), admin-stamped global skills (Phase 4). Optional: Workspace profiles (Phase 3) for department highlights. This phase surfaces all capabilities.

**Delivers:**
- Search-first hero layout (large search bar, category pills)
- Personalized recommendations (hybrid search with empty query + user preferences)
- Company Recommended section (admin-stamped global skills)
- Redesigned trending/leaderboard as cards (not tables)
- Condensed platform metrics banner

**Implements:** Personalized feed service with graceful degradation (works without Workspace integration)
**Avoids:** Pitfall 7 (performance via caching slow queries + Suspense boundaries + async AI), Pitfall 11 (breaking workflows via additive changes + feature flags)
**Research needed:** SKIP (marketplace homepage patterns well-established)

### Phase Ordering Rationale

- **Phase 1 parallelism:** Visibility, Loom, MCP have no shared files — safe parallel execution
- **Phase 2 dependencies:** Preferences before hybrid search (search uses prefs for boost), both after visibility (search filters by visibility)
- **Phase 3 isolation:** Workspace integration is highest risk — feature flag allows rollback without affecting other phases
- **Phases 4-5 convergence:** Admin stamping and homepage redesign compose features from earlier phases, minimal new infrastructure

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Workspace):** OAuth verification timeline, Directory API `updatedMin` parameter behavior, GDPR compliance specifics for jurisdiction — allocate 2 weeks for verification process
- **Phase 2 (Intent classifier):** Prompt engineering for intent extraction quality — validate with sample queries during implementation, not blocking

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (all):** Schema migrations, oEmbed patterns, MCP tool composition are well-documented
- **Phase 2 (hybrid search):** RRF algorithm is standard, pgvector + full-text patterns already proven in codebase
- **Phase 4:** Enterprise approval workflows are well-established (SharePoint, Confluence)
- **Phase 5:** Marketplace homepage patterns are well-documented (Atlassian, Notion, Slack)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified npm versions, compatibility matrix, existing codebase analysis (17K LOC audited). Vercel AI SDK peer deps match installed React 19.2.4 + Zod 3.25.76 exactly. Google API individual packages confirmed 98% smaller than monolith. |
| Features | HIGH | Visibility scoping, Loom, homepage redesign based on established marketplace patterns (Atlassian, Notion, Linear). MEDIUM for AI intent search (prompt quality needs validation) and Workspace diagnostic (value prop unvalidated — survey-first recommended). |
| Architecture | HIGH | Direct codebase analysis of schema (17 tables), services (21 files), auth flow (Auth.js v5 + JWT + RLS). Separate OAuth pattern verified against Auth.js limitations (GitHub #10261). RRF hybrid search is standard approach. |
| Pitfalls | HIGH | Critical pitfalls verified via codebase grep (DEFAULT_TENANT_ID in 30+ files, 11+ query paths for visibility), Auth.js GitHub discussions (incremental auth not supported), Google API docs (rate limits, Directory API scopes). |

**Overall confidence:** HIGH for core patterns and infrastructure. MEDIUM for Google Workspace integration complexity (OAuth verification, privacy compliance, rate limits require careful handling but are manageable with research findings).

### Gaps to Address

- **Embedding model decision:** Current Ollama local (`nomic-embed-text` 768-dim) vs cloud provider (Voyage AI, OpenAI) affects AI intent search. Switching models invalidates all existing embeddings. **Resolution:** Decide before Phase 2 starts. If switching, plan re-embedding migration (batch process, exponential backoff on rate limits, use existing `inputHash` to skip unchanged skills).

- **Department/team data dependency:** Visibility scoping Phase 1 should implement only `tenant` and `personal`. Defer `team` and `department` scopes to Phase 1b AFTER Workspace sync (Phase 3) populates organizational data. Alternative: manual team assignment in admin settings for non-Google orgs. **Resolution:** Phase 1 delivers two visibility levels, Phase 3 enables the other two.

- **Google Workspace value validation:** Workspace diagnostic is highest risk, unvalidated feature. NO competitor does "workspace activity analysis → skill recommendation" in this exact pattern. **Resolution:** Build manual "time allocation survey" in Phase 3a before OAuth integration in Phase 3b. If survey engagement is low, skip OAuth entirely and archive the feature.

- **Homepage performance budget:** Current homepage fetches 8 parallel queries. v3.0 adds 4-5 more (recommendations, activity feed, department highlights). Database connection pool default size (likely 10) insufficient. **Resolution:** Set performance budget in Phase 5 planning (TTFB < 400ms p95). Cache slow queries (platform stats, trending — 5min TTL), async-load AI recommendations via Suspense, monitor connection pool usage.

## Sources

### Primary (HIGH confidence)
- **Direct codebase analysis (17,000+ LOC):** 17 schema files, 21 service files, auth flow (auth.ts, auth.config.ts, middleware.ts), 11+ search query paths, homepage (8 parallel queries), 30+ files with DEFAULT_TENANT_ID hardcoded
- **npm registry (verified 2026-02-13):** @googleapis/drive@20.1.0 (2.3MB), calendar@14.2.0 (809KB), gmail@16.1.1 (1.1MB) vs googleapis@171.4.0 (200MB), ai@6.0.86 + @ai-sdk/anthropic@3.0.43, @loomhq/loom-embed@1.7.0 (last published 2 years ago)
- **Auth.js GitHub Discussions:** #10261 (incremental auth not supported), #3016 (refresh token issues)
- **Google official docs:** Directory API rate limits (2,400 queries/min/user/project), OAuth scopes (directory.readonly requires admin or DWD), Domain-Wide Delegation setup
- **Loom official docs:** oEmbed endpoint (https://www.loom.com/v1/oembed), Embed SDK API (client-side only)

### Secondary (MEDIUM confidence)
- **Hybrid search patterns:** ParadeDB hybrid search guide (RRF k=60 standard), pgvector Jonathan Katz hybrid search blog
- **RAG research:** arxiv 2602.09552 (single-query vs multi-turn RAG effectiveness for single-domain QA), arxiv 2510.24476v1 (hallucination mitigation via grounding)
- **Enterprise search UX:** Kore.ai enterprise search patterns (intent understanding), Algolia marketplace search UX (sub-200ms expectation)
- **Marketplace design:** Atlassian Marketplace (hero search + category pills), Notion Template Gallery (visual cards), Slack App Directory (featured apps)
- **Privacy compliance:** Google Workspace GDPR compliance guides (data minimization), Google Workspace API User Data Policy

### Tertiary (validation needed)
- **Voyage AI rate limits:** Project memory notes "tight rate limits" but specific QPM not documented — validate during Phase 2 if switching from Ollama
- **Loom roadmap under Atlassian:** Loom acquired 2023, SDK v1.7.0 published 2 years ago, no public embed API roadmap — oEmbed approach mitigates SDK deprecation risk but long-term embed stability is LOW confidence

---
*Research completed: 2026-02-13*
*Ready for roadmap: yes*
*Next step: Roadmapper agent consumes this summary to structure v3.0 phases*
