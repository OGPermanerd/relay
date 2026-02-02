# Phase 15: Embeddings Foundation - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable semantic search by generating and storing vector embeddings for all skill content. This is infrastructure for Phase 16 (Similarity Detection) and Phase 17 (AI Review). Users don't interact with embeddings directly — they enable similarity matching and AI context.

</domain>

<decisions>
## Implementation Decisions

### Embedding Scope
- Embed combined fields: name + description + content + tags concatenated
- Include tags in embedding input (adds semantic signal like 'code-review', 'documentation')
- Same embedding approach for all skill types (prompt, workflow, agent, mcp) — no type-specific preprocessing
- Full content embedded, truncate at model limit if needed (voyage-code-3 supports 16K tokens)

### Backfill Strategy
- Migration script runs during deployment, blocks until complete
- If migration fails partway through, fail the deployment (all embeddings must succeed)
- Throttle API requests during migration to avoid rate limits
- Expected volume: under 100 skills (migration will be quick)

### Model Versioning
- Store model name/version alongside each embedding vector (per-embedding tracking)
- Initial model: voyage-code-3 (Voyage's code-optimized model)
- Future model migration: gradual — new skills use new model, old skills re-embedded over time
- Allow cross-model similarity comparisons (accept some accuracy loss during transition periods)

### Claude's Discretion
- Error handling for embedding API failures on new skill publish
- Exact throttle delay between API calls during migration
- Embedding vector storage format (separate table vs column on skills)
- Index type for vector similarity queries (HNSW vs IVFFlat)

</decisions>

<specifics>
## Specific Ideas

- Research recommended Voyage AI as Anthropic's preferred embedding provider
- pgvector extension stays within PostgreSQL (no new infrastructure)
- voyage-code-3 specifically optimized for code/technical content — good fit for skills

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-embeddings-foundation*
*Context gathered: 2026-02-02*
