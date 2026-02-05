# Architecture Research

**Domain:** Internal Skill Marketplace / Developer Tool Catalog
**Researched:** 2026-01-31
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
+-----------------------------------------------------------------------------+
|                           PRESENTATION LAYER                                 |
+-----------------------------------------------------------------------------+
|  +-------------+  +-------------+  +-------------+  +-------------+        |
|  |  Web App    |  | MCP Server  |  |  REST API   |  |  CLI (v2)   |        |
|  |  (Browse,   |  |  (Deploy,   |  |  (External  |  |  (Future)   |        |
|  |  Publish)   |  |  Track)     |  |  Integrations)| |             |        |
|  +------+------+  +------+------+  +------+------+  +------+------+        |
|         |                |                |                |               |
+---------|----------------|----------------|----------------|---------------+
|                            SERVICE LAYER                                    |
+-----------------------------------------------------------------------------+
|  +---------------+  +---------------+  +---------------+  +-------------+  |
|  | Skill Service |  | Metrics       |  | Search        |  | Auth        |  |
|  | (CRUD,        |  | Service       |  | Service       |  | Service     |  |
|  |  Versions)    |  | (Track, Agg)  |  | (FTS, Filter) |  | (SSO)       |  |
|  +-------+-------+  +-------+-------+  +-------+-------+  +------+------+  |
|          |                  |                  |                 |         |
+----------|------------------|------------------|-----------------|----------+
|                           DATA LAYER                                        |
+-----------------------------------------------------------------------------+
|  +--------------+  +--------------+  +--------------+  +--------------+    |
|  |  PostgreSQL  |  | Object Store |  | Search Index |  | Cache        |    |
|  |  (Skills,    |  | (Skill       |  | (Optional)   |  | (Redis)      |    |
|  |  Metrics)    |  | Content)     |  |              |  |              |    |
|  +--------------+  +--------------+  +--------------+  +--------------+    |
+-----------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Web Application | Browse, search, publish skills; view metrics; user dashboard | Next.js with React, server-side rendering for SEO |
| MCP Server | Deploy skills to Claude, track usage events, query catalog | Node.js or Python, implements MCP specification |
| REST API | Programmatic access for integrations, CI/CD hooks | Express or FastAPI, OpenAPI documented |
| Skill Service | CRUD for skills/versions, validation, format handling | Domain service, handles multiple skill formats |
| Metrics Service | Ingest usage events, aggregate FTE Days Saved, compute rankings | Event-driven, async processing |
| Search Service | Full-text search, category filtering, ranking by metrics | PostgreSQL FTS initially, Elasticsearch for scale |
| Auth Service | Google Workspace SSO, session management, domain restriction | OAuth 2.0 / OIDC with Google as IdP |
| PostgreSQL | Skills, versions, users, reviews, metrics (primary store) | Relational with JSONB for flexible skill metadata |
| Object Store | Skill content files (prompts, configs, agent files) | S3-compatible (AWS S3, MinIO, GCS) |
| Search Index | Optional dedicated search for scale | Elasticsearch or Algolia (500+ users may not need) |
| Cache | Session data, hot skill metadata, search results | Redis for speed |

## Recommended Project Structure

```
relay/
+-- apps/
|   +-- web/                    # Next.js web application
|   |   +-- app/                # App router pages
|   |   +-- components/         # React components
|   |   +-- lib/                # Client utilities
|   |   +-- styles/             # CSS/Tailwind
|   +-- mcp-server/             # MCP server for Claude integration
|   |   +-- src/
|   |   |   +-- handlers/       # MCP tool handlers
|   |   |   +-- client/         # API client to backend
|   |   |   +-- tracking/       # Usage event collection
|   |   +-- package.json
|   +-- api/                    # REST API (if separate from web)
|       +-- src/
+-- packages/
|   +-- db/                     # Database schema, migrations, client
|   |   +-- prisma/             # Prisma schema
|   |   +-- migrations/         # SQL migrations
|   |   +-- src/                # Database client
|   +-- shared/                 # Shared types, utilities
|   |   +-- types/              # TypeScript interfaces
|   |   +-- validation/         # Zod schemas
|   +-- skill-formats/          # Skill format parsers/validators
|       +-- claude-code/        # Claude Code skill format
|       +-- prompt/             # Prompt format
|       +-- workflow/           # Workflow format
|       +-- agent-config/       # Agent config format
+-- infrastructure/
|   +-- docker/                 # Docker configs
|   +-- terraform/              # IaC (optional)
+-- docs/                       # Documentation
```

### Structure Rationale

