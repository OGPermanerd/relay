# Research Summary: Relay v1.3

**Project:** Relay Internal Skill Marketplace
**Domain:** Developer Tool Catalog / Internal Platform
**Researched:** 2026-02-02
**Confidence:** HIGH

## Executive Summary

Relay v1.3 adds AI-driven quality and discovery capabilities to an existing Next.js/PostgreSQL skill marketplace. The research reveals a clear technical path: use pgvector with Voyage AI embeddings as the foundation for both AI review context and semantic similarity detection, integrate Claude API via `@anthropic-ai/sdk` for skill reviews, and extend the existing fork-like versioning model to formalize fork relationships. Cross-platform install requires generating platform-specific MCP configs (Claude Code, Cursor, Windsurf) and addressing OS-specific path variations.

The recommended approach prioritizes embeddings infrastructure first, since both AI review (needs similar skills for context) and duplicate detection depend on semantic search. This creates a natural implementation order: embeddings → similarity detection → AI review → fork formalization → cross-platform configs. All features integrate cleanly with the existing architecture—server-side operations via Server Actions, no client bundle impact, and pgvector stays within the existing PostgreSQL stack.

Key risks center on AI reliability (hallucinated suggestions, prompt injection), cost management (Claude API and embedding costs scale with usage), and trust erosion from false positives in duplicate detection. Mitigations include advisory-only AI features (never blocking), comprehensive input sanitization, budget caps with circuit breakers, and high similarity thresholds tuned empirically. The fork model risk is proliferation creating discovery chaos; address with parent/fork hierarchy in UI and "best fork" signals.

## Key Findings

### Recommended Stack

v1.3 requires three new dependencies that integrate cleanly with the existing Next.js 15 + PostgreSQL + Drizzle stack. All are server-side only with no client bundle impact.

**Core technologies:**
- **`@anthropic-ai/sdk` ^0.71.2** — Claude API for AI skill review. Official TypeScript SDK with streaming, supports `claude-sonnet-4-5-20250929` model. Cost-effective with Haiku for initial review (~$0.002 per skill).
- **`voyageai` ^0.1.0** — Voyage AI embeddings for semantic similarity. Anthropic-recommended provider, `voyage-code-3` model optimized for code/technical content (1024 dimensions, $0.18/1M tokens with 200M free tier). Outperforms OpenAI for skill content.
- **`pgvector` ^0.2.0** — Node.js types for PostgreSQL vector extension. Enables semantic search without separate vector database. HNSW index provides fast approximate nearest neighbor search. Stays within existing PostgreSQL infrastructure.

**Database changes:**
- Enable pgvector extension (`CREATE EXTENSION vector`)
- Add `embedding vector(1024)` column with HNSW index for cosine similarity
- Add `forkedFromId`, `forkCount` for fork relationships
- Add `aiReviewStatus`, `aiReviewResult` for review tracking

**What NOT to add:**
- Pinecone/Weaviate (pgvector handles scale, no new infrastructure needed)
- Semgrep/SAST tools (skills are prompts/configs, not executable code; Claude provides contextual security review)
- LangChain (direct SDK usage is simpler)
- OpenAI embeddings (Voyage is Anthropic-recommended, voyage-code-3 outperforms text-embedding-3-small for code)

### Expected Features

**Must have (table stakes):**
- **AI review on demand** — Button-triggered review (not automatic) with structured feedback (functionality, security, quality)
- **Similarity detection on publish** — Advisory warning showing 3-5 most similar skills with percentage, never blocking submission
- **Fork with attribution** — Copy skill with `forkedFromId` reference, display "Forked from X" and fork count
- **Cross-platform configs** — Generate Claude Code, Cursor, Windsurf configs with OS-specific paths

**Should have (competitive):**
- **Review history** — Store past reviews with timestamps to track improvement
- **Similarity bypass** — Let authors publish anyway with acknowledgment
- **Fork comparison** — Side-by-side diff between fork and parent
- **Platform auto-detect** — Show relevant install option first

**Defer (v2+):**
- **Batch review for authors** — Review all skills at once (complex queue management)
- **Upstream sync notifications** — Alert fork authors when parent updates (high complexity)
- **Claude.ai web integration** — Remote MCP requires Anthropic partnership
- **VS Code extension marketplace** — Separate project requiring extension development

### Architecture Approach

All v1.3 features integrate with existing Next.js 15 App Router + Server Components architecture. AI operations happen server-side via Server Actions, keeping API keys secure. pgvector extends PostgreSQL (no new database), and embedding generation occurs at skill creation time (not query time).

**Major components:**
1. **Embeddings service** (`apps/web/lib/embeddings.ts`) — Generate Voyage embeddings for skill content, cache in PostgreSQL, pre-compute on save
2. **AI review service** (`apps/web/lib/ai-review.ts`) — Claude API calls with sanitized skill content, structured prompts for functionality/security/quality assessment
3. **Similarity search** (`apps/web/lib/search-skills.ts`) — Vector search using Drizzle + pgvector cosine distance, returns top-N similar skills above threshold
4. **Fork actions** (`apps/web/app/actions/skills.ts`) — Server Actions for fork creation with parent reference, fork count updates
5. **Config generators** (`apps/web/lib/config-generators.ts`) — Multi-platform MCP config generation with OS-specific paths

**Data flow patterns:**
- Embeddings computed once at skill creation, stored alongside metadata
- AI review triggered explicitly by user, runs async, updates `aiReviewStatus` field
- Similarity check runs on publish, queries pgvector index, shows advisory UI
- Fork creates new skill with `forkedFromId`, increments parent counter
- Install button generates platform config on-demand, copies to clipboard

### Critical Pitfalls

Top 5 risks based on v1.3 research (all addressable with proper implementation):

1. **AI Review Hallucinated Suggestions** — Claude may generate plausible but incorrect advice. Mitigation: Frame as "advisory only" in UI, display confidence signals, require author acknowledgment, enable "flag as unhelpful" button.

2. **Prompt Injection via Skill Content** — Malicious skills embed hidden instructions that manipulate review behavior. Mitigation: Sanitize skill content before review prompt, use structured prompts with clear delimiters, validate output for suspicious patterns, rate limit per author.

3. **AI Review Cost Explosion** — Long skills and verbose responses multiply token costs unpredictably. Mitigation: Hard budget caps with alerts at 50/75/90%, circuit breakers for graceful degradation, prompt compression, cache reviews for unchanged content, leverage prompt caching for 5x effective throughput.

4. **Semantic Similarity False Positives** — Generic boilerplate triggers high similarity despite functional differences, eroding trust. Mitigation: Advisory only (never block), show similarity score for author judgment, start with very high threshold (0.85+), track dismiss rate, tune empirically.

5. **Fork Proliferation Creates Discovery Chaos** — Popular skills spawn dozens of near-identical forks, cluttering search results. Mitigation: Require meaningful fork description, surface parent/fork hierarchy in UI, show "best fork" signals (highest rated/most used), default search to show parents with expand option.

## Implications for Roadmap

Based on dependency analysis, the research reveals a natural implementation order:

### Phase 1: Embeddings Foundation
**Rationale:** Both AI review (needs similar skills for context) and duplicate detection depend on semantic search. Implementing embeddings first enables both features and avoids rework.

**Delivers:**
- pgvector extension enabled in PostgreSQL
- `embedding vector(1024)` column with HNSW index
- `embeddings.ts` service with Voyage AI integration
- Semantic search function in `search-skills.ts`
- Backfill script for existing skills

**Tech from STACK.md:** `voyageai`, `pgvector`, Drizzle custom vector type

**Avoids:** Pitfall #25 (embedding computation at query time) by pre-computing on save

**Research needs:** Standard integration pattern, skip `/gsd:research-phase`

---

### Phase 2: Semantic Similarity Detection
**Rationale:** Builds on embeddings infrastructure, provides standalone value for duplicate prevention, and generates training data (dismiss rates) for threshold tuning.

**Delivers:**
- `findSimilarSkills()` function with configurable threshold
- Advisory UI component showing top 3-5 similar skills on publish
- Similarity percentage display
- "Publish anyway" bypass with acknowledgment
- Dismiss tracking for false positive monitoring

**Addresses features:** Table stakes similarity detection, bypass option

**Avoids:** Pitfall #23 (false positives damage trust) by starting advisory-only with high threshold

**Research needs:** Threshold tuning based on user feedback, may need `/gsd:research-phase` for domain-specific patterns

---

### Phase 3: AI Review Pipeline
**Rationale:** Uses similarity results to provide context in review prompts, improving review quality. Depends on embeddings from Phase 1.

**Delivers:**
- `ai-review.ts` service with Claude API integration
- Review schema columns (`aiReviewStatus`, `aiReviewResult`)
- Server Action for on-demand review trigger
- Review feedback UI on skill detail page
- Cost monitoring and budget alerts
- Input sanitization for prompt injection prevention

**Tech from STACK.md:** `@anthropic-ai/sdk`, Claude Sonnet/Haiku models

**Addresses features:** Table stakes AI review, review history

**Avoids:** Pitfall #19 (hallucination), #20 (prompt injection), #21 (cost explosion), #22 (rate limits)

**Research needs:** Prompt engineering for skill-specific review, likely needs `/gsd:research-phase` for security patterns

---

### Phase 4: Fork-Based Versioning
**Rationale:** Simple schema changes with no external dependencies. Can be implemented independently of AI features.

**Delivers:**
- `forkedFromId`, `forkCount`, `forkReason` columns
- Fork creation Server Action
- Fork button UI component
- Parent/fork display in skill cards and detail page
- Fork list on parent skill page

