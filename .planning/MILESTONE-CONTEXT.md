# Milestone Context — Post-v5.0 Roadmap

## Background

After shipping v5.0 (Feedback, Training & Benchmarking), we reframed EverySkill's architecture into 4 layers:

1. **Smart Skills Database** — Multi-tenant, semantic search, work-activity analysis
2. **IP Stewardship & High Velocity Growth** — Usage tracking, feedback loops, training data, benchmarking, IP protection
3. **AI Independence** — Portable format, model-agnostic training data, cross-model benchmarking
4. **Universally Integrated Access** — Web, MCP, hooks, API

This reframing revealed gaps where the product doesn't yet deliver on its architectural promises. Five milestones were identified, in priority order:

---

## Milestone 1: v6.0 — IP Dashboard & Skills Portfolio

**Primary Layer:** Layer 2 (IP Stewardship)
**Priority:** Highest — this is the sales story

**Problem:** The IP stewardship claim is theoretical. A company admin can't answer "How much IP have we captured?" An employee can't see their skills portfolio or impact. The bidirectional IP protection value prop has zero product surface.

**Goals:**
- Company IP Dashboard showing total skills captured, hours saved, estimated replacement cost, IP concentration risk (which employees hold critical skills)
- Individual Skills Portfolio showing personal contributions, usage metrics, portable vs company IP
- IP Value Estimation quantifying what it would cost to recreate skills from scratch
- Org-wide quality trends over time (are our skills getting better?)
- IP risk alerts (key person dependency, skills with single author and high usage)

**Scope notes:**
- Mostly new pages + SQL aggregation queries on existing data
- No schema changes expected — all data already captured
- Could include an "IP Report" PDF/CSV export for board presentations

---

## Milestone 2: v7.0 — Multi-Signal Intelligence

**Primary Layer:** Layer 1 (Smart Skills Database)
**Priority:** High — makes the "smart" promise real

**Problem:** The database claims to analyze work patterns but only looks at Gmail. One signal source doesn't make a smart database. The Operator Skills Wizard concept exists in the backlog but isn't built.

**Goals:**
- Browser history analysis (Chrome, Safari, Edge) — analyze tool usage patterns and match to skills
- Operator Skills Wizard — guided onboarding flow that maps user's role/tools/tasks to recommended skills
- "Brain profile" sliders — personalized weighting for how the system ranks skills (focus depth, task switching tolerance, learning style)
- Rerunnable assessment — refresh recommendations on demand as work patterns change
- Seed database with curated open-source skills (cold start solution)
- Screen time / app usage data upload (iOS/Android)

**Scope notes:**
- Browser extension may be needed for history collection (overlaps with Milestone 4)
- Could start with manual CSV upload of browser history before building the extension
- The Operator Skills Wizard is the most immediately impactful piece

---

## Milestone 3: v8.0 — AI Independence (Minimal Viable)

**Primary Layer:** Layer 3 (AI Independence)
**Priority:** Medium-high — validates a core architectural promise

**Problem:** AI Independence is a named architectural layer but has zero non-Claude integration. Skills only run on Claude, benchmarks only compare Claude models, MCP only works with Claude. The promise is credible architecturally but not proven.

**Goals:**
- Add OpenAI (GPT-4o) to benchmark runner — execute skills and compare results alongside Claude
- Add at least one more provider (Gemini, Llama via Ollama) to benchmarks
- Skill format adaptation — detect and translate Claude-specific patterns (XML tags, artifacts) to equivalent patterns for other providers
- Universal skill export — download a skill formatted for a specific AI platform
- Document the portable skill specification

**Scope notes:**
- Benchmark runner already uses Promise.allSettled — adding models is architecturally straightforward
- The blinded AI judge already evaluates without knowing the model — works for any provider
- Skill translation is the hard part (prompt engineering varies by model)

---

## Milestone 4: v9.0 — Browser Extension

**Primary Layer:** Layer 1 + Layer 4 (Smart Database + Universal Access)
**Priority:** Medium — highest strategic leverage, higher effort

**Problem:** Skills are only accessible via web, MCP, or API. A browser extension would serve three layers simultaneously: data collection for smart matching (L1), universal access from any tab (L4), and more usage data for IP measurement (L2).

**Goals:**
- Chrome extension (Manifest V3) with skill search and quick-access
- Browsing pattern collection (opt-in) feeding into Layer 1 work-activity analysis
- Skill suggestion popup based on current page context (e.g., "You're on Jira — here are skills for project management")
- Quick feedback submission from extension popup
- Safari and Edge ports (same codebase via WebExtension API)

**Scope notes:**
- Higher engineering effort than other milestones
- Privacy considerations for browsing data (must be opt-in, anonymized, tenant-scoped)
- Could be split: extension shell first (L4), then behavior tracking (L1)

---

## Milestone 5: v10.0 — Skills Marketplace

**Primary Layer:** Layer 1 + Layer 2 (Smart Database + IP Stewardship)
**Priority:** Lower — natural evolution once IP measurement is solid

**Problem:** Skills are currently tenant-scoped. Proven high-quality skills (high benchmarks, positive feedback, training data) can't be shared across organizations. There's no revenue model beyond the platform itself.

**Goals:**
- Cross-tenant skill publishing for verified high-quality skills
- Marketplace browse/search with quality signals (benchmark scores, usage counts, feedback sentiment)
- Skill licensing model (free/paid) with revenue share for authors
- Quality threshold for marketplace listing (minimum benchmark score, feedback count, training examples)
- Import/fork marketplace skills into your tenant with attribution

**Scope notes:**
- Requires IP ownership clarity (who owns a skill created at work and published to marketplace?)
- Revenue infrastructure (Stripe or similar) needed
- Could start with a "featured skills" page before full marketplace
- Depends on Layer 2 (IP Dashboard) being solid — need to quantify skill value before pricing

---

## Sequencing Rationale

1. **v6.0 IP Dashboard** first because it creates the sales story and makes existing data visible. No new data collection needed — just surfaces what we already track.
2. **v7.0 Multi-Signal Intelligence** second because it delivers the "smart" promise with more behavioral data sources.
3. **v8.0 AI Independence** third because it validates a core architectural claim with minimal scope.
4. **v9.0 Browser Extension** fourth because it's higher effort but triple-value.
5. **v10.0 Skills Marketplace** last because it depends on IP measurement maturity and requires the most business model decisions.

## User Decisions Needed

- Scope of v6.0: minimal IP dashboard vs comprehensive analytics suite?
- v7.0: start with Operator Skills Wizard only, or also browser history in same milestone?
- v8.0: which non-Claude providers to target first?
- v9.0: Chrome-first or cross-browser from day one?
- v10.0: business model (free marketplace, paid listings, subscription)?
