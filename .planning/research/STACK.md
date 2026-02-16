# Technology Stack: v7.0 Algorithm & Architecture Rewrite

**Project:** EverySkill - GraphRAG, Adaptive Routing, Temporal Tracking, Extended Visibility, Multi-Model Benchmarking
**Researched:** 2026-02-16
**Overall confidence:** HIGH

---

## Recommended Stack

### Core Framework (NO CHANGES)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 16.1.6 | App framework, server actions, API routes | Already installed |
| Drizzle ORM | 0.42.0 | Database ORM with pgPolicy support | Already installed |
| PostgreSQL | 16 | Database with pgvector, RLS, range types | Already running |
| Zod | 3.25+ | Schema validation | Already installed |
| Recharts | 3.7.0 | Dashboard charts | Already installed |
| TypeScript | 5.7+ | Type safety | Already installed |
| Anthropic SDK | 0.72.1 | AI reviews, benchmarking judge, community labels | Already installed |

### NEW: Community Detection

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| louvain-leiden (or vendor) | TBD | Leiden community detection algorithm | TypeScript implementation exists on GitHub (esclear/louvain-leiden). For graphs under 10K nodes, pure JS runs in milliseconds. No Python sidecar needed |

**Note:** The exact npm package needs verification at implementation time. Alternatives include vendoring the algorithm (~300 lines) or using graphology-communities-louvain (Louvain with resolution tuning, which achieves equivalent results at this scale).

### NEW: Multi-Model AI SDKs

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| openai | ^5.x | OpenAI API client for GPT models in benchmarks | Official SDK, dynamic-imported only when benchmarking uses OpenAI models |
| @google/genai | ^1.x | Google AI API client for Gemini models in benchmarks | New official SDK (replaces deprecated @google/generative-ai). Dynamic-imported only when benchmarking uses Google models |

### Database (NO CHANGES)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| PostgreSQL | 16 | Primary database | Already running |
| pgvector | (installed) | Vector similarity search | Already enabled |
| RLS policies | (enabled) | Tenant isolation | Already configured on all tables |

### Infrastructure (NO CHANGES)

| Technology | Purpose | Status |
|------------|---------|--------|
| Ollama | Local embeddings (nomic-embed-text, 768 dims) | Already running |
| PM2 | Process management (prod/staging) | Already configured |
| Caddy | Reverse proxy with TLS | Already configured |
| Docker Compose | PostgreSQL container | Already running |

### Supporting Libraries (NO NEW DEPS)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| diff | 8.0.3 | Text diffs for version comparison | Already installed |
| drizzle-orm | 0.42.0 | ORM with pgPolicy support | Already installed |
| @modelcontextprotocol/sdk | 1.26+ | MCP server | Already installed |

---

## Alternatives Considered

### Community Detection

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Graph storage | PG adjacency list | Neo4j | Massive operational overhead for <10K node graphs. Research confirms PG outperforms Neo4j at this scale |
| Graph storage | PG adjacency list | Apache AGE (PG extension) | Adds Cypher query language. Overkill -- we load into memory for analysis, PG just stores edges |
| Community detection | Leiden (JS/vendored) | Python sidecar (leidenalg) | Deployment complexity, IPC overhead, separate process health monitoring |
| Community detection | Leiden (JS/vendored) | Louvain (graphology) | Louvain with resolution tuning is viable but Leiden guarantees well-connected communities. At our scale the difference is minor but Leiden is the more correct algorithm |
| Community detection | Leiden (JS/vendored) | WASM Leiden binary | Build complexity for marginal performance gain on small graphs |

### Multi-Model Benchmarking

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Multi-model SDK | Direct SDKs + abstraction | Vercel AI SDK | Project already has direct @anthropic-ai/sdk with custom pricing logic. AI SDK adds ~200KB+ framework code for features we don't use (streaming UI, RSC integration). A thin provider abstraction is simpler |
| Multi-model SDK | Direct SDKs + abstraction | LangChain.js | 50+ package ecosystem for what we need from 2 SDK packages. Heavy abstraction without value |
| Multi-model SDK | Direct SDKs + abstraction | LiteLLM | Python-only. Would require sidecar |
| Background jobs | DB-based cron polling | Inngest | Self-hosted VPS, not Vercel. External dependency for a single use case |
| Background jobs | DB-based cron polling | Bull + Redis | No Redis in current stack. Adding Redis for one feature is overhead |
| Background jobs | DB-based cron polling | Trigger.dev | External SaaS dependency. The existing cron pattern is sufficient |

