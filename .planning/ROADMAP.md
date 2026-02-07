# Roadmap: Relay

## Milestones

- ✅ **v1.0 MVP** - Phases 1-8 (shipped 2026-01-31)
- ✅ **v1.1 Quality & Polish** - Phases 9-11 (shipped 2026-02-01)
- ✅ **v1.2 UI Redesign** - Phases 12-14 (shipped 2026-02-02)
- ✅ **v1.3 AI Quality & Cross-Platform** - Phases 15-19 (shipped 2026-02-04)
- ✅ **v1.4 Employee Analytics & Remote MCP** - Phases 20-24 (shipped 2026-02-06)
- 🚧 **v1.5 Production, Multi-Tenancy & Reliable Usage Tracking** - Phases 25-33 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8) - SHIPPED 2026-01-31</summary>

See archived roadmap: .planning/milestones/v1.0-ROADMAP.md

**Summary:**
- Phase 1: Project Foundation (4 plans)
- Phase 2: Authentication (3 plans)
- Phase 3: MCP Integration (6 plans)
- Phase 4: Data Model & Storage (5 plans)
- Phase 5: Skill Publishing (3 plans)
- Phase 6: Discovery (4 plans)
- Phase 7: Ratings & Reviews (3 plans)
- Phase 8: Metrics & Analytics (5 plans)

Total: 33 plans completed in 120 minutes.

</details>

<details>
<summary>✅ v1.1 Quality & Polish (Phases 9-11) - SHIPPED 2026-02-01</summary>

See archived roadmap: .planning/milestones/v1.1-ROADMAP.md

**Summary:**
- Phase 9: Tag Filtering (1 plan)
- Phase 10: Quality Scorecards (4 plans)
- Phase 11: E2E Test Coverage (4 plans)

Total: 9 plans completed in 45 minutes.

</details>

<details>
<summary>✅ v1.2 UI Redesign (Phases 12-14) - SHIPPED 2026-02-02</summary>

See archived roadmap: .planning/milestones/v1.2-ROADMAP.md

**Summary:**
- Phase 12: Two-Panel Layout Foundation (3 plans)
- Phase 13: Interactive Sorting & Accordion (4 plans)
- Phase 14: Mobile & Accessibility Polish (5 plans)

Total: 12 plans completed.

</details>

<details>
<summary>✅ v1.3 AI Quality & Cross-Platform (Phases 15-19) - SHIPPED 2026-02-04</summary>

See archived roadmap: .planning/milestones/v1.3-ROADMAP.md

**Summary:**
- Phase 15: Embeddings Foundation (4 plans)
- Phase 16: Similarity Detection (2 plans)
- Phase 17: AI Review Pipeline (3 plans)
- Phase 18: Fork-Based Versioning (2 plans)
- Phase 19: Cross-Platform Install (2 plans)

Total: 15 plans completed.

</details>

<details>
<summary>✅ v1.4 Employee Analytics & Remote MCP (Phases 20-24) - SHIPPED 2026-02-06</summary>

See archived roadmap: .planning/milestones/v1.4-ROADMAP.md

**Summary:**
- Phase 20: API Key Management (7 plans)
- Phase 21: Employee Usage Tracking (6 plans)
- Phase 22: Web Remote MCP (3 plans)
- Phase 23: Analytics Dashboard (7 plans)
- Phase 24: Extended MCP Search (2 plans)

Total: 25 plans completed.

</details>

### 🚧 v1.5 Production, Multi-Tenancy & Reliable Usage Tracking (In Progress)

**Milestone Goal:** Transform Relay from a single-tenant internal tool into a production-deployed, multi-tenant SaaS platform with deterministic usage tracking, SOC2 compliance foundations, white-label branding, enhanced skill management, and a notification system. 62 requirements across 9 categories deliver the infrastructure for enterprise-grade multi-organization deployment.

- [x] **Phase 25: Multi-Tenancy Schema & Audit Foundation** - Tenant isolation at the database level
- [ ] **Phase 26: Auth & Subdomain Routing** - Users can log in to their tenant's subdomain
- [ ] **Phase 27: Production Docker Deployment** - Single-command production deployment (parallel track)
- [ ] **Phase 28: Hook-Based Usage Tracking** - Deterministic skill usage tracking via Claude Code hooks
- [ ] **Phase 29: Tenant-Scoped Analytics & MCP** - Analytics and MCP respect tenant boundaries
- [ ] **Phase 30: Branding & Navigation** - White-label tenant branding and improved navigation
- [ ] **Phase 31: Skills & Upload Enhancements** - Richer upload experience with auto-review and similarity
- [ ] **Phase 32: Admin Panel** - Tenant administrators can manage their organization
- [ ] **Phase 33: Email & Notifications** - Transactional email and in-app notification system

## Phase Details