- **apps/**: Deployable applications separated by deployment target. Web and MCP server have different lifecycles.
- **packages/**: Shared code across apps. Monorepo pattern for type safety and code reuse.
- **packages/skill-formats/**: Format-specific parsing isolated; new formats added without touching core services.
- **packages/db/**: Single source of truth for schema; Prisma generates type-safe client.

## Architectural Patterns

### Pattern 1: Version-Immutable Content Model

**What:** Each skill version is immutable once published. New contributions create new versions, never modify existing ones.
**When to use:** Wiki-style versioning where history matters and metrics are per-version.
**Trade-offs:** Storage grows with versions (+), audit trail built-in (+), no data loss risk (+), requires garbage collection strategy for unused versions (-).

**Example:**
```typescript
// Skills are containers; versions hold the actual content
interface Skill {
  id: string;
  name: string;
  createdAt: Date;
  createdBy: string;
  latestVersionId: string;  // Points to current "best" version
}

interface SkillVersion {
  id: string;
  skillId: string;
  versionNumber: number;  // Auto-incremented per skill
  content: SkillContent;  // Stored in object storage
  metadata: SkillMetadata;
  createdAt: Date;
  createdBy: string;
  commitMessage: string;
  // Per-version metrics
  usageCount: number;
  avgRating: number;
  estimatedHoursSaved: number;
}
```

### Pattern 2: Separated Metadata and Content Storage

**What:** Store skill metadata (searchable, frequently accessed) in PostgreSQL; store actual skill content (files, large text) in object storage.
**When to use:** When content can be large (agent configs with embedded examples) and access patterns differ.
**Trade-offs:** Fast metadata queries (+), cheap content storage (+), content versioning via object keys (+), additional infrastructure (-), eventual consistency possible (-).

**Example:**
```typescript
// In PostgreSQL
{
  id: "ver_123",
  skillId: "skill_456",
  contentHash: "sha256:abc...",  // Content integrity
  contentUrl: "s3://relay-content/skills/456/versions/123/content.zip",
  metadata: { ... }  // JSONB
}

// In Object Storage
// s3://relay-content/skills/456/versions/123/content.zip
// Contains: skill.md, README.md, examples/, etc.
```

### Pattern 3: Event-Driven Metrics Ingestion

**What:** MCP server emits usage events to a queue; metrics service consumes and aggregates asynchronously.
**When to use:** When tracking should not block user actions and aggregations need flexibility.
**Trade-offs:** Non-blocking tracking (+), can replay events (+), batch aggregation efficient (+), slight delay in metric visibility (-), queue infrastructure required (-).

**Example:**
```typescript
// MCP server emits event
{
  type: "skill_used",
  skillVersionId: "ver_123",
  userId: "user_789",
  timestamp: "2026-01-31T10:00:00Z",
  context: {
    duration_seconds: 45,
    success: true
  }
}

// Metrics service aggregates
// Hourly: increment counters, update rolling averages
// Daily: compute FTE Days Saved, update rankings
```

### Pattern 4: Progressive Loading for MCP

**What:** MCP server returns skill summaries first; full content loaded only when skill is deployed.
**When to use:** When skill catalog is large and MCP context window is limited.
**Trade-offs:** Fast browsing (+), efficient context usage (+), aligns with Anthropic's skill architecture (+), two-phase loading complexity (-).

**Example:**
```typescript
// MCP list_skills returns summaries
{
  tools: [{
    name: "relay_list_skills",
    description: "Lists available skills from Relay catalog"
  }]
}

// Response: summaries only (few dozen tokens each)
[
  { id: "skill_1", name: "Code Review Checklist", rating: 4.8, uses: 1200 },
  { id: "skill_2", name: "API Documentation", rating: 4.5, uses: 890 }
]

// MCP deploy_skill fetches full content on demand
{
  name: "relay_deploy_skill",
  arguments: { skillId: "skill_1" }
}
// Returns full skill content for Claude to use
```

## Data Flow

### Request Flow: Publish New Version

```
User -> Web App -> Auth (verify SSO) -> Skill Service -> Validate Format
                                          |
                    Content Storage <- Upload Content -> PostgreSQL
                                          |
                           Search Service -> Update Index
                                          |
                           Response <- New Version Created
```

### Request Flow: Deploy Skill via MCP

```
Claude User -> MCP Server -> Auth (verify token) -> Skill Service
                                                      |
                         Content Storage <- Fetch Content
                                                      |
                         MCP Server <- Return Skill
                                                      |
                         Claude Loads Skill
                                                      |
                         [Later: Usage Event] -> Metrics Queue -> Metrics Service
```

### Key Data Flows

1. **Publish Flow:** User submits skill through web app; content validated, stored to object storage, metadata to PostgreSQL, search index updated.
2. **Browse Flow:** User searches catalog; PostgreSQL (or search index) queried, results ranked by metrics, skill cards returned.
3. **Deploy Flow:** MCP client requests skill; content fetched from object storage, returned to Claude for execution.
4. **Tracking Flow:** Skill executes; MCP server emits usage event; metrics service aggregates; dashboards updated.
5. **Rating Flow:** User submits review with time estimate; updates skill version's metrics; propagates to skill aggregate.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users (v1) | Single PostgreSQL with built-in FTS; Redis for sessions; S3 for content. All services in one deployment. |
| 500-5k users | Add read replicas for PostgreSQL; dedicated search (Elasticsearch); CDN for content delivery; separate MCP server deployment. |
| 5k+ users | Shard metrics by time; event streaming (Kafka) for tracking; regional deployments; dedicated analytics database. |

### Scaling Priorities

1. **First bottleneck (likely: search):** PostgreSQL FTS degrades with complex queries at scale. Solution: Add Elasticsearch or Algolia when search latency exceeds 200ms.
2. **Second bottleneck (likely: content delivery):** Large skill files slow deployment. Solution: CDN for object storage; cache popular skills at edge.
3. **Third bottleneck (likely: metrics aggregation):** Real-time aggregation expensive. Solution: Pre-compute aggregations; materialized views; async updates.

## Anti-Patterns

### Anti-Pattern 1: Storing Skill Content in PostgreSQL

**What people do:** Store skill file content as TEXT or BYTEA columns in PostgreSQL.
**Why it's wrong:** Bloats database, slows backups, mixes hot metadata with cold content, makes versioning expensive.
**Do this instead:** Store content in object storage (S3), store URL/hash in PostgreSQL. Content is immutable; reference it by hash.

### Anti-Pattern 2: Synchronous Metrics Tracking

**What people do:** Write usage metrics directly to PostgreSQL in the request path.
**Why it's wrong:** Adds latency to skill execution; database writes block user; metrics spikes cause cascading slowdowns.
**Do this instead:** Emit events to queue (Redis, SQS, Kafka); process asynchronously; batch writes to database.

### Anti-Pattern 3: Monolithic Skill Format

**What people do:** Force all skills into a single format (e.g., only Claude Code skills).
**Why it's wrong:** Limits adoption; some workflows are better as prompts, some as agent configs. Different tools need different formats.
**Do this instead:** Define format-agnostic skill container; format-specific parsers in `skill-formats/` package; validate per-format; store content generically.

### Anti-Pattern 4: Tight MCP-Backend Coupling

**What people do:** MCP server directly queries PostgreSQL and accesses object storage.
**Why it's wrong:** MCP server runs locally on user machines; exposing DB credentials is a security risk; harder to evolve backend independently.
**Do this instead:** MCP server calls REST API; API handles auth, business logic, data access. MCP server is thin client with local caching.

### Anti-Pattern 5: Conflating Skill Identity with Version Identity

**What people do:** Use skill ID everywhere, including for metrics and deployments.
**Why it's wrong:** Metrics become ambiguous (which version?); can't compare version performance; breaks wiki-style model.
**Do this instead:** Skills have IDs for browsing; versions have IDs for deployment and metrics. Always track at version granularity; aggregate to skill for display.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Workspace | OAuth 2.0 / OIDC | Use authorization code flow; restrict to company domain; sync user profile |
| Claude (via MCP) | MCP Protocol | MCP server implements tools; uses stdio or HTTP transport |
| Object Storage (S3) | AWS SDK or S3-compatible API | Presigned URLs for upload; public read with CDN, or presigned for private |
| Search (optional) | REST API | Elasticsearch or Algolia REST; sync via webhooks or polling |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web App to Backend API | REST/GraphQL over HTTPS | API Gateway pattern; JWT auth |
| MCP Server to Backend API | REST over HTTPS | API key or JWT; rate limiting per user |
| Backend to Database | Prisma Client (type-safe) | Connection pooling; read replicas if needed |
| Backend to Object Storage | S3 SDK | Presigned URLs for browser upload; server-side for MCP |
| Backend to Search Index | REST API | Webhook for updates; REST for queries |
| Backend to Cache | Redis Client | Session storage; hot data caching |
| Backend to Metrics Queue | Producer/Consumer | Redis Streams, SQS, or Kafka (scale-dependent) |

## Build Order Implications

Based on component dependencies, recommended build sequence:

```
Phase 1: Foundation
+-- Database schema (skills, versions, users)
+-- Auth service (Google SSO)
+-- Basic Skill Service (CRUD)

Phase 2: Core Web Experience
+-- Web app (browse, publish)
+-- Search (PostgreSQL FTS initially)
+-- Content storage integration

Phase 3: MCP Integration
+-- MCP Server (list, deploy)
+-- REST API for MCP access
+-- Usage event emission

Phase 4: Metrics & Polish
+-- Metrics service (aggregation)
+-- Dashboard views
+-- Rating/review system

Phase 5: Scale (as needed)
+-- Dedicated search index
+-- CDN for content
+-- Event streaming for metrics
```

**Why this order:**
1. **Database first:** All components depend on data model; schema changes are expensive later.
2. **Auth early:** Every endpoint needs authentication; building without it creates security debt.
3. **Web before MCP:** Web app validates data model and UX; MCP consumes same API.
4. **MCP before metrics:** Need usage events before metrics aggregation makes sense.
5. **Scale last:** Premature optimization; 500 users doesn't need Elasticsearch or Kafka.

## Sources

- [Backstage Architecture Overview](https://backstage.io/docs/overview/architecture-overview/)
- [Backstage Software Catalog](https://backstage.io/docs/features/software-catalog/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [Anthropic Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Internal Developer Platform Reference](https://internaldeveloperplatform.org/)
- [NPM Registry Architecture](https://blog.npmjs.org/post/75707294465/new-npm-registry-architecture.html)
- [Google Workspace SSO Documentation](https://support.google.com/a/answer/12032922)
- [Algolia vs Elasticsearch Comparison](https://www.algolia.com/blog/engineering/full-text-search-in-your-database-algolia-vs-elasticsearch)
- [Real-time Streaming Architecture Patterns](https://www.confluent.io/learn/real-time-streaming-architecture-examples/)

---

# v1.4 Employee Analytics, MCP Auth & Remote MCP: Integration Architecture

**Milestone:** v1.4 Employee Analytics & Remote MCP
**Researched:** 2026-02-05
**Confidence:** HIGH (existing codebase analysis, MCP SDK documentation, official Next.js/Vercel docs)

## Executive Summary

v1.4 adds six capabilities to Relay: per-employee usage tracking, org API keys for MCP auth, install callback analytics, a usage analytics dashboard, web remote MCP via Streamable HTTP, and extended search. This document maps exactly how each feature integrates with the existing Next.js 15 + MCP stdio + PostgreSQL architecture, what new components are needed, and the recommended build order.

**Critical architectural insight:** The current MCP server (`apps/mcp`) connects directly to PostgreSQL via `DATABASE_URL`. For remote MCP, the server needs to transition from stdio-only to also supporting Streamable HTTP transport over an authenticated endpoint. The cleanest approach is to add the remote MCP endpoint as a Next.js API route using `mcp-handler` (Vercel's adapter), keeping the existing stdio server intact for local use. This avoids duplicating tool logic and naturally shares the web app's database connection and auth infrastructure.

## Existing Architecture Reference

```
+-------------------------------------------------------------------------+
|                           CURRENT STATE (v1.3)                           |
+-------------------------------------------------------------------------+
|                                                                         |
|  apps/web (Next.js 15 App Router)      apps/mcp (stdio MCP Server)     |
|  +-- app/                              +-- tools/                       |
|  |   +-- (protected)/                  |   +-- search.ts                |
|  |   |   +-- skills/page.tsx           |   +-- list.ts                  |
|  |   |   +-- skills/[slug]/page.tsx    |   +-- deploy.ts                |
|  |   |   +-- skills/new/page.tsx       +-- tracking/                    |
|  |   |   +-- profile/page.tsx              +-- events.ts                |
|  |   |   +-- users/[id]/page.tsx                                        |
|  |   +-- actions/                                                       |
|  |   |   +-- skills.ts                                                  |
|  |   |   +-- ratings.ts                                                 |
|  |   |   +-- ai-review.ts                                               |
|  |   |   +-- fork-skill.ts                                              |
|  |   +-- api/auth/[...nextauth]/route.ts                                |
|  |   +-- api/dev-login/route.ts                                         |
|  +-- lib/                                                               |
|  |   +-- search-skills.ts                                               |
|  |   +-- platform-stats.ts                                              |
|  |   +-- user-stats.ts                                                  |
|  |   +-- usage-trends.ts                                                |
|  |   +-- leaderboard.ts                                                 |
|  |   +-- install-script.ts                                              |
|  |   +-- mcp-config.ts                                                  |
|  +-- middleware.ts (Auth.js + edge redirect)                             |
|  +-- auth.ts (Auth.js v5, Google SSO, JWT strategy)                     |
|  +-- auth.config.ts (Edge-compatible config)                            |
|                                                                         |
|  packages/db (Drizzle ORM + PostgreSQL)                                 |
|  +-- schema/                                                            |
|  |   +-- skills.ts (searchVector, forkedFromId, publishedVersionId)     |
|  |   +-- users.ts                                                       |
|  |   +-- usage-events.ts (toolName, skillId, userId, metadata, jsonb)   |
|  |   +-- ratings.ts                                                     |
|  |   +-- skill-versions.ts                                              |
|  |   +-- skill-embeddings.ts                                            |
|  |   +-- skill-reviews.ts                                               |
|  +-- services/                                                          |
|  |   +-- skill-metrics.ts (incrementSkillUses, updateSkillRating)       |
|  |   +-- skill-embeddings.ts                                            |
|  |   +-- skill-forks.ts                                                 |
|  |   +-- skill-reviews.ts                                               |
|  +-- relations/index.ts                                                 |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Current State: Key Facts

1. **MCP server** uses `StdioServerTransport` from `@modelcontextprotocol/sdk` v1.25.0. No HTTP transport, no authentication.
2. **MCP tracking** calls `trackUsage()` which inserts into `usage_events` table. Currently has no `userId` populated (no auth context in stdio MCP).
3. **usage_events schema** already has a nullable `userId` column referencing `users.id`, but it is never set by MCP tools.
4. **Web auth** uses Auth.js v5 with JWT session strategy, Google Workspace SSO restricted to company domain. Middleware redirects unauthenticated users.
5. **Middleware matcher** exempts `/api/auth` and `/api/dev-login`. New API routes for MCP and callbacks will need similar exemptions.
6. **Search** in `search-skills.ts` uses PostgreSQL `websearch_to_tsquery` with ILIKE fallback. Already searches `skills.name`, `skills.description`, `users.name`, and `skills.tags` (via `array_to_string`).

## Feature Integration Map

### Feature 1: Org API Keys for MCP Authentication

**Goal:** Tie MCP sessions to specific employees. When a user calls `list_skills` or `deploy_skill` via MCP, the system knows who they are.

#### New Schema: `api_keys` Table

```
+-------------------------------------------------------------------------+
|  packages/db/src/schema/api-keys.ts (NEW)                               |
+-------------------------------------------------------------------------+
|                                                                         |
|  api_keys                                                               |
|  +-- id: uuid (PK)                                                     |
|  +-- userId: text -> users.id (who owns this key)                       |
|  +-- keyHash: text (SHA-256 of the actual key; never store plaintext)   |
|  +-- keyPrefix: text (first 8 chars for display: "rl_abc12...")         |
|  +-- name: text (user-given label, e.g. "Work Laptop")                 |
|  +-- lastUsedAt: timestamp (nullable, updated on each use)              |
|  +-- createdAt: timestamp                                               |
|  +-- revokedAt: timestamp (nullable; soft-delete)                       |
|                                                                         |
+-------------------------------------------------------------------------+
```

**Design decisions:**
- Store `keyHash` (SHA-256), not the plaintext key. The full key is shown once on creation.
- `keyPrefix` (e.g., `rl_abc12345...`) allows users to identify keys without exposing the secret.
- `revokedAt` enables soft-delete. Revoked keys fail validation immediately.
- No scopes or role-based permissions for v1.4. All keys get full read access (list, search, deploy). Write operations (publish) remain web-only.

**Key format:** `rl_<32 random hex chars>` (e.g., `rl_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`)

#### Integration Points

| Component | Type | Change |
|-----------|------|--------|
| `packages/db/src/schema/api-keys.ts` | NEW | Table definition |
| `packages/db/src/schema/index.ts` | MODIFY | Export new schema |
| `packages/db/src/relations/index.ts` | MODIFY | Add user -> apiKeys relation |
| `packages/db/src/services/api-keys.ts` | NEW | createKey, validateKey, revokeKey, listKeys |
| `apps/web/app/(protected)/profile/page.tsx` | MODIFY | Add API key management section |
| `apps/web/app/actions/api-keys.ts` | NEW | Server Actions for key CRUD |
| `apps/web/components/api-key-manager.tsx` | NEW | UI for creating/revoking keys |
| `apps/web/app/api/auth/validate-key/route.ts` | NEW | API route for key validation (used by MCP) |

#### Key Validation Flow

```
MCP Client sends request with Authorization header
    |
    v
API Route / MCP endpoint receives request
    |
    v
Extract Bearer token from Authorization header
    |
    v
SHA-256 hash the token
    |
    v
Query: SELECT * FROM api_keys WHERE key_hash = $hash AND revoked_at IS NULL
    |
    +-- Not found -> 401 Unauthorized
    |
    +-- Found -> Update last_used_at, return userId
    |
    v
Attach userId to request context / MCP authInfo
    |
    v
Tool handlers receive userId, pass to trackUsage()
```

### Feature 2: Per-Employee Usage Tracking

**Goal:** Populate `usage_events.userId` so analytics can show who used what.

#### How It Works with Existing Architecture

The `trackUsage()` function in `apps/mcp/src/tracking/events.ts` already accepts an event object with an optional `userId` field. The `usage_events` schema already has a nullable `userId` column. The only missing piece is the identity context flowing from authentication into tool handlers.

**For stdio MCP (existing):**
- Add optional `--api-key` CLI flag or `RELAY_API_KEY` env var
- On startup, validate key against the web app's API route
- Cache the resolved `userId` for the session lifetime
- Pass `userId` into every `trackUsage()` call

**For remote MCP (new):**
- `authInfo` is automatically available in tool handlers via the MCP SDK
- Extract `userId` from `authInfo` and pass to `trackUsage()`

#### Integration Points

| Component | Type | Change |
|-----------|------|--------|
| `apps/mcp/src/index.ts` | MODIFY | Parse --api-key / RELAY_API_KEY, validate on startup |
| `apps/mcp/src/tracking/events.ts` | MODIFY | Accept userId parameter in all trackUsage calls |
| `apps/mcp/src/tools/search.ts` | MODIFY | Pass userId from context into trackUsage |
| `apps/mcp/src/tools/list.ts` | MODIFY | Same |
| `apps/mcp/src/tools/deploy.ts` | MODIFY | Same |

#### Data Flow

```
MCP startup (stdio mode):
    |
    v
Read RELAY_API_KEY from env
    |
    v
POST /api/auth/validate-key { key: RELAY_API_KEY }
    |
    +-- 200 { userId: "abc", userName: "Alice" }
    |       -> Store in memory, attach to all trackUsage() calls
    |
    +-- 401 -> Log warning, continue without userId (anonymous usage)
```

### Feature 3: Install Callback Analytics

**Goal:** When a user runs the install script, "phone home" to record the install event with employee attribution and platform info.

#### Architecture

The existing `install-script.ts` generates bash/PowerShell scripts that configure Claude Desktop. These scripts need a callback step that pings the web app API with install metadata.

**New API route:** `POST /api/callbacks/install`

```
Install script runs on user's machine
    |
    v
Script configures MCP in claude_desktop_config.json
    |
    v
Script calls: curl -X POST https://relay.company.com/api/callbacks/install \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"platform":"claude-desktop","os":"macos"}'
    |
    v
API route validates Bearer token (same api_keys table)
    |
    v
Insert into install_events table
    |
    v
Return 200 OK (non-blocking; script doesn't fail on callback error)
```

#### New Schema: `install_events` Table

```
install_events
+-- id: uuid (PK)
+-- userId: text -> users.id (from API key)
+-- platform: text ("claude-desktop" | "claude-code" | "other-ide" | "other-systems")
+-- os: text ("macos" | "windows" | "linux")
+-- metadata: jsonb (any extra info)
+-- createdAt: timestamp
```

#### Integration Points

| Component | Type | Change |
|-----------|------|--------|
| `packages/db/src/schema/install-events.ts` | NEW | Table definition |
| `apps/web/app/api/callbacks/install/route.ts` | NEW | POST handler for install callbacks |
| `apps/web/lib/install-script.ts` | MODIFY | Add curl/Invoke-WebRequest callback step to generated scripts |
| `apps/web/middleware.ts` | MODIFY | Exempt `/api/callbacks/` from auth redirect |

#### Middleware Exemption

The install callback URL must be accessible without browser auth (it uses API key Bearer auth instead). Update the middleware:

```typescript
// apps/web/middleware.ts
const isCallbackApi = req.nextUrl.pathname.startsWith("/api/callbacks");
const isMcpApi = req.nextUrl.pathname.startsWith("/api/mcp");

// Allow callback and MCP API routes (they use their own API key auth)
if (isAuthApi || isDevLogin || isCallbackApi || isMcpApi) {
  return;
}
```

### Feature 4: Usage Analytics Dashboard

**Goal:** New pages in `apps/web` showing per-employee skill usage, hours saved, activity over time.

#### Where It Lives

New route group under the existing `(protected)` layout:

```
apps/web/app/(protected)/analytics/
+-- page.tsx            (analytics overview / org-level dashboard)
+-- employees/
|   +-- page.tsx        (employee table with usage metrics)
|   +-- [id]/
|       +-- page.tsx    (individual employee deep-dive)
+-- skills/
    +-- page.tsx        (skill-level analytics, not per-employee)
```

#### New Lib Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `getEmployeeAnalytics()` | `apps/web/lib/employee-analytics.ts` | Aggregate per-employee: skills used, total uses, FTE days saved, last active |
| `getEmployeeDetail()` | `apps/web/lib/employee-analytics.ts` | Single employee: usage timeline, top skills, activity heatmap data |
| `getSkillAnalytics()` | `apps/web/lib/skill-analytics.ts` | Per-skill: unique users, usage over time, top users |
| `getInstallAnalytics()` | `apps/web/lib/install-analytics.ts` | Install counts by platform, OS, over time |

#### Data Flow

All analytics queries are Server Components hitting PostgreSQL directly via Drizzle -- the same pattern used by the existing homepage (`getPlatformStats`, `getLeaderboard`, `getTrendingSkills`). No new API layer needed.

```
/analytics (Server Component)
    |
    v
getEmployeeAnalytics() -> PostgreSQL (usage_events JOIN users JOIN skills)
getInstallAnalytics()  -> PostgreSQL (install_events)
getPlatformStats()     -> PostgreSQL (existing, reuse)
    |
    v
Render: OrgDashboard
    +-- StatCards (total employees active, total FTE days, install count)
    +-- EmployeeTable (sortable, linked to /analytics/employees/[id])
    +-- InstallChart (by platform, over time)
```

#### SQL Patterns

Employee analytics queries aggregate from `usage_events`:

```sql
-- Top employees by FTE days saved
SELECT
  u.id, u.name, u.image,
  COUNT(DISTINCT ue.skill_id) as skills_used,
  COUNT(*) as total_uses,
  SUM(COALESCE(s.hours_saved, 1)) / 8.0 as fte_days_saved,
  MAX(ue.created_at) as last_active
FROM usage_events ue
JOIN users u ON ue.user_id = u.id
JOIN skills s ON ue.skill_id = s.id
WHERE ue.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name, u.image
ORDER BY fte_days_saved DESC;
```

This works because `usage_events.userId` will now be populated via MCP auth.

### Feature 5: Web Remote MCP via Streamable HTTP

**Goal:** Allow Claude.ai (browser-based) to connect to Relay's MCP server over HTTP instead of requiring local stdio setup.

#### Architecture Decision: Where to Host Remote MCP

**Option A: Separate Express server in `apps/mcp`**
- Pro: Keeps MCP server self-contained
- Con: Duplicates DB config, auth logic; separate deployment
- Con: Need CORS, session management, separate process

**Option B: Next.js API route in `apps/web` using `mcp-handler`** (RECOMMENDED)
- Pro: Shares web app's DB connection, auth infrastructure, deployment
- Pro: `mcp-handler` handles Streamable HTTP transport automatically
- Pro: Single deployment, no new infrastructure
- Pro: Tool registration can share logic with stdio server
- Con: Tools defined in `apps/mcp` need to be importable by `apps/web`

**Recommendation:** Option B. Use Vercel's `mcp-handler` package to expose an MCP endpoint as a Next.js API route. Extract tool handler logic from `apps/mcp/src/tools/*.ts` into shared functions that both the stdio server and the web API route can import.

#### Component Architecture

```
+--------------------------------------------------------------------------+
|                    v1.4 REMOTE MCP ARCHITECTURE                           |
+--------------------------------------------------------------------------+
|                                                                          |
|  Browser (Claude.ai)              CLI (Claude Code / Claude Desktop)     |
|  Streamable HTTP                  stdio                                  |
|       |                                |                                 |
|       v                                v                                 |
|  apps/web/app/api/mcp/            apps/mcp/src/index.ts                  |
|    [transport]/route.ts               StdioServerTransport               |
|    (mcp-handler)                      + RELAY_API_KEY validation         |
|    + API key Bearer auth              |                                  |
|       |                                |                                 |
|       v                                v                                 |
|  +--------------------------------------------------+                    |
|  | Shared Tool Handlers (packages/mcp-tools or      |                    |
|  | apps/mcp/src/tools/handlers.ts)                   |                    |
|  |   handleListSkills()                              |                    |
|  |   handleSearchSkills()                            |                    |
|  |   handleDeploySkill()                             |                    |
|  +--------------------------------------------------+                    |
|       |                                                                  |
|       v                                                                  |
|  packages/db (shared database access)                                    |
|  trackUsage() with userId from auth context                              |
|                                                                          |
+--------------------------------------------------------------------------+
```

#### Implementation Pattern

The existing tool handlers in `apps/mcp/src/tools/*.ts` already export handler functions separately from tool registration (e.g., `handleSearchSkills`, `handleDeploySkill`, `handleListSkills`). The remote MCP route can import and re-register these.

```typescript
// apps/web/app/api/mcp/[transport]/route.ts (NEW)
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// Import shared handler functions from mcp package
import { handleListSkills } from "@relay/mcp/tools/list";
import { handleSearchSkills } from "@relay/mcp/tools/search";
import { handleDeploySkill } from "@relay/mcp/tools/deploy";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_skills",
      {
        description: "List available skills in the Relay marketplace",
        inputSchema: {
          category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional(),
          limit: z.number().min(1).max(50).default(20),
        },
      },
      async ({ category, limit }) => handleListSkills({ category, limit })
    );

    server.registerTool(
      "search_skills",
      {
        description: "Search skills by query",
        inputSchema: {
          query: z.string().min(1),
          category: z.enum(["prompt", "workflow", "agent", "mcp"]).optional(),
          limit: z.number().min(1).max(25).default(10),
        },
      },
      async ({ query, category, limit }) =>
        handleSearchSkills({ query, category, limit })
    );

    server.registerTool(
      "deploy_skill",
      {
        description: "Deploy a skill from Relay",
        inputSchema: {
          skillId: z.string(),
        },
      },
      async ({ skillId }) => handleDeploySkill({ skillId })
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST };
```

#### Authentication for Remote MCP

`mcp-handler` supports authentication via `withMcpAuth`:

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { validateApiKey } from "@/lib/api-key-validation";

const handler = withMcpAuth(
  createMcpHandler(/* ... */),
  async (req) => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const key = authHeader.slice(7);
    const result = await validateApiKey(key);
    if (!result) {
      throw new Response("Invalid API key", { status: 401 });
    }
    return {
      token: key,
      clientId: result.userId,
      scopes: ["read"],
    };
  }
);
```

#### Client Configuration

Users connecting from Claude.ai or other Streamable HTTP clients:

```json
{
  "mcpServers": {
    "relay-skills": {
      "url": "https://relay.company.com/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer rl_<your-api-key>"
      }
    }
  }
}
```

For stdio-only clients, the existing `npx @relay/mcp` continues to work with `RELAY_API_KEY` env var.

### Feature 6: Extended Search

**Goal:** Search query matches author name and tags in addition to name/description.

#### Current State

The existing `searchSkills()` in `apps/web/lib/search-skills.ts` (line 60-72) ALREADY searches:
- `skills.searchVector` (PostgreSQL FTS on name + description)
- `skills.name` via ILIKE
- `skills.description` via ILIKE
- `users.name` via ILIKE
- `skills.tags` via `array_to_string(tags, ' ') ILIKE`

**The web app search already covers author name and tags.** The gap is the MCP server search.

#### MCP Search Gap

The MCP `search_skills` tool in `apps/mcp/src/tools/search.ts` uses in-memory filtering with only `name` and `description` matching (lines 41-44). It does NOT search author names or tags.

**Fix:** Either:
1. Have the MCP search tool use the same `searchSkills()` function from `apps/web/lib/search-skills.ts` (requires making it importable from MCP), or
2. Enhance the MCP in-memory search to also match tags and load author data.

**Recommendation:** Option 1. Move `searchSkills()` to `packages/db/src/services/search.ts` so both `apps/web` and `apps/mcp` can import it. This eliminates the divergence between web and MCP search behavior.

#### Integration Points

| Component | Type | Change |
|-----------|------|--------|
| `packages/db/src/services/search.ts` | NEW | Move searchSkills() from apps/web/lib |
| `packages/db/src/services/index.ts` | MODIFY | Export search service |
| `apps/web/lib/search-skills.ts` | MODIFY | Re-export from packages/db service |
| `apps/mcp/src/tools/search.ts` | MODIFY | Import searchSkills from @relay/db |

## New Components Summary

### New Files

| File | Purpose | Depends On |
|------|---------|------------|
| `packages/db/src/schema/api-keys.ts` | API key table schema | users schema |
| `packages/db/src/schema/install-events.ts` | Install event table schema | users schema |
| `packages/db/src/services/api-keys.ts` | Key validation, CRUD | api-keys schema |
| `packages/db/src/services/search.ts` | Shared search (moved from web) | skills, users schemas |
| `apps/web/app/api/mcp/[transport]/route.ts` | Remote MCP endpoint | mcp-handler, tool handlers |
| `apps/web/app/api/callbacks/install/route.ts` | Install callback | api-keys service |
| `apps/web/app/api/auth/validate-key/route.ts` | Key validation API | api-keys service |
| `apps/web/app/actions/api-keys.ts` | Server Actions for key CRUD | api-keys service |
| `apps/web/app/(protected)/analytics/page.tsx` | Analytics overview | analytics lib |
| `apps/web/app/(protected)/analytics/employees/page.tsx` | Employee list | analytics lib |
| `apps/web/app/(protected)/analytics/employees/[id]/page.tsx` | Employee detail | analytics lib |
| `apps/web/lib/employee-analytics.ts` | Employee aggregation queries | usage_events, users |
| `apps/web/lib/install-analytics.ts` | Install event queries | install_events |
| `apps/web/components/api-key-manager.tsx` | Key management UI | api-keys actions |
| `apps/web/components/analytics-charts.tsx` | Dashboard charts | analytics lib |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/src/schema/index.ts` | Export api-keys, install-events |
| `packages/db/src/relations/index.ts` | Add user -> apiKeys, user -> installEvents |
| `packages/db/src/services/index.ts` | Export api-keys service, search service |
| `apps/mcp/src/index.ts` | Add API key validation on startup |
| `apps/mcp/src/tools/search.ts` | Use shared searchSkills from @relay/db |
| `apps/mcp/src/tools/list.ts` | Pass userId into trackUsage |
| `apps/mcp/src/tools/deploy.ts` | Pass userId into trackUsage |
| `apps/mcp/src/tracking/events.ts` | Accept userId parameter consistently |
| `apps/mcp/package.json` | (may need mcp-handler if sharing types) |
| `apps/web/middleware.ts` | Exempt /api/callbacks/ and /api/mcp/ paths |
| `apps/web/lib/install-script.ts` | Add callback curl/Invoke-WebRequest step |
| `apps/web/lib/search-skills.ts` | Re-export from shared service |
| `apps/web/app/(protected)/layout.tsx` | Add Analytics nav link |
| `apps/web/app/(protected)/profile/page.tsx` | Add API key management section |

