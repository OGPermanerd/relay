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

# v1.2 UI Redesign: Two-Panel Table Architecture

**Milestone:** v1.2 UI Redesign
**Researched:** 2026-02-01
**Confidence:** HIGH (based on existing codebase patterns and verified Next.js 15 documentation)

## Executive Summary

The two-panel sortable table UI should integrate with the existing Next.js 15 App Router architecture using a **hybrid Server Component + Client Component pattern**. The core data fetching and table structure remain Server Components, while interactive elements (sort controls, accordion expansion, install button) become targeted Client Components. This matches the established patterns in the codebase (SearchInput, CategoryFilter, SortDropdown already use nuqs).

**Key Recommendation:** Use nuqs for all sort/filter state (already adopted), keep data fetching in Server Components, and create a thin Client Component wrapper for table interactions. Avoid TanStack Table - the use case is simple enough that native components with shadcn/ui Table suffice.

## Recommended Architecture

### Component Hierarchy

```
/app/(protected)/skills/page.tsx  (Server Component - existing, modified)
+-- SearchInput                   (Client - existing, reuse)
+-- TwoPanelLayout               (Server - NEW wrapper)
    +-- SkillsTablePanel          (Server - NEW, 2/3 width)
    |   +-- TableSortControls     (Client - NEW, nuqs-based)
    |   +-- SkillsTable           (Server - data table structure)
    |       +-- SkillTableRow     (Client - expandable accordion)
    |           +-- RowSummary    (Server child - visible by default)
    |           +-- RowDetails    (Client child - expanded content)
    |           +-- InstallButton (Client - MCP integration)
    +-- LeaderboardPanel          (Server - 1/3 width)
        +-- LeaderboardTable      (Server - existing, minor mods)
```

### Component Boundaries

| Component | Type | Responsibility | Communicates With |
|-----------|------|----------------|-------------------|
| `page.tsx` | Server | Data fetching, layout orchestration | All child components via props |
| `TwoPanelLayout` | Server | Grid layout (2/3 + 1/3), responsive | Children as slots |
| `TableSortControls` | Client | Sort column selection, direction toggle | URL (nuqs), triggers re-render |
| `SkillsTable` | Server | Renders table headers and rows | Receives sorted data from page |
| `SkillTableRow` | Client | Accordion open/close state | Local state only |
| `InstallButton` | Client | Triggers MCP deploy_skill | Server Action for tracking |
| `LeaderboardTable` | Server | Renders leaderboard (existing) | Props only |

### Data Flow

```
URL params (nuqs: sortBy, sortDir, q, category, tags, qualityTier)
    |
    v
page.tsx (Server Component)
    |
    +-> searchSkills({ ...params, sortBy, sortDir })  -> PostgreSQL
    |                                                        |
    |<----------------------- skills[] <---------------------+
    |
    +-> getLeaderboard(limit)  -> PostgreSQL
    |                                 |
    |<------------ leaderboard[] <----+
    |
    v
Render: TwoPanelLayout
    +-> SkillsTablePanel(skills, sortBy, sortDir)
    |       +-> TableSortControls (nuqs state)
    |       +-> SkillsTable (receives pre-sorted data)
    |               +-> SkillTableRow[] (client for accordion)
    |                       +-> InstallButton (MCP action)
    +-> LeaderboardPanel(leaderboard)
```

## Patterns to Follow

### Pattern 1: nuqs for Sort State

**What:** Store sort column and direction in URL using nuqs (already adopted in codebase).

**Why:**
- Consistent with existing CategoryFilter, QualityFilter, SortDropdown patterns
- Enables shareable/bookmarkable views
- Server Components re-render with new data on URL change
- Already in package.json (nuqs@2.8.7)

**Example:**
```typescript
// components/table-sort-controls.tsx
"use client";

import { useQueryState, parseAsStringEnum } from "nuqs";
import { useTransition } from "react";

const SORT_COLUMNS = ["name", "uses", "rating", "quality", "fteDays"] as const;
const SORT_DIRS = ["asc", "desc"] as const;

export function TableSortControls() {
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsStringEnum(SORT_COLUMNS).withDefault("uses")
  );
  const [sortDir, setSortDir] = useQueryState(
    "sortDir",
    parseAsStringEnum(SORT_DIRS).withDefault("desc")
  );
  const [isPending, startTransition] = useTransition();

  const handleSort = (column: typeof SORT_COLUMNS[number]) => {
    startTransition(() => {
      if (sortBy === column) {
        // Toggle direction
        setSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
        // New column, default to desc
        setSortBy(column);
        setSortDir("desc");
      }
    });
  };

  return (
    // ... column header buttons with sort indicators
  );
}
```

