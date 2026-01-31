# Pitfalls Research

**Domain:** Internal skill marketplace / developer tool catalog
**Researched:** 2026-01-31
**Confidence:** HIGH (multiple sources corroborate patterns)

## Critical Pitfalls

### Pitfall 1: The Catalog Staleness Death Spiral

**What goes wrong:**
Content becomes outdated within weeks of publication. Skills that worked with older Claude versions break. Prompts reference deprecated features. Users encounter broken skills, lose trust, and stop checking the catalog entirely. Once trust erodes, adoption collapses and never recovers.

**Why it happens:**
- Wiki-style versioning with no approval gates means anyone can publish, but no one is responsible for maintenance
- Original creators move on to other projects or leave the organization
- Skills are "fire and forget" - no ownership model after initial contribution
- No automated detection of broken or outdated content
- Backstage-style catalogs driven by static files require manual maintenance that developers deprioritize

**How to avoid:**
- Implement automated health checks: test skills against current Claude versions periodically
- Build "last verified working" timestamps into skill metadata
- Create deprecation workflows: auto-flag skills unused for 90 days
- Surface freshness signals prominently ("Last updated 6 months ago" warning)
- Consider "adopt-a-skill" programs for orphaned high-value content

**Warning signs:**
- User complaints about broken skills increasing month-over-month
- High bounce rates on skill detail pages (users look, then leave without using)
- Support tickets mentioning "skill doesn't work anymore"
- Growing gap between "most viewed" and "most used" skills

**Phase to address:**
Phase 1 (Foundation) - Build freshness/health tracking into core data model from day one. Cannot retrofit easily.

---

### Pitfall 2: Metrics Gaming and Inflated Value Claims

**What goes wrong:**
Users inflate "time saved" estimates to make their contributions look impressive or justify their team's investment. FTE Days Saved metric becomes meaningless noise. Leadership loses ability to measure actual ROI. Platform gets defunded or deprioritized because value claims become untrustworthy.

**Why it happens:**
- Goodhart's Law: "When a measure becomes a target, it ceases to be a good measure"
- Self-reported metrics are inherently gameable
- No verification mechanism for time-saved claims
- Incentive structures (recognition, performance reviews) reward high numbers
- Stack Overflow research shows users "cherry-pick" easy tasks to maximize reputation
- User estimates override creator estimates (per design) but introduces new gaming vector

**How to avoid:**
- Use multiple complementary metrics, not a single "north star"
- Track behavioral signals that are harder to game: repeat usage, cross-team adoption, organic sharing
- Implement peer validation: "Did this actually save you time?" confirmation prompts
- Compare estimates against actual task completion times where measurable
- Surface distribution anomalies: flag users whose estimates are 3x above median
- Focus on quality over quantity: sharing value > consumption metrics

**Warning signs:**
- Time-saved estimates showing unrealistic distributions (clustering at round numbers)
- Users claiming 8+ hours saved for simple prompts
- Disconnect between "FTE Days Saved" dashboard and actual productivity metrics
- Defensive reactions when audit processes are proposed

**Phase to address:**
Phase 2 (Metrics) - Design anti-gaming measures before launching public metrics. Add safeguard metrics alongside primary KPIs.

---

### Pitfall 3: MCP Lock-in Creates Invisible Usage

**What goes wrong:**
Skills used outside MCP are invisible to tracking. Users discover workarounds (copy-paste prompts, manual configurations) that bypass the platform. Usage metrics show declining engagement while actual skill reuse flourishes - untracked. Product decisions based on incomplete data lead to wrong priorities.

**Why it happens:**
- MCP adoption is not universal - many users still interact with Claude directly
- Friction in MCP workflow drives users to simpler alternatives
- Mobile users, quick tasks, external collaborators can't use MCP
- Users copy prompts from catalog to use elsewhere - legitimate reuse goes untracked
- Per project context: "skills used outside MCP are invisible"

**How to avoid:**
- Design for multi-channel usage from the start, not MCP-only
- Provide easy export/copy mechanisms that still capture usage intent
- Build browser extensions or Claude.ai integrations as first-class citizens
- Create "did you use this skill?" follow-up mechanisms for copied content
- Accept that some usage will be untracked - don't over-index on perfect measurement
- Consider watermarking/tagging prompts to enable attribution even when copied

