# Requirements: Relay v1.5

**Defined:** 2026-02-07
**Core Value:** Skills get better as they pass through more hands, with real metrics proving that value.

## v1.5 Requirements

Requirements for Production, Multi-Tenancy & Reliable Usage Tracking milestone.

### Multi-Tenancy

- [ ] **TENANT-01**: Tenants table with id, name, slug, domain, logo, isActive, plan (freemium/paid)
- [ ] **TENANT-02**: tenant_id column on all data tables (skills, usage_events, ratings, skill_versions, skill_embeddings, skill_reviews, api_keys, site_settings, users)
- [ ] **TENANT-03**: Composite unique constraints (tenant_id + slug on skills)
- [ ] **TENANT-04**: PostgreSQL RLS policies on all tenant-scoped tables
- [ ] **TENANT-05**: Tenant-scoped query helper with automatic WHERE tenant_id filtering
- [ ] **TENANT-06**: Subdomain routing — middleware extracts tenant from Host header
- [ ] **TENANT-07**: Domain-based SSO mapping — email domain resolves to tenant in Auth.js signIn callback
- [ ] **TENANT-08**: Shared Google OAuth endpoint with state parameter redirect back to tenant subdomain
- [ ] **TENANT-09**: Auth.js cookies with domain scope for cross-subdomain sharing
- [ ] **TENANT-10**: JWT includes tenantId claim
- [ ] **TENANT-11**: API key validation returns tenantId (not just userId)
- [ ] **TENANT-12**: All 6 analytics queries converted from domain-matching to tenantId filtering
- [ ] **TENANT-13**: MCP server scoped to tenant via API key to tenantId resolution

### SOC2 Compliance

- [ ] **SOC2-01**: Append-only audit_logs table (actorId, tenantId, action, resourceType, ipAddress, metadata, createdAt)
- [ ] **SOC2-02**: Audit logging on all security events (auth, admin actions, data modifications, cross-tenant access attempts)
- [ ] **SOC2-03**: LUKS full-disk encryption on Hetzner for Docker volumes
- [ ] **SOC2-04**: Session timeout reduced to 8 hours (from 30 days)
- [ ] **SOC2-05**: API key default 90-day expiration with 14-day rotation warning
- [ ] **SOC2-06**: Backup strategy — hourly incremental + daily full, 90-day retention, off-site encrypted
- [ ] **SOC2-07**: PostgreSQL exposed only within Docker internal network

### Production Deployment

- [ ] **DEPLOY-01**: Dockerfile for Next.js (multi-stage with turbo prune, Node 22-alpine)
- [ ] **DEPLOY-02**: docker-compose.yml with Caddy + Next.js + PostgreSQL (pgvector/pg17)
- [ ] **DEPLOY-03**: Caddyfile with wildcard subdomain routing and automatic HTTPS
- [ ] **DEPLOY-04**: Health checks on all services (pg_isready, /api/health, caddy depends_on)
- [ ] **DEPLOY-05**: Named volumes for postgres_data, caddy_data, caddy_config
- [ ] **DEPLOY-06**: Environment variable template for all configuration
- [ ] **DEPLOY-07**: Backup script with pg_dump, gzip, gpg, off-site storage

### Usage Tracking

- [ ] **TRACK-01**: POST /api/track endpoint with Bearer token auth and tenant context
- [ ] **TRACK-02**: PostToolUse hook template injected into skill YAML frontmatter on deploy
- [ ] **TRACK-03**: Async hook execution (never blocks Claude sessions)
- [ ] **TRACK-04**: Auto-injection of tracking hooks into skill frontmatter on upload (invisible to uploader)
- [ ] **TRACK-05**: Deploy-time compliance check — verify tracker harness, nudge if missing
- [ ] **TRACK-06**: Rate limiting on tracking endpoint (100 req/min per API key)
- [ ] **TRACK-07**: HMAC payload signing for hook callbacks
- [ ] **TRACK-08**: Write-ahead log pattern for hook resilience

