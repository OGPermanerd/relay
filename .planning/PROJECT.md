# EverySkill

## What This Is

EverySkill is an AI skills platform that turns scattered prompts, workflows, and agent configurations into managed, measurable intellectual property. Built on four architectural layers:

1. **Smart Skills Database** — A multi-tenant, privacy-scoped repository that analyzes your work patterns to surface the skills that will have the most impact on what you're actually doing.
2. **IP Stewardship & High Velocity Growth** — Protect and grow your IP. Fast. Tracks usage, measures quality, captures feedback, collects training data, benchmarks across models, and channels improvement suggestions back into skills.
3. **AI Independence** — Skills are portable text, training data is model-agnostic, and benchmarking compares models head-to-head. No lock-in to any single AI provider.
4. **Universally Integrated Access** — Low friction equals adoption. Skills are accessible wherever you work — browser, prompt, code, or API — with zero context switching.

## Core Value

Protect and grow your IP. Fast. Skills get better as they pass through more hands, with real metrics proving that value — and the IP is protected for both companies and individuals.

## Current State

**v5.0 shipped 2026-02-15** — Feedback loops, training data, benchmarking, token/cost measurement.

Tech stack: Next.js 16.1.6, PostgreSQL 16, Drizzle ORM, Auth.js v5, MCP SDK, Anthropic SDK, Ollama, pgvector, Recharts, Playwright
LOC: ~50,000 TypeScript across 386 files

Milestones:
- v5.0 shipped 2026-02-15 — Feedback, training data, benchmarking, cost measurement
- v4.0 shipped 2026-02-14 — Gmail workflow diagnostic, work-activity skill recommendations
- v3.0 shipped 2026-02-13 — AI discovery, hybrid search, homepage redesign, user preferences
- v2.0 shipped 2026-02-08 — Quality-gated publishing, conversational MCP, fork drift detection
- v1.5 shipped 2026-02-08 — Production deployment, multi-tenancy, RBAC, branding, email notifications
- v1.4 shipped 2026-02-06 — Employee analytics, remote MCP, extended search
- v1.3 shipped 2026-02-04 — AI review, semantic similarity, forking, cross-platform install
- v1.2 shipped 2026-02-02 — Two-panel UI redesign, keyboard navigation
- v1.1 shipped 2026-02-01 — Quality scorecards, E2E test coverage
- v1.0 shipped 2026-01-31 — MVP: skill CRUD, MCP integration, search, ratings

## Requirements

### Validated