**Warning signs:**
- Catalog page views >> MCP tracked usage (10:1 or worse ratio)
- Users reporting "I use that skill all the time" for skills showing zero MCP usage
- Declining MCP adoption rates despite growing team interest in AI tools
- Feature requests for "easier ways to use skills without MCP"

**Phase to address:**
Phase 1 (Foundation) - Design tracking architecture to accommodate non-MCP channels. Phase 3 (Scale) - Build integrations for popular non-MCP workflows.

---

### Pitfall 4: The Cold Start Content Desert

**What goes wrong:**
Marketplace launches with too few skills. Users check it once, find nothing relevant, and never return. Without users, contributors have no audience. Without content, users have no reason to visit. Classic chicken-and-egg collapse.

**Why it happens:**
- Underestimating content seeding requirements before launch
- Relying on "build it and they will come" organic contribution
- Not identifying and activating early champion contributors
- Broad categorization without depth in any single area
- TikTok research shows even well-funded companies struggle with adoption when catalogs feel sparse

**How to avoid:**
- Curate 50+ high-quality skills before any public announcement
- Identify 3-5 "atomic networks" (specific teams/use cases) and densely populate those first
- Recruit internal power users as founding contributors with explicit commitments
- Use seeding: convert existing team prompts, templates, and workflows into catalog entries
- Focus depth over breadth: better to have 30 great skills for one use case than 3 skills each for 10 use cases

**Warning signs:**
- Launch delayed repeatedly due to "not enough content yet"
- Early users reporting "couldn't find anything relevant to my work"
- High signup/visit rates but near-zero return visits
- Contributors waiting to see if "anyone else will add stuff first"

**Phase to address:**
Phase 0 (Pre-launch) - Seeding strategy must precede public launch. Build content corpus before building platform features.

---

### Pitfall 5: Quality Collapse Without Gates

**What goes wrong:**
Without approval gates, low-quality content floods the catalog. Users can't distinguish good skills from garbage. Discovery becomes a churn through noise. High-quality contributors stop contributing because their work gets buried. Platform becomes a dumping ground.

**Why it happens:**
- Wiki-style "anyone can add" philosophy prioritizes contribution volume over quality
- No expert review before publication
- Ratings systems take time to accumulate signal
- Metrics-driven quality (per design) requires scale to work - fails at launch
- Easy to publish half-baked ideas; hard to surface polished solutions

**How to avoid:**
- Implement lightweight quality gates: required fields, minimum documentation, working example
- Create "verified" or "featured" tiers for editorially-reviewed content
- Build reputation systems that weight contributions by contributor track record
- Enable community flagging for "doesn't work" or "misleading description"
- Surface quality signals prominently: success rate, error reports, time-since-last-issue
- Consider "probationary" period where new contributions have lower visibility until validated

**Warning signs:**
- User complaints about "lots of broken skills"
- High variance in quality within same category
- Expert contributors disengaging ("why bother, my stuff gets buried")
- Support requests asking "which skills actually work?"

**Phase to address:**
Phase 1 (Foundation) - Build quality signal infrastructure. Phase 2 (Metrics) - Implement tiered visibility based on quality indicators.

---

### Pitfall 6: Version Sprawl Without Cleanup

**What goes wrong:**
Wiki-style versioning creates version proliferation. 47 versions of "meeting summary prompt" exist, most nearly identical. Users can't determine which to use. Storage/maintenance costs balloon. Search results become unusable.

**Why it happens:**
- Per design: "anyone can add versions, no approval gates"
- No deprecation or archival mechanism
- Fork culture: easier to create new version than improve existing
- No consolidation workflows or duplicate detection
- Research shows forked code "requires that every bug is corrected in each copy"

**How to avoid:**
- Implement duplicate detection at creation time ("similar skills exist - consider contributing to those instead")
- Build version consolidation workflows: merge best parts of related versions
- Create archival triggers: versions with zero usage after 90 days get auto-archived
- Surface "canonical" versions prominently, push forks to secondary discovery
- Enable "this replaces/improves on [other skill]" relationships