### Phase 25: Multi-Tenancy Schema & Audit Foundation
**Goal**: Every database query is tenant-isolated, with an append-only audit trail capturing all security events
**Depends on**: Nothing (first phase of v1.5)
**Requirements**: TENANT-01, TENANT-02, TENANT-03, TENANT-04, TENANT-05, SOC2-01, SOC2-02
**Success Criteria** (what must be TRUE):
  1. A `tenants` table exists with id, name, slug, domain, logo, isActive, and plan columns
  2. Every data table (skills, usage_events, ratings, skill_versions, skill_embeddings, skill_reviews, api_keys, site_settings, users) has a NOT NULL tenant_id column with foreign key to tenants
  3. Skills table has a composite unique constraint on (tenant_id, slug) — two tenants can have skills with the same slug
  4. PostgreSQL RLS policies are active on all tenant-scoped tables, preventing cross-tenant reads/writes at the database level
  5. An append-only audit_logs table records all security events (auth, admin actions, data modifications), and UPDATE/DELETE are revoked on it
**Plans:** 9 plans
Plans:
- [x] 25-01-PLAN.md — Tenants + audit_logs table schemas
- [x] 25-02-PLAN.md — withTenant() helper module
- [x] 25-03-PLAN.md — Add tenant_id to 5 schema files (skills, users, ratings, usage-events, skill-versions) + schema index
- [x] 25-04-PLAN.md — Add tenant_id to 4 schema files (skill-embeddings, skill-reviews, api-keys, site-settings) + relations
- [x] 25-05-PLAN.md — SQL migrations 0002-0004 (create tenants, add columns, backfill)
- [x] 25-06-PLAN.md — SQL migrations 0005-0006 (enforce constraints + RLS, audit logs)
- [x] 25-07-PLAN.md — RLS pgPolicy definitions on all 9 tables + drizzle config
- [x] 25-08-PLAN.md — Audit log write service
- [x] 25-09-PLAN.md — Run migrations + end-to-end verification

### Phase 26: Auth & Subdomain Routing
**Goal**: Users access their tenant via a subdomain and authenticate through domain-mapped Google SSO with proper session management
**Depends on**: Phase 25
**Requirements**: TENANT-06, TENANT-07, TENANT-08, TENANT-09, TENANT-10, SOC2-04
**Success Criteria** (what must be TRUE):
  1. Visiting `tenant-slug.domain.com` loads Relay scoped to that tenant — middleware extracts tenant from Host header
  2. Google SSO login maps the user's email domain to the correct tenant — a user with `@acme.com` email can only sign into the Acme tenant
  3. A single shared Google OAuth endpoint handles all tenants, using the state parameter to redirect back to the originating tenant subdomain after auth
  4. Auth.js session cookies work across subdomains (domain-scoped cookies), and the JWT includes a tenantId claim
  5. Sessions expire after 8 hours (reduced from 30 days)
**Plans**: TBD

### Phase 27: Production Docker Deployment
**Goal**: Relay runs in production on a Hetzner VPS with automatic HTTPS, encrypted storage, and automated backups
**Depends on**: Nothing (parallel track — no dependency on multi-tenancy code)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07, SOC2-03, SOC2-06, SOC2-07
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts Caddy (reverse proxy), Next.js (web app), and PostgreSQL (pgvector/pg17) with health checks on all services
  2. Caddy handles wildcard subdomain routing and automatic HTTPS via Let's Encrypt
  3. PostgreSQL is accessible only within the Docker internal network — no host port exposure
  4. Docker volumes are encrypted at rest via LUKS full-disk encryption on the Hetzner VPS
  5. A backup script performs pg_dump with gzip compression, GPG encryption, and off-site storage — hourly incremental and daily full with 90-day retention
**Plans**: TBD

### Phase 28: Hook-Based Usage Tracking
**Goal**: Every Claude Code tool invocation against a deployed skill is deterministically tracked via PostToolUse hooks firing to the production endpoint
**Depends on**: Phase 25, Phase 26
**Requirements**: TRACK-01, TRACK-02, TRACK-03, TRACK-04, TRACK-05, TRACK-06, TRACK-07, TRACK-08, TENANT-11, SOC2-05
**Success Criteria** (what must be TRUE):
  1. A `POST /api/track` endpoint accepts hook callbacks with Bearer token auth, validates the API key, resolves userId + tenantId, and inserts a usage event
  2. When a skill is uploaded/deployed, tracking hook frontmatter (PostToolUse with async curl) is auto-injected into the skill file — invisible to the uploader
  3. Hook execution is async and never blocks Claude Code sessions — failures are silently logged, not surfaced to the user
  4. The tracking endpoint enforces rate limiting (100 req/min per API key) and HMAC payload signing to prevent spoofed callbacks
  5. API key validation returns tenantId alongside userId, and keys have a default 90-day expiration with 14-day rotation warning
**Plans**: TBD

### Phase 29: Tenant-Scoped Analytics & MCP
**Goal**: Analytics dashboards and MCP operations respect tenant boundaries — each tenant sees only their own data
**Depends on**: Phase 25, Phase 26
**Requirements**: TENANT-12, TENANT-13, METRIC-01
**Success Criteria** (what must be TRUE):
  1. All 6 analytics queries filter by tenantId instead of email domain matching — no cross-tenant data leakage in dashboards
  2. MCP server operations (search, deploy, list) are scoped to the tenant resolved from the API key's tenantId
  3. FTE Years Saved calculation uses the standard 2,080 hours/year (USA FTE) and displays correctly across tenant-scoped views