## Data Flow Changes

### Before v1.4 (Anonymous MCP Usage)

```
Claude Code -> stdio MCP -> trackUsage(toolName, skillId, metadata)
                                  |
                                  v
                            usage_events { userId: NULL }
```

### After v1.4 (Authenticated MCP Usage)

```
Claude Code                              Claude.ai (browser)
    |                                         |
    v                                         v
stdio MCP                              Streamable HTTP
(RELAY_API_KEY env)                   (Bearer token in header)
    |                                         |
    v                                         v
Validate key on startup              mcp-handler validates per-request
Cache userId for session             authInfo passed to tool handlers
    |                                         |
    v                                         v
trackUsage(toolName, skillId, userId, metadata)
    |
    v
usage_events { userId: "real-user-id" }
    |
    v
Analytics dashboard shows per-employee data
```

### Install Callback Flow

```
User visits /skills/[slug] -> clicks "Install" -> selects platform
    |
    v
Generate install script with embedded callback
    |
    v
User runs script locally:
  1. Configure MCP in claude_desktop_config.json
  2. curl POST /api/callbacks/install -H "Bearer $KEY" -d '{"platform":"claude-desktop","os":"macos"}'
    |
    v
API route validates key, inserts install_events
    |
    v
Analytics dashboard shows install counts
```

