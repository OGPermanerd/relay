# Feature Research

**Domain:** Internal Skill Marketplace for Claude Skills, Prompts, Workflows, and Agent Configurations
**Researched:** 2026-01-31
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Search & Discovery** | Users need to find skills quickly; 47% of workers struggle to find information (Gartner) | MEDIUM | Full-text search across names, descriptions, tags. Faceted filtering by category, author, rating. Critical path feature. |
| **Skill Cards with Metadata** | Every marketplace shows items with key info at a glance | LOW | Name, description, author, rating, usage count, last updated. Standard pattern from PromptBase, SkillsMP. |
| **One-Click Install/Deploy** | DigitalOcean, Backstage, SkillsMP all provide instant deployment | LOW | Copy to ~/.claude/skills/ or project .claude/skills/. Must be frictionless. |
| **Version History** | Git/wiki mental model; users expect to see changes over time | MEDIUM | Track all versions, show diffs, allow rollback. SemVer-style (Major.Minor.Patch). |
| **User Authentication (SSO)** | Enterprise users expect existing identity; RBAC is table stakes for IDPs | LOW | Google Workspace SSO as specified. No separate account creation. |
| **User Profiles** | Attribution, accountability, ownership tracking | LOW | Display name, avatar (from Google), contributions, usage stats. |
| **Basic Ratings (1-5 stars)** | PromptBase, app stores, all marketplaces have ratings | LOW | Post-use rating with aggregate display. Builds trust signals. |
| **Usage Instructions** | Users need to know how to use what they install | LOW | Markdown documentation per skill. README equivalent. |
| **Categories/Tags** | Users browse by category; SkillsMP has 71,000+ skills organized this way | LOW | Hierarchical categories, user-defined tags, standard taxonomy. |
| **Mobile-Responsive UI** | Modern web expectation | LOW | Not mobile-first, but must work on tablets/phones. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **FTE Days Saved Metric** | Unique ROI visualization; McKinsey: 20% of day spent searching for info. Quantifies value in business terms. | MEDIUM | User-reported time estimate + aggregation. Main differentiator from generic marketplaces. Addresses $31.5B knowledge sharing loss (Fortune 500). |
| **Fork & Improve Workflow** | Wiki-style contribution model is rare in skill marketplaces. GitHub-inspired but simplified. | MEDIUM | Fork existing skill, modify, submit improvement. Creates improvement flywheel. |
| **Quality Scorecards** | Cortex, Port, Harness IDP use scorecards for standards. Apply to skills: documentation quality, usage rate, rating. | MEDIUM | Auto-calculated maturity score (Gold/Silver/Bronze). Gamifies quality. |
| **Commit Comments on Versions** | Wiki-style changelog explanation. Most skill marketplaces lack version narratives. | LOW | Required on publish. Builds institutional knowledge. |
| **Smart Search with AI** | Context-aware search beyond keyword matching. SkillsMP uses semantic search. | HIGH | Understand intent, suggest related skills. Requires embedding/vector search. |
| **Usage Analytics Dashboard** | Pendo-style adoption tracking. See which skills are used, by whom, when. | MEDIUM | Track installs, active usage, time saved aggregate. Platform teams need this data. |
| **Trending/Popular Sections** | Surface high-value content. Reduce discovery friction. | LOW | Based on usage velocity, not just total usage. |
| **Team/Org Collections** | Group skills for specific teams or use cases. Like Spotify playlists for skills. | LOW | Curated bundles. Onboarding packages. |
| **Skill Dependencies** | Show what other skills are needed. Backstage templates have this. | MEDIUM | Dependency graph, auto-install dependencies. |
| **Preview Before Install** | See skill content before committing. Reduces friction. | LOW | Read-only view of SKILL.md, supporting files. |
| **Notification Subscriptions** | Follow skills for update alerts. Standard in software catalogs. | MEDIUM | Subscribe to skills/authors, get notified on new versions. |
| **Contribution Leaderboards** | Gamification of contributions. Drives engagement. | LOW | Top contributors by skills shared, ratings received, time saved generated. |
| **Related Skills Recommendations** | "Users who installed X also installed Y". Amazon-style discovery. | HIGH | Collaborative filtering or content-based similarity. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Paid Skills/Monetization** | PromptBase model; creators want income | Adds payment complexity, splits community, creates gatekeeping, legal/tax overhead | Free internal marketplace. Value measured in FTE Days Saved, not revenue. Recognition through leaderboards. |
| **Real-Time Collaboration** | "Google Docs for skills" sounds good | Complexity explosion; skills are versioned artifacts, not live documents; merge conflicts | Wiki-style: one person edits, submits version. Fork for parallel work. |
| **Complex Permission Hierarchies** | "Different teams need different access" | Creates admin burden, reduces sharing culture, defeats open marketplace purpose | Simple model: all skills visible to all authenticated users. Edit requires account. |
| **Approval Workflows** | "Skills need review before publishing" | Creates bottlenecks, kills contribution velocity, requires reviewers (who?) | Post-publish community moderation via ratings. Flag problematic skills. Quality surfaces organically. |
| **AI-Generated Skills** | "Let AI create skills automatically" | Quality control nightmare; floods marketplace with low-value content | Support AI-assisted editing, but human must own and submit. |
| **Skill Execution Environment** | "Run skills directly in the platform" | Security risks, scope creep, maintenance burden | Skills execute in Claude Code/claude.ai. Marketplace is discovery + distribution only. |
| **Complex Analytics** | "We need 50 metrics and custom dashboards" | Over-engineering; most metrics won't be used | Focus on ONE core metric (FTE Days Saved) + basic usage stats. Add more only when proven need. |
| **Comments/Discussion Threads** | "Let users discuss skills" | Becomes noise, moderation burden, better venues exist (Slack, Teams) | Link to external discussion (Slack channel). Keep marketplace focused on discovery. |
| **Private Skills** | "Some skills are team-only" | Fragments discovery, creates "haves and have-nots", admin complexity | All skills public within org. Use separate repos for truly sensitive content. |
| **Skill Certification** | "Official stamp of approval" | Who certifies? Creates politics, bottleneck, false sense of security | Quality signals from usage and ratings. Community-driven trust. |

