# Research Synthesis: Context & Attention Architecture — EverySkill/Relay

## What This Is

This document synthesizes ~40 academic papers on RAG architectures, knowledge graphs, adaptive retrieval, and community detection, mapped specifically to EverySkill's skill marketplace. It was produced in a research session on Feb 15, 2026. Two key constraints shape the priorities:

1. **No tech debt exists** — structural changes should happen now while the system is early
2. **Compute is free, tokens are scarce** — pre-compute as much as possible so query-time token consumption stays low

## Current Architecture (for context)

- Next.js 15 + React 19 monorepo (Turborepo + pnpm)
- PostgreSQL 16 with Drizzle ORM + pgvector
- Voyage API embeddings for semantic similarity (primarily duplicate detection)
- AI skill review pipeline (Anthropic API) with auto-approval thresholds
- Multi-tenant with email-domain-based access control
- MCP integration for Claude Desktop/Code skill access
- Caddy reverse proxy with on-demand TLS for tenant subdomains

## Priority 1: GraphRAG-Style Skill Communities

**What:** Run community detection over the skill similarity graph + usage co-occurrence. Pre-compute community summaries. This powers the v3 "what are you trying to solve today" discovery feature.

**Why this matters for v3:** The v3 milestone describes: "allow the user to input 'what are you trying to solve today' and also from their claude interface from any prompt: /everyskill should invoke a search for matching potential skills." Flat semantic search returns skills that are textually similar to the query. Community-based discovery returns clusters of related skills organized by workflow, domain, and tool chain — much more useful for exploratory queries where the user doesn't know exactly what they need.

**Natural community structure in EverySkill:**
- **Domain communities**: Marketing, engineering, research, operations
- **Workflow communities**: Ideation, execution, review, reporting
- **Tool chain communities**: Claude-optimized, GPT-optimized, multi-model
- **Usage communities**: Skills frequently used together by the same people

**Implementation approach:**
1. Build a skill similarity graph: nodes = skills, edges = semantic similarity (Voyage embeddings, threshold ~0.7) + co-usage by same users
2. Run Leiden community detection (NetworkX or igraph in a background job)
3. Generate a summary per community using LLM (compute is free, run on cron)
4. For "what are you trying to solve" queries: match to communities first, then surface top skills within matched communities
5. Store community assignments and summaries in PostgreSQL, regenerate daily

**Research basis:** Microsoft GraphRAG (arXiv 2404.16130) — 70-80% win rate over naive RAG on comprehensiveness. Leiden algorithm outperforms Louvain for community detection quality. Dynamic Community Selection uses a cheap LLM to rate community relevance before expensive operations.

## Priority 2: Adaptive Skill Recommendation (Query Routing)

**What:** Instead of one-size-fits-all semantic search, route different query types to different retrieval strategies.

**Three query types and their optimal paths:**

1. **Exact-match queries** ("find the brand guidelines skill") → keyword search, skip semantic entirely. Fast, precise.

2. **Exploratory queries** ("what skills exist for content marketing?") → community-based browsing. Return the relevant community summary + top skills per community. Don't just return the 10 most similar skills — show the landscape.

3. **Diagnostic queries** ("tell me what I need" / the v3 screentime-style analysis) → multi-step pipeline:
   - Connect to Google Drive, Gmail, Calendar (the v3 feature describes this)
   - Analyze activity patterns (% of time per task type)
   - Map task types to skill communities
   - Rank skills by estimated time savings × match quality
   - Present a deployment plan

**Implementation:** A lightweight routing classifier (or rule-based: if query contains "find" / specific skill name → exact-match; if query is a question → exploratory; if query mentions "diagnose" / "analyze" / "what do I need" → diagnostic).

**Research basis:** Adaptive-RAG — query complexity classifier routing between no-retrieval, single-step, and multi-step. Self-RAG — learned reflection tokens that decide when retrieval is needed.

## Priority 3: Temporal Skill Tracking

**What:** Track skill version evolution, author changes, usage trends over time. Enables "what changed since I last used this skill?" and "is this skill still maintained?"

**Why:** The v3 milestone describes training data, benchmarking, and drift prevention. Temporal tracking is the foundation for all of these — you need to know what changed, when, and whether it improved or degraded quality.

