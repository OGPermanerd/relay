# EverySkill

**Protect and grow your IP. Fast.**

EverySkill is an AI skills platform built on four architectural layers that turn scattered prompts, workflows, and agent configurations into managed, measurable intellectual property.

## The Problem

AI skills live in individual CLAUDE.md files, scattered across laptops, invisible to the organization. When someone leaves, their skills leave too. When someone builds something great, nobody else benefits. When a skill works well, there's no data to prove it. And when the next AI platform arrives, everything starts over.

## Four Layers

### 1. Smart Skills Database
A multi-tenant, privacy-scoped skills repository that goes beyond storage. Skills are discovered through semantic search (not just keywords), and the system analyzes your actual work patterns to recommend the skills that will have the most impact on what you're doing right now.

- **Multi-tenant isolation** with row-level security and subdomain routing
- **4-tier visibility**: personal, team, tenant-wide, or public
- **Semantic search** via Ollama embeddings + pgvector cosine similarity
- **Work-activity analysis** (Gmail patterns today, browser history and more channels coming) matched against the skill catalog
- **Duplicate detection** on upload to prevent redundant skills
- **Quality-gated publishing** with AI review and admin approval workflows

### 2. IP Stewardship & High Velocity Growth
The sum total of a tenant's (or user's) skills is intellectual property. This layer protects it, measures it, and makes it better through continuous feedback loops.

- **Usage tracking** with per-skill metrics (total uses, unique users, hours saved)
- **Quality scoring** via automated AI review (clarity, completeness, quality)
- **Feedback sentiment** from thumbs up/down with aggregated trends
- **Training data** — authors seed golden input/output examples; real usage captures more (with dual consent)
- **Token/cost measurement** — actual cost per skill execution across models
- **Benchmarking** — cross-model quality comparison with blinded AI judge
- **Suggestion-to-fork pipeline** — user suggestions auto-generate improved versions
- **IP protection** — companies retain institutional knowledge when employees leave; employees retain personal skills when they move on

### 3. AI Independence
Skills are portable text, training data is model-agnostic input/output pairs, and benchmarking already compares models head-to-head. The architecture ensures no lock-in to any single AI provider.

- **Model-agnostic skill format** — markdown-based, works with any LLM
- **Cross-model benchmarking** — evaluate skills across Sonnet, Haiku, and any future model
- **Model-agnostic training data** — golden examples are input/output pairs, not fine-tuning artifacts
- **Roadmap**: multi-platform execution (OpenAI, Gemini, Llama) with platform-agnostic skill translation

### 4. Universally Integrated Access
Low friction equals adoption. Skills are accessible wherever you work — browser, prompt, code, or API — with zero context switching.

- **Web application** — full CRUD, feedback, suggestions, training, benchmarking, admin controls
- **In-prompt (MCP)** — search, execute, track, and give feedback without leaving Claude
- **In-code (hooks)** — PostToolUse hooks for automatic tracking, feedback prompting, and training data capture
- **REST API** — programmatic access for tracking, feedback, health checks, and integrations
- **Roadmap**: cross-AI-platform access (same skill from ChatGPT, Gemini, Claude)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 with React 19 |
| Language | TypeScript (strict mode), ~50k LOC |
| Database | PostgreSQL 16 + pgvector + Drizzle ORM |
| Auth | Auth.js v5 (Google Workspace SSO) |
| AI | Anthropic SDK, Ollama (nomic-embed-text) |
| MCP | @modelcontextprotocol/sdk + mcp-handler |
| Monorepo | Turborepo + pnpm workspaces |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Testing | Playwright (E2E), vitest (unit) |
| Deployment | PM2, Caddy, LXC on Hetzner VPS |

## Monorepo Structure

```
everyskill/
├── apps/
│   ├── web/                # Next.js web application
│   └── mcp/                # MCP server (stdio transport)
├── packages/
│   ├── core/               # Shared types and constants
│   ├── db/                 # Drizzle schema, migrations, services
│   ├── storage/            # File storage abstractions
│   └── ui/                 # Shared React components
├── docs/                   # Architecture, infrastructure, guides
│   ├── ARCHITECTURE.md     # 4-layer architecture deep dive
│   ├── INFRASTRUCTURE.md   # Deployment and environments
│   ├── CONTRIBUTING.md     # Developer guide
│   └── API.md              # API reference
└── .planning/              # Roadmap, phase plans, state tracking
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+ with pgvector extension

### Setup

```bash
git clone <repository-url>
cd everyskill
pnpm install
cp apps/web/.env.example apps/web/.env.local  # configure DATABASE_URL, auth credentials
pnpm db:migrate                                # run all migrations
pnpm dev                                       # start dev server on :2002
```

### Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build all packages |
| `pnpm db:migrate` | Run database migrations |
| `cd apps/web && npx playwright test` | Run E2E tests |
| `./deploy.sh staging` | Deploy to staging |
| `./deploy.sh promote` | Promote staging to production |

## Environments

| Environment | URL | Port |
|------------|-----|------|
| Production | everyskill.ai | 2000 |
| Staging | staging.everyskill.ai | 2001 |
| Development | localhost:2002 | 2002 |

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** — 4-layer architecture, data model, integration patterns
- **[Infrastructure](docs/INFRASTRUCTURE.md)** — Deployment topology, environments, operations
- **[Contributing](docs/CONTRIBUTING.md)** — Developer setup, code style, testing conventions
- **[API Reference](docs/API.md)** — REST endpoints, MCP tools, webhook formats
- **[System Admin Guide](docs/system-admin-guide.md)** — Server setup, TLS, backups
- **[Tenant Admin Guide](docs/tenant-admin-guide.md)** — Tenant configuration, user management
- **[User Guide](docs/user-guide.md)** — End-user features and workflows

## Milestones

| Version | Shipped | Highlights |
|---------|---------|-----------|
| v1.0 | 2026-01-31 | MVP: skill CRUD, MCP integration, search, ratings |
| v1.1 | 2026-02-01 | Quality scorecards, E2E test coverage |
| v1.2 | 2026-02-02 | Two-panel UI redesign, keyboard navigation |
| v1.3 | 2026-02-04 | AI review, semantic similarity, forking, cross-platform install |
| v1.4 | 2026-02-06 | Employee analytics, remote MCP, API keys |
| v1.5 | 2026-02-08 | Production deployment, multi-tenancy, RBAC, notifications |
| v2.0 | 2026-02-08 | Quality-gated publishing, conversational MCP, drift detection |
| v3.0 | 2026-02-13 | AI discovery, hybrid search, homepage redesign, preferences |
| v4.0 | 2026-02-14 | Gmail workflow diagnostic, work-activity skill recommendations |
| v5.0 | 2026-02-15 | Feedback loops, training data, benchmarking, cost measurement |

## License

Proprietary. Internal use only.