## Feature Dependencies

```
[Authentication (SSO)]
    |
    v
[User Profiles]
    |
    +---> [Basic Ratings] ---> [Quality Scorecards]
    |           |
    |           v
    |     [FTE Days Saved Metric] ---> [Usage Analytics Dashboard]
    |
    +---> [Skill Cards with Metadata]
    |           |
    |           +---> [Search & Discovery] ---> [Smart Search with AI]
    |           |           |
    |           |           v
    |           |     [Related Skills Recommendations]
    |           |
    |           +---> [One-Click Install/Deploy]
    |           |
    |           +---> [Preview Before Install]
    |
    +---> [Version History]
    |           |
    |           v
    |     [Commit Comments] ---> [Fork & Improve Workflow]
    |
    +---> [Categories/Tags] ---> [Team/Org Collections]
    |
    +---> [Notification Subscriptions]
    |
    +---> [Contribution Leaderboards]

[Skill Dependencies] --enhances--> [One-Click Install/Deploy]

[Trending/Popular] --requires--> [Usage Analytics Dashboard]
```

### Dependency Notes

- **Authentication is foundational:** All personalization, contribution, and rating features require authenticated users
- **Version History enables Fork & Improve:** Can't fork without version tracking
- **Usage tracking enables advanced features:** Trending, recommendations, analytics all need usage data
- **Search is the primary UX:** Must work before other discovery features matter
- **Scorecards build on ratings:** Need rating data before calculating quality scores
- **FTE Days Saved needs ratings flow:** Time-saved estimate comes from post-use rating

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the concept.

- [x] **Google Workspace SSO** - Non-negotiable for internal tool
- [x] **User Profiles (basic)** - Name, avatar from Google, list of contributions
- [x] **Skill Upload with Metadata** - Name, description, tags, usage instructions, time estimate
- [x] **Search & Discovery** - Full-text search, category filtering
- [x] **Skill Cards** - Display all metadata, rating, usage count
- [x] **One-Click Install** - Copy command or direct file placement
- [x] **Version History** - List of versions with commit comments, ability to view old versions
- [x] **Basic Ratings (1-5)** - Post-use rating with optional comment and time-saved estimate
- [x] **FTE Days Saved Display** - Aggregate and display at skill and platform level