## Dependency Graph

```
                    API Keys Schema + Service
                    /           |          \
                   /            |           \
                  v             v            v
        MCP Auth        Install Callbacks    Remote MCP Auth
       (stdio key)     (Bearer validation)   (mcp-handler auth)
            |                  |                    |
            v                  v                    v
    Employee Tracking    Install Analytics     Remote MCP Endpoint
            |                  |                    |
            +--------+---------+--------------------+
                     |
                     v
              Analytics Dashboard
                     |
                     v
              Extended Search (independent, can be parallel)
```

## Recommended Build Order

Based on the dependency graph above:

```
Phase 20: API Keys & MCP Authentication
  Plan 20-01: api_keys schema + migration + service (createKey, validateKey, revokeKey)
  Plan 20-02: Key validation API route + MCP stdio key validation on startup
  Plan 20-03: API key management UI on profile page (create, revoke, list)

Phase 21: Employee Usage Tracking
  Plan 21-01: Wire userId through all MCP tool handlers + trackUsage
  Plan 21-02: Install events schema + install callback API route
  Plan 21-03: Update install scripts with callback step

Phase 22: Remote MCP
  Plan 22-01: Install mcp-handler, create /api/mcp/[transport]/route.ts
  Plan 22-02: Add withMcpAuth using API key validation
  Plan 22-03: Shared tool handlers between stdio and remote

Phase 23: Analytics Dashboard
  Plan 23-01: Employee analytics queries + overview page
  Plan 23-02: Employee detail page with usage timeline
  Plan 23-03: Install analytics + org stats integration

Phase 24: Extended Search
  Plan 24-01: Move searchSkills to packages/db/src/services/search.ts
  Plan 24-02: Update MCP search to use shared service
```

