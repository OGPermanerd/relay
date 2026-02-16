# Research Summary: v7.0 Algorithm & Architecture Rewrite

**Domain:** AI skills marketplace -- graph-based discovery, adaptive search, temporal tracking, extended visibility, multi-model benchmarking
**Researched:** 2026-02-16
**Overall confidence:** HIGH

## Executive Summary

The v7.0 milestone adds five capabilities to EverySkill: GraphRAG community detection for skill clustering, adaptive query routing for smarter search, temporal version tracking, extended visibility levels (public/unlisted), and multi-model benchmarking (OpenAI + Google alongside existing Anthropic). Research confirms all five features integrate cleanly with the existing PostgreSQL + Drizzle + Next.js architecture without requiring new infrastructure services.

The most architecturally significant finding is that PostgreSQL handles the graph requirements without a graph database. The skill graph is small enough (hundreds to low thousands of nodes per tenant) that an adjacency-list table with in-memory Leiden clustering outperforms Neo4j at this scale, according to peer-reviewed research. This avoids adding a separate database service with its own backup, monitoring, and connection management.

The visibility extension is deceptively simple at the schema level (the column is already text, no DDL needed) but has the widest blast radius: 15+ query locations must be audited and updated. The centralized `visibility.ts` module covers 10 of those, but 5+ use hardcoded SQL strings. The audit in ARCHITECTURE.md maps every location.

Multi-model benchmarking is the most self-contained feature. The existing `benchmarkRuns` and `benchmarkResults` tables already have `modelProvider` and `models` columns -- they were designed for multi-provider from the start. The main work is a provider abstraction layer with dynamic imports and converting the synchronous server action into a background job using the existing cron pattern.

## Key Findings

**Stack:** No new infrastructure needed. PostgreSQL adjacency lists for graphs, JS Leiden implementation, dynamic-import provider abstraction for OpenAI/Google SDKs, existing cron pattern for background jobs. 3 new npm packages total.

**Architecture:** 5 new schema tables/modifications, 6 new service files, 3 new API routes, 1 library file, 15+ modified files across the monorepo. All changes are additive -- no breaking schema changes, no column type alterations, no data loss.

**Critical pitfall:** The "public" visibility level conflicts with existing RLS policies that enforce tenant isolation. Public skills need cross-tenant read access, which requires a new permissive RLS policy alongside the existing restrictive one. Getting this wrong breaks either multi-tenancy (too permissive) or public visibility (too restrictive).

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase: Temporal Tracking + Visibility Extension** (parallel, no dependencies)
   - Addresses: temporal columns on skillVersions, visibility.ts refactor, 15+ hardcoded query updates, CHECK constraint, RLS policy for public visibility
   - Avoids: dependency on community detection or query routing
   - Rationale: Schema-level foundations that other features build on. Can be done simultaneously since they touch different code paths.

2. **Phase: Community Detection** (depends on visibility being done)
   - Addresses: graph edge construction, Leiden clustering, community CRUD, AI-generated community summaries, cron job
   - Avoids: premature query routing integration
   - Rationale: Needs visibility filter updates to be in place so community queries respect new visibility levels.

3. **Phase: Query Routing** (depends on community detection)
   - Addresses: query classification, strategy selection, search enhancement, searchQueries schema extension
   - Avoids: routing to communities that don't exist yet
   - Rationale: The "community_explore" intent requires communities to exist. Also benefits from A/B testing against baseline search metrics.

4. **Phase: Multi-Model Benchmarking** (independent, placed last for practical reasons)
   - Addresses: provider abstraction, background execution, OpenAI/Google integration, pricing table extension
   - Avoids: nothing technically -- this is independent
   - Rationale: Most external dependencies (API keys, new npm packages), most expensive to iterate on (real API calls), and most self-contained.

**Phase ordering rationale:**
- Temporal + Visibility are schema foundations with zero cross-dependencies -- do them first and in parallel
- Community Detection needs visibility filters to be correct before building graph queries
- Query Routing needs communities to exist for the community_explore intent
- Multi-Model is independent but requires real API keys and costs money to test -- delay until core features are solid

**Research flags for phases:**
- Phase 2 (Communities): Likely needs deeper research on Leiden npm package API. The `louvain-leiden` package exists but its exact API, edge format, and resolution parameter handling should be verified at implementation time. MEDIUM confidence on the specific library.
- Phase 4 (Multi-Model): Needs verification of `@google/genai` SDK API for chat completions with token counting. The package was recently renamed from `@google/generative-ai` (deprecated Aug 2025). LOW confidence on exact API surface.
- Phase 1 (Temporal/Visibility): Standard patterns, unlikely to need additional research.
- Phase 3 (Query Routing): Standard patterns, unlikely to need additional research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new infrastructure, all patterns verified against existing codebase |
| Features | HIGH | All 5 features analyzed with specific schema/service/migration designs |
| Architecture | HIGH | Direct codebase analysis of all affected files, complete integration maps |
| Pitfalls | HIGH | RLS/public visibility identified as critical risk, migration strategies verified |
| Leiden library | MEDIUM | Package exists but exact API needs verification at implementation |
| Google AI SDK | MEDIUM | Package renamed recently, exact token counting API needs verification |

## Gaps to Address

- Leiden npm package API verification: install the package and test with sample data before committing to it
- Google `@google/genai` SDK: verify chat completion API returns token counts compatible with the existing measurement infrastructure
- Community label generation cost: each community needs an Anthropic API call for label/summary -- estimate cost for ~50-100 communities per tenant
- Public visibility RLS policy interaction with the existing restrictive policy: test the dual-policy approach (permissive for reads, restrictive for writes) in a staging environment before production
- Background benchmark execution: verify the cron polling pattern handles concurrent benchmark requests safely (locking/dequeue strategy)

---
*Research completed: 2026-02-16*
*Ready for roadmap: YES*
*Critical unknowns: Leiden library API (Phase 2), Google AI SDK token counting (Phase 4)*
