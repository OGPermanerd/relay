# Project Milestones: EverySkill

## v6.0 IP Dashboard & Skills Portfolio (Shipped: 2026-02-16)

**Delivered:** Company IP dashboard with risk analysis and valuation, individual skills portfolio with impact measurement, shareable skills resume, and pre-LLM history upload.

**Phases completed:** 62-68 (15 plans total)

**Key accomplishments:**
- Company IP dashboard with hero KPIs (total skills, uses, hours saved, contributors) and org-wide quality trend charts
- IP risk analysis with key person dependency detection, severity indicators, and employee drill-down
- IP valuation with replacement cost formula and PDF/CSV board report export
- Individual skills portfolio with portable vs company IP breakdown and tenant-scoped contribution ranking
- Skills impact timeline and value-added calculator with cumulative hours/cost metrics
- Shareable skills resume with public URL, PDF download, and company skills toggle
- Pre-LLM work artifact upload with AI-powered skill analysis and timeline integration

**Stats:**
- 83 files created/modified
- ~13,926 lines of TypeScript
- 7 phases, 15 plans, 12 requirements
- 2 days (2026-02-15 → 2026-02-16)

**Git range:** `1bfa3a3` (feat(62-01)) → `c0c94db` (docs(phase-68))

**Archive:** [v6.0-ROADMAP.md](milestones/v6.0-ROADMAP.md) | [v6.0-REQUIREMENTS.md](milestones/v6.0-REQUIREMENTS.md)

---

## v5.0 Feedback, Training & Benchmarking (Shipped: 2026-02-15)

**Delivered:** In-Claude and web feedback collection, training data with golden datasets, suggestion-to-fork pipeline, token/cost measurement, and cross-model benchmarking.

**Phases completed:** 55-61 (18 plans total)

**Key accomplishments:**
- In-Claude feedback via MCP with smart frequency gating (first 3 uses, then every 10th)
- Web feedback with thumbs up/down, comments, and aggregated sentiment trends
- Structured suggestion form with category, severity, and author review workflow
- Training data with author-seeded golden examples and consent-gated usage capture
- Token/cost measurement with transcript parsing, static pricing table, and cost StatCards
- Cross-model benchmarking with blinded AI judge and cost trend visualization

**Stats:**
- 7 phases, 18 plans, 12 requirements
- 1 day (2026-02-15)

**Archive:** [v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md) | [v5.0-REQUIREMENTS.md](milestones/v5.0-REQUIREMENTS.md)

---

## v4.0 Gmail Workflow Diagnostic (Shipped: 2026-02-14)

**Delivered:** Gmail OAuth connector, email pattern analysis, AI-powered skill recommendations, diagnostic dashboard, and deployment plan.

**Phases completed:** 49-54 (17 plans total)

**Key accomplishments:**
- Gmail connector via separate OAuth flow with encrypted token storage
- Email pattern analysis with two-pass classification (rule-based + AI)
- AI-powered skill recommendations matching work activity to skill catalog
- Diagnostic dashboard with category PieChart, time BarChart, and hero KPIs
- Tenant resolution cleanup (DEFAULT_TENANT_ID removed from all code paths)

**Stats:**
- 6 phases, 17 plans, 22 requirements
- 1 day (2026-02-14)

**Archive:** [v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md) | [v4.0-REQUIREMENTS.md](milestones/v4.0-REQUIREMENTS.md)

---

## v3.0 AI Discovery & Workflow Intelligence (Shipped: 2026-02-13)

**Delivered:** Visibility scoping, Loom video integration, unified MCP tool, user preferences, hybrid search, search analytics, and homepage redesign.

**Phases completed:** 40-48 (21 plans total)

**Key accomplishments:**
- Skill visibility scoping (global company / employee visible / employee invisible / personal)
- Loom video integration for skill demos
- `/everyskill` unified MCP tool with STRAP action router pattern
- Personal preference extraction and cross-AI pref sync (CLAUDE.md export)
- Hybrid search with pgvector + ILIKE + RRF fusion
- Homepage redesign with AI greeting, compact stats, category tiles, discovery search