- ✓ E2E browser automation testing with Playwright — v1.0
- ✓ Google Workspace SSO authentication with domain restriction — v1.0
- ✓ User profile with name, avatar, contribution statistics — v1.0
- ✓ Contributor leaderboard by skills shared, ratings, FTE Days Saved — v1.0
- ✓ Full-text search across skill names, descriptions, tags — v1.0
- ✓ Skill cards with rating, uses, FTE Days Saved sparkline — v1.0
- ✓ Category browsing and tag filtering — v1.0
- ✓ Trending skills with usage velocity — v1.0
- ✓ Skill upload with metadata (name, description, category, tags, instructions, time saved) — v1.0
- ✓ Multi-format skill support (Claude Code skills, prompts, workflows, agent configs) — v1.0
- ✓ Skill detail page with full metadata and usage statistics — v1.0
- ✓ Star ratings (1-5) with optional comments — v1.0
- ✓ User time-saved estimates override creator estimates — v1.0
- ✓ FTE Days Saved at skill and platform level — v1.0
- ✓ Dashboard with contributors, downloads, uses, FTE Days Saved — v1.0
- ✓ MCP search/list skill operations — v1.0
- ✓ MCP one-click skill deployment — v1.0
- ✓ MCP automatic usage tracking — v1.0
- ✓ Tag filtering backend with getAvailableTags implementation — v1.1
- ✓ E2E tests for skill upload, rating, search, and profile flows (22 tests) — v1.1
- ✓ Quality scorecards (Gold/Silver/Bronze/Unrated) with auto-calculation — v1.1
- ✓ Quality tier filtering and sorting on browse page — v1.1
- ✓ "Why this badge?" breakdown showing score components — v1.1
- ✓ Two-panel layout with skills table (2/3) and leaderboard (1/3) — v1.2
- ✓ Sortable table columns with ascending/descending toggle — v1.2
- ✓ Inline row expansion for skill details (accordion) — v1.2
- ✓ One-click MCP install button that copies skill config — v1.2
- ✓ Search bar for filtering skills table — v1.2
- ✓ Full keyboard navigation (Tab, Enter, Arrow keys) — v1.2
- ✓ Screen reader accessibility (aria-sort, live announcements, ARIA attributes) — v1.2
- ✓ Mobile responsive layout with swipe gestures — v1.2
- ✓ Vector embeddings for skill content using Voyage AI — v1.3
- ✓ Embeddings stored in PostgreSQL using pgvector extension — v1.3
- ✓ Existing skills backfilled with embeddings — v1.3
- ✓ New skills automatically embedded on publish — v1.3
- ✓ AI review with quality, clarity, completeness scores — v1.3
- ✓ AI review results stored and persisted — v1.3
- ✓ Top 3 similar skills shown on publish (advisory) — v1.3
- ✓ Similar skills section on skill detail page — v1.3
- ✓ Fork skill with "Forked from X" attribution — v1.3
- ✓ Parent skill shows fork count — v1.3
- ✓ View all forks for any skill — v1.3
- ✓ Forked skills inherit parent's tags and category — v1.3
- ✓ Cross-platform install modal with 4 platforms — v1.3
- ✓ OS auto-detection (macOS/Windows/Linux) — v1.3
- ✓ Install scripts for Claude Desktop (bash/PowerShell) — v1.3
- ✓ API key management with SHA-256 hashing, rotation, admin CRUD — v1.4
- ✓ Per-employee usage tracking via EVERYSKILL_API_KEY with graceful anonymous fallback — v1.4
- ✓ Install callback analytics (per platform, OS, employee, skill) — v1.4
- ✓ Analytics dashboard with org-wide trends, per-employee tables, skill leaderboards, CSV export — v1.4
- ✓ Web remote MCP via Streamable HTTP for Claude.ai browser access — v1.4
- ✓ Extended MCP search matching author name and tags with field-weighted scoring — v1.4

### Validated — v3.0 AI Discovery & Workflow Intelligence

- ✓ Skill visibility scoping (global company / employee visible / employee invisible / personal) — v3.0
- ✓ Loom video integration for skill demos (authors and reviewers) — v3.0
- ✓ `/everyskill` unified MCP tool with STRAP action router pattern — v3.0
- ✓ Personal preference extraction and cross-AI pref sync (CLAUDE.md export) — v3.0
- ✓ Admin-stamped global skills with company approval workflows — v3.0
- ✓ Hybrid search with pgvector + ILIKE + RRF fusion — v3.0
- ✓ Search analytics with normalized query tracking and admin dashboard — v3.0
- ✓ Homepage redesign with AI greeting, compact stats, category tiles, discovery search — v3.0

### Validated — v4.0 Gmail Workflow Diagnostic

- ✓ Gmail connector via separate OAuth flow with encrypted token storage — v4.0
- ✓ Email pattern analysis with two-pass classification (rule-based + AI) — v4.0
- ✓ AI-powered skill recommendations matching work activity to skill catalog — v4.0
- ✓ Diagnostic dashboard with category PieChart, time BarChart, and hero KPIs — v4.0
- ✓ Deployment plan with ranked adoption sequence and cumulative FTE savings projection — v4.0
- ✓ Privacy-first: analyze and discard raw metadata, persist only aggregates — v4.0
- ✓ DEFAULT_TENANT_ID cleanup (tenant resolved from session in all code paths) — v4.0
- ✓ Semantic search supplement on /skills page via Ollama embeddings — post-v4.0