### Pattern 2: Server Component Data Fetching with Sort

**What:** Extend existing `searchSkills()` to accept sortBy column and direction, do sorting in SQL.

**Why:**
- Matches existing pattern in `/app/(protected)/skills/page.tsx`
- Server-side sorting is fast and reduces client bundle
- PostgreSQL handles sort efficiently

**Example:**
```typescript
// lib/search-skills.ts (extend existing)
export interface SearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  qualityTier?: "gold" | "silver" | "bronze";
  sortBy?: "name" | "uses" | "rating" | "quality" | "fteDays";
  sortDir?: "asc" | "desc";
}

// In the query builder:
const orderByColumn = {
  name: skills.name,
  uses: skills.totalUses,
  rating: skills.averageRating,
  quality: qualityScoreSql,
  fteDays: sql`(${skills.totalUses} * ${skills.hoursSaved} / 8.0)`,
}[params.sortBy || "uses"];

const orderFn = params.sortDir === "asc" ? asc : desc;
return filteredQuery.orderBy(orderFn(orderByColumn));
```

### Pattern 3: Client Component Accordion Rows

**What:** Each table row is a Client Component managing its own open/close state.

**Why:**
- Expansion is purely local UI state - no URL sync needed
- Each row independently manages expansion
- Avoids prop drilling through Server Component

**Example:**
```typescript
// components/skill-table-row.tsx
"use client";

import { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface SkillTableRowProps {
  skill: SkillRowData;
}

export function SkillTableRow({ skill }: SkillTableRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <tr className="border-b hover:bg-gray-50">
        <CollapsibleTrigger asChild>
          <td className="cursor-pointer">
            <ChevronIcon className={isOpen ? "rotate-90" : ""} />
          </td>
        </CollapsibleTrigger>
        <td>{skill.name}</td>
        <td>{skill.totalUses}</td>
        <td>{skill.averageRating}</td>
        <td><InstallButton skillId={skill.id} /></td>
      </tr>
      <CollapsibleContent asChild>
        <tr className="bg-gray-50">
          <td colSpan={5}>
            <SkillRowDetails skill={skill} />
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Pattern 4: MCP Install via Server Action

**What:** Install button triggers a Server Action that returns skill content for clipboard/download.

**Why:**
- MCP servers run in Claude Code/Claude Desktop, not in browser
- Web app cannot directly invoke MCP tools
- Best we can do: copy skill content or provide download, with instructions

**Limitation:** True one-click install requires the user to have the Relay MCP server configured in their Claude environment. The web app can:
1. Copy skill content to clipboard
2. Provide download link
3. Show MCP command to run

**Example:**
```typescript
// app/actions/install.ts
"use server";

import { auth } from "@/auth";
import { db, skills } from "@relay/db";
import { eq } from "drizzle-orm";
import { trackInstall } from "@/lib/tracking";

export async function getInstallContent(skillId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, name: true, slug: true, content: true },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Track web-initiated install intent (different from MCP deploy)
  await trackInstall(skill.id, session.user.id, "web");

  return {
    content: skill.content,
    filename: `${skill.slug}.md`,
    instructions: [
      `1. Copy the content below to your clipboard`,
      `2. Save to: .claude/skills/${skill.slug}.md`,
      `3. Or use MCP: deploy_skill with skillId="${skill.id}"`,
    ],
  };
}
```

```typescript
// components/install-button.tsx
"use client";

import { useState, useTransition } from "react";
import { getInstallContent } from "@/app/actions/install";