**Warning signs:**
- Category pages showing 20+ similar-sounding skills
- User confusion about which version to use
- Storage costs growing faster than useful content
- Contributors complaining about "too much noise to find anything"

**Phase to address:**
Phase 2 (Metrics) - Build usage-based cleanup triggers. Phase 3 (Scale) - Implement consolidation and archival workflows.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip MCP tracking for MVP | Faster launch | Permanent blind spot on non-MCP usage; retrofit is expensive | Never - design multi-channel from start |
| Store time-saved as single number | Simple data model | Can't audit, can't compare, can't detect gaming | MVP only - add context fields in Phase 2 |
| No skill health checks | Less infrastructure | Broken skills erode trust; manual cleanup doesn't scale | First 6 months only |
| Flat skill organization | Easy to implement | Discovery fails at 100+ skills; restructuring breaks links | First 50 skills only |
| Creator-only edit permissions | Simpler permissions | Orphaned skills can't be maintained; wiki model breaks | Never - design for maintenance handoff |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API | Hardcoding model versions in skills | Use version-agnostic skill format; test against latest models |
| MCP Servers | Storing API keys in skill definitions | Centralized credential management; skill references secrets by ID |
| SSO/Identity | Treating user identity as stable string | Design for identity merges, name changes, email updates |
| Metrics/Analytics | Assuming synchronous tracking is sufficient | Build event queue; handle offline/delayed attribution |
| Search/Discovery | Relying on basic text search | Plan for semantic search from start; keyword matching fails at scale |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full skill catalog on search | Search latency grows linearly | Implement pagination, faceted search, lazy loading | 500+ skills |
| Synchronous metrics writes | Skill execution slowed by tracking | Async event queue with eventual consistency | 100+ concurrent users |
| Single-node search index | Search becomes bottleneck | Design for distributed search from architecture phase | 1000+ skills |
| Storing all versions inline | Page load times balloon | Version storage with lazy retrieval; show active only | 50+ versions per skill |
| No caching on popular skills | Same skills fetched repeatedly | Implement tiered caching with TTL-based invalidation | 1000+ daily active users |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Skills that capture user input in logs | PII exposure in analytics | Sanitize/redact user inputs before any persistence |
| Storing API keys in skill configurations | Credential theft if skill is exported/shared | Reference secrets by ID; never inline credentials |
| No rate limiting on skill execution | DoS via automated skill invocation; cost explosion | Per-user, per-skill rate limits |
| Trusting skill-provided "time saved" for billing | Gaming to inflate usage-based charges | Independent verification for any financial metrics |
| Skills that can modify other skills | Privilege escalation via malicious skill update | Strict permission boundaries; skills can't write to catalog |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Requiring MCP setup before browsing | New users bounce immediately | Allow browsing/discovery without authentication |
| Complex contribution workflow | Only power users contribute | One-click "add prompt" for simple cases; progressive complexity |
| No preview before execution | Users afraid to try skills | Show example inputs/outputs; "try with sample data" option |
| Overwhelming search results | Users give up finding relevant skill | Default to quality-weighted ranking; progressive disclosure of results |
| No feedback after skill use | Users can't report problems | Inline "did this work?" with one-click issue reporting |
| Hidden version history | Users can't understand skill evolution | Visible changelog; diff between versions |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Skill search:** Often missing semantic understanding - verify it finds "meeting notes" when user searches "standup summary"
- [ ] **Usage tracking:** Often missing offline/copied usage - verify tracking plan covers non-MCP scenarios
- [ ] **Quality ratings:** Often missing fraud detection - verify you can detect coordinated rating manipulation
- [ ] **Version control:** Often missing rollback mechanism - verify users can revert to previous version
- [ ] **Metrics dashboard:** Often missing confidence intervals - verify you show uncertainty, not false precision
- [ ] **Skill categories:** Often missing multi-categorization - verify skills can appear in multiple relevant categories
- [ ] **Contributor profiles:** Often missing maintenance burden view - verify contributors can see "your skills needing attention"
- [ ] **Admin tools:** Often missing bulk operations - verify admins can deprecate/archive at scale

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Catalog staleness | MEDIUM | 1) Mass deprecation announcement 2) Automated health scan 3) Community "fix-a-thon" event 4) Rebuild trust through "verified working" badge |
| Metrics gaming | HIGH | 1) Acknowledge issue publicly 2) Retroactively flag suspicious data 3) Introduce verification 4) Reset baseline expectations |
| MCP lock-in blindspot | HIGH | 1) Add alternative tracking channels 2) Survey for untracked usage 3) Adjust historical metrics with estimates 4) Communicate limitations |
| Cold start failure | MEDIUM | 1) Pause public marketing 2) Intensive seeding sprint 3) Recruit power users directly 4) Relaunch to specific communities first |
| Quality collapse | MEDIUM | 1) Introduce curation layer 2) Archive low-quality content 3) Feature high-quality examples 4) Communicate quality standards |
| Version sprawl | LOW | 1) Implement archival automation 2) Surface canonical versions 3) Merge duplicates manually 4) Prevent future sprawl with duplicate detection |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Catalog staleness | Phase 1 - Build freshness tracking into core model | Skills have last_verified, health_status fields; automated checks running |
| Metrics gaming | Phase 2 - Design safeguard metrics before public dashboard | Multiple metrics tracked; anomaly detection in place |
| MCP lock-in | Phase 1 - Multi-channel tracking architecture | Non-MCP usage has attribution path; not 100% but not 0% |
| Cold start | Phase 0 - Seeding before launch | 50+ skills live before public announcement |
| Quality collapse | Phase 1/2 - Quality signals in foundation; tiered visibility in metrics | Quality score computed; featured vs. standard tiers exist |
| Version sprawl | Phase 2/3 - Usage tracking enables cleanup; archival workflows at scale | Auto-archive triggers active; duplicate detection at creation |