### Validated — v5.0 Feedback, Training & Benchmarking

- ✓ In-Claude feedback via MCP with smart frequency gating (first 3 uses, then every 10th) — v5.0
- ✓ Web feedback with thumbs up/down, comments, and aggregated sentiment trends — v5.0
- ✓ Structured suggestion form with category, severity, and author review workflow — v5.0
- ✓ Suggestion-to-fork pipeline with Accept & Fork, Apply Inline, and auto-implement on publish — v5.0
- ✓ Training data with author-seeded golden examples and consent-gated usage capture — v5.0
- ✓ Token/cost measurement with transcript parsing, static pricing table, and cost StatCards — v5.0
- ✓ Cross-model benchmarking with blinded AI judge and cost trend visualization — v5.0
- ✓ Secret detection and sanitization across all user-submitted content — v5.0

### Active — v6.0 IP Dashboard & Skills Portfolio

## Current Milestone: v6.0 IP Dashboard & Skills Portfolio

**Goal:** Make the IP stewardship value proposition tangible — give companies an IP dashboard showing what they've captured and what's at risk, and give individuals a skills portfolio showing their contributions and portable IP.

**Target features:**
- Company IP Dashboard with total skills captured, hours saved, estimated replacement cost, IP concentration risk
- Individual Skills Portfolio showing personal contributions, usage metrics, portable vs company IP
- IP Value Estimation quantifying what it would cost to recreate skills from scratch
- Org-wide quality trends over time (are our skills getting better?)
- IP risk alerts for key person dependency (skills with single author and high usage)
- IP Report export (PDF/CSV) for board presentations

### Validated — Post-v2.0 (ad hoc)

- ✓ Fork & Improve with AI — single-click fork + auto-triggered AI review + iterative refinement loop — 2026-02-11
- ✓ AI refinement of improved content via user feedback with iteration counter — 2026-02-11
- ✓ Fork differentiation summary auto-generated on accept (prepended to description) — 2026-02-11
- ✓ Split fork button: "Fork & Improve" (primary, non-authors) + "Fork" (secondary) — 2026-02-11
- ✓ New pacman gradient wordmark logo with transparent background — 2026-02-11

### Validated — v2.0 Skill Ecosystem

- ✓ Quality-gated skill publishing with draft → AI review → admin approval → published lifecycle — v2.0
- ✓ AI review analyzes quality, clarity, completeness with auto-approve threshold (7/10) — v2.0
- ✓ Admin review dashboard with queue, diff view, approve/reject/request-changes, audit trail — v2.0
- ✓ Review notifications (in-app + email) at every lifecycle stage with grouped preferences — v2.0
- ✓ Semantic search via MCP (recommend_skills) with Ollama embeddings + pgvector cosine similarity — v2.0
- ✓ Conversational discovery: describe_skill, guide_skill with category-specific guidance — v2.0
- ✓ Enhanced search_skills with quality tiers (gold/silver/bronze), ratings, usage stats — v2.0
- ✓ Fork drift detection via check_skill_status (frontmatter-stripped hash comparison) — v2.0
- ✓ update_skill MCP tool for pushing local modifications back as new version or fork — v2.0
- ✓ Web UI drift indicator on fork detail pages + /skills/[slug]/compare comparison page — v2.0
- ✓ MCP review tools: review_skill, submit_for_review, check_review_status — v2.0
- ✓ State machine with 7 valid statuses and enforced transitions — v2.0

### Validated — v1.5 Production, Multi-Tenancy & Reliable Usage Tracking