export function InstallButton({ skillId }: { skillId: string }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleInstall = () => {
    startTransition(async () => {
      const result = await getInstallContent(skillId);
      if (result.content) {
        await navigator.clipboard.writeText(result.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };

  return (
    <button
      onClick={handleInstall}
      disabled={isPending}
      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {isPending ? "..." : copied ? "Copied!" : "Install"}
    </button>
  );
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: TanStack Table for Simple Use Case

**What:** Importing @tanstack/react-table for the skills table.

**Why bad:**
- Adds 30-50KB to client bundle
- Complexity overkill for a single-column-sort, no-pagination table
- Existing patterns (nuqs + Server Component) already solve this

**Instead:** Use shadcn/ui Table component with manual column headers that trigger nuqs updates. The server does the sorting.

### Anti-Pattern 2: Client-Side Data Fetching

**What:** Fetching skills data in useEffect or React Query on the client.

**Why bad:**
- Loses SEO benefits of Server Components
- Adds loading states and waterfalls
- Existing page.tsx already fetches server-side

**Instead:** Keep data fetching in page.tsx Server Component. Let nuqs URL changes trigger full server re-render with new data.

### Anti-Pattern 3: Global Accordion State

**What:** Managing all row expansion states in a single parent state object.

**Why bad:**
- Unnecessary prop drilling
- Re-renders entire table when one row expands
- More complex than needed

**Instead:** Each SkillTableRow manages its own `isOpen` state locally.

### Anti-Pattern 4: URL State for Row Expansion

**What:** Storing which rows are expanded in URL params.

**Why bad:**
- Makes URLs ugly and unbookmarkable
- Expansion is ephemeral UI state, not application state
- Complicates nuqs usage

**Instead:** Local useState per row.

## Integration Points

### 1. Existing nuqs Setup

The app already has nuqs configured:
- `nuqs@2.8.7` in package.json
- Used in SearchInput, CategoryFilter, QualityFilter, SortDropdown
- Pattern: `useQueryState` with parser and `startTransition`

**Integration:** Add `sortBy` and `sortDir` params following same pattern.

### 2. Existing Data Fetching

`searchSkills()` in `/lib/search-skills.ts` already:
- Accepts SearchParams including sortBy
- Does server-side ordering with Drizzle
- Returns full skill data with author

**Integration:** Extend to accept sortDir and support column-specific sorting.

### 3. Existing Table Component

`LeaderboardTable` in `/components/leaderboard-table.tsx`:
- Uses shadcn/ui-style table markup
- Purely presentational Server Component
- No sorting controls (just displays ranked data)

**Integration:** New SkillsTable follows similar structure but with sortable headers.

### 4. MCP Server

`deploy_skill` tool in `/apps/mcp/src/tools/deploy.ts`:
- Takes skillId, returns skill content
- Tracks usage via `trackUsage()`
- Used from Claude Code MCP integration

**Integration:** Web InstallButton provides alternative path - copy to clipboard with instructions to use MCP or save manually.

## Suggested Build Order

Based on dependencies and integration points:

### Phase 1: Layout Foundation
1. Create `TwoPanelLayout` component (Server, simple grid wrapper)
2. Update `/app/(protected)/skills/page.tsx` to use two-panel layout
3. Move existing LeaderboardTable into right panel
4. Verify existing functionality still works

### Phase 2: Table Structure
1. Create `SkillsTable` Server Component (table structure, no sorting yet)
2. Create `SkillTableRow` Client Component with Collapsible
3. Replace SkillList/SkillCard grid with table
4. Add row expansion with existing skill data

### Phase 3: Sortable Columns
1. Add `sortBy` and `sortDir` to nuqs params in page.tsx
2. Extend `searchSkills()` for column-specific sorting
3. Create `TableSortControls` Client Component
4. Add sort indicators to column headers

### Phase 4: Install Button
1. Create `getInstallContent` Server Action
2. Create `InstallButton` Client Component
3. Add install column to table
4. Add tracking for web installs

### Phase 5: Polish
1. Responsive breakpoints for two-panel layout
2. Loading states during sort transitions
3. Empty states for table
4. Keyboard navigation for accordion

## Confidence Assessment

| Decision | Confidence | Rationale |
|----------|------------|-----------|
| nuqs for sort state | HIGH | Already adopted, pattern verified in codebase |
| Server Component data fetch | HIGH | Matches existing page.tsx pattern, Next.js 15 best practice |
| Local state for accordion | HIGH | Standard React pattern, avoids complexity |
| shadcn Table over TanStack | HIGH | Simpler, bundle-efficient, sufficient for use case |
| Server Action for install | MEDIUM | Best available pattern for web-to-MCP bridge |
| Collapsible for accordion | HIGH | shadcn/ui component, verified in search results |

## Sources

- [Next.js Server and Client Components Documentation](https://nextjs.org/docs/app/getting-started/server-and-client-components) - HIGH confidence
- [nuqs Official Documentation](https://nuqs.dev/) - HIGH confidence
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table) - HIGH confidence
- [TanStack Table Sorting Guide](https://tanstack.com/table/v8/docs/guide/sorting) - HIGH confidence (for reference)
- [Build Expandable Data Table with shadcn/ui](https://dev.to/mfts/build-an-expandable-data-table-with-2-shadcnui-components-4nge) - MEDIUM confidence
- Existing codebase patterns in `/apps/web/components/` - HIGH confidence

---

# v1.3 Feature Integration Architecture

**Milestone:** v1.3 AI Review, Similarity, Forks, Cross-Platform
**Researched:** 2026-02-02
**Confidence:** HIGH (Context7, official docs, existing codebase analysis)

## Executive Summary

v1.3 introduces four major capabilities to Relay's existing Next.js/PostgreSQL/MCP architecture. This document maps how each integrates with existing components, what new infrastructure is required, and the recommended build order.

**Key finding:** All four features share a common dependency on vector embeddings. Implementing pgvector + embedding generation first enables both AI review context and similarity detection, reducing overall complexity.

## Existing Architecture Reference

```
+-------------------------------------------------------------------------+
|                           CURRENT STATE                                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  apps/web (Next.js 15)              apps/mcp (MCP Server)              |
|  +-- app/                           +-- tools/                          |
|  |   +-- (protected)/               |   +-- search.ts                   |
|  |   |   +-- skills/                |   +-- list.ts                     |
|  |   |       +-- page.tsx           |   +-- deploy.ts                   |
|  |   |       +-- [slug]/page.tsx    +-- tracking/                       |
|  |   |       +-- new/page.tsx           +-- events.ts                   |
|  |   +-- actions/                                                       |
|  |       +-- skills.ts                                                  |
|  |       +-- ratings.ts                                                 |
|  +-- lib/                                                               |
|      +-- search-skills.ts                                               |
|      +-- quality-score.ts                                               |
|                                                                         |
|  packages/db                                                            |
|  +-- schema/                                                            |
|  |   +-- skills.ts          (searchVector tsvector, publishedVersionId) |
|  |   +-- skill-versions.ts  (contentUrl, contentHash, metadata jsonb)   |
|  |   +-- ratings.ts                                                     |
|  |   +-- users.ts                                                       |
|  +-- relations/                                                         |
|      +-- index.ts           (skills -> versions, author, ratings)       |
|                                                                         |
+-------------------------------------------------------------------------+
```

## Feature 1: AI Skill Review Pipeline

### Integration Points

| Component | Integration Type | Notes |
|-----------|------------------|-------|
| `apps/web/app/actions/skills.ts` | MODIFY | Add review step after skill creation |
| `packages/db/src/schema/skills.ts` | MODIFY | Add `reviewStatus`, `reviewFeedback` columns |
| `apps/web/lib/` | NEW | `ai-review.ts` - Claude API integration |
| Environment | MODIFY | Add `ANTHROPIC_API_KEY` |

### Where Claude API Call Happens

**Recommended:** Server Action in `apps/web/app/actions/skills.ts`

```typescript
// apps/web/lib/ai-review.ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function reviewSkill(
  content: string,
  metadata: { name: string; category: string; description: string },
  similarSkills: { name: string; description: string }[]
): Promise<ReviewResult> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-20250514", // Cost-effective for review
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Review this skill for quality, clarity, and potential issues:

Name: ${metadata.name}
Category: ${metadata.category}
Description: ${metadata.description}

Content:
${content}

Similar existing skills for reference:
${similarSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}

Provide:
1. Quality score (1-10)
2. Suggestions for improvement
3. Potential issues or concerns
4. Whether this seems like a duplicate`
    }]
  });

  return parseReviewResponse(response);
}
```

**Rationale:** Server Actions run server-side with full environment access, integrate naturally with form submission flow, and keep API key secure.

### Schema Changes

```sql
-- Add to skills table
ALTER TABLE skills ADD COLUMN review_status text DEFAULT 'pending';
  -- Values: 'pending', 'passed', 'needs_improvement', 'flagged'
ALTER TABLE skills ADD COLUMN review_feedback jsonb;
  -- Structure: { score: number, suggestions: string[], issues: string[] }
ALTER TABLE skills ADD COLUMN reviewed_at timestamp with time zone;
```

### Data Flow

```
User submits skill
    |
    v
createSkill() Server Action
    |
    v
Insert skill (review_status: 'pending')
    |
    v
Generate embedding (see Feature 2)
    |
    v
Find similar skills using embedding
    |
    v
Call Claude API with skill content + similar skills context
    |
    v
Parse review response
    |
    v
Update skill with review_status, review_feedback
    |
    v
Return to user (show feedback if needs_improvement)
```

### Cost Considerations

| Model | Input (1M tokens) | Output (1M tokens) | Est. cost per review |
|-------|-------------------|--------------------|-----------------------|
| claude-sonnet-4-20250514 | $3 | $15 | ~$0.005 (avg 500 in / 800 out) |
| claude-haiku-4-20250514 | $1 | $5 | ~$0.002 |

**Recommendation:** Use Haiku for initial review, escalate to Sonnet if content flagged.

## Feature 2: Semantic Similarity Detection

### Integration Points

| Component | Integration Type | Notes |
|-----------|------------------|-------|
| PostgreSQL | MODIFY | Enable pgvector extension |
| `packages/db/src/schema/skills.ts` | MODIFY | Add `embedding` vector column |
| `apps/web/lib/` | NEW | `embeddings.ts` - embedding generation |
| `apps/web/lib/search-skills.ts` | MODIFY | Add semantic search option |
| `apps/web/app/actions/skills.ts` | MODIFY | Generate embedding on create/update |

### pgvector Integration with Drizzle

Based on [Drizzle ORM documentation](https://orm.drizzle.team/docs/guides/vector-similarity-search):

```typescript
// packages/db/src/schema/skills.ts
import { pgTable, text, vector, index } from "drizzle-orm/pg-core";

export const skills = pgTable(
  "skills",
  {
    // ... existing columns

    // Semantic embedding for similarity search
    // 1024 dimensions for Voyage-3-lite (Anthropic recommended)
    embedding: vector("embedding", { dimensions: 1024 }),
  },
  (table) => [
    // Existing full-text search index
    index("skills_search_idx").using("gin", table.searchVector),

    // Vector similarity index (HNSW for fast approximate search)
    index("skills_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);
```

### Embedding Provider Choice

| Provider | Model | Dimensions | Cost (1M tokens) | Notes |
|----------|-------|------------|------------------|-------|
| **Voyage AI** | voyage-3-lite | 1024 | $0.02 | Anthropic recommended |
| Voyage AI | voyage-3 | 1024 | $0.06 | Higher quality |
| OpenAI | text-embedding-3-small | 1536 | $0.02 | Widely used |
| OpenAI | text-embedding-3-large | 3072 | $0.13 | Highest quality |

**Recommendation:** Voyage-3-lite. Anthropic partnership ensures compatibility, 1024 dimensions balance quality/storage, lowest cost tier.

### Embedding Generation

```typescript
// apps/web/lib/embeddings.ts

// Voyage AI uses same SDK pattern as Anthropic
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "voyage-3-lite",
      input: text,
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

export async function generateSkillEmbedding(skill: {
  name: string;
  description: string;
  content: string;
}): Promise<number[]> {
  // Combine relevant text for embedding
  const text = `${skill.name}\n\n${skill.description}\n\n${skill.content}`;
  return generateEmbedding(text);
}
```

### Similarity Search Query

```typescript
// apps/web/lib/search-skills.ts
import { cosineDistance, desc, gt, sql } from "drizzle-orm";

export async function findSimilarSkills(
  embedding: number[],
  threshold = 0.7,
  limit = 10,
  excludeId?: string
): Promise<SimilarSkill[]> {
  if (!db) return [];

  const similarity = sql<number>`1 - (${cosineDistance(skills.embedding, embedding)})`;

  const conditions = [gt(similarity, threshold)];
  if (excludeId) {
    conditions.push(sql`${skills.id} != ${excludeId}`);
  }

  return db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      description: skills.description,
      similarity,
    })
    .from(skills)
    .where(and(...conditions))
    .orderBy(desc(similarity))
    .limit(limit);
}
```

### Duplicate Detection Flow

```
User submits new skill
    |
    v
generateSkillEmbedding(name, description, content)
    |
    v
findSimilarSkills(embedding, threshold=0.85)
    |
    v
if (similarSkills.length > 0)
    |
    v
Show warning: "Similar skills exist: [links]"
    |
    v
User chooses: Create anyway | Fork existing | Cancel
```

## Feature 3: Fork-Based Versioning

### Current vs Proposed Schema

**Current:** Wiki-style versioning (single skill, multiple versions)
```
skills (id, slug, publishedVersionId, draftVersionId)
    |
    v
skill_versions (id, skillId, version, contentUrl)
```

**Proposed:** Add fork relationships
```
skills (id, slug, parentSkillId, forkReason, publishedVersionId)
    |
    v
skill_versions (id, skillId, version, contentUrl)
    |
    v
skill_forks (implicit via parentSkillId)
```

### Schema Changes

```typescript
// packages/db/src/schema/skills.ts - ADD columns
export const skills = pgTable("skills", {
  // ... existing columns

  // Fork relationship
  parentSkillId: text("parent_skill_id").references(() => skills.id),
  forkReason: text("fork_reason"), // "improvement", "variant", "specialization"
  isFork: boolean("is_fork").default(false), // Denormalized for query perf

  // Fork tree metrics (denormalized)
  forkCount: integer("fork_count").default(0),
  rootSkillId: text("root_skill_id"), // Original ancestor for deep trees
});
```

### Relations Update

```typescript
// packages/db/src/relations/index.ts - ADD
export const skillsRelations = relations(skills, ({ one, many }) => ({
  // ... existing relations

  // Fork relationships
  parent: one(skills, {
    fields: [skills.parentSkillId],
    references: [skills.id],
    relationName: "forks",
  }),
  forks: many(skills, {
    relationName: "forks",
  }),
}));
```

### Fork Creation Flow

```
User views skill
    |
    v
Clicks "Fork this skill"
    |
    v
Select fork reason: "Improvement" | "Variant" | "Specialization"
    |
    v
createFork() Server Action
    |
    v
Copy skill content to new skill with parentSkillId set
    |
    v
Increment parent.forkCount
    |
    v
User edits their fork
    |
    v
Publish as new skill (linked to parent)
```

### UI Integration Points

| Location | Change |
|----------|--------|
| Skill detail page | Add "Fork" button, show fork tree if has forks/parent |
| Skill card | Badge showing "Fork of X" or "N forks" |
| Create skill form | Option to "Fork from existing" |
| Profile page | "My Forks" section |

### Query Patterns

```typescript
// Get skill with fork context
const skillWithForks = await db.query.skills.findFirst({
  where: eq(skills.slug, slug),
  with: {
    parent: { columns: { id: true, name: true, slug: true } },
    forks: {
      columns: { id: true, name: true, slug: true },
      limit: 5,
      orderBy: desc(skills.totalUses),
    },
  },
});

// Get fork tree (for visualization)
async function getForkTree(rootId: string): Promise<ForkNode[]> {
  return db.query.skills.findMany({
    where: or(
      eq(skills.id, rootId),
      eq(skills.rootSkillId, rootId)
    ),
    columns: { id: true, name: true, parentSkillId: true, totalUses: true },
  });
}
```

## Feature 4: Cross-Platform Install Configs

### Platform Config Formats

Based on research of Claude Code, Cursor, and Windsurf documentation:

| Platform | Config Location | Format | Key Structure |
|----------|-----------------|--------|---------------|
| Claude Code | `.claude/skills/<name>/SKILL.md` | YAML frontmatter + Markdown | `name`, `description`, frontmatter |
| Cursor | `.cursor/rules/<name>.mdc` | MDC (frontmatter + content) | `description`, `globs`, `alwaysApply` |
| Windsurf | `.windsurf/rules/<name>.md` | Markdown | Simpler format, 6000 char limit |
| MCP | `claude_desktop_config.json` | JSON | `mcpServers` object |

### Config Generator Service

```typescript
// apps/web/lib/config-generators.ts

interface SkillConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  content: string;
  tags: string[];
}

// Claude Code SKILL.md format
export function generateClaudeCodeConfig(skill: SkillConfig): string {
  return `---
name: ${skill.slug}
description: ${skill.description}
---

${skill.content}`;
}

// Cursor .mdc format
export function generateCursorConfig(skill: SkillConfig): string {
  // Map skill category to appropriate glob patterns
  const globs = getCursorGlobs(skill.category, skill.tags);

  return `---
description: ${skill.description}
globs: ${globs}
alwaysApply: false
---

# ${skill.name}

${skill.content}`;
}

// Windsurf .md format
export function generateWindsurfConfig(skill: SkillConfig): string {
  // Windsurf has 6000 char limit per rule file
  const truncatedContent = skill.content.slice(0, 5500);

  return `# ${skill.name}

${skill.description}

${truncatedContent}`;
}

// Existing MCP config (enhanced)
export function generateMcpConfig(skill: SkillConfig): string | null {
  if (skill.category === "mcp") {
    return JSON.stringify({
      mcpServers: {
        [skill.slug]: {
          command: "npx",
          args: ["-y", `@relay/${skill.slug}`],
        },
      },
    }, null, 2);
  }
  return null; // Non-MCP skills don't get this config
}
```

### Multi-Platform Install UI

```typescript
// apps/web/components/install-modal.tsx
interface Platform {
  id: string;
  name: string;
  icon: string;
  configGenerator: (skill: SkillConfig) => string;
  installPath: string;
  instructions: string[];
}

const PLATFORMS: Platform[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    icon: "/icons/claude.svg",
    configGenerator: generateClaudeCodeConfig,
    installPath: ".claude/skills/{slug}/SKILL.md",
    instructions: [
      "Create directory: mkdir -p .claude/skills/{slug}",
      "Save content to: .claude/skills/{slug}/SKILL.md",
      "Skill will be available as /{slug} command",
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "/icons/cursor.svg",
    configGenerator: generateCursorConfig,
    installPath: ".cursor/rules/{slug}.mdc",
    instructions: [
      "Create directory: mkdir -p .cursor/rules",
      "Save content to: .cursor/rules/{slug}.mdc",
      "Rule will auto-apply based on glob patterns",
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    icon: "/icons/windsurf.svg",
    configGenerator: generateWindsurfConfig,
    installPath: ".windsurf/rules/{slug}.md",
    instructions: [
      "Create directory: mkdir -p .windsurf/rules",
      "Save content to: .windsurf/rules/{slug}.md",
      "Rule will be available in Cascade",
    ],
  },
];
```

### Install Button Enhancement

```typescript
// apps/web/components/install-button.tsx - ENHANCE
interface InstallButtonProps {
  skill: SkillConfig;
  variant?: "full" | "icon";
}

export function InstallButton({ skill, variant = "full" }: InstallButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // On click, show platform selection modal
  // After selection, generate config and copy to clipboard
  // Show post-copy instructions specific to platform
}
```

### MCP Tool Enhancement

```typescript
// apps/mcp/src/tools/deploy.ts - ENHANCE
server.registerTool(
  "deploy_skill",
  {
    inputSchema: {
      skillId: z.string(),
      platform: z.enum(["claude-code", "cursor", "windsurf", "mcp"]).default("claude-code"),
    },
  },
  async ({ skillId, platform }) => {
    const skill = await getSkill(skillId);
    const config = generateConfigForPlatform(skill, platform);
    const installPath = getInstallPath(platform, skill.slug);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          platform,
          config,
          installPath,
          instructions: getInstructions(platform, skill),
        }, null, 2),
      }],
    };
  }
);
```

## Component Summary

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ai-review.ts` | `apps/web/lib/` | Claude API for skill review |
| `embeddings.ts` | `apps/web/lib/` | Voyage AI embedding generation |
| `config-generators.ts` | `apps/web/lib/` | Multi-platform config generation |
| `install-modal.tsx` | `apps/web/components/` | Platform selection UI |
| `fork-button.tsx` | `apps/web/components/` | Fork action button |
| `fork-tree.tsx` | `apps/web/components/` | Fork relationship visualization |
| `similar-skills.tsx` | `apps/web/components/` | Duplicate detection display |