**Stats:**
- 9 phases, 21 plans, 26 requirements
- 5 days (2026-02-08 → 2026-02-13)

**Archive:** [v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) | [v3.0-REQUIREMENTS.md](milestones/v3.0-REQUIREMENTS.md)

---

## v2.0 Skill Ecosystem (Shipped: 2026-02-08)

**Delivered:** Quality-gated skill publishing with AI review, admin approval, conversational MCP discovery, and fork drift detection.

**Phases completed:** 34-39 (23 plans total)

**Key accomplishments:**
- Quality-gated publishing: 7-status review lifecycle replacing instant-publish, with draft → AI review → admin approval → published flow
- Automatic AI review with configurable auto-approve threshold (7/10) — low-quality skills never reach admin queue
- Admin review dashboard with paginated queue, AI scores, content diffs, and immutable SOC2 audit trail
- Review notification system: in-app + email at every lifecycle stage with grouped preference controls
- Conversational MCP discovery: semantic search via pgvector, rich skill descriptions with quality tiers, category-specific usage guidance
- Fork drift detection: frontmatter-stripped hash comparison, update_skill MCP tool for pushing changes back, side-by-side comparison UI

**Stats:**
- 67 files created/modified
- ~17,000 lines of TypeScript (cumulative)
- 6 phases, 23 plans, 44 requirements
- 1 day (2026-02-08)

**Git range:** `d047dfc` (feat(34-01)) → `65c87f3` (docs(phase-39))

**Archive:** [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) | [v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md)

---

## v1.5 Production, Multi-Tenancy & Reliable Usage Tracking (Shipped: 2026-02-08)

**Delivered:** Production Docker deployment, full multi-tenancy with subdomain routing, RBAC, branding, email notifications, and hook-based usage tracking.

**Phases completed:** 25-33 (55 plans total)

**Key accomplishments:**
- Multi-tenancy with RLS, subdomain routing, and tenant isolation across all 9 data tables
- Production Docker Compose deployment on Hetzner with Caddy/SSL
- Hook-based deterministic usage tracking via PostToolUse callbacks
- EverySkill branding with custom domain, tenant white-labeling, and animated logo
- Admin panel with RBAC, tenant settings, user management
- Email notification system with preferences, cron digests, and notification bell UI

**Stats:**
- 55 plans across 9 phases
- 2 days (2026-02-07 → 2026-02-08)

**Git range:** See v1.5-ROADMAP.md

**Archive:** [v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) | v1.5-REQUIREMENTS.md (inline in v1.5 roadmap)

---

## v1.4 Employee Analytics & Remote MCP (Shipped: 2026-02-06)

**Delivered:** Enterprise-grade employee attribution, usage analytics dashboard, web-accessible MCP via Streamable HTTP, and extended search matching authors and tags.

**Phases completed:** 20-24 (25 plans total)

**Key accomplishments:**
- API key infrastructure with SHA-256 hashing, `rlk_` prefix, rotation with grace period, admin management
- Per-employee usage attribution — every MCP tool call and install linked to the employee who performed it
- Streamable HTTP MCP endpoint for Claude.ai browser access with bearer token auth and CORS
- Analytics dashboard with org-wide trends chart, per-employee tables, skill leaderboards, and CSV export
- Extended MCP search with shared ILIKE service matching name, description, author, and tags with field-weighted scoring

**Stats:**
- 34 files created/modified
- ~4,117 lines of TypeScript
- 5 phases, 25 plans
- 2 days (2026-02-05 → 2026-02-06)

**Git range:** `c1ebb22` (docs(20)) → `1472a72` (docs(v1.4))

**Archive:** [v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) | [v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)

---

## v1.3 AI Quality & Cross-Platform (Shipped: 2026-02-04)