**Plans**: TBD

### Phase 30: Branding & Navigation
**Goal**: Each tenant has branded navigation with white-label options, and users see their personal impact and contributor tier at a glance
**Depends on**: Phase 25, Phase 26
**Requirements**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06, BRAND-07, BRAND-08
**Success Criteria** (what must be TRUE):
  1. The relay logo is an animated baton-pass concept, and freemium tenants display "Tenant x Relay" branding while paid tenants show only their own logo
  2. Freemium tenants are served on `tenant.hostname.ai` subdomains; paid tenants can configure a vanity URL
  3. The navigation bar shows an active-page underline indicator, a dedicated Skills nav button, and no longer displays the "2.7Y saved" metric
  4. The greeting area shows the user's name, their personal Days Saved total, and their composite contributor tier (Platinum/Gold/Silver/Bronze based on skills shared, days saved, ratings, and usage)
**Plans**: TBD

### Phase 31: Skills & Upload Enhancements
**Goal**: Uploading a skill gives the author immediate AI feedback, rich similarity context, and the ability to propose grouping with existing skills
**Depends on**: Phase 25
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06, SKILL-07
**Success Criteria** (what must be TRUE):
  1. All timestamps across the platform display as relative ("1d 5h 3min ago" until 1 year, then "1y 5d ago") instead of absolute dates
  2. On upload, a right-hand similarity pane shows AI-summarized matches with highlighted semantic overlaps — the "semantic vs name match" label is hidden from users
  3. AI review runs automatically on upload (not on-demand) and suggests description modifications that the user can copy
  4. AI review results feed into duplicate/similarity detection for more accurate matching
  5. The uploader can "message author" to propose grouping their skill under an existing similar skill
**Plans**: TBD

### Phase 32: Admin Panel
**Goal**: Tenant administrators can manage their organization's settings, users, skills, and compliance status
**Depends on**: Phase 25, Phase 26, Phase 28, Phase 29
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. A tenant admin settings page allows admins to configure tenant name, allowed domains, and logo
  2. Each tenant has two roles — admin and member — and only admins can access admin-only pages
  3. Admins can review, delete, or select multiple skills to merge under one parent skill
  4. Admins can view which users have compliance hooks installed and actively firing callbacks
**Plans**: TBD

### Phase 33: Email & Notifications
**Goal**: Users receive timely email and in-app notifications about skill activity, trends, and platform updates, with full control over their preferences
**Depends on**: Phase 25, Phase 26
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. Transactional and digest emails are sent via Resend — infrastructure is tenant-aware
  2. An in-app notification center (bell icon with unread count) shows a scrollable list of notifications
  3. Users can configure notification preferences per type (skill grouping requests, trending digests, platform updates) and choose digest frequency
  4. When someone proposes grouping a skill under another, the original author receives both an in-app notification and an email
  5. Trending skills digests (daily or weekly) and platform update notifications are delivered based on user preferences
**Plans**: TBD

## Progress

**Execution Order:**
Phases 25, 26, and 27 can begin first. Phase 27 (Docker) is a parallel track with no dependency on 25/26.
Phases 28-33 follow their dependency chains. Phase 32 (Admin) depends on 25, 26, 28, 29 — the most downstream.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 33/33 | Complete | 2026-01-31 |
| 9-11 | v1.1 | 9/9 | Complete | 2026-02-01 |
| 12-14 | v1.2 | 12/12 | Complete | 2026-02-02 |
| 15-19 | v1.3 | 15/15 | Complete | 2026-02-04 |
| 20-24 | v1.4 | 25/25 | Complete | 2026-02-06 |
| 25. Multi-Tenancy Schema | v1.5 | 9/9 | Complete | 2026-02-07 |
| 26. Auth & Subdomain Routing | v1.5 | 0/TBD | Not started | - |
| 27. Docker Deployment | v1.5 | 0/TBD | Not started | - |
| 28. Hook-Based Tracking | v1.5 | 0/TBD | Not started | - |
| 29. Tenant Analytics & MCP | v1.5 | 0/TBD | Not started | - |
| 30. Branding & Navigation | v1.5 | 0/TBD | Not started | - |
| 31. Skills & Upload | v1.5 | 0/TBD | Not started | - |
| 32. Admin Panel | v1.5 | 0/TBD | Not started | - |
| 33. Email & Notifications | v1.5 | 0/TBD | Not started | - |

**Total: 103 plans completed across 25 phases and 5 milestones (v1.0-v1.5 Phase 25)**

---
*Roadmap created: 2026-01-31*
*v1.1 completed: 2026-02-01*
*v1.2 completed: 2026-02-02*
*v1.3 completed: 2026-02-04*
*v1.4 completed: 2026-02-06*
*v1.5 roadmap added: 2026-02-07*
