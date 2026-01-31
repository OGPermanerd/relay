# Project Research Summary

**Project:** Relay - Internal Skill Marketplace
**Domain:** Developer Tool Catalog / Internal Developer Portal
**Researched:** 2026-01-31
**Confidence:** HIGH

## Executive Summary

Relay is an internal skill marketplace for Claude-specific developer tools (skills, prompts, workflows, agent configurations) designed to maximize knowledge sharing and quantify productivity impact through FTE Days Saved metrics. Based on comprehensive research across 15+ sources including Backstage, SkillsMP, and internal developer portal patterns, the recommended approach is a **Next.js 15+ full-stack application with PostgreSQL, Auth.js SSO, and MCP integration**, prioritizing developer velocity and type safety over microservice complexity.

The product differentiates through three unique elements: (1) FTE Days Saved as a core metric that quantifies value in business terms unlike generic marketplaces, (2) wiki-style fork-and-improve contribution model that's more accessible than PR-based workflows, and (3) authenticated internal catalog that provides trust and accountability. The architecture should follow an immutable version model with separated metadata (PostgreSQL) and content storage (object storage), enabling both web browsing and MCP-based deployment while maintaining comprehensive usage tracking.

Critical risks center on **catalog staleness** (outdated skills erode trust), **metrics gaming** (self-reported time savings are inherently gameable), and **cold start failure** (empty marketplace prevents adoption). Mitigation requires automated health checks built into the data model from day one, multiple complementary metrics to prevent gaming, and seeding 50+ quality skills before public launch. The research strongly recommends avoiding approval workflows (kills contribution velocity), paid monetization (adds unnecessary complexity), and premature optimization to distributed systems (500 users don't need Elasticsearch).

## Key Findings

### Recommended Stack

**Core Framework:** Next.js 15+ with React 19 and TypeScript provides server-first rendering, type safety end-to-end, and proven enterprise scalability. The App Router enables React Server Components and Server Actions that eliminate the need for a separate backend service.

**Database Layer:** PostgreSQL 16+ with Drizzle ORM offers relational data handling, built-in full-text search (avoiding Elasticsearch complexity at launch scale), JSONB for flexible skill metadata, and temporal tables for version history. Drizzle provides 14x lower latency than Prisma on complex joins and superior serverless performance.

**Core technologies:**
- **Next.js 15+ / React 19**: Full-stack framework with server components — eliminates backend service complexity
- **PostgreSQL + Drizzle ORM**: Primary database with FTS — handles 500+ users without dedicated search infrastructure
- **Auth.js (NextAuth v5)**: Google Workspace SSO — native Next.js integration with domain restriction
- **shadcn/ui + Tailwind CSS**: Component library — copy-paste components with full ownership and accessibility
- **TanStack Query + Zustand**: State management — server state caching and client state without Redux overhead
- **MCP TypeScript SDK**: Claude integration — official Anthropic SDK for skill deployment and tracking
- **Cloudflare R2**: Object storage — S3-compatible with zero egress fees for skill content

**Critical version requirements:**
- Next.js 15.5+ requires React 19.x (App Router features)
- Auth.js v5 is App Router native (v4 is Pages Router only)
- TanStack Query 5.x has full Suspense support with React 19

### Expected Features

**Must have (table stakes):**
- **Search & Discovery**: Full-text search across names, descriptions, tags with faceted filtering — primary UX, if search fails the platform fails
- **One-Click Install**: Copy to ~/.claude/skills/ or direct file placement — friction kills adoption
- **Version History**: Track all versions with commit comments, show diffs, allow rollback — wiki mental model users expect
- **Basic Ratings (1-5 stars)**: Post-use rating with aggregate display — builds trust signals
- **Google Workspace SSO**: Enterprise users expect existing identity — no separate account creation
- **User Profiles**: Display name, avatar, contributions, usage stats — attribution and accountability
- **Skill Cards**: Name, description, author, rating, usage count, last updated — standard marketplace pattern
- **Categories/Tags**: Hierarchical categories and user-defined tags — discovery breaks without organization

**Should have (competitive advantage):**
- **FTE Days Saved Metric**: User-reported time estimate aggregated across organization — unique ROI visualization addressing $31.5B knowledge sharing loss
- **Fork & Improve Workflow**: Clone existing skill, modify, submit improvement — creates improvement flywheel rare in skill marketplaces
- **Quality Scorecards**: Auto-calculated maturity score (Gold/Silver/Bronze) based on documentation quality, usage rate, rating — gamifies quality like Cortex/Port IDPs
- **Usage Analytics Dashboard**: Track installs, active usage, time saved aggregate — platform teams need adoption data
- **Trending/Popular Sections**: Surface high-value content based on usage velocity — reduces discovery friction

**Defer (v2+):**
- **Smart Search with AI**: Semantic search with embeddings — requires vector DB, defer until keyword search proves insufficient
- **Related Skills Recommendations**: Collaborative filtering — requires substantial usage data and ML infrastructure
- **Skill Dependencies**: Dependency graph with auto-install — adds complexity, most skills standalone
- **Contribution Leaderboards**: Gamification feature — culture-building but not critical for validation

**Anti-features to avoid:**
- **Paid Skills/Monetization**: Creates payment complexity, splits community, legal/tax overhead — keep internal marketplace free
- **Approval Workflows**: Creates bottlenecks, kills contribution velocity — rely on post-publish community moderation
- **Real-Time Collaboration**: Complexity explosion for versioned artifacts — use wiki-style one-person-edits model
- **Skill Execution Environment**: Security risks and scope creep — skills execute in Claude, marketplace is discovery only

### Architecture Approach

The system follows a **layered architecture with immutable version model**: presentation layer (Web App + MCP Server), service layer (Skill/Metrics/Search/Auth services), and data layer (PostgreSQL + Object Storage + Cache). This enables both web-based browsing and MCP-based deployment while maintaining a single source of truth for skill metadata.

**Major components:**
1. **Web Application (Next.js)**: Browse, search, publish skills; view metrics; user dashboard — serves as primary interface for discovery and contribution
2. **MCP Server (TypeScript SDK)**: Deploy skills to Claude, track usage events, query catalog — enables Claude Code integration with usage attribution
3. **Skill Service**: CRUD for skills/versions, validation, format handling — domain service supporting multiple skill formats (Claude Code, prompts, workflows, agent configs)
4. **Metrics Service**: Ingest usage events, aggregate FTE Days Saved, compute rankings — event-driven with async processing to avoid blocking user actions
5. **PostgreSQL**: Skills, versions, users, reviews, metrics (primary store) — relational with JSONB for flexible skill metadata
6. **Object Storage (R2/S3)**: Skill content files — separated from metadata to avoid database bloat and enable efficient versioning

**Critical patterns:**
- **Immutable versions**: Each skill version is immutable once published; new contributions create new versions, never modify existing — enables audit trail and per-version metrics
- **Separated content storage**: Metadata (searchable, frequently accessed) in PostgreSQL, content (large files) in object storage — fast queries and cheap storage
- **Event-driven metrics**: MCP server emits usage events to queue, metrics service consumes asynchronously — non-blocking tracking with replay capability
- **Progressive MCP loading**: Return skill summaries first, full content only on deployment — efficient context usage within Claude's limits

### Critical Pitfalls

1. **Catalog Staleness Death Spiral**: Content becomes outdated, users lose trust, adoption collapses — **AVOID by:** building automated health checks into core data model from day one, implementing "last verified working" timestamps, auto-flagging skills unused for 90 days, and surfacing freshness signals prominently ("Last updated 6 months ago" warnings)

2. **Metrics Gaming and Inflated Value Claims**: Self-reported time savings become meaningless noise due to Goodhart's Law — **AVOID by:** using multiple complementary metrics instead of single north star, tracking behavioral signals harder to game (repeat usage, cross-team adoption), implementing peer validation prompts, and surfacing distribution anomalies (flag estimates 3x above median)

3. **MCP Lock-in Creates Invisible Usage**: Skills used outside MCP go untracked, product decisions based on incomplete data — **AVOID by:** designing multi-channel tracking architecture from start, providing easy export/copy with usage capture, accepting some usage will be untracked, and not over-indexing on perfect measurement

4. **Cold Start Content Desert**: Marketplace launches empty, users never return, chicken-and-egg collapse — **AVOID by:** curating 50+ high-quality skills before public announcement, identifying 3-5 "atomic networks" (specific teams) and densely populating those first, recruiting power users as founding contributors, and converting existing team prompts into catalog entries

5. **Quality Collapse Without Gates**: Low-quality content floods catalog, high-quality contributors disengage — **AVOID by:** implementing lightweight quality gates (required fields, minimum documentation), creating "verified/featured" tiers for editorially-reviewed content, enabling community flagging for broken skills, and using reputation systems that weight by contributor track record

6. **Version Sprawl Without Cleanup**: 47 versions of similar skills, users can't determine which to use — **AVOID by:** implementing duplicate detection at creation time, building version consolidation workflows, creating archival triggers (zero usage after 90 days), and surfacing canonical versions prominently

## Implications for Roadmap

Based on research, suggested phase structure emphasizes **foundation before features, web before MCP, and scale last**:

### Phase 1: Foundation & Core Web Experience
**Rationale:** Database schema and auth are foundational dependencies; all other components depend on data model and identity. Web app validates data model and UX before MCP consumes same patterns. Schema changes are expensive later, so getting the version model and quality signals right from day one is critical.

**Delivers:**
- Database schema (skills, versions, users, ratings) with immutable version model
- Google Workspace SSO with domain restriction
- Basic Skill Service (CRUD operations)
- Web application (browse, search with PostgreSQL FTS, publish)
- Object storage integration for skill content
- Freshness tracking infrastructure (last_verified, health_status fields)

**Addresses (from FEATURES.md):**
- Search & Discovery (P1)
- Skill Cards with Metadata (P1)
- User Authentication SSO (P1)
- User Profiles basic (P1)
- Categories/Tags (P1)
- Version History (P1)
- One-Click Install (P1)

**Avoids (from PITFALLS.md):**
- **Catalog Staleness**: Freshness tracking in core data model prevents retrofit pain
- **MCP Lock-in**: Multi-channel tracking architecture designed from start
- **Quality Collapse**: Quality signal fields in schema enable tiered visibility later

**Research needed:** SKIP - Well-documented patterns (Next.js App Router, Auth.js, PostgreSQL schema design all have extensive official documentation)

### Phase 2: Metrics & Community Features
**Rationale:** Need usage events before metrics aggregation makes sense. Ratings system provides data for quality scorecards. This phase establishes the unique value proposition (FTE Days Saved) and community dynamics (fork & improve) that differentiate Relay from generic marketplaces.

**Delivers:**
- Basic Ratings system (1-5 stars with optional comment)
- FTE Days Saved capture and display (skill-level and platform-level aggregation)
- Metrics service with event ingestion and aggregation
- Fork & Improve workflow for collaborative contribution
- Quality Scorecards (Gold/Silver/Bronze based on ratings, usage, documentation)
- Trending/Popular sections based on usage velocity
- Anti-gaming safeguards (anomaly detection, peer validation prompts)

**Addresses (from FEATURES.md):**
- Basic Ratings (P1)
- FTE Days Saved Metric (P1)
- Fork & Improve Workflow (P2)
- Quality Scorecards (P2)
- Trending/Popular Sections (P2)

**Avoids (from PITFALLS.md):**
- **Metrics Gaming**: Multiple complementary metrics and safeguards designed before public dashboard
- **Version Sprawl**: Usage-based cleanup triggers enable archival of unused versions
- **Quality Collapse**: Scorecards enable tiered visibility (featured vs. standard)

**Research needed:** YES - Phase 2 (Anti-gaming strategies and metrics aggregation patterns need deeper research; limited prior art on FTE Days Saved implementation)

### Phase 3: MCP Integration & Deployment
**Rationale:** MCP consumes patterns validated by web app. Need working metrics service before implementing usage event emission. This phase enables Claude Code integration while avoiding the MCP lock-in pitfall through continued support for web-based workflows.

**Delivers:**
- MCP Server implementing tools API (list_skills, deploy_skill)
- Progressive loading for efficient context usage
- REST API for MCP backend access
- Usage event emission from MCP tool invocations
- Tracking attribution for MCP-based skill usage
- Multi-channel usage capture (web + MCP)

**Uses (from STACK.md):**
- MCP TypeScript SDK (official Anthropic SDK)
- Server Actions for mutations
- TanStack Query for caching

**Implements (from ARCHITECTURE.md):**
- MCP Server component with client/handlers/tracking
- Progressive MCP loading pattern
- Event-driven metrics ingestion

**Avoids (from PITFALLS.md):**
- **MCP Lock-in**: Non-MCP usage channels remain first-class; web-based copy/install continues to work
- **Tight MCP-Backend Coupling**: MCP server calls REST API, doesn't directly access database

**Research needed:** YES - Phase 3 (MCP specification details, tool invocation patterns, and usage event attribution strategies need validation)

### Phase 4: Analytics & Optimization
**Rationale:** Platform is validated and in active use. Now optimize based on real usage patterns. Add advanced features requested by users. Scale infrastructure based on actual bottlenecks, not premature optimization.

**Delivers:**
- Usage Analytics Dashboard for platform teams
- Team/Org Collections for curated skill bundles
- Notification Subscriptions for skill updates
- Preview Before Install feature
- Performance optimization based on real usage patterns
- Scaling adjustments (CDN for content, read replicas, dedicated search if needed)

**Addresses (from FEATURES.md):**
- Usage Analytics Dashboard (P2)
- Team/Org Collections (P2)
- Notification Subscriptions (P2)
- Preview Before Install (P2)

**Avoids (from PITFALLS.md):**
- **Version Sprawl**: Consolidation and archival workflows at scale
- **Performance Traps**: Scale based on actual bottlenecks, not assumptions

**Research needed:** SKIP - Standard analytics patterns; optimization based on profiling data available during implementation

### Phase 5: Advanced Discovery (Future/v2+)
**Rationale:** Defer until keyword search proves insufficient and sufficient usage data exists. Requires substantial infrastructure (vector DB, ML models) that isn't justified until proven need.

**Delivers:**
- Smart Search with AI (semantic search with embeddings)
- Related Skills Recommendations (collaborative filtering)
- Skill Dependencies with auto-install
- Contribution Leaderboards
- Advanced quality signals

**Addresses (from FEATURES.md):**
- Smart Search with AI (P3)
- Related Skills Recommendations (P3)
- Skill Dependencies (P3)
- Contribution Leaderboards (P3)

**Research needed:** YES - Phase 5 (Vector search implementation, recommendation algorithms, dependency resolution all need dedicated research)

### Phase Ordering Rationale

- **Foundation first (Phase 1)**: Schema changes are expensive; version model and quality signals must be correct from day one. Auth is prerequisite for all personalization features.
- **Web before MCP (Phases 1-2 before 3)**: Web validates UX and data patterns; MCP consumes same API. Building MCP first creates blind spots on user behavior.
- **Metrics before MCP (Phase 2 before 3)**: Need metrics infrastructure in place before MCP starts emitting usage events; retrofitting event handling is painful.
- **Scale last (Phase 4)**: 500 users don't need Elasticsearch, Kafka, or distributed systems. Premature optimization wastes effort and creates unnecessary complexity.
- **Content seeding before Phase 1 launch (Phase 0)**: Empty marketplace kills adoption. Requires 50+ skills from power users before public announcement.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Metrics)**: Anti-gaming strategies and FTE Days Saved aggregation patterns have limited prior art; need dedicated research on detection heuristics
- **Phase 3 (MCP)**: MCP specification November 2025 updates (parallel tool calls, tasks API) need validation; usage event attribution in multi-channel environment needs design
- **Phase 5 (Advanced Discovery)**: Vector search implementation, embedding models, and recommendation algorithms all require substantial research

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation)**: Next.js App Router, Auth.js Google provider, PostgreSQL schema design, and shadcn/ui all have extensive official documentation and established patterns
- **Phase 4 (Analytics)**: Analytics dashboard patterns and CDN configuration are well-documented; optimization based on profiling is implementation-specific

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All recommendations verified via official documentation (Next.js blog, Auth.js docs, Drizzle docs, MCP specification). Version compatibility matrix validated. |
| Features | **HIGH** | Based on current market analysis of SkillsMP (71K+ skills), Backstage (primary IDP reference), PromptBase, and 2026 Gartner IDP reviews. Feature prioritization validated against competitor analysis. |
| Architecture | **HIGH** | Standard patterns from Backstage architecture, NPM registry design, and IDP reference architectures. Component responsibilities well-established in domain. |
| Pitfalls | **HIGH** | Multiple sources corroborate patterns (Platform Engineering failure research, Backstage backlash articles, gaming expertise metrics studies, cold start problem research). Pitfall-to-phase mapping is actionable. |

