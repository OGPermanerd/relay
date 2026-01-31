# Roadmap: Relay

## Overview

Relay is an internal skill marketplace delivering Claude skills, prompts, workflows, and agent configurations with wiki-style contribution and metrics-driven quality. The roadmap builds foundation first (auth), then integrates MCP early for usage tracking from the start, then layers web features (publishing, discovery, ratings). Each phase delivers a coherent, verifiable capability that enables the next. Moving MCP Integration early ensures the core metric (FTE Days Saved = uses x hours) has real usage data from day one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Project Foundation** - Development infrastructure, tooling, and CI/CD
- [x] **Phase 2: Authentication** - Google Workspace SSO and user profiles
- [x] **Phase 3: MCP Integration** - Claude Code deployment and usage tracking (early for metrics)
- [x] **Phase 4: Data Model & Storage** - Core schema and multi-format skill support (informed by MCP)
- [x] **Phase 5: Skill Publishing** - Upload skills with metadata and view details
- [ ] **Phase 6: Discovery** - Search, browse, and skill cards
- [ ] **Phase 7: Ratings & Reviews** - User feedback with time-saved estimates
- [ ] **Phase 8: Metrics & Analytics** - FTE Days Saved, dashboard, trending, leaderboard (with real data)

## Phase Details

### Phase 1: Project Foundation
**Goal**: Development environment is ready for feature implementation
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01
**Success Criteria** (what must be TRUE):
  1. Next.js 15+ application runs locally with hot reload
  2. PostgreSQL database runs locally with migrations applied
  3. CI pipeline runs linting, type checking, and tests on push
  4. Project structure follows monorepo pattern from research
  5. Development documentation enables immediate contribution
  6. E2E test harness can validate served pages automatically
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md - Scaffold monorepo with Turborepo, Next.js 15+, shared packages, linting
- [x] 01-02-PLAN.md - PostgreSQL Docker Compose and Drizzle ORM setup
- [x] 01-03-PLAN.md - GitHub Actions CI pipeline with lint, typecheck, test, build, E2E
- [x] 01-04-PLAN.md - Playwright E2E testing with webServer auto-start

### Phase 2: Authentication
**Goal**: Users can securely access the application with company credentials
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User can sign in via Google Workspace SSO
  2. Only users with company domain email can access the application
  3. User profile page displays name and avatar from Google
  4. User profile shows placeholder for contribution statistics
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md - Auth.js v5 with Google provider and Drizzle adapter
- [x] 02-02-PLAN.md - Route protection middleware and login page
- [x] 02-03-PLAN.md - User profile page with contribution statistics placeholder

### Phase 3: MCP Integration
**Goal**: Users can deploy skills to Claude and usage is tracked automatically
**Depends on**: Phase 2
**Requirements**: MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):
  1. MCP server exposes skill search/list operations to Claude
  2. User can query skills from within Claude Code
  3. User can deploy skill to local Claude environment via one-click
  4. MCP server automatically tracks usage when deployed skills run
  5. Usage events stored for downstream analytics (schema ready for Phase 4)
**Plans**: 6 plans (4 original + 2 gap closure)

Plans:
- [x] 03-01-PLAN.md - MCP server scaffold with TypeScript SDK and usageEvents schema
- [x] 03-02-PLAN.md - Skills schema and search/list tools with usage tracking
- [x] 03-03-PLAN.md - Deploy skill tool with usage tracking
- [x] 03-04-PLAN.md - MCP tools unit testing with Vitest
- [x] 03-05-PLAN.md - MCP integration documentation and Claude Desktop configuration (gap closure)
- [x] 03-06-PLAN.md - Database seed script and setup verification (gap closure) [checkpoint: Docker required]