### Temporal Tracking

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Temporal model | Application-time columns (valid_from/valid_to) | Full bi-temporal (4 columns) | Overkill. System time already captured by immutable append-only skillVersions + createdAt |
| Temporal model | Application-time columns | SCD Type 2 (flag columns) | Doesn't capture validity periods. Two timestamp columns are cleaner and support range queries |
| Column type | timestamptz (nullable) | tstzrange | Range types need custom Drizzle column types and are harder to work with. Two nullable timestamps are simpler and sufficient for our queries |

### Visibility Extension

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Visibility column | Keep as text, add CHECK constraint | Migrate to PG enum | Enum changes require ALTER TYPE which is disruptive. Text + CHECK is simpler and equally type-safe |
| RLS for public | Permissive read policy | Application-level bypass | Application bypass breaks the security model. A permissive RLS policy is the PostgreSQL-native approach |

---

## Environment Variables (New)

```env
# apps/web/.env.local (all optional -- only needed for multi-model benchmarking)

OPENAI_API_KEY=sk-...           # For GPT model benchmarks
GOOGLE_AI_API_KEY=AIza...       # For Gemini model benchmarks

# Existing (unchanged):
# ANTHROPIC_API_KEY — already configured
# DATABASE_URL — already configured
# CRON_SECRET — already configured (used by new cron routes)
```

---

## Installation

```bash
# Multi-model AI SDKs (only needed for multi-model benchmarking, Phase 4)
cd /home/dev/projects/relay/apps/web && pnpm add openai @google/genai

# Community detection (Phase 2 -- exact package TBD, may vendor instead)
# cd /home/dev/projects/relay/apps/web && pnpm add louvain-leiden

# No other new dependencies needed
# No new database extensions needed (pgvector and btree_gist already available)
```

**Dev dependencies:** None new. Existing vitest + playwright handle testing.

---

## What NOT to Add

| Tempting Addition | Why Skip |
|-------------------|----------|
| Neo4j / Memgraph | Graph DB for <10K nodes is massive overkill. PG adjacency list + in-memory algorithm covers our needs |
| Python sidecar | Deployment complexity, IPC overhead, resource management. Only consider if skill count exceeds 100K per tenant |
| Vercel AI SDK | Already have direct Anthropic SDK with custom pricing. Adding AI SDK framework code for 2 additional providers is worse than a thin abstraction |
| LangChain.js | 50+ package ecosystem for what we need from 2 SDK packages |
| Redis | No Redis in current stack. DB-based job tracking is sufficient for benchmark background execution |
| Inngest / Trigger.dev | External SaaS for a self-hosted project. The existing cron pattern works |
| TimescaleDB | Temporal needs are metadata snapshots, not time-series telemetry |
| Apache AGE | Cypher on PG is interesting but overkill -- we load into JS for analysis |
| graphology suite | 6+ packages for what could be a vendored ~300-line Leiden implementation or one npm package |

---

## Package Summary

| Package | New/Update | Server-Only | Phase |
|---------|------------|-------------|-------|
| openai | NEW | Yes (dynamic import) | Phase 4 |
| @google/genai | NEW | Yes (dynamic import) | Phase 4 |
| louvain-leiden (or vendor) | NEW | Yes | Phase 2 |

**Total new JS deps:** 2-3 packages (all server-only, no client bundle impact due to dynamic imports)
**New PG extensions:** 0
**New infrastructure services:** 0

---

## Sources

### HIGH Confidence
- [OpenAI Node.js SDK](https://github.com/openai/openai-node) -- official, actively maintained
- [@google/genai migration docs](https://ai.google.dev/gemini-api/docs/migrate) -- replacement for deprecated @google/generative-ai
- [PostgreSQL vs Neo4j for small graphs](https://medium.com/self-study-notes/exploring-graph-database-capabilities-neo4j-vs-postgresql-105c9e85bb5d) -- PG outperforms for <100K nodes
- [Leiden algorithm paper](https://arxiv.org/abs/1810.08473) -- algorithm specification
- Existing codebase: `benchmark-runner.ts`, `hybrid-search.ts`, `visibility.ts`, `pricing.ts`, `ollama.ts`

### MEDIUM Confidence
- [esclear/louvain-leiden](https://github.com/esclear/louvain-leiden) -- TypeScript Leiden implementation exists but needs API verification
- @google/genai exact API surface for token counting -- recently renamed package, verify at implementation time
- Dynamic import pattern for tree-shaking -- standard Node.js pattern but verify Next.js handles it correctly in server actions