**Overall confidence:** **HIGH**

All four research areas produced actionable recommendations with verification from official sources or multiple corroborating secondary sources. The domain (internal developer portals / skill marketplaces) has substantial prior art from Backstage, SkillsMP, and enterprise IDP implementations.

### Gaps to Address

**Multi-format skill support:** Research focused primarily on Claude Code skill format. During Phase 1 implementation, need to validate parsing strategies for prompts, workflows, and agent configurations. The `packages/skill-formats/` monorepo structure accommodates this, but format-specific validation schemas need design.

**Seeding strategy execution:** Research identifies need for 50+ skills before launch but doesn't prescribe specific seeding tactics. During Phase 0 (pre-launch), need to identify power users, conversion process for existing team prompts, and quality baseline for seed content.

**Non-MCP attribution mechanisms:** Research acknowledges some usage will be untracked when users copy-paste prompts. During Phase 1-3, need to design optional attribution mechanisms (watermarking, follow-up surveys, browser extensions) without creating friction.

**Metrics aggregation performance:** Research recommends PostgreSQL with Drizzle for metrics but doesn't validate specific aggregation query patterns at scale. During Phase 2, need to profile query performance and determine if materialized views or pre-computed aggregations are required.

**Version consolidation workflows:** Research identifies version sprawl as a pitfall with consolidation as mitigation, but doesn't specify merge/consolidation UX. During Phase 4, need to design workflows for identifying duplicate skills and community-driven consolidation.

