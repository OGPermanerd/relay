# Phase 1: Project Foundation - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Development infrastructure and tooling for Relay. Sets up Next.js 15+, PostgreSQL, CI/CD pipeline, and Playwright E2E testing. Creates the monorepo structure that enables future selective deployment and white-labeling.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- **Monorepo with Turborepo** — enables selective deployment, independent versioning, white-label flexibility
- **Apps:**
  - `apps/web` — Next.js web application
  - `apps/mcp-server` — MCP server for Claude integration
- **Packages (scoped as @relay/*):**
  - `@relay/core` — shared types, constants, utilities
  - `@relay/db` — database schema, queries, migrations
  - `@relay/ui` — shared React components
- **Feature-based folder structure** within apps/web — colocate by domain (src/features/auth, src/features/skills)

### Development Workflow
- **Pre-commit hooks** with Husky + lint-staged — enforce standards before code hits repo
- **Balanced linting** — core rules as errors, stylistic rules as warnings
- **Prettier** for code formatting — opinionated, minimal config
- **Conventional Commits** — feat:, fix:, docs: prefixes for automated changelogs

### Local Dev Environment
- **Docker Compose** for services — consistent across machines, one command start
- **Fixture data** for database seeding — pre-defined test skills, users, ratings for realistic dev environment
- **Single command startup** — `pnpm dev` starts web, MCP server, and database together
- **Environment variables** — .env.example template checked in, .env.local for local overrides (gitignored)

### Claude's Discretion
- Exact Turborepo configuration and caching setup
- Specific ESLint rules and Prettier config
- Docker Compose service definitions
- CI/CD pipeline implementation details
- Playwright test structure and patterns

</decisions>

<specifics>
## Specific Ideas

- Monorepo chosen specifically for future multi-tenant and cross-company deployment flexibility
- Companies should be able to run just the MCP server with their own UI if needed
- White-labeling should be possible by swapping out apps/web while keeping @relay/core

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-project-foundation*
*Context gathered: 2026-01-31*
