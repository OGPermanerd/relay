# Phase 47: Homepage Research

**Researched:** 2026-02-13
**Domain:** Homepage layout design for enterprise skill marketplace
**Confidence:** HIGH

## Summary

EverySkill's current homepage is functional but follows a generic dashboard pattern rather than a marketplace/directory pattern. It has all the right data --- trending skills, company-recommended skills, platform stats, leaderboard, semantic discovery search, and personal leverage metrics --- but the layout buries discoverable content below the fold and treats all sections with equal visual weight.

Research into six marketplace platforms (Atlassian Marketplace, Notion Templates, Slack App Directory, VS Code Extensions, Chrome Web Store, Figma Community) reveals three dominant layout archetypes that could dramatically improve EverySkill's homepage: (1) search-hero + curated collections (Atlassian/Chrome), (2) category-gallery with editorial curation (Notion/Figma), and (3) sidebar-navigation + personalized recommendations (Slack/VS Code). Each archetype prioritizes different aspects of content discovery and maps differently to EverySkill's existing data.

**Primary recommendation:** Variant A (Marketplace Hub) is the strongest fit for EverySkill's enterprise context. It elevates the search experience into the hero position, uses the existing company-recommended and trending data as curated collections, and keeps the platform stats as social proof --- all while requiring minimal new data sources.

---

## Current Homepage Inventory

### Page Structure (page.tsx)
The homepage at `apps/web/app/(protected)/page.tsx` is a server component inside the `(protected)` layout. It requires authentication and fetches 9 parallel data queries on load.

### Current Section Order (top to bottom)

| # | Section | Component | Data Source | Visual Treatment |
|---|---------|-----------|-------------|-----------------|
| 1 | Welcome message | Inline JSX | `session.user.name` | h1 + subtitle text |
| 2 | Discovery Search | `<DiscoverySearch />` | `discoverSkills()` server action (hybrid semantic + keyword) | Search input + button, inline results as 3-column card grid |
| 3 | Tab bar | `<HomeTabs />` | URL query state (`?view=browse\|leverage`) | Two tabs: "Browse Skills" / "My Leverage" |
| 4 | **Browse tab content:** | | | |
| 4a | CTAs | Inline JSX (2 Link cards) | Static | 2-column grid: "Share a Skill" (blue) + "Install a Skill" (green) |
| 4b | Platform Stats | 4x `<StatCard />` | `getPlatformStats()` + `getPlatformStatTrends()` | 4-column grid with sparklines: FTE Years Saved, Total Uses, Total Downloads, Avg Rating |
| 4c | Company Recommended | `<CompanyApprovedSection />` | `getCompanyApprovedSkills(6)` | 2-column card grid with shield badge, author name, use count |
| 4d | Trending + Leaderboard | `<TrendingSection />` + `<LeaderboardTable />` | `getTrendingSkills(6)` + `getLeaderboard(5)` | 3-column layout: trending (2/3) + leaderboard (1/3). Trending has sparkline underlay, HN-style time-decay algorithm |
| 4e | Your Impact | Inline JSX | Static (link to /profile) | Gradient background callout with "View Stats" link |
| 5 | **Leverage tab content:** | | | |
| 5a | Skills Used stats | 4x `<StatCard />` | `getSkillsUsedStats()` | 4-column grid |
| 5b | Skills Used timeline | `<MyLeverageView />` | `getSkillsUsed()` | Paginated list with action badges |
| 5c | Skills Created stats | 4x `<StatCard />` | `getSkillsCreatedStats()` | 4-column grid |
| 5d | Skills Created list | `<MyLeverageView />` | `getSkillsCreated()` | List with impact metrics |

### Available Data Sources (already queryable)