- ✓ Production deployment via Docker Compose on Hetzner (PostgreSQL, Next.js, Caddy/SSL) — v1.5
- ✓ Public domain with SSL + Tailscale access — v1.5
- ✓ Full multi-tenancy with subdomain routing (tenant1.domain.com) — v1.5
- ✓ Tenant isolation — separate admin, users, skills per tenant — v1.5
- ✓ tenant_id across all DB tables, scoped queries — v1.5
- ✓ Domain-based Google SSO mapping to tenants — v1.5
- ✓ Compliance skill with PostToolUse hooks for deterministic MCP tool tracking — v1.5
- ✓ Tracking endpoint that receives hook callbacks from user machines — v1.5
- ✓ Auto-injection of tracking hooks into skill frontmatter on upload — v1.5
- ✓ Deploy-time compliance checking — verify tracker harness, nudge if missing — v1.5
- ✓ RBAC with admin/member roles and tenant-scoped admin panel — v1.5
- ✓ EverySkill branding with custom domain and tenant white-labeling — v1.5
- ✓ Email notification system with preferences and cron digests — v1.5

### Out of Scope

- Review prompts in Claude after skill use — adds MCP complexity, defer
- Auto-review on every publish — cost scaling issues; AI review triggered on submission to review pipeline instead

## Context

**IP protection — bidirectional:** Companies need institutional knowledge to survive employee turnover. Employees need their personal expertise to be portable. EverySkill solves both: tenant-scoped skills capture company IP that stays when people leave; personal-scoped skills belong to the creator regardless of employer.

**The feedback loop is the engine:** Use → Track → Feedback → Suggestion → Fork → Improved skill → More use. This continuous improvement cycle is what makes skills living assets rather than static documents. Every layer reinforces this loop.

**MCP is the tracking backbone:** Usage metrics only work for skills deployed through the MCP integration. Skills downloaded and used manually are invisible to the system. This creates strong incentive for MCP adoption and enables the feedback loop.

**Metrics-driven quality:** No gatekeeping on contributions. Anyone can publish a new version to any skill. Bad versions get low ratings and usage; good ones rise. The numbers do the talking.

**FTE Days Saved is the core metric:** Primary measure of value to the organization. Calculated per-version and aggregated across the platform. Creator provides initial estimate, but user-submitted estimates from reviews take precedence.

**Scale:** Enterprise-wide rollout targeting 500+ users in year one. Multi-tenant architecture enables multiple organizations to run isolated instances on shared infrastructure.

**AI Independence:** Skills are markdown text, training data is input/output pairs, benchmarking evaluates across models. When the next AI platform arrives, skills and their quality data transfer — no vendor lock-in.

## Constraints

- **Tech stack**: Next.js 16, PostgreSQL 16, Drizzle ORM, Auth.js v5 — established in v1.0, evolved through 10 milestones
- **Authentication**: Google Workspace SSO only, domain maps to tenant — no public registration
- **MCP compatibility**: Must work with Claude Code's MCP server architecture (stdio + HTTP transports)
- **Skill format flexibility**: System must handle heterogeneous skill types without forcing a single format
- **Privacy-first**: Raw behavioral data (emails, browsing) analyzed and discarded; only aggregates persisted

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Wiki-style versioning over fork model | Keeps skills as single evolving artifacts rather than fragmenting into forks; simpler mental model | ✓ Both — added fork model in v1.3 as complement |
| MCP-only tracking | Provides accurate usage data; creates natural incentive for MCP adoption | ✓ Good |
| No approval gates | Reduces friction for contributors; lets metrics surface quality organically | ✓ Good |
| User estimates override creator | Real-world usage data more reliable than creator's guess | ✓ Good |
| Defer similarity detection to v2 | Simplifies v1 scope; basic search sufficient to start | ✓ Done — shipped in v1.3 |
| MCP Integration in Phase 3 | Enable usage tracking from day one; core metric needs real data | ✓ Good |
| JWT session strategy | Required for Edge middleware compatibility with Auth.js | ✓ Good |
| Denormalized totalUses counter | Display performance over query complexity | ✓ Good |
| Hacker News trending formula | Proven time-decay algorithm; simple to implement | ✓ Good |
| TEXT[] for tags over JSONB | Simpler type inference, direct PostgreSQL array operators | ✓ Good |
| vitest for unit testing | Fast startup, native ESM, simple Next.js config | ✓ Good |
| Rating stored as integer * 100 | Avoids floating point precision issues in DB and calcs | ✓ Good |
| Minimum 3 ratings for quality tier | Prevents gaming, ensures meaningful quality signals | ✓ Good |
| nuqs for URL state | Consistent with existing CategoryFilter/TagFilter patterns | ✓ Good |
| Inline SQL quality computation | Avoids denormalized column; acceptable at v1.1 scale | ✓ Good |
| JWT injection for E2E auth | Bypasses OAuth flow, enables fast authenticated testing | ✓ Good |
| Plain HTML table over shadcn/ui | shadcn/ui Table not installed; follow existing leaderboard pattern | ✓ Good |
| nuqs for sort URL state | Consistent with existing CategoryFilter/TagFilter patterns | ✓ Good |
| sm: breakpoint (640px) for mobile | Phones stack vertically, tablets+ show side-by-side | ✓ Good |
| W3C APG Grid Pattern for keyboard | Standard pattern for accessible data grids | ✓ Good |
| 5 sessions as onboarding threshold | Balances feature discovery with mobile UX | ✓ Good |
| 80px swipe delta threshold | Balances sensitivity with accidental activation prevention | ✓ Good |