## Sources

### Primary (HIGH confidence)
- **Stack Research**: Next.js 15 Blog, TanStack Query v5 Docs, Drizzle ORM Docs, Auth.js Docs, MCP Specification (2025-06-18), shadcn/ui official site
- **Feature Research**: Gartner Internal Developer Portals Reviews 2026, SkillsMP Agent Skills Marketplace, Backstage Software Templates Documentation, Claude Agent Skills Documentation
- **Architecture Research**: Backstage Architecture Overview, Model Context Protocol Specification, Internal Developer Platform Reference, NPM Registry Architecture
- **Pitfalls Research**: Platform Engineering 80% Adoption/70% Fail study, Gaming Expertise Metrics on Knowledge Platforms (Springer), Backstage Backlash articles, How to Solve Cold Start Problem (Andrew Chen), Goodhart's Law in Software Engineering (Jellyfish)

### Secondary (MEDIUM confidence)
- Drizzle vs Prisma performance benchmarks (Bytebase comparison)
- Vitest vs Jest speed comparisons (BetterStack)
- PostgreSQL FTS vs Elasticsearch (Neon blog)
- React State Management 2025 trends (dev.to)
- tRPC vs GraphQL vs REST patterns (BetterStack)
- Port Scorecards and Initiatives, Cortex Scorecards, Harness IDP Governance Guide

### Tertiary (LOW confidence, needs validation)
- TikTok Component Library adoption challenges (used for cold start analogy)
- Knowledge Sharing ROI metrics (Bloomfire) - $31.5B figure
- Developer productivity measurement frameworks (platformengineering.org)

---
*Research completed: 2026-01-31*
*Ready for roadmap: yes*