### Modified Components

| Component | Changes |
|-----------|---------|
| `packages/db/src/schema/skills.ts` | Add `embedding`, `reviewStatus`, `parentSkillId`, `forkCount` |
| `apps/web/app/actions/skills.ts` | Add review, embedding, fork logic |
| `apps/web/lib/search-skills.ts` | Add semantic search function |
| `apps/web/components/install-button.tsx` | Platform selection modal |
| `apps/mcp/src/tools/deploy.ts` | Multi-platform support |

## Recommended Build Order

Based on dependency analysis:

```
Phase 1: Foundation (pgvector + embeddings)
+-- Enable pgvector extension
+-- Add embedding column to skills
+-- Create embeddings.ts service
+-- Backfill existing skill embeddings
+-- Add semantic search to search-skills.ts

Phase 2: Similarity Detection
+-- findSimilarSkills() function
+-- similar-skills.tsx component
+-- Integrate with skill creation flow
+-- Add "Similar skills" to detail page

Phase 3: AI Review Pipeline
+-- Add review columns to skills
+-- Create ai-review.ts service
+-- Integrate with createSkill() action
+-- Review feedback UI on detail page
+-- Admin view for flagged skills

Phase 4: Fork Versioning
+-- Add parent/fork columns to skills
+-- Update relations
+-- Fork creation action
+-- fork-button.tsx component
+-- fork-tree.tsx visualization
+-- Update profile with "My Forks"

Phase 5: Cross-Platform Install
+-- config-generators.ts service
+-- install-modal.tsx component
+-- Enhance install-button.tsx
+-- Update MCP deploy tool
+-- Add platform badges to skill cards
```

