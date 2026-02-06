# Phase 24: Extended MCP Search - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP search reaches parity with web search by matching author names and tags in addition to skill title/description. Both MCP and web search are updated together for consistency. No new capabilities — just expanding what the existing search query matches against.

</domain>

<decisions>
## Implementation Decisions

### Search matching strategy
- Case-insensitive partial matching for both author names and tags (consistent with title/description matching)
- "john" matches skills by "John Smith", "auto" matches tag "automation"
- Mirror web search logic exactly — same SQL/ILIKE approach, just add author and tag columns to the query
- Update BOTH MCP search and web search for consistency (if web is also missing author/tag matching)

### Result ranking
- Field priority: title > description > author > tags (title matches most relevant)
- Blended scoring — a strong author match can beat a weak title match, not strict tiers
- Hybrid search: ILIKE first, use embedding similarity as fallback when ILIKE returns < 3 results
- Embeddings supplement sparse ILIKE results, not always combined (cheaper, simpler)

### Search response shape
- No match reason field — just return results without indicating why they matched
- Keep current result shape unchanged — don't add author/tags to result items
- Cap results at 50 (hard limit)

### Claude's Discretion
- Exact scoring weights for field priority blending
- How to implement the embedding fallback threshold (< 3 results or different number) — note: MCP stdio has no VOYAGE_API_KEY, so embedding fallback is optional and ILIKE-only is acceptable
- SQL query structure (single query with OR clauses vs. UNION)
- Whether to use a CTE or subquery for the JOIN to authors/tags

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The goal is simple: search "john" via MCP and get back skills authored by John, just like you would on the web.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-extended-mcp-search*
*Context gathered: 2026-02-06*