**Data model additions:**
- Skill version history (content snapshots per publish event)
- Per-version usage metrics and ratings (did the update improve things?)
- Author change log
- Temporal validity for skill metadata (a skill's description of what it does may become outdated)

**Research basis:** Zep/Graphiti bi-temporal model — every fact tracks when it was true (t_valid/t_invalid) and when the system learned about it (t_created/t_expired). Applied to skills: track when a skill version was active, when it was superseded, and preserve the full history.

## Priority 4: Skill Visibility Scoping & Personal Preference Layer

**What:** Implement the v3 visibility scopes (global company-visible, employee-visible, employee-invisible, employee-personal) and build a cross-AI personal preference layer.

**The v3 milestone describes:**
- Global stamped/approved skills (authorized by business admin or department head)
- Personal preference extraction from skills
- Cross-AI personal pref layer that syncs to claude.ai, Claude Code, etc.
- Scanning existing prefs (claude.md, etc.) to build the pref layer

**Architecture approach:**
- Add `visibility` enum to skills table: `global_approved`, `org_visible`, `personal`, `private`
- Approval workflow: admin or department head group can stamp skills as globally approved
- Personal preference extraction: when a user customizes a skill (fork with personal tweaks), identify which changes are personal preference vs. functional changes
- Preference sync: expose preferences via MCP so Claude Desktop/Code can pull them

## Priority 5: AI Independence — Benchmarking & Portability

**What:** The v3 milestone's core value proposition: validate skill performance and portability across LLMs.

**Components:**
1. **Training/assessment data storage** per skill × model × version
2. **Benchmarking tool**: tokens required, cost estimation, quality score (if training data available), date of benchmark
3. **Continuous feedback collection**: solicited within Claude, within EverySkill UI, per usage
4. **Author-approved changes**: users can suggest improvements, but authors must approve to prevent drift
5. **Multi-model support**: scoping for Google, Llama, on-prem instances

**Research basis:** RAGAS framework for RAG evaluation — provides metrics for faithfulness, answer relevancy, context precision, context recall. Adaptable for skill evaluation: does the skill produce the expected output across different models?

## Additional Research Findings (Reference)

### For the "Tell Me What I Need" Feature
The v3 diagnostic feature where EverySkill analyzes Google Drive, Gmail, Calendar to show a "screentime" view maps to Information Foraging Theory (Pirolli & Card, 1999):
- **Diet model**: Which skills should the user "consume"? Optimal diet maximizes information/productivity gain per adoption cost
- **Patch model**: Different work domains are "patches" — the system should identify which patches the user spends time in and recommend skills per patch
- **Exploration vs exploitation**: Suggest both high-confidence matches (exploitation) and potentially-useful skills from adjacent domains (exploration)

### For Skill Discovery via MCP (`/everyskill` command)
The v3 idea of invoking skill search from any Claude prompt maps to Modular RAG (Gao et al., arXiv 2312.10997):
- The MCP tool should compose multiple retrieval strategies based on query context
- If the user is mid-conversation about a specific task, use that conversation context to improve skill matching
- Return top 3 with confidence scores and "try it now" affordance

### For Education & News Section
The v3 education/news component (skills onboarding, reddit-style threads, news feed) could use community summaries:
- "What's new in Marketing skills" = summary of the marketing skill community's recent additions
- "Trending" = skills whose usage velocity increased in communities the user belongs to
- Thread ranking could use the same RRF approach the CEO Command Center uses for search

### For Org Structure Integration
The v3 idea of uploading org structure for role-based recommendations:
- Map org chart nodes to skill communities
- "Skills for your role" = community intersection of (role-typical skills) ∩ (skills not yet adopted by user)
- Manager view: skill adoption gaps across their team

## Key Papers

| Paper | Year | Key Contribution |
|-------|------|-----------------|
| Microsoft GraphRAG, arXiv 2404.16130 | 2024 | Community detection + summarization |
| Adaptive-RAG | 2024 | Query complexity routing |
| Self-RAG (Asai et al.) | 2023 | Adaptive retrieval decisions |
| Gao et al., arXiv 2312.10997 | 2023 | Modular RAG architecture |
| Zep/Graphiti, arXiv 2501.13956 | 2025 | Bi-temporal knowledge model |
| Pirolli & Card (IFT) | 1999 | Information foraging theory |
| RAGAS | 2024 | RAG evaluation framework |
| Cormack et al. (RRF) | 2009 | Reciprocal rank fusion |

## Open Source Tools to Evaluate

| Tool | Purpose |
|------|---------|
| **NetworkX / igraph** | Community detection (Leiden algorithm) |
| **RAGAS** | Skill quality evaluation framework |
| **Graphiti** (Zep, OSS) | If skill relationships need temporal tracking |
| **LangChain GraphRAG** | Community detection pipeline toolkit |