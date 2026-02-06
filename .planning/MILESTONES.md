# Project Milestones: Relay

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