**Rationale for order:**

1. **API keys first** -- Every authenticated feature depends on API keys. This is the foundation that unlocks MCP auth, install callbacks, and remote MCP.
2. **Employee tracking second** -- Once API keys exist, wiring userId through trackUsage is a small change that immediately starts collecting attributable data. Install callbacks also land here since they depend on key validation.
3. **Remote MCP third** -- Depends on API keys being built and the auth pattern being proven. The install callback API route provides a precedent for auth-exempt API routes.
4. **Analytics dashboard fourth** -- Needs data in usage_events.userId to be meaningful. Building it after tracking has been active for even a short time means there is data to display.
5. **Extended search last** -- Completely independent. Can actually be built in parallel with any other phase. Placed last because it is the simplest change.

## Technology Requirements

### New Dependencies

| Package | Version | Purpose | Install Location |
|---------|---------|---------|------------------|
| `mcp-handler` | latest | Streamable HTTP MCP in Next.js | apps/web |
| `@modelcontextprotocol/sdk` | ^1.25.2 | Required peer dep for mcp-handler | apps/web |

**Note:** `@modelcontextprotocol/sdk` ^1.25.0 is already installed in `apps/mcp`. Version 1.25.2+ is recommended for security. The web app will need its own copy for the remote MCP route.

### Environment Variables