| Data | Function | Returns | Notes |
|------|----------|---------|-------|
| Platform stats | `getPlatformStats()` | totalContributors, totalDownloads, totalUses, totalFteDaysSaved, averageRating | Aggregates across all published skills |
| Stat trends (14d) | `getPlatformStatTrends()` | fteDaysTrend[], usesTrend[], downloadsTrend[] | Cumulative daily arrays for sparklines |
| Trending skills | `getTrendingSkills(n)` | id, name, slug, description, category, recentUses, trendingScore, totalUses, loomUrl, companyApproved | HN time-decay algorithm, min 3 uses in 7 days |
| Company recommended | `getCompanyApprovedSkills(n)` | id, name, slug, description, category, totalUses, loomUrl, authorName | Ordered by approvedAt desc |
| Leaderboard | `getLeaderboard(n)` | rank, userId, name, image, skillsShared, totalUses, avgRating, fteDaysSaved | RANK() window function |
| Semantic discovery | `discoverSkills(query)` | id, name, slug, description, category, matchRationale, matchType, rrfScore, isBoosted | Hybrid search with preference boost |
| Skill search | `searchSkills(params)` | Full skill objects with author, tags, ratings | Supports category, tag, quality tier, sort by |
| Available tags | `getAvailableTags()` | string[] | All unique tags from published skills |
| User leverage (used) | `getSkillsUsed(userId)` | Timeline entries with hours saved | Paginated |
| User leverage (created) | `getSkillsCreated(userId)` | Created skills with impact metrics | By author |

### Skill Categories
Four categories exist: `prompt`, `workflow`, `agent`, `mcp`. URL filter types map as: `claude-skill` -> agent, `ai-prompt` -> prompt, `other` -> workflow + mcp.

### Existing Reusable Components

| Component | Location | Reusability |
|-----------|----------|-------------|
| `StatCard` | `components/stat-card.tsx` | Fully reusable -- accepts label, value, suffix, icon, trendData |
| `TrendingSection` | `components/trending-section.tsx` | Reusable -- accepts TrendingSkill[] + trendData |
| `CompanyApprovedSection` | `components/company-approved-section.tsx` | Reusable -- accepts CompanyApprovedSkill[] |
| `LeaderboardTable` | `components/leaderboard-table.tsx` | Reusable -- accepts LeaderboardEntry[] |
| `DiscoverySearch` | `components/discovery-results.tsx` | Reusable -- self-contained with inline results |
| `HomeTabs` | `components/home-tabs.tsx` | Reusable -- URL-synced tabs via nuqs |
| `MyLeverageView` | `components/my-leverage-view.tsx` | Reusable -- accepts all leverage data |
| `Sparkline` | `components/sparkline.tsx` | Reusable -- SVG sparkline for any data array |
| `TwoPanelLayout` | `components/two-panel-layout.tsx` | Reusable -- left/right panel layout |
| `SearchWithDropdown` | `components/search-with-dropdown.tsx` | Reusable -- search bar with autocomplete |
| `SkillTypeFilter` | `components/skill-type-filter.tsx` | Reusable -- category filter pills |

---

## Marketplace Platform Research

### Atlassian Marketplace (marketplace.atlassian.com)
**Confidence:** HIGH (fetched directly)

**Layout pattern:** Search-hero + curated collections

- **Hero:** Prominent headline "Discover apps for your team" + centered search bar
- **Category grid:** 9 major categories as icon cards (not just skill types -- functional groupings like "Project Management", "Data & Analytics")
- **Featured collections:** Multiple horizontal carousels:
  - "Cloud Fortified" (security-certified -- analogous to Company Recommended)
  - "Spotlight" apps (exceptional growth -- analogous to Trending)
  - "Bestsellers" (high demand)
  - "Rising Stars" (new noteworthy)
- **Social proof bar:** "8,000+ App listings | 1.2M+ Installs | 1,800+ Partners" as horizontal metrics
- **Card format:** Icon + title + developer + partnership badge + star rating + install count

**Key takeaway for EverySkill:** The "curated collection" carousel pattern maps perfectly to our existing data: Company Recommended = "Cloud Fortified", Trending = "Spotlight", and we could add "Recently Added" or "Most Time Saved" as new collections with existing queries.

### Notion Templates (notion.com/templates)
**Confidence:** HIGH (fetched directly)

**Layout pattern:** Category gallery with editorial curation