**Addresses features:** Table stakes fork with attribution, fork count display

**Avoids:** Pitfall #26 (fork proliferation) by requiring fork reason and showing hierarchy, #27 (orphaned chains) by using soft delete

**Research needs:** Standard pattern, skip `/gsd:research-phase`

---

### Phase 5: Cross-Platform Install Configs
**Rationale:** Independent feature with no dependencies on other v1.3 work. Can be parallelized or deferred without blocking other phases.

**Delivers:**
- `config-generators.ts` with platform-specific formats (Claude Code, Cursor, Windsurf)
- Platform selection modal UI
- OS detection for path generation (macOS, Windows, Linux)
- Enhanced install button with platform options
- MCP tool extension for multi-platform support

**Tech from STACK.md:** Existing MCP server, platform-specific config formats

**Addresses features:** Table stakes cross-platform configs, auto-detect

**Avoids:** Pitfall #29 (config format mismatch), #30 (path/permission issues), #31 (version incompatibility)

**Research needs:** Platform config formats well-documented, skip `/gsd:research-phase`

---

### Phase Ordering Rationale

- **Embeddings first** — Foundation for both similarity and AI review; implementing later requires migration
- **Similarity before review** — Provides immediate value, generates user feedback for threshold tuning, and produces training data for AI review prompts
- **Review after similarity** — Benefits from similar skills context in prompt, improving review quality
- **Fork after AI features** — Independent, no dependencies, can be parallelized
- **Cross-platform last** — Completely independent, can ship incrementally per platform

### Research Flags

**Needs deeper research during planning:**
- **Phase 3 (AI Review):** Security patterns for prompt injection mitigation, cost optimization strategies, prompt engineering for skill-specific review formats
- **Phase 2 (Similarity):** Domain-specific threshold tuning may require experimentation

**Standard patterns (skip research-phase):**
- **Phase 1 (Embeddings):** Drizzle pgvector integration is well-documented
- **Phase 4 (Fork):** Standard database relationship pattern
- **Phase 5 (Cross-Platform):** Config formats documented by platform vendors

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official docs for all dependencies, verified npm packages, Context7 library coverage |
| Features | HIGH | Multiple corroborating sources, OWASP guidelines for security, established patterns from GitHub/marketplace domains |
| Architecture | HIGH | Existing codebase analysis shows clean integration points, Server Component patterns already established |
| Pitfalls | HIGH | Verified via official security docs (MCP, OWASP), AI reliability research, production failure case studies |

**Overall confidence:** HIGH

### Gaps to Address

- **Embedding model longevity:** Voyage AI is relatively new. Plan for model migration from day one (store model version alongside embeddings, preserve original text for re-embedding).

- **AI review quality validation:** Initial prompt engineering will require iteration. Plan for A/B testing review prompts and tracking user satisfaction (helpfulness ratings).

- **Similarity threshold tuning:** Optimal threshold depends on corpus characteristics. Start at 0.85, monitor dismiss rate, adjust based on user feedback.

- **Fork ecosystem evolution:** Unknown how users will adopt forking vs. versioning. Monitor fork patterns, be prepared to adjust hierarchy display or introduce consolidation tools.

- **Cross-platform maintenance burden:** Each platform may change config formats independently. Establish monitoring for platform updates, plan for config generator updates.

## Sources

### Primary (HIGH confidence)
- **Context7 Libraries:**
  - `@anthropic-ai/sdk` official docs — v0.71.x features, streaming, tool use
  - Voyage AI embeddings docs — Model selection, pricing, input types
  - pgvector GitHub — v0.8.1 features, HNSW indexes, distance functions
  - Drizzle pgvector guide — Custom vector type, cosineDistance function
  - MCP Streamable HTTP spec — Transport protocol
  - MCP TypeScript SDK — v1.x production usage
  - Claude Code MCP setup — CLI commands
  - Cursor Rules documentation — .mdc format specification

- **Official Documentation:**
  - Claude API Rate Limits — Token bucket algorithm, retry-after headers
  - OWASP LLM Top 10 — Prompt injection (#1), security vulnerabilities
  - Next.js Server/Client Components — Hybrid rendering patterns
  - GitHub fork a repo — Standard fork behavior and UX

### Secondary (MEDIUM confidence)
- MCP Security Best Practices (Practical DevSecOps) — Prompt injection vectors
- Semantic Deduplication (NVIDIA NeMo) — Cosine similarity thresholds
- LLM Cost Management (Kosmoy) — Budget optimization strategies
- Vector Search Best Practices (Databricks) — Index tuning
- Understanding MCP Servers Across Platforms (DEV Community) — Config format differences

### Tertiary (LOW confidence, needs validation)
- Fork attribution patterns — Derived from open source contribution norms
- Platform version compatibility — Inferred from general cross-platform development patterns

---

*Research completed: 2026-02-02*
*Ready for roadmap: yes*
