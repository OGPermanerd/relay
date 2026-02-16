# Requirements: EverySkill v7.0

**Defined:** 2026-02-16
**Core Value:** Protect and grow your IP. Fast. Skills get better as they pass through more hands, with real metrics proving that value.

## v7.0 Requirements

Requirements for v7.0 Algorithm & Architecture Rewrite. Each maps to roadmap phases.

### Community Detection

- [x] **COMM-01**: System clusters skills into thematic communities using embedding similarity
- [x] **COMM-02**: Each community has an AI-generated name and summary description
- [x] **COMM-03**: User can browse skill communities on a discovery page
- [x] **COMM-04**: User can view community detail page with member skills and similarity scores
- [x] **COMM-05**: Communities are persisted in the database and refreshed periodically

### Adaptive Query Routing

- [x] **ROUTE-01**: System classifies search queries as keyword, semantic, hybrid, or browse
- [x] **ROUTE-02**: Keyword queries skip embedding generation for faster results
- [x] **ROUTE-03**: Query route type is logged in search analytics
- [x] **ROUTE-04**: System falls back to hybrid if keyword search returns zero results

### Temporal Tracking

- [x] **TEMP-01**: System tracks when a user last viewed each skill
- [x] **TEMP-02**: Skill cards show "Updated" badge when skill changed since user's last view
- [x] **TEMP-03**: Skill detail page shows change summary since user's last visit
- [x] **TEMP-04**: Dashboard shows "What's New" feed of recently changed skills the user interacts with

### Extended Visibility

- [ ] **VIS-01**: Skills support 4 visibility levels: global_approved, tenant, personal, private
- [ ] **VIS-02**: Visibility filter (buildVisibilityFilter) enforces all 4 levels correctly
- [ ] **VIS-03**: Global approved skills are visible across tenants via updated RLS policy
- [ ] **VIS-04**: Author can select visibility level when creating or editing a skill
- [ ] **VIS-05**: Only admins can promote skills to global_approved
- [ ] **VIS-06**: MCP tools can read and write user search preferences
- [ ] **VIS-07**: MCP search applies user preference boosts when authenticated

### RAGAS Benchmarking

- [x] **BENCH-01**: Benchmark judge scores 4 dimensions: faithfulness, relevancy, precision, recall
- [x] **BENCH-02**: Benchmark results page shows per-dimension scores with radar chart
- [x] **BENCH-03**: Per-dimension model comparison table on benchmark results
- [x] **BENCH-04**: Aggregate dimension scores displayed per skill across benchmark runs
- [x] **BENCH-05**: Existing overall quality score remains backward-compatible

## v8.0+ Requirements (Deferred Differentiators)

### Community Detection Differentiators

- **COMM-D01**: Hierarchical communities (sub-communities within communities)
- **COMM-D02**: Community health scores (avg rating, total uses, update frequency)
- **COMM-D03**: Community evolution timeline (new skills joined this month)
- **COMM-D04**: Skill gap detection within community (missing coverage areas)
- **COMM-D05**: Community-aware search (search within community context)

### Adaptive Query Routing Differentiators

- **ROUTE-D01**: Query intent display showing search strategy used
- **ROUTE-D02**: Route performance tracking analytics
- **ROUTE-D03**: MCP-specific routing defaults (semantic-heavy)
- **ROUTE-D04**: Community-aware routing for "skills like X" queries

### Temporal Tracking Differentiators

- **TEMP-D01**: AI-generated change summaries
- **TEMP-D02**: Digest email/notification for updated skills
- **TEMP-D03**: Version diff viewer (side-by-side comparison)
- **TEMP-D04**: Temporal search ("skills updated in the last week")
- **TEMP-D05**: Usage recency weighting in What's New feed

### Extended Visibility Differentiators

- **VIS-D01**: Visibility audit trail logging who changed visibility
- **VIS-D02**: Bulk visibility management for admins
- **VIS-D03**: Visibility request workflow (author requests, admin approves)
- **VIS-D04**: Cross-tool preference learning from search patterns

### RAGAS Benchmarking Differentiators

- **BENCH-D01**: Model recommendation per skill based on dimension scores
- **BENCH-D02**: Dimension trend tracking across versions
- **BENCH-D03**: Cross-skill dimension comparison by category
- **BENCH-D04**: Automatic re-benchmark on version change
- **BENCH-D05**: Benchmark cost estimation before running

### Knowledge Topology Visualization (Backlogged)

- **TOPO-01**: Live interactive visualization of the full data shape — raw data → organized info → intelligence
- **TOPO-02**: Graph view showing skills as nodes, communities as clusters, relationships as edges
- **TOPO-03**: Multi-layer toggle (communities, entities, LLM layer)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full GraphRAG knowledge graph extraction | Skills already have structured metadata and dense embeddings — full KG extraction is overkill |
| LLM-based query classification | Rule-based handles 90%+ correctly; LLM adds 200-1000ms latency per search |
| Full bi-temporal database schema | Lightweight interaction tracking table sufficient; full temporal tables are massive migration |
| User-created communities | Manual curation defeats algorithmic discovery; categories handle manual classification |
| Real-time change notifications (WebSocket) | Skills change infrequently; passive "Updated" badge is sufficient |
| RAGAS Python library integration | Adds Python runtime dependency; TypeScript judge prompt achieves same result |
| Non-Anthropic model providers in benchmarks | Keep Anthropic-only for v7.0; multi-provider is a future milestone |
| Per-user visibility overrides | 4-level visibility is sufficient; per-user ACLs create unscalable RBAC complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMM-01 | Phase 72 | Pending |
| COMM-02 | Phase 73 | Pending |
| COMM-03 | Phase 73 | Pending |
| COMM-04 | Phase 73 | Pending |
| COMM-05 | Phase 72 | Pending |
| ROUTE-01 | Phase 74 | Complete |
| ROUTE-02 | Phase 74 | Complete |
| ROUTE-03 | Phase 74 | Complete |
| ROUTE-04 | Phase 74 | Complete |
| TEMP-01 | Phase 71 | Pending |
| TEMP-02 | Phase 71 | Pending |
| TEMP-03 | Phase 71 | Pending |
| TEMP-04 | Phase 71 | Pending |
| VIS-01 | Phase 69 | Complete |
| VIS-02 | Phase 69 | Complete |
| VIS-03 | Phase 69 | Complete |
| VIS-04 | Phase 69 | Complete |
| VIS-05 | Phase 69 | Complete |
| VIS-06 | Phase 70 | Complete |
| VIS-07 | Phase 70 | Complete |
| BENCH-01 | Phase 75 | Complete |
| BENCH-02 | Phase 75 | Complete |
| BENCH-03 | Phase 75 | Complete |
| BENCH-04 | Phase 75 | Complete |
| BENCH-05 | Phase 75 | Complete |

**Coverage:**
- v7.0 requirements: 25 total
- Mapped to phases: 25/25 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation — all 25 requirements mapped to phases 69-75*