- **Hero:** Scale emphasis -- "Choose from 30,000+ Notion templates"
- **Primary categories:** 3 large tile cards (Work, School, Life) with template counts and "free" counts
- **Consultant section:** Human experts who help with setup
- **Featured sections:** Editorial picks -- "Featured templates", "Featured creators", "Featured collections"
- **Template cards:** Creator profile + pricing (Free badge) + thumbnail image
- **Top categories:** Sub-categories with counts (e.g., "Habit Tracking (2,925)")

**Key takeaway for EverySkill:** The "large category tiles with counts" pattern would work well for our 4 categories (Prompt, Workflow, Agent, MCP), showing total skills per category. The "Featured creators" maps to our Leaderboard.

### Slack App Directory (slack.com/apps)
**Confidence:** MEDIUM (JS-rendered, supplemented with search results)

**Layout pattern:** Sidebar navigation + personalized recommendations

- **Categories:** ~22 categories in sidebar navigation (Customer Support, Marketing, Sales, Security, etc.)
- **Featured apps:** Prominently shown with editorial curation
- **Featured workflows:** API-managed via `workflows.featured.add/list/remove` methods
- **App counts:** 2,600+ apps across categories with varying sizes
- **Recommendations:** "Recommended for you" personalized section

**Key takeaway for EverySkill:** The sidebar pattern is heavy for only 4 categories but the "Featured workflows" concept (admin-curated recommendations) maps to Company Recommended. The personalized recommendations align with our existing preference-boosted discovery.

### VS Code Extensions Marketplace (marketplace.visualstudio.com/vscode)
**Confidence:** HIGH (fetched directly)

**Layout pattern:** Curated collections with social proof

- **Hero:** Featured extension spotlight
- **Collection sections:** "Featured", "Most Popular", "Recently Added" -- each as horizontal scroll
- **Card format:** Extension icon + title + publisher + verified badge + install count (abbreviated) + rating score
- **Categories:** 22 categories in footer navigation
- **Social proof:** Install counts (e.g., "1.3 billion downloads" for Python), ratings as numerical scores

**Key takeaway for EverySkill:** The "Featured / Most Popular / Recently Added" triple-collection pattern is simple and effective. Maps directly to Company Recommended / Trending / newest skills.

### Chrome Web Store
**Confidence:** MEDIUM (inferred from developer docs and collections data)

**Layout pattern:** Editorial curation + themed collections

- **Hero:** Rotating marquee banner highlighting outstanding extensions
- **Editors' Picks:** Curated by editorial team for quality
- **Themed collections:** "Extensions starter kit", "Work smarter, not harder with AI", "Works with Gmail" -- contextual groupings
- **Discovery options:** Search, curated collections, homepage, personalized recommendations

**Key takeaway for EverySkill:** The "themed collections" idea is interesting -- instead of just category filters, collections like "Getting Started with AI Skills", "Top Time Savers", "New This Week" would add editorial value.

### Figma Community (figma.com/community)
**Confidence:** LOW (403 blocked, inferred from search)

**Layout pattern:** Community + gallery browsing

- **Template gallery:** Large visual cards with thumbnails
- **Community resources:** Plugins, widgets, templates in one hub
- **Creator profiles:** Community-contributed with social metrics (likes, downloads)

**Key takeaway for EverySkill:** The community/creator emphasis maps to our leaderboard and author profiles, but the visual gallery approach is less relevant for text-based skills.

---

## Three Layout Variants

### Variant A: "Marketplace Hub" (Atlassian + VS Code inspired)

**Core idea:** Search-first hero with curated collection carousels below. Treats the homepage as a marketplace storefront.

**Section layout (top to bottom):**

```
+----------------------------------------------------------+
| HERO: "Discover skills that save your team time"         |
| [========= Discovery Search Bar =========] [Discover]    |
|                                                          |
| Platform stats as inline metrics bar:                    |
| X skills | Y total uses | Z FTE years saved | W avg     |
+----------------------------------------------------------+
|                                                          |
| CATEGORY TILES (4 columns)                               |
| [Prompts]  [Workflows]  [Agents]  [MCP Tools]           |
| "42 skills" "18 skills"  "12 skills" "8 skills"          |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| COMPANY RECOMMENDED (horizontal card row, see all ->)    |
| [Card] [Card] [Card] [Card]                             |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| TRENDING NOW (horizontal card row, see all ->)           |
| [Card] [Card] [Card] [Card]                             |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| TOP CONTRIBUTORS          | YOUR LEVERAGE (mini)         |
| [Leaderboard table]       | Skills used: X               |
|                           | Hours saved: Y               |
|                           | [View full leverage ->]       |
+----------------------------------------------------------+
|                                                          |
| CTAs: "Share a Skill" + "Install a Skill"                |
+----------------------------------------------------------+
```

