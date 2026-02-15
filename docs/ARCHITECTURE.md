# EverySkill Architecture

## Overview

EverySkill is built on four architectural layers, each delivering distinct value while reinforcing the others. Together they transform scattered AI skills into managed, measurable, portable intellectual property.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Universally Integrated Access                 │
│  Web  |  MCP (in-prompt)  |  Hooks (in-code)  |  API   │
├─────────────────────────────────────────────────────────┤
│  Layer 3: AI Independence                               │
│  Portable format  |  Model-agnostic training data       │
│  Cross-model benchmarking  |  No vendor lock-in         │
├─────────────────────────────────────────────────────────┤
│  Layer 2: IP Stewardship & High Velocity Growth         │
│  Usage metrics  |  Quality scoring  |  Feedback loops   │
│  Training data  |  Cost measurement  |  Benchmarking    │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Smart Skills Database                         │
│  Multi-tenant  |  Semantic search  |  Work-activity     │
│  Privacy-scoped  |  Quality-gated  |  Duplicate detect  │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Smart Skills Database

### Purpose
A multi-tenant, privacy-scoped repository that doesn't just store skills — it understands what each user needs and surfaces the right skills at the right time.

### Architecture

**Multi-tenancy**
- Every data table has a `tenant_id` NOT NULL foreign key to the `tenants` table
- PostgreSQL Row-Level Security (RLS) policies enforce tenant isolation at the database level
- Connection-level `app.current_tenant_id` set via `SET LOCAL` on each request
- Subdomain routing: `acme.everyskill.ai` resolves to the `acme` tenant

**Visibility scoping**
- 4 tiers: `personal` (author only), `team`, `tenant` (company-wide), `public`
- Visibility filter applied via `buildVisibilityFilter()` SQL builder in all skill queries
- Personal skills belong to the user regardless of employer — portable IP

**Semantic search**
- Ollama runs `nomic-embed-text` locally to generate 768-dimension embeddings
- Embeddings stored in PostgreSQL via `pgvector` extension with HNSW index
- Search flow: keyword results (tsvector + ILIKE) run in parallel with semantic results (cosine similarity), then merge — semantic matches supplement keyword results
- Duplicate detection uses the same embedding infrastructure (cosine threshold 0.85+)

**Work-activity analysis**
- Gmail connector analyzes email patterns via two-pass classification (rule-based + AI)
- Activity categories mapped against skill catalog to recommend high-impact skills
- Privacy-first: raw email metadata analyzed and discarded, only aggregates persisted
- Roadmap: Chrome/Safari/Edge browsing history, Slack, Google Docs, screen time data

**Quality-gated publishing**
- Skill lifecycle: `draft` → `pending_review` → `ai_reviewed` → `approved`/`rejected` → `published`
- AI review scores quality, clarity, completeness (auto-approve threshold 7/10)
- Admin review dashboard with diff view, approve/reject/request-changes
- Insert-only `review_decisions` table for SOC2-compliant audit trail

### Key Files
```
packages/db/src/schema/skills.ts          — skill table definition
packages/db/src/schema/tenants.ts         — tenant table + RLS
packages/db/src/schema/skill-embeddings.ts — pgvector embedding storage
packages/db/src/services/tenant.ts        — getTenantBySlug(), getTenantByDomain()
apps/web/lib/search-skills.ts             — hybrid keyword + semantic search
apps/web/lib/similar-skills.ts            — cosine similarity queries
apps/web/lib/ollama.ts                    — embedding generation
apps/web/middleware.ts                    — subdomain extraction + tenant header injection
```

### Data Model (Layer 1)
```
tenants ──┐
           ├── skills (name, content, category, tags, visibility, status)
           ├── skill_embeddings (vector(768), HNSW index)
           ├── users (Google SSO, role, tenant membership)
           └── site_settings (per-tenant feature flags)
```

---

## Layer 2: IP Stewardship & High Velocity Growth

### Purpose
Protect and grow your IP. Fast. This layer tracks usage, measures quality, captures feedback, collects training data, benchmarks across models, and channels improvement suggestions back into skills — creating a continuous improvement engine.

### The Feedback Loop
```
    ┌──── Use skill ────┐
    │                    ▼
Improved skill    Track usage + cost
    ▲                    │
    │                    ▼
Fork / Apply      Collect feedback
suggestion        (thumbs, suggestions)
    ▲                    │
    │                    ▼
    └── Author review ──┘
         + training data
```

### Architecture

**Usage tracking**
- PostToolUse hooks embedded in skill frontmatter fire on every skill execution
- Hooks call `/api/track` with skill ID, user ID, timestamps, and tool input/output snippets
- `usage_events` table stores individual events; `skills.totalUses` denormalized counter for display
- Per-employee analytics with org-wide trends, CSV export

**Feedback collection**
- **In-Claude**: MCP `feedback` action with smart frequency gating (first 3 uses, then every 10th)
- **Web**: thumbs up/down + comments on skill detail pages
- **Suggestions**: structured form with category, severity, description, suggested content
- Feedback sentiment aggregated with 14-day daily trend data for sparkline visualization
- File-based counter at `/tmp/everyskill-fb-{skillId}.cnt` for frequency gating