**Rationale for order:**
1. **Embeddings first** - Both AI review (needs similar skills context) and similarity detection depend on embeddings
2. **Similarity before review** - AI review benefits from showing similar skills in prompt
3. **Fork after similarity** - "Fork existing" option uses similarity to suggest forkable skills
4. **Cross-platform last** - Independent feature, no dependencies on others

## Migration Strategy

### Database Migrations

```sql
-- Migration 1: pgvector extension and embedding column
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE skills ADD COLUMN embedding vector(1024);
CREATE INDEX skills_embedding_idx ON skills
  USING hnsw (embedding vector_cosine_ops);

-- Migration 2: AI review columns
ALTER TABLE skills ADD COLUMN review_status text DEFAULT 'pending';
ALTER TABLE skills ADD COLUMN review_feedback jsonb;
ALTER TABLE skills ADD COLUMN reviewed_at timestamp with time zone;

-- Migration 3: Fork relationship columns
ALTER TABLE skills ADD COLUMN parent_skill_id text REFERENCES skills(id);
ALTER TABLE skills ADD COLUMN fork_reason text;
ALTER TABLE skills ADD COLUMN is_fork boolean DEFAULT false;
ALTER TABLE skills ADD COLUMN fork_count integer DEFAULT 0;
ALTER TABLE skills ADD COLUMN root_skill_id text;
CREATE INDEX skills_parent_idx ON skills(parent_skill_id);
```

