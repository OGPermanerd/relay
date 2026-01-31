# Architecture Research

**Domain:** Internal Skill Marketplace / Developer Tool Catalog
**Researched:** 2026-01-31
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Web App    │  │ MCP Server  │  │  REST API   │  │  CLI (v2)   │        │
│  │  (Browse,   │  │  (Deploy,   │  │  (External  │  │  (Future)   │        │
│  │  Publish)   │  │  Track)     │  │  Integrations)│ │             │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │               │
├─────────┴────────────────┴────────────────┴────────────────┴───────────────┤
│                            SERVICE LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │ Skill Service │  │ Metrics       │  │ Search        │  │ Auth        │  │
│  │ (CRUD,        │  │ Service       │  │ Service       │  │ Service     │  │
│  │  Versions)    │  │ (Track, Agg)  │  │ (FTS, Filter) │  │ (SSO)       │  │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬──────┘  │
│          │                  │                  │                 │         │
├──────────┴──────────────────┴──────────────────┴─────────────────┴─────────┤
│                           DATA LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  PostgreSQL  │  │ Object Store │  │ Search Index │  │ Cache        │    │
│  │  (Skills,    │  │ (Skill       │  │ (Optional)   │  │ (Redis)      │    │
│  │  Metrics)    │  │ Content)     │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
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
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── app/                # App router pages
│   │   ├── components/         # React components
│   │   ├── lib/                # Client utilities
│   │   └── styles/             # CSS/Tailwind
│   ├── mcp-server/             # MCP server for Claude integration
│   │   ├── src/
│   │   │   ├── handlers/       # MCP tool handlers
│   │   │   ├── client/         # API client to backend
│   │   │   └── tracking/       # Usage event collection
│   │   └── package.json
│   └── api/                    # REST API (if separate from web)
│       └── src/
├── packages/
│   ├── db/                     # Database schema, migrations, client
│   │   ├── prisma/             # Prisma schema
│   │   ├── migrations/         # SQL migrations
│   │   └── src/                # Database client
│   ├── shared/                 # Shared types, utilities
│   │   ├── types/              # TypeScript interfaces
│   │   └── validation/         # Zod schemas
│   └── skill-formats/          # Skill format parsers/validators
│       ├── claude-code/        # Claude Code skill format
│       ├── prompt/             # Prompt format
│       ├── workflow/           # Workflow format
│       └── agent-config/       # Agent config format
├── infrastructure/
│   ├── docker/                 # Docker configs
│   └── terraform/              # IaC (optional)
└── docs/                       # Documentation
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
User → Web App → Auth (verify SSO) → Skill Service → Validate Format
                                          ↓
                    Content Storage ← Upload Content → PostgreSQL
                                          ↓
                           Search Service → Update Index
                                          ↓
                           Response ← New Version Created
```

### Request Flow: Deploy Skill via MCP

```
Claude User → MCP Server → Auth (verify token) → Skill Service
                                                      ↓
                         Content Storage ← Fetch Content
                                                      ↓
                         MCP Server ← Return Skill
                                                      ↓
                         Claude Loads Skill
                                                      ↓
                         [Later: Usage Event] → Metrics Queue → Metrics Service
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
| Web App ↔ Backend API | REST/GraphQL over HTTPS | API Gateway pattern; JWT auth |
| MCP Server ↔ Backend API | REST over HTTPS | API key or JWT; rate limiting per user |
| Backend ↔ Database | Prisma Client (type-safe) | Connection pooling; read replicas if needed |
| Backend ↔ Object Storage | S3 SDK | Presigned URLs for browser upload; server-side for MCP |
| Backend ↔ Search Index | REST API | Webhook for updates; REST for queries |
| Backend ↔ Cache | Redis Client | Session storage; hot data caching |
| Backend ↔ Metrics Queue | Producer/Consumer | Redis Streams, SQS, or Kafka (scale-dependent) |

## Build Order Implications

Based on component dependencies, recommended build sequence:

```
Phase 1: Foundation
├── Database schema (skills, versions, users)
├── Auth service (Google SSO)
└── Basic Skill Service (CRUD)

Phase 2: Core Web Experience
├── Web app (browse, publish)
├── Search (PostgreSQL FTS initially)
└── Content storage integration

Phase 3: MCP Integration
├── MCP Server (list, deploy)
├── REST API for MCP access
└── Usage event emission

Phase 4: Metrics & Polish
├── Metrics service (aggregation)
├── Dashboard views
└── Rating/review system

Phase 5: Scale (as needed)
├── Dedicated search index
├── CDN for content
└── Event streaming for metrics
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
*Architecture research for: Relay Internal Skill Marketplace*
*Researched: 2026-01-31*