## Sources

- [The New Stack: 7 Reasons Internal Developer Platforms Fail](https://thenewstack.io/7-reasons-internal-developer-platforms-fail-so-yours-wont/)
- [Platform Engineering: Why Companies Fail at IDPs](https://platformengineering.org/blog/why-companies-fail-at-internal-developer-platforms)
- [Springer: Gaming Expertise Metrics on Knowledge Platforms](https://link.springer.com/article/10.1007/s12108-023-09607-x)
- [Backstage Backlash: Why Developer Portals Struggle](https://medium.com/@samadhi-anuththara/backstage-backlash-why-developer-portals-struggle-cb82d4f082e1)
- [Port.io: Technical Disadvantages of Backstage](https://www.port.io/blog/what-are-the-technical-disadvantages-of-backstage)
- [TikTok Component Library Adoption Challenges](https://autonomyai.io/business/the-adoption-gap-why-component-libraries-fail-without-automation/)
- [CData: MCP Limitations Explained](https://www.cdata.com/blog/navigating-the-hurdles-mcp-limitations)
- [Merge: 6 Challenges of Using MCP](https://www.merge.dev/blog/mcp-challenges)
- [Andrew Chen: How to Solve the Cold Start Problem](https://andrewchen.com/how-to-solve-the-cold-start-problem-for-social-products/)
- [Jellyfish: Goodhart's Law in Software Engineering](https://jellyfish.co/blog/goodharts-law-in-software-engineering-and-how-to-avoid-gaming-your-metrics/)
- [NN/G: Campbell's Law - The Dark Side of Metric Fixation](https://www.nngroup.com/articles/campbells-law/)
- [Enterprise Knowledge: Findability vs Discoverability](https://enterprise-knowledge.com/findability-v-discoverability/)
- [Vanderbilt: Why Software Reuse Has Failed](https://www.dre.vanderbilt.edu/~schmidt/reuse-lessons.html)
- [ACM: Software Reuse Strategies and Component Markets](https://cacm.acm.org/research/software-reuse-strategies-and-component-markets/)

---
*Pitfalls research for: Internal skill marketplace / developer tool catalog*
*Researched: 2026-01-31*