### Branding & Navigation

- [ ] **BRAND-01**: Animated relay logo (baton pass concept)
- [ ] **BRAND-02**: White-label tenant branding — freemium shows "Tenant x Relay", paid shows tenant logo only
- [ ] **BRAND-03**: Freemium on tenant1.hostname.ai, paid supports vanity URL
- [ ] **BRAND-04**: Active page underline indicator on nav links
- [ ] **BRAND-05**: Skills nav button linking to dedicated skills page
- [ ] **BRAND-06**: Remove 2.7Y saved display from nav bar
- [ ] **BRAND-07**: Greeting shows "Name — XX Days Saved | Tier Contributor"
- [ ] **BRAND-08**: Composite contributor tiers (Platinum/Gold/Silver/Bronze) based on skills shared + days saved + ratings + usage

### Skills & Upload

- [ ] **SKILL-01**: Relative timestamps — "1d 5h 3min ago" until 1 year, then "1y 5d ago"
- [ ] **SKILL-02**: Rich similarity pane on upload — right-hand popup with AI summary and highlighted semantic matches
- [ ] **SKILL-03**: Hide semantic vs name match label from user
- [ ] **SKILL-04**: Message author feature — propose grouping skill under an existing similar skill
- [ ] **SKILL-05**: AI review auto-generated on upload (not on-demand)
- [ ] **SKILL-06**: AI review suggests description modifications for user to copy
- [ ] **SKILL-07**: AI review used in duplicate/similarity checks

### Admin

- [ ] **ADMIN-01**: Tenant admin panel — settings page for tenant config (name, domains, logo)
- [ ] **ADMIN-02**: Two roles per tenant — admin and member
- [ ] **ADMIN-03**: Admin can review and delete any skill in the database
- [ ] **ADMIN-04**: Admin can select multiple skills to merge under one parent or delete
- [ ] **ADMIN-05**: Admin can view which users have compliance hooks set up and firing

### Email & Notifications

- [ ] **NOTIF-01**: Email system via Resend (transactional + digest)
- [ ] **NOTIF-02**: In-app notification center (bell icon, unread count, notification list)
- [ ] **NOTIF-03**: User notification preferences page (toggle per type, digest frequency)
- [ ] **NOTIF-04**: Skill grouping request notification — "Someone wants to add their skill under yours"
- [ ] **NOTIF-05**: Trending skills digest (daily or weekly, user-configurable)
- [ ] **NOTIF-06**: Platform update notifications (feature releases, upgrades)

### Metrics

- [ ] **METRIC-01**: Verify FTE years saved calculation uses 2,080 hours/year (standard USA FTE)

## Future Requirements

Deferred to post-v1.5. Tracked but not in current roadmap.

### Cross-Tenant Features
- **CROSS-01**: Public/shared skill marketplace visible across tenants — admin-controllable opt-in, subscription fee per tenant and per user per month
- **CROSS-02**: Tenant onboarding wizard (self-service tenant creation)
- **CROSS-03**: Cross-tenant skill forking
- **CROSS-04**: Promote skills from private tenant catalog into public marketplace

### Advanced Deployment
- **DEPLOY-08**: Zero-downtime rolling deployments
- **DEPLOY-09**: Blue-green deployment strategy
- **DEPLOY-10**: Auto-scaling based on load

### Advanced Compliance
- **SOC2-08**: Formal incident response plan documentation
- **SOC2-09**: Quarterly backup restore testing
- **SOC2-10**: SOC2 Type II audit engagement

## Out of Scope

| Feature | Reason |
|---------|--------|
| Separate database per tenant | Overkill for <50 tenants, operational overhead |
| Global user hooks via ~/.claude/settings.json | Invasive, affects all user projects |
| Mandatory hook compliance enforcement | Users can edit local files; soft enforcement only |
| Blocking (sync) hooks for tracking | Would freeze Claude sessions on endpoint failures |
| Storing raw hook payloads (tool_input/response) | Contains sensitive code |
| Self-service tenant creation | Defer to post-v1.5; admin-provisioned for now |
| Cross-tenant skill sharing | Defer to post-v1.5; all skills private to tenant |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TENANT-01 | Phase 25 | Pending |
| TENANT-02 | Phase 25 | Pending |
| TENANT-03 | Phase 25 | Pending |
| TENANT-04 | Phase 25 | Pending |
| TENANT-05 | Phase 25 | Pending |
| TENANT-06 | Phase 26 | Pending |
| TENANT-07 | Phase 26 | Pending |
| TENANT-08 | Phase 26 | Pending |
| TENANT-09 | Phase 26 | Pending |
| TENANT-10 | Phase 26 | Pending |
| TENANT-11 | Phase 28 | Pending |
| TENANT-12 | Phase 29 | Pending |
| TENANT-13 | Phase 29 | Pending |
| SOC2-01 | Phase 25 | Pending |
| SOC2-02 | Phase 25 | Pending |
| SOC2-03 | Phase 27 | Pending |
| SOC2-04 | Phase 26 | Pending |
| SOC2-05 | Phase 28 | Pending |
| SOC2-06 | Phase 27 | Pending |
| SOC2-07 | Phase 27 | Pending |
| DEPLOY-01 | Phase 27 | Pending |
| DEPLOY-02 | Phase 27 | Pending |
| DEPLOY-03 | Phase 27 | Pending |
| DEPLOY-04 | Phase 27 | Pending |
| DEPLOY-05 | Phase 27 | Pending |
| DEPLOY-06 | Phase 27 | Pending |
| DEPLOY-07 | Phase 27 | Pending |
| TRACK-01 | Phase 28 | Pending |
| TRACK-02 | Phase 28 | Pending |
| TRACK-03 | Phase 28 | Pending |
| TRACK-04 | Phase 28 | Pending |
| TRACK-05 | Phase 28 | Pending |
| TRACK-06 | Phase 28 | Pending |
| TRACK-07 | Phase 28 | Pending |
| TRACK-08 | Phase 28 | Pending |
| BRAND-01 | Phase 30 | Pending |
| BRAND-02 | Phase 30 | Pending |
| BRAND-03 | Phase 30 | Pending |
| BRAND-04 | Phase 30 | Pending |
| BRAND-05 | Phase 30 | Pending |
| BRAND-06 | Phase 30 | Pending |
| BRAND-07 | Phase 30 | Pending |
| BRAND-08 | Phase 30 | Pending |
| SKILL-01 | Phase 31 | Pending |
| SKILL-02 | Phase 31 | Pending |
| SKILL-03 | Phase 31 | Pending |
| SKILL-04 | Phase 31 | Pending |
| SKILL-05 | Phase 31 | Pending |
| SKILL-06 | Phase 31 | Pending |
| SKILL-07 | Phase 31 | Pending |
| ADMIN-01 | Phase 32 | Pending |
| ADMIN-02 | Phase 32 | Pending |
| ADMIN-03 | Phase 32 | Pending |
| ADMIN-04 | Phase 32 | Pending |
| ADMIN-05 | Phase 32 | Pending |
| NOTIF-01 | Phase 33 | Pending |
| NOTIF-02 | Phase 33 | Pending |
| NOTIF-03 | Phase 33 | Pending |
| NOTIF-04 | Phase 33 | Pending |
| NOTIF-05 | Phase 33 | Pending |
| NOTIF-06 | Phase 33 | Pending |
| METRIC-01 | Phase 29 | Pending |

**Coverage:**
- v1.5 requirements: 62 total
- Mapped to phases: 62
- Unmapped: 0

---
*Requirements defined: 2026-02-07*
*Last updated: 2026-02-07 — traceability updated after roadmap creation*