**Delivered:** AI-driven skill review, semantic similarity detection, fork-based versioning, and cross-platform MCP install with OS auto-detection.

**Phases completed:** 15-19 (15 plans total)

**Key accomplishments:**
- Vector embeddings infrastructure with Voyage AI and pgvector for semantic search
- Similarity detection showing top 3 similar skills on publish (advisory, non-blocking)
- On-demand AI quality review with 3 categories (quality, clarity, completeness) and overall score
- Fork-based versioning with "Forked from X" attribution and fork count display
- Cross-platform install modal with 4 platforms (Claude Desktop, Claude Code, Other IDE, Other Systems)
- OS auto-detection with install scripts for macOS/Linux (bash) and Windows (PowerShell)

**Stats:**
- 25 files created/modified
- 9,475 lines of TypeScript
- 5 phases, 15 plans
- 2 days from v1.2 to v1.3

**Git range:** `dd0c6f1` (feat(15-01)) → `138083f` (test(19))

**Archive:** [v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) | [v1.3-REQUIREMENTS.md](milestones/v1.3-REQUIREMENTS.md)

---

## v1.2 UI Redesign (Shipped: 2026-02-02)

**Delivered:** Two-panel sortable table layout with inline expansion, one-click install, full keyboard navigation, and mobile accessibility.

**Phases completed:** 12-14 (12 plans total)

**Key accomplishments:**
- Two-panel layout with skills table (2/3) and contributor leaderboard (1/3)
- Sortable columns with URL state persistence via nuqs
- Inline accordion expansion for skill details with one-click MCP install
- Full keyboard navigation with roving tabindex and arrow key support
- Screen reader support with aria-sort, live announcements, and ARIA attributes
- Mobile responsive with vertical stacking, horizontal scroll, and swipe gestures

**Stats:**
- 20 files created/modified
- 5,592 lines of TypeScript
- 3 phases, 12 plans
- 1 day from v1.1 to v1.2

**Git range:** `8ea8da8` (feat(12-01)) → `1173641` (docs(14-05))

**Archive:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 Quality & Polish (Shipped: 2026-02-01)

**Delivered:** Quality scorecards for skill discovery, tag filtering backend, and comprehensive E2E test coverage.

**Phases completed:** 9-11 (9 plans total)

**Key accomplishments:**
- Quality score calculation with weighted formula (usage 50%, rating 35%, docs 15%)
- Gold/Silver/Bronze/Unrated badges on skill cards and detail pages
- "Why this badge?" breakdown showing score components
- Quality tier filter and sort on browse page
- Backend tag filtering with PostgreSQL array operators
- 22 Playwright E2E tests covering authenticated user flows

**Stats:**
- 30 files created/modified
- 5,942 lines of TypeScript
- 3 phases, 9 plans
- 1 day from start to ship

**Git range:** `9328002` (feat: add tags column) → `15e28ce` (docs: add UAT verification report)

**Archive:** [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

---

## v1.0 MVP (Shipped: 2026-01-31)

**Delivered:** Internal skill marketplace with MCP integration, usage tracking, ratings, and FTE Days Saved metrics.

**Phases completed:** 1-8 (33 plans total)

**Key accomplishments:**
- Monorepo with Turborepo, Next.js 15+, PostgreSQL, Drizzle ORM
- Google Workspace SSO authentication with domain restriction
- MCP server with skill search, deploy, and automatic usage tracking
- Multi-format skill validation (Claude Code skills, prompts, workflows, agent configs)
- Full-text search with PostgreSQL tsvector
- Star ratings with user time-saved estimates
- Platform dashboard with FTE Days Saved, trending skills, contributor leaderboard

**Stats:**
- 200 files created/modified
- 4,667 lines of TypeScript
- 8 phases, 33 plans
- 1 day from start to ship

**Git range:** `d25bb59` (docs: initialize project) → `b2f5fb3` (fix: increment totalUses)

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---
