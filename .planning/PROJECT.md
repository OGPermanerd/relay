# Relay

## What This Is

Relay is an internal skill marketplace where Claude skills, prompts, workflows, and agent configurations are discovered, deployed, and collectively improved. Think Apple App Store polish with wiki-style contribution — anyone can add versions to any skill, and metrics (usage, ratings, FTE Days Saved) surface quality organically. Skills are living documents that get more valuable as the org iterates on them.

## Core Value

Skills get better as they pass through more hands, with real metrics proving that value.

## Current State

**v1.3 shipped 2026-02-04** — AI-driven skill review, semantic similarity detection, fork-based versioning, and cross-platform MCP install.

Tech stack: Next.js 15, PostgreSQL, Drizzle ORM, Auth.js v5, MCP SDK, Playwright, vitest, nuqs, react-swipeable, Voyage AI, pgvector, Anthropic SDK
LOC: 9,475 TypeScript across 250+ files

Previous:
- v1.2 shipped 2026-02-02 — Two-panel UI redesign with sortable table, inline expansion, keyboard navigation, and mobile accessibility
- v1.1 shipped 2026-02-01 — Quality scorecards and comprehensive E2E test coverage
- v1.0 shipped 2026-01-31 — Full internal skill marketplace with MCP integration

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

### Active

**v1.4: Employee Analytics & Remote MCP**

- [ ] Per-employee usage tracking — identify which employee used which skill via MCP
- [ ] Org API keys for MCP authentication — tie MCP sessions to employees
- [ ] Install callback analytics — track installs per platform with employee attribution
- [ ] Usage analytics dashboard — per-employee skill usage, hours saved, activity over time
- [ ] Web remote MCP via Claude.ai — streamable HTTP transport for browser-based skill access
- [ ] Extended search — query matches author name and tags in addition to name/description

### Out of Scope

- Review prompts in Claude after skill use — adds MCP complexity, defer
- Skill creation scaffolding via MCP — focus on deploy/track first
- Approval gates or review process for new versions — metrics-driven quality model instead
- Claude.ai web remote MCP — moved to v1.4 Active scope
- Auto-review on every publish — cost scaling issues, use on-demand instead

## Context

**The "Relay" concept:** Skills are passed like a baton from person to person, each handoff making them better. This relays institutional knowledge across the org while continuously improving the tools themselves.

**MCP is the tracking backbone:** Usage metrics only work for skills deployed through the MCP integration. Skills downloaded and used manually are invisible to the system. This creates strong incentive for MCP adoption.

**Metrics-driven quality:** No gatekeeping on contributions. Anyone can publish a new version to any skill. Bad versions get low ratings and usage; good ones rise. The numbers do the talking.

**FTE Days Saved is the core metric:** This is the primary measure of Relay's value to the organization. It's calculated per-version and aggregated across the platform. Creator provides initial estimate (or asks Relay to estimate), but user-submitted estimates from reviews take precedence once available.

**Scale:** Enterprise-wide rollout targeting 500+ users in year one.

## Constraints

- **Tech stack**: Next.js 15, PostgreSQL, Drizzle ORM, Auth.js v5 — established in v1.0
- **Authentication**: Google Workspace SSO only, restricted to company domain — no public access
- **MCP compatibility**: Must work with Claude Code's MCP server architecture
- **Skill format flexibility**: System must handle heterogeneous skill types without forcing a single format

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

---
*Last updated: 2026-02-05 after v1.4 milestone started*