| Voyage AI for embeddings | Anthropic-recommended, voyage-code-3 model with 1024 dimensions | ✓ Good |
| pgvector for storage | Stays within PostgreSQL, no new infrastructure | ✓ Good |
| Advisory similarity detection | Never blocking, high threshold 0.85+ | ✓ Good |
| On-demand AI review | Not auto-trigger, manages costs | ✓ Good |
| Self-contained InstallButton | Internal modal state, no props drilling | ✓ Good |
| `rlk_` prefix + SHA-256 hash for API keys | Identifiable prefix, secure storage, timing-safe comparison | ✓ Good |
| Graceful anonymous degradation | No breaking changes for existing MCP users without API key | ✓ Good |
| Dual-transport MCP (stdio + HTTP) | Same tools available via both transports, shared handlers | ✓ Good |
| Inline tool logic in web MCP route | No cross-app imports, prevents bundler issues | ✓ Good |
| ILIKE-only search for MCP | Practical default since MCP stdio lacks VOYAGE_API_KEY | ✓ Good |
| Field-weighted scoring (4/3/2/1) | Blended ranking: title > desc > author > tags | ✓ Good |
| Recharts for analytics charts | Lightweight, React-native, blue #3b82f6 theme | ✓ Good |
| mcp-handler for Streamable HTTP | Handles MCP protocol negotiation for Next.js routes | ✓ Good |
| 7-status skill lifecycle | draft → pending_review → ai_reviewed → approved/rejected/changes_requested → published | ✓ Good |
| Inline AI review (not fire-and-forget) | User sees result immediately; explicit error handling for failures | ✓ Good |
| Auto-approve threshold 7/10 | All 3 categories must meet threshold; configurable per tenant | ✓ Good |
| Insert-only review_decisions | SOC2 immutable audit trail; no updatedAt column | ✓ Good |
| cosineDistance for semantic search | drizzle-orm type-safe pgvector; similarity = 1 - distance | ✓ Good |
| Self-contained MCP helpers | No cross-app imports; stdio protocol safety | ✓ Good |
| Frontmatter-stripped hash for drift | Tracking hooks don't trigger false positive drift detection | ✓ Good |
| Author-update vs non-author-fork | update_skill branches on userId === authorId | ✓ Good |
| Combined fork + improve flow | Single button reduces friction; auto-trigger review on ?improve=1 query param | ✓ Good |
| Local pending state over useActionState isPending | isPending unreliable for programmatic dispatch via startTransition | ✓ Good |
| Fork differentiation non-fatal | If AI summary fails, still save content — skip summary silently | ✓ Good |
| PNG logo over animated SVG | New brand identity; transparent background works on both light and dark headers | ✓ Good |

---
*Last updated: 2026-02-15 — v5.0 shipped, 4-layer architecture documented*