| Variable | Purpose | Used By |
|----------|---------|---------|
| `RELAY_API_KEY` | MCP auth for stdio server | apps/mcp (optional env var) |

No new server-side env vars needed for the web app -- API keys are stored in the database.

## Anti-Patterns to Avoid

### Anti-Pattern 1: OAuth for Internal MCP Auth

**What people do:** Implement full OAuth 2.1 with PKCE for MCP authentication.
**Why it's wrong for Relay:** OAuth is designed for third-party integrations. Relay is internal, behind corporate SSO. The MCP spec's OAuth flow adds massive complexity (discovery endpoints, token exchange, refresh) for no benefit when all users are already authenticated via Google Workspace.
**Do this instead:** Simple API key auth validated against the same user database. Keys are created through the authenticated web UI, so identity is already verified.

### Anti-Pattern 2: Separate Analytics Database

**What people do:** Set up a dedicated analytics DB or data warehouse for usage data.
**Why it's wrong at Relay's scale:** With 500 users, usage_events will have tens of thousands of rows per month. PostgreSQL handles this trivially with proper indexes. A separate analytics DB adds infrastructure, data sync complexity, and deployment burden.
**Do this instead:** Query usage_events directly with indexed columns. Add materialized views or summary tables only if query performance degrades.

### Anti-Pattern 3: Duplicating Tool Logic for Remote MCP