### Phase 4: Data Model & Storage
**Goal**: Database schema supports all skill types with immutable versioning
**Depends on**: Phase 3
**Requirements**: SKIL-02
**Success Criteria** (what must be TRUE):
  1. Database schema supports skills, versions, users, ratings, usage events
  2. Skill content stored in object storage (R2/S3)
  3. System accepts Claude Code skills, prompts, workflows, agent configs
  4. Version model is immutable (new versions create records, never modify)
  5. Usage tracking from MCP Phase 3 integrated into skill metrics
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md - Versioned schema (skillVersions + ratings tables, skills extensions)
- [x] 04-02-PLAN.md - R2 storage package with presigned URL helpers
- [x] 04-03-PLAN.md - Drizzle relations for type-safe nested queries
- [x] 04-04-PLAN.md - Multi-format skill validation with Zod schemas
- [x] 04-05-PLAN.md - Skill metrics service and database push

### Phase 5: Skill Publishing
**Goal**: Users can upload skills and view skill details
**Depends on**: Phase 4
**Requirements**: SKIL-01, SKIL-03
**Success Criteria** (what must be TRUE):
  1. User can upload skill with name, description, category, tags
  2. User can provide usage instructions and estimated time saved
  3. Skill detail page displays full metadata
  4. Skill detail page shows real usage statistics from MCP tracking
  5. Uploaded skill content persists in object storage
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md - Skill upload form with Server Action and slug utility
- [x] 05-02-PLAN.md - Skill detail page with usage statistics
- [x] 05-03-PLAN.md - R2 content storage integration with versioning

### Phase 6: Discovery
**Goal**: Users can find relevant skills through search and browse
**Depends on**: Phase 5
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. User can search skills via full-text search across names, descriptions, tags
  2. Skill cards display name, author, rating, uses (real data), FTE Days Saved sparkline
  3. User can browse skills by category
  4. User can filter search results by tags
  5. Empty states guide users when no results found
**Plans**: TBD

Plans:
- [ ] 06-01: Full-text search with PostgreSQL
- [ ] 06-02: Skill card components
- [ ] 06-03: Category browse and tag filtering
- [ ] 06-04: Search results page

### Phase 7: Ratings & Reviews
**Goal**: Users can rate skills and provide time-saved feedback
**Depends on**: Phase 6
**Requirements**: RATE-01, RATE-02
**Success Criteria** (what must be TRUE):
  1. User can rate skill 1-5 stars after viewing
  2. User can add optional comment with rating
  3. User can submit time-saved estimate as part of review
  4. User-submitted time estimates display and override creator estimates
  5. Skill cards and detail pages reflect aggregated ratings
**Plans**: TBD

Plans:
- [ ] 07-01: Rating submission UI and API
- [ ] 07-02: Time-saved estimate capture
- [ ] 07-03: Rating aggregation and display

### Phase 8: Metrics & Analytics
**Goal**: Platform shows value through FTE Days Saved and surfaces quality content
**Depends on**: Phase 7
**Requirements**: RATE-03, RATE-04, DISC-04, AUTH-03
**Success Criteria** (what must be TRUE):
  1. FTE Days Saved displays at skill level (uses x estimated hours) with real usage data
  2. Platform dashboard shows total contributors, downloads, uses, FTE Days Saved
  3. Trending section surfaces skills with high recent usage velocity (from MCP tracking)
  4. Leaderboard shows top contributors by skills shared, ratings, FTE Days Saved
  5. User profile displays complete contribution statistics
**Plans**: TBD

Plans:
- [ ] 08-01: FTE Days Saved calculation service
- [ ] 08-02: Platform dashboard
- [ ] 08-03: Trending algorithm and section
- [ ] 08-04: Contributor leaderboard
- [ ] 08-05: Profile statistics completion

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Foundation | 4/4 | Complete | 2026-01-31 |
| 2. Authentication | 3/3 | Complete | 2026-01-31 |
| 3. MCP Integration | 6/6 | Complete | 2026-01-31 |
| 4. Data Model & Storage | 5/5 | Complete | 2026-01-31 |
| 5. Skill Publishing | 3/3 | Complete | 2026-01-31 |
| 6. Discovery | 0/4 | Not started | - |
| 7. Ratings & Reviews | 0/3 | Not started | - |
| 8. Metrics & Analytics | 0/5 | Not started | - |

---
*Created: 2026-01-31*
*Last updated: 2026-01-31 - Phase 5 complete*