**What changes from current:**
- Welcome greeting moves to header `<GreetingArea />` (already exists there)
- Search becomes the hero focal point instead of secondary
- Stats become a compact metrics bar (no sparklines in hero)
- Category tiles added (new, but uses existing `searchSkills` with category filter)
- Tabs removed -- My Leverage becomes a compact sidebar widget with link to dedicated page
- Company Recommended and Trending become horizontal scrolling carousels
- CTAs move to bottom (incentivize browsing first, creating after discovery)

**Pros:**
- Puts discovery front and center (the primary user job-to-be-done)
- Marketplace-native pattern users recognize from Atlassian/Chrome/VS Code
- Category tiles give immediate structure to content
- Compact stats bar maintains social proof without dominating
- Horizontal carousels show more content per vertical pixel

**Cons:**
- My Leverage loses prominence (moved from tab to small widget)
- Category tiles need a new query for per-category counts (simple SQL, no new infra)
- More scrolling needed to see all sections
- Horizontal scrolling can feel "fiddly" on desktop

**Data mapping:**
- Hero search -> `discoverSkills()` (existing)
- Stats bar -> `getPlatformStats()` (existing, subset of fields)
- Category tiles -> NEW query: `SELECT category, COUNT(*) FROM skills WHERE status = 'published' GROUP BY category`
- Company Recommended -> `getCompanyApprovedSkills()` (existing)
- Trending -> `getTrendingSkills()` (existing)
- Leaderboard -> `getLeaderboard()` (existing)
- Mini leverage -> `getSkillsUsedStats()` + `getSkillsCreatedStats()` (existing)

**New components needed:** Category tile card (simple), horizontal scroll container, mini leverage widget
**Components reused:** DiscoverySearch, CompanyApprovedSection (card style), TrendingSection (card style), LeaderboardTable, StatCard (adapted)

---

### Variant B: "Category Gallery" (Notion Templates + Chrome Web Store inspired)

**Core idea:** Large visual category navigation with editorial collections. Treats the homepage as a curated gallery where browsing by type is the primary path.

**Section layout (top to bottom):**

```
+----------------------------------------------------------+
| Welcome back, {firstName}!     [===Search===] [Discover] |
| Your team has saved X FTE years this month               |
+----------------------------------------------------------+
|                                                          |
| BROWSE BY TYPE (large tiles, 2x2 grid)                   |
| +------------------------+ +------------------------+    |
| | PROMPTS           42   | | WORKFLOWS         18   |    |
| | Ready-to-use AI        | | Multi-step processes    |    |
| | prompts for any task   | | that automate work      |    |
| +------------------------+ +------------------------+    |
| +------------------------+ +------------------------+    |
| | AGENTS            12   | | MCP TOOLS          8   |    |
| | Claude skills that     | | Model Context Protocol  |    |
| | work autonomously      | | integrations            |    |
| +------------------------+ +------------------------+    |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| COMPANY PICKS                   | TOP CONTRIBUTORS       |
| (Editorial grid, 3 columns)    | [Leaderboard compact]  |
| [Card] [Card] [Card]           |                        |
| [Card] [Card] [Card]           |                        |
|                                 |                        |
+----------------------------------------------------------+
|                                                          |
| TRENDING THIS WEEK (full-width row)                      |
| [Card] [Card] [Card] [Card] [Card] [Card]               |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| YOUR ACTIVITY                                             |
| +--------------------+ +--------------------+             |
| | Skills Used: 14    | | Skills Created: 3  |             |
| | Hours Saved: 42    | | Impact: 156 hrs    |             |
| | [View timeline ->] | | [View details ->]  |             |
| +--------------------+ +--------------------+             |
|                                                          |
+----------------------------------------------------------+
|                                                          |
| QUICK ACTIONS                                             |
| [Share a Skill]  [Browse All Skills]                     |
+----------------------------------------------------------+
```