**What people do:** Rewrite tool handlers in the web API route separately from the stdio server.
**Why it's wrong:** Two codepaths for the same operations diverge over time. Bugs get fixed in one but not the other. Feature parity becomes a maintenance burden.
**Do this instead:** Extract handler functions (already done: `handleListSkills`, `handleSearchSkills`, `handleDeploySkill`) and import them in both stdio and remote registrations.

### Anti-Pattern 4: Client-Side Analytics Fetching

**What people do:** Fetch analytics data via client-side API calls with loading spinners.
**Why it's wrong:** Matches the existing Relay pattern to use Server Components for data fetching. Client-side fetching adds loading states, waterfalls, and bundle size.
**Do this instead:** Server Component pages that fetch data at render time, matching the existing homepage, profile, and skills browse patterns.

### Anti-Pattern 5: Storing API Keys in Plaintext

**What people do:** Store the full API key string in the database.
**Why it's wrong:** Database breach exposes all keys immediately. No defense in depth.
**Do this instead:** Store SHA-256 hash of key. Show full key once on creation. Store prefix for display/identification.

## Confidence Assessment

| Decision | Confidence | Rationale |
|----------|------------|-----------|
| API key auth over OAuth | HIGH | Internal tool, all users already SSO-authenticated, OAuth is overkill |
| mcp-handler for remote MCP | HIGH | Official Vercel adapter, documented for Next.js App Router, handles transport |
| Shared tool handlers | HIGH | Existing code already exports handler functions separately from registration |
| Analytics as Server Components | HIGH | Matches 100% of existing Relay data-fetching patterns |
| API key schema design | HIGH | Standard pattern (hash + prefix), proven at scale |
| install_events table | MEDIUM | Simple design, may need platform enum refinement |
| Middleware exemptions for /api/mcp | HIGH | Same pattern as existing /api/auth exemption |
| searchSkills move to packages/db | MEDIUM | Clean separation but requires verifying all imports resolve |