**Suggestion-to-fork pipeline**
- Users submit improvement suggestions on any skill
- Author can **Accept & Fork** (creates a new skill with suggestion applied) or **Apply Inline** (creates a new version)
- `implementedBySkillId` links suggestion to resulting fork for traceability
- `autoImplementLinkedSuggestions()` fires on publish — marks all linked suggestions as "implemented"

**Training data**
- Authors seed golden input/output pairs via web form (source: `web`, status: `approved`)
- Real usage automatically captured as training examples (source: `usage_capture`, status: `pending`)
- Dual consent gating: tenant `trainingDataCaptureEnabled` AND user `trainingDataConsent` must both be true
- Both inputs and outputs sanitized via `sanitizePayload()` to strip secrets before storage

**Token/cost measurement**
- PostToolUse hooks parse Claude transcript JSONL for `model`, `input_tokens`, `output_tokens`
- Static pricing table maps 14 Anthropic model IDs to microcents per input/output token
- `token_measurements` table stores per-execution costs; aggregated into per-skill cost stats
- Fire-and-forget insertion — never blocks the tracking response

**Benchmarking**
- Cross-model execution engine runs skill against multiple models (default: Sonnet 4.5 + Haiku 4.5)
- Blinded AI judge (Claude Sonnet) evaluates outputs without knowing which model produced them
- `Promise.allSettled` for parallel model execution — individual failures stored as error results
- Staleness threshold: 90 days or never benchmarked triggers amber warning banner
- Cost trend chart (Recharts AreaChart) shows token costs over time

### Key Files
```
packages/db/src/services/skill-feedback.ts    — feedback CRUD, suggestions, training examples
packages/db/src/services/token-measurements.ts — cost tracking and aggregation
packages/db/src/services/benchmark.ts         — benchmark runs, results, model comparison
packages/db/src/services/pricing.ts           — static Anthropic pricing table
apps/web/app/api/track/route.ts               — usage + token + training capture endpoint
apps/web/app/api/feedback/route.ts            — feedback submission endpoint
apps/web/lib/benchmark-runner.ts              — cross-model execution engine
apps/mcp/src/tools/feedback.ts                — MCP feedback handler
apps/mcp/src/tools/deploy.ts                  — PostToolUse hooks (tracking + feedback prompting)
apps/web/lib/sanitize-payload.ts              — secret stripping utility
```

### Data Model (Layer 2)
```
skills
  ├── usage_events (userId, toolInput, toolOutput, timestamps)
  ├── skill_feedback (feedbackType discriminator)
  │     ├── type: thumbs_up / thumbs_down (sentiment)
  │     ├── type: suggestion (category, severity, suggestedContent)
  │     └── type: training_example (exampleInput, exampleOutput, source)
  ├── token_measurements (model, inputTokens, outputTokens, costMicrocents)
  ├── benchmark_runs (status, totalInputs, completedAt)
  │     └── benchmark_results (model, input, output, score, costMicrocents)
  └── ratings (score, comment, hoursSavedEstimate)
```

---

## Layer 3: AI Independence

### Purpose
Free users and organizations from dependence on any single AI provider. Skills, training data, and quality benchmarks are portable across platforms.

### Architecture

**Portable skill format**
- Skills are markdown documents with YAML frontmatter metadata
- No Claude-specific instructions embedded in the format itself
- Frontmatter contains universal metadata: name, description, category, tags, time estimates
- EverySkill-specific tracking hooks are injected/stripped separately from skill content

**Model-agnostic training data**
- Training examples are simple input/output text pairs
- Not model-specific fine-tuning data (no LoRA weights, no prompt templates)
- Any AI platform can use these examples for evaluation, few-shot prompting, or fine-tuning

**Cross-model benchmarking**
- Benchmark runner executes skills against configurable model list
- Default: Claude Sonnet 4.5 + Claude Haiku 4.5; extensible to any model with API access
- Blinded evaluation: judge model sees outputs without model attribution
- Results stored with model ID — enables historical quality comparison across models

### Current State vs Roadmap

| Capability | Status |
|-----------|--------|
| Portable markdown skill format | Built |
| Model-agnostic training data | Built |
| Cross-model benchmarking (Claude models) | Built |
| Multi-provider execution (OpenAI, Gemini) | Roadmap |
| Platform-agnostic skill translation | Roadmap |
| Provider-neutral MCP transport | Roadmap |

### Key Files
```
apps/web/lib/benchmark-runner.ts    — model-configurable execution engine
apps/web/lib/frontmatter.ts         — portable frontmatter build/strip utilities
packages/db/src/services/pricing.ts  — multi-model pricing (extensible)
```

---

## Layer 4: Universally Integrated Access

### Purpose
Low friction equals adoption. Users should access skills wherever they already work, with zero context switching. Each access point is a full participant — not a read-only view.

### Access Points