**What changes from current:**
- Search moves to header area (smaller, inline with greeting)
- Large category tiles become the primary navigation element
- Company Recommended gets full editorial treatment (larger cards, more detail)
- Trending becomes a dedicated full-width section
- Personal activity becomes a compact summary with navigation links
- Tabs removed entirely

**Pros:**
- Visual hierarchy makes categories discoverable immediately
- Large tiles work well with only 4 categories (Notion has 3, this has 4)
- Company Recommended gets prime real estate (important for enterprise buyers)
- Personal activity still visible but proportional to its role
- Clean, browsable feel without overwhelming density

**Cons:**
- Search is less prominent (category browsing is the primary path)
- Large tiles use significant vertical space for just 4 items
- Less data-dense than current layout -- more "magazine" feel
- Category tiles need descriptions (copywriting needed)
- Two-column sections need careful responsive behavior

**Data mapping:**
- Category tiles -> NEW query: per-category skill counts
- Company Picks -> `getCompanyApprovedSkills()` (existing)
- Trending -> `getTrendingSkills()` (existing)
- Leaderboard -> `getLeaderboard()` (existing)
- Your Activity -> `getSkillsUsedStats()` + `getSkillsCreatedStats()` (existing)

**New components needed:** Large category tile, compact activity summary
**Components reused:** CompanyApprovedSection, TrendingSection, LeaderboardTable

---

### Variant C: "Personalized Dashboard" (Slack + current EverySkill hybrid)

**Core idea:** Keep the dashboard feel but reorganize for progressive disclosure. Personal context up top, organizational context below. Sidebar navigation for categories.

**Section layout (top to bottom):**

```
+----------------------------------------------------------+
| Welcome back, {firstName}!                               |
| [============ Discovery Search ============] [Discover]  |
+----------------------------------------------------------+
|                     |                                     |
| SIDEBAR (sticky)    | MAIN CONTENT                       |
| +----------------+  |                                     |
| | All Skills     |  | YOUR MOMENTUM                      |
| | Prompts (42)   |  | [Skills Used] [Hours Saved] [Created]
| | Workflows (18) |  | [Trending sparkline chart]          |
| | Agents (12)    |  |                                     |
| | MCP Tools (8)  |  | RECOMMENDED FOR YOU                 |
| +----------------+  | (Company Recommended + preference   |
| | Quick Links    |  |  boosted results mixed)             |
| | Share a Skill  |  | [Card] [Card] [Card]               |
| | Browse All     |  |                                     |
| | My Profile     |  | TRENDING NOW                        |
| +----------------+  | [Card] [Card] [Card]               |
|                     |                                     |
| PLATFORM            | TOP CONTRIBUTORS                    |
| X skills            | [Leaderboard full]                  |
| Y uses              |                                     |
| Z FTE years         | RECENTLY ADDED                      |
|                     | [Card] [Card] [Card]               |
+----------------------------------------------------------+
```

**What changes from current:**
- Sidebar navigation added with category links + counts
- Personal stats ("Your Momentum") elevated to top of main content
- "Recommended for You" mixes company-recommended with preference-boosted suggestions
- Trending and Recently Added as separate collections
- Platform stats move to sidebar (always visible but compact)
- Tab system removed in favor of vertical scrolling with sidebar

**Pros:**
- Personal context (your stats) is immediately visible
- Sidebar provides persistent navigation without extra clicks
- "Recommended for You" feels more personalized than generic featured
- All content visible in one scrollable page
- Closest to current layout -- smallest redesign effort

**Cons:**
- Sidebar takes horizontal space -- feels cramped on smaller screens
- Only 4 categories may not justify a sidebar (overkill for 4 items)
- Dashboard feel is less exciting than marketplace feel
- "Your Momentum" stats may be zero for new users (empty state problem)
- Sidebar pattern is more suited for 10+ categories (Slack has 22)
- Mobile responsive sidebar is complex