## Sources

### Official Documentation
- [MCP TypeScript SDK - Server Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) - StreamableHTTPServerTransport API
- [MCP Transports Specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - Streamable HTTP protocol
- [mcp-handler GitHub](https://github.com/vercel/mcp-handler) - Vercel's Next.js MCP adapter
- [MCP Authorization Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization) - Auth patterns for remote MCP
- [Next.js MCP Guide](https://nextjs.org/docs/app/guides/mcp) - Next.js 16+ built-in MCP support

### WebSearch (Verified with official sources)
- [Why MCP Deprecated SSE for Streamable HTTP](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/) - Transport migration rationale
- [MCP Auth Best Practices Discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1247) - Community auth patterns
- [Build a Secure MCP Server](https://rebeccamdeprey.com/blog/secure-mcp-server) - Express auth middleware patterns
- [mcp-handler npm](https://www.npmjs.com/package/mcp-handler) - Package details and version info

### Existing Codebase (HIGH confidence)
- `/home/dev/projects/relay/apps/mcp/src/server.ts` - McpServer setup
- `/home/dev/projects/relay/apps/mcp/src/index.ts` - StdioServerTransport entry point
- `/home/dev/projects/relay/apps/mcp/src/tools/search.ts` - Search tool with exported handler
- `/home/dev/projects/relay/apps/mcp/src/tools/deploy.ts` - Deploy tool with exported handler
- `/home/dev/projects/relay/apps/mcp/src/tracking/events.ts` - trackUsage() with optional userId
- `/home/dev/projects/relay/packages/db/src/schema/usage-events.ts` - usage_events with userId column
- `/home/dev/projects/relay/apps/web/lib/search-skills.ts` - Full search with author + tags
- `/home/dev/projects/relay/apps/web/auth.ts` - Auth.js v5 config with JWT strategy
- `/home/dev/projects/relay/apps/web/middleware.ts` - Auth redirect with API route exemptions

---
*Architecture research for: Relay Internal Skill Marketplace*
*Updated: 2026-02-05 for v1.4 Employee Analytics, MCP Auth & Remote MCP*