### Backfill Strategy

```typescript
// scripts/backfill-embeddings.ts
async function backfillEmbeddings() {
  const skillsWithoutEmbedding = await db.query.skills.findMany({
    where: isNull(skills.embedding),
  });

  for (const skill of skillsWithoutEmbedding) {
    const embedding = await generateSkillEmbedding(skill);
    await db.update(skills)
      .set({ embedding })
      .where(eq(skills.id, skill.id));

    // Rate limit to avoid API throttling
    await sleep(100);
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side AI Calls

**What people do:** Call Claude/Voyage API from React components
**Why it's wrong:** Exposes API keys, no rate limiting, inconsistent results
**Do this instead:** All AI calls through Server Actions or API routes

### Anti-Pattern 2: Synchronous Review on Submit

**What people do:** Block form submission until AI review completes
**Why it's wrong:** 2-5 second delay, poor UX, timeouts
**Do this instead:** Create skill immediately with `review_status: 'pending'`, review async

### Anti-Pattern 3: Embedding Every Search Query

**What people do:** Generate embedding for every search
**Why it's wrong:** Adds latency, increases API costs
**Do this instead:** Offer semantic search as explicit option, default to full-text

### Anti-Pattern 4: Deep Fork Trees

**What people do:** Allow unlimited fork depth
**Why it's wrong:** Complex queries, confusing UI, attribution dilution
**Do this instead:** Consider max 3 levels, or flatten to direct parent only

### Anti-Pattern 5: Platform-Specific Content

**What people do:** Store different content per platform
**Why it's wrong:** Maintenance nightmare, content drift
**Do this instead:** Single source content, generate platform configs on-demand

## Sources

### Context7 / Official Documentation
- [Drizzle ORM pgvector guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) - Schema and query patterns
- [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) - SKILL.md format specification
- [Cursor Rules documentation](https://cursor.com/docs/context/rules) - .mdc format specification

### WebSearch (Verified)
- [pgvector GitHub](https://github.com/pgvector/pgvector) - Extension capabilities and index types
- [Anthropic embeddings docs](https://docs.claude.com/en/docs/build-with-claude/embeddings) - Voyage AI partnership
- [Windsurf rules docs](https://docs.windsurf.com/windsurf/cascade/memories) - Rule file format

### Existing Codebase
- `/home/dev/projects/relay/packages/db/src/schema/skills.ts` - Current schema
- `/home/dev/projects/relay/apps/web/app/actions/skills.ts` - Skill creation flow
- `/home/dev/projects/relay/apps/web/lib/search-skills.ts` - Full-text search implementation
- `/home/dev/projects/relay/apps/mcp/src/tools/deploy.ts` - MCP deploy tool

---
*Architecture research for: Relay Internal Skill Marketplace*
*Updated: 2026-02-02 for v1.3 Feature Integration*