**Data mapping:**
- Category sidebar -> NEW query: per-category skill counts
- Your Momentum -> `getSkillsUsedStats()` + `getSkillsCreatedStats()` + `getPlatformStatTrends()` (existing)
- Recommended -> `getCompanyApprovedSkills()` + `discoverSkills()` with preference boost (existing)
- Trending -> `getTrendingSkills()` (existing)
- Recently Added -> NEW query: `searchSkills({ sortBy: 'recent' })` or simple `ORDER BY created_at DESC`
- Leaderboard -> `getLeaderboard()` (existing)
- Platform stats -> `getPlatformStats()` (existing)

**New components needed:** Sidebar nav, compact momentum stats, recently added section
**Components reused:** DiscoverySearch, CompanyApprovedSection, TrendingSection, LeaderboardTable, StatCard, Sparkline

---

## Comparison Matrix

| Criterion | Variant A: Marketplace Hub | Variant B: Category Gallery | Variant C: Personalized Dashboard |
|-----------|---------------------------|----------------------------|-----------------------------------|
| **Discovery focus** | Search-first (strongest) | Browse-first (strong) | Personal-first (moderate) |
| **Enterprise feel** | Professional marketplace | Editorial/curated | Internal dashboard |
| **New user experience** | Great (search + browse) | Great (visual categories) | Weak (empty personal stats) |
| **Returning user value** | Good (trending, recommended) | Good (editorial picks) | Best (personal momentum) |
| **Implementation effort** | Medium (new components) | Medium (new tiles + layout) | High (sidebar + responsive) |
| **Mobile responsiveness** | Easy (stacked sections) | Easy (stacked tiles) | Hard (sidebar collapse) |
| **Data reuse** | 90% existing | 85% existing | 80% existing |
| **Scales with content** | Very well (carousels grow) | Well (more categories later) | Moderate (sidebar gets long) |
| **Visual distinctiveness** | High (marketplace pattern) | High (gallery pattern) | Low (dashboard, generic) |
| **Appropriate for 4 categories** | Good (small tiles row) | Excellent (large tiles) | Overkill (sidebar for 4 items) |

## Recommendation

**Variant A: Marketplace Hub** is the strongest choice for EverySkill.

**Rationale:**

1. **User job-to-be-done:** Enterprise users come to the homepage to *find useful skills*. Search-first matches this intent directly. Current data shows discovery search is already built and powerful (hybrid semantic + keyword with preference boost).

2. **Enterprise marketplace positioning:** Atlassian Marketplace and VS Code Extensions are the closest analogues to EverySkill (B2B tool marketplaces). Both use the search-hero + curated collections pattern. This is the layout users in the target market will recognize.

3. **Data advantage:** EverySkill already has all the data needed for curated collections (company recommended, trending with time-decay, leaderboard). The only new query is per-category counts, which is trivial.

4. **Scalability:** As skills grow from 80 to 800 to 8,000, horizontal carousels and search scale naturally. Category tiles can evolve into sub-categories. Gallery (B) and dashboard (C) patterns struggle at scale.

5. **New user experience:** New users see a marketplace full of content, not empty personal dashboards. The "Your Leverage" data moves to a dedicated page (linked from mini widget), solving the empty state problem.

6. **Mobile-first:** Stacked sections (hero -> tiles -> carousels -> CTA) collapse to mobile naturally without sidebar complexity.

**Variant B is the runner-up** -- the large category tiles are visually striking and would work well if the team wants a more editorial, curated feel. It could be combined with Variant A (large category tiles in the hero area of a Marketplace Hub layout).

**Variant C is not recommended** -- a sidebar for 4 categories is architecturally overkill, and the personal-first approach creates empty state problems for new or light users.

---

## Plan Structure (for planner)

This is a research-only phase. The output should be:

**Single plan: "Create homepage layout comparison document"**

The plan should produce a comparison document (this RESEARCH.md essentially serves as that document) plus optionally low-fidelity wireframe descriptions or ASCII art mockups for each variant.

Given that this RESEARCH.md already contains:
- Full current homepage inventory
- 3 detailed layout variants with section-by-section descriptions
- Data source mapping for each variant
- Component reuse analysis
- Comparison matrix
- Recommendation with rationale