**MVP Rationale:** This covers the core user journeys (Creating, Publishing, Finding, Rating) and establishes the unique value proposition (FTE Days Saved). Everything else can wait for validation.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Fork & Improve Workflow** - When contribution velocity is proven; trigger: 50+ skills in marketplace
- [ ] **Quality Scorecards** - When rating data is meaningful; trigger: 100+ ratings
- [ ] **Trending/Popular Sections** - When enough usage data exists; trigger: 1000+ installs
- [ ] **Team/Org Collections** - When teams request curation; trigger: user feedback
- [ ] **Notification Subscriptions** - When users ask "how do I know when X updates"; trigger: user feedback
- [ ] **Usage Analytics Dashboard** - When platform team needs adoption metrics; trigger: 6 months post-launch
- [ ] **Preview Before Install** - Low effort, add when one-click install is stable

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Smart Search with AI** - Requires vector DB, significant complexity; defer until search is proven pain point
- [ ] **Related Skills Recommendations** - Requires substantial usage data and ML infrastructure
- [ ] **Skill Dependencies** - Adds complexity; most skills are standalone; wait for demand
- [ ] **Contribution Leaderboards** - Gamification can wait; culture-building feature
- [ ] **Advanced Analytics** - Build on request from leadership/platform team

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Search & Discovery | HIGH | MEDIUM | P1 |
| One-Click Install | HIGH | LOW | P1 |
| SSO Authentication | HIGH | LOW | P1 |
| Skill Cards | HIGH | LOW | P1 |
| Basic Ratings | HIGH | LOW | P1 |
| Version History | HIGH | MEDIUM | P1 |
| FTE Days Saved | HIGH | MEDIUM | P1 |
| User Profiles | MEDIUM | LOW | P1 |
| Categories/Tags | MEDIUM | LOW | P1 |
| Fork & Improve | HIGH | MEDIUM | P2 |
| Quality Scorecards | MEDIUM | MEDIUM | P2 |
| Trending/Popular | MEDIUM | LOW | P2 |
| Team Collections | MEDIUM | LOW | P2 |
| Notifications | MEDIUM | MEDIUM | P2 |
| Preview Install | LOW | LOW | P2 |
| Usage Analytics | MEDIUM | MEDIUM | P2 |
| Smart Search | MEDIUM | HIGH | P3 |
| Recommendations | MEDIUM | HIGH | P3 |
| Skill Dependencies | LOW | MEDIUM | P3 |
| Leaderboards | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add after validation
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | SkillsMP | Backstage | PromptBase | Relay Approach |
|---------|----------|-----------|------------|----------------|
| Discovery | Semantic search, categories, 71K+ skills | Software catalog, search | Category browse, search | Search + categories + FTE Days Saved surfacing |
| Install | One-command via marketplace.json | Templates scaffold new projects | Download prompt file | One-click copy/install to Claude skills |
| Versioning | Git-based (inherits from GitHub repos) | Entity tracking | None | Wiki-style with commit comments |
| Quality Signals | Star threshold (2+), badges | Scorecards (configurable) | Price + reviews | Ratings + FTE Days Saved + Scorecards |
| Contribution | Link to GitHub | PR-based templates | Upload via form | Fork & Improve workflow |
| Metrics | None visible | DORA, custom scorecards | None | FTE Days Saved (unique differentiator) |
| Auth | None (public catalog) | SSO/RBAC | Account-based | Google Workspace SSO |
| Monetization | Free (community) | N/A (self-hosted) | Paid prompts ($1.99-$9.99) | Free (internal, value via metrics) |

## Implications for Relay

### Unique Positioning
Relay differentiates through:
1. **FTE Days Saved as core metric** - No other skill marketplace quantifies value in business terms
2. **Wiki-style contribution model** - Fork & Improve is more accessible than PR-based contribution
3. **Internal/authenticated** - Trust and accountability that public marketplaces lack
4. **Claude-specific** - Focused on one ecosystem vs. multi-model fragmentation

### Critical Success Factors
1. **Search must be fast and accurate** - Primary UX; if search fails, platform fails
2. **Install friction must be zero** - One click or users won't adopt
3. **Time-saved capture must be frictionless** - Core metric depends on user input
4. **Initial content seeding** - Empty marketplace = no adoption; need 20-50 quality skills at launch

### Risk Mitigation
- **70% of platform engineering initiatives fail within 18 months** - Focus on developer experience, treat as product
- **Tool fatigue is real** - Integration with existing Claude workflow, not separate destination
- **Adoption needs incentives** - FTE Days Saved leaderboards, recognition, not just metrics

## Sources

### Primary Research
- [Gartner Internal Developer Portals Reviews 2026](https://www.gartner.com/reviews/market/internal-developer-portals)
- [SkillsMP Agent Skills Marketplace](https://skillsmp.com/)
- [Backstage Software Templates Documentation](https://backstage.io/docs/features/software-templates/)
- [Port Scorecards and Initiatives](https://www.port.io/product/scorecards-and-initiatives)
- [Cortex Scorecards](https://www.cortex.io/post/why-scorecards-are-critical-to-your-developer-portal)
- [Claude Agent Skills Documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

### Market & Adoption Data
- [Platform Engineering 80% Adoption, 70% Fail](https://byteiota.com/platform-engineering-80-adoption-70-fail-within-18-months/)
- [6 Things Developer Tools Must Have in 2026](https://evilmartians.com/chronicles/six-things-developer-tools-must-have-to-earn-trust-and-adoption)
- [Knowledge Sharing ROI Metrics](https://bloomfire.com/blog/roi-knowledge-management/)
- [How to Measure Developer Productivity and Platform ROI](https://platformengineering.org/blog/how-to-measure-developer-productivity-and-platform-roi-a-complete-framework-for-platform-engineers)

### Feature References
- [PromptBase Marketplace Review](https://www.godofprompt.ai/blog/review-popular-ai-prompt-library-platforms)
- [Harness IDP Governance Guide](https://www.harness.io/harness-devops-academy/internal-developer-portal-governance-guide)
- [OpsLevel Guide to Developer Portals](https://www.opslevel.com/resources/2025-ultimate-guide-to-building-a-high-performance-developer-portal)
- [DigitalOcean Marketplace One-Click Apps](https://www.digitalocean.com/products/marketplace)

---
*Feature research for: Internal Skill Marketplace (Relay)*
*Researched: 2026-01-31*
*Confidence: HIGH - Based on current market analysis, competitor review, and established patterns from IDPs and skill marketplaces*
