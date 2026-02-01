# Project Milestones: Relay

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