The planner may choose to have the executor create a cleaner presentation document, or simply present this research as-is for evaluation.

**Recommended plan structure:**
1. Plan 01: Review and finalize layout comparison (present this research to user for decision)

No code implementation should happen in this phase -- that belongs to a future "Homepage Redesign" implementation phase.

---

## Open Questions

1. **Category tile counts:** Need a new query for per-category skill counts. Trivial SQL but not yet implemented. Should the plan include writing this query, or save it for implementation phase?
   - Recommendation: Save for implementation phase

2. **My Leverage page:** If leverage is removed from homepage tabs, should a dedicated `/leverage` or `/my-leverage` page be created?
   - Recommendation: Yes, implementation phase should include this

3. **Recently Added section:** None of the current queries return "newest skills." A simple `ORDER BY created_at DESC` query would be needed.
   - Recommendation: Add in implementation phase

4. **Horizontal scroll vs grid:** Marketplace carousels typically use horizontal scroll on desktop, but this can feel unnatural. Should we use a 4-column grid with "See all" link instead?
   - Recommendation: 4-column grid with "See all" is simpler and more accessible. Horizontal scroll only for mobile breakpoints.

---

## Sources

### Primary (HIGH confidence)
- **Atlassian Marketplace** (marketplace.atlassian.com) -- Full page fetch, layout analysis confirmed
- **Notion Templates** (notion.com/templates) -- Full page fetch via redirect, layout analysis confirmed
- **VS Code Extensions Marketplace** (marketplace.visualstudio.com/vscode) -- Full page fetch, layout and collections confirmed

### Secondary (MEDIUM confidence)
- **Chrome Web Store** -- Layout inferred from [Chrome developer docs on discovery](https://developer.chrome.com/docs/webstore/discovery/) and [Chrome Web Store collections data](https://chrome-stats.com/chrome/col/homepage_main_section)
- **Slack App Directory** -- Category structure and app counts from [Slack App Directory categories](https://slack.com/apps/category/At0EFX4CCE-design) and web search results
- **SaaS homepage best practices** -- Trends from [SaaS landing page trends 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples) and [best B2B SaaS examples](https://www.caffeinemarketing.com/blog/20-best-b2b-saas-landing-page-examples)

### Tertiary (LOW confidence)
- **Figma Community** -- 403 blocked, layout inferred from search results only

### Codebase (HIGH confidence)
- `apps/web/app/(protected)/page.tsx` -- Current homepage implementation
- `apps/web/components/trending-section.tsx` -- Trending skills component
- `apps/web/components/company-approved-section.tsx` -- Company recommended component
- `apps/web/components/discovery-results.tsx` -- Discovery search component
- `apps/web/components/home-tabs.tsx` -- Tab switching component
- `apps/web/components/stat-card.tsx` -- Statistics card component
- `apps/web/components/leaderboard-table.tsx` -- Leaderboard component
- `apps/web/components/my-leverage-view.tsx` -- Personal leverage view
- `apps/web/lib/trending.ts` -- Trending algorithm (HN time-decay)
- `apps/web/lib/company-approved.ts` -- Company recommended query
- `apps/web/lib/platform-stats.ts` -- Platform-wide stats aggregation
- `apps/web/lib/platform-stat-trends.ts` -- 14-day trend sparkline data
- `apps/web/lib/leaderboard.ts` -- Leaderboard with RANK()
- `apps/web/lib/search-skills.ts` -- Full skill search with filters
- `apps/web/lib/my-leverage.ts` -- Personal usage/creation stats
- `apps/web/app/actions/discover.ts` -- Hybrid semantic+keyword discovery
- `packages/db/src/schema/skills.ts` -- Skills schema (categories: prompt, workflow, agent, mcp)

---

## Metadata

**Confidence breakdown:**
- Current homepage inventory: HIGH -- direct codebase analysis
- Marketplace research: HIGH -- 3 platforms fetched directly, 3 via search
- Layout variants: HIGH -- based on verified marketplace patterns mapped to verified data sources
- Recommendation: HIGH -- grounded in enterprise marketplace analogues and existing data capabilities

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (marketplace layouts change slowly)