**Web application** (`apps/web`)
- Full-featured Next.js 16 application with React 19
- Server components for data fetching, client components for interactivity
- Server actions for mutations (form-based, progressive enhancement)
- Pages: home, skills browse, skill detail (5 tabs), upload, admin panel, analytics, preferences

**MCP server** (`apps/mcp`)
- Stdio transport for Claude Code CLI integration
- Streamable HTTP transport for Claude.ai browser access (via `/api/mcp/[transport]`)
- Unified `/everyskill` tool with STRAP action router:
  - `search` — semantic + keyword skill discovery
  - `track` — usage event recording
  - `recommend` — AI-powered skill suggestions
  - `analyze` — skill quality analysis
  - `publish` — push skill updates
  - `feedback` — thumbs up/down with comments
- PostToolUse hooks for automatic tracking and feedback prompting

**REST API** (`apps/web/app/api/`)
- `/api/track` — usage events, token measurements, training data capture
- `/api/feedback` — feedback submission with Bearer auth
- `/api/health` — health check endpoint
- `/api/auth/validate-key` — API key validation
- `/api/install-callback` — install analytics
- `/api/mcp/[transport]` — Streamable HTTP MCP endpoint
- `/api/cron/*` — scheduled digest emails, integrity checks
- `/api/gmail/*` — Gmail OAuth flow and status

**In-code hooks**
- PostToolUse hooks injected into skill frontmatter on upload
- Sync hooks return `additionalContext` for feedback prompting
- Async hooks fire tracking callbacks to `/api/track`
- Transcript parsing extracts model and token data from Claude JSONL logs

### Authentication

| Access Point | Auth Method |
|-------------|------------|
| Web | Session cookie (Auth.js, Google SSO) |
| MCP stdio | `EVERYSKILL_API_KEY` env var |
| MCP HTTP | Session cookie (shared with web) |
| REST API | Bearer token (API key with SHA-256 hash) |
| Hooks | API key embedded in frontmatter |

### Key Files
```
apps/web/app/                         — Next.js pages and API routes
apps/mcp/src/tools/everyskill.ts      — unified MCP tool with action router
apps/mcp/src/tools/deploy.ts          — PostToolUse hook generation
apps/mcp/src/auth.ts                  — MCP auth (API key → userId)
apps/web/middleware.ts                — subdomain routing, auth checks, path exemptions
apps/web/auth.ts                      — Auth.js configuration
```

---

## Cross-Cutting Concerns

### Secret Detection & Sanitization
- `sanitizePayload()` strips API keys, tokens, passwords from all user-submitted content
- Pattern-based detection with assignment-context gating (key=value syntax) to prevent false positives
- Pattern order matters: Anthropic (`sk-ant-`) before OpenAI (`sk-`) to prevent double-matching
- Applied to: feedback comments, tracking snippets, training data, suggestions

### Multi-Tenancy
- Database: `tenant_id` FK on all 9 data tables + RLS policies
- Auth: Google SSO email domain maps to tenant via `getTenantByDomain()`
- Routing: subdomain extraction in middleware injects `x-tenant-slug` header
- Session: JWT carries `tenantId` claim, 8-hour expiry (SOC2 compliance)
- Cookies: `__Secure-` prefix with domain attribute for cross-subdomain access

### Notification System
- In-app notifications with unread counts
- Email notifications (immediate + daily/weekly digest via cron)
- Per-user notification preferences (review updates, suggestion activity)
- Types: `review_submitted`, `review_decision`, `suggestion_received`, `suggestion_status_changed`

---

## Database Schema Overview

24 tables across the 4 layers:

```
Core:           skills, users, tenants, skill_versions, skill_messages
Auth:           accounts, sessions, verification_tokens (Auth.js managed)
Discovery:      skill_embeddings, search_queries, email_diagnostics, gmail_tokens
Quality:        ratings, skill_reviews, review_decisions, skill_feedback
Measurement:    usage_events, token_measurements, benchmark_runs, benchmark_results
Settings:       site_settings, user_preferences, notification_preferences, api_keys
Audit:          audit_logs, notifications
```

All tables use `text` primary keys (UUIDs as text), `timestamp` columns for created/updated dates, and `tenant_id` foreign keys for multi-tenancy.

---

## Technology Choices

| Choice | Rationale |
|--------|-----------|
| Next.js 16 + React 19 | Server components for data, client components for interaction; `useActionState` for progressive forms |
| PostgreSQL + pgvector | Single database for relational + vector; no separate vector DB infrastructure |
| Drizzle ORM | Type-safe queries, raw SQL escape hatch, pgPolicy support for RLS |
| Ollama (local) | No external API dependency for embeddings; runs on same server |
| Auth.js v5 | Google Workspace SSO with JWT strategy for Edge middleware compatibility |
| MCP SDK | Standard protocol for Claude integration; stdio + HTTP transports |
| Turborepo + pnpm | Fast builds with caching; workspace isolation between packages |
| PM2 | Process management with zero-downtime reload, auto-restart on crash |
| Caddy | Auto-TLS via Let's Encrypt, on-demand certificates for tenant subdomains |

---

*Last updated: 2026-02-15*
