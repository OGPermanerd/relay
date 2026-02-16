# Phase 72: Community Detection - Research

**Researched:** 2026-02-16
**Domain:** Graph-based community detection on vector embeddings (pgvector + graphology)
**Confidence:** HIGH

## Summary

This phase clusters published skills into thematic communities using embedding similarity. The approach has three stages: (1) build a KNN similarity graph in PostgreSQL using pgvector's HNSW index via LATERAL JOIN to avoid quadratic CROSS JOIN, (2) run the Louvain community detection algorithm in-process using the `graphology` + `graphology-communities-louvain` JavaScript libraries, and (3) persist community assignments to a new `skill_communities` table with tenant isolation.

The project already has 211 skill embeddings (768-dim, nomic-embed-text model) with an HNSW index using `vector_cosine_ops`. pgvector 0.6.0 is installed. The existing `db.execute(sql`...`)` pattern for raw SQL queries is well-established (see `hybrid-search.ts`). The cron endpoint pattern is also well-established (`/api/cron/daily-digest`, `/api/cron/integrity-check`) with CRON_SECRET Bearer auth.

The key architectural decision is to use K=10 nearest neighbors per skill to build edges, with a minimum cosine similarity threshold of 0.3 to prune weak edges. This keeps the graph sparse enough for fast Louvain execution while preserving meaningful relationships. For 200 skills, this means at most 2,000 edges -- well within graphology's fast performance range (benchmarks show 1,000 nodes in 52ms).

**Primary recommendation:** Use pgvector LATERAL JOIN for KNN edge extraction, graphology UndirectedGraph + graphology-communities-louvain for in-memory clustering, persist results to a `skill_communities` table, and expose via a `/api/cron/community-detection` endpoint.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| graphology | 0.26.0 | In-memory graph data structure | De facto JS graph library, TypeScript support, used by sigma.js |
| graphology-communities-louvain | 2.0.2 | Louvain community detection algorithm | Only maintained JS Louvain implementation, part of graphology ecosystem |
| graphology-types | 0.24.8 | TypeScript type declarations | Peer dependency of graphology |
| pgvector (existing) | 0.6.0 | Vector similarity via HNSW index | Already installed, HNSW index already exists on skill_embeddings |
| drizzle-orm (existing) | 0.42.0 | ORM + raw SQL execution | Already in use, `db.execute(sql`...`)` pattern established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| graphology-utils | (transitive) | Graph utility functions | Pulled in by louvain, no direct install needed |
| graphology-indices | (transitive) | Index data structures | Pulled in by louvain, no direct install needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| graphology-communities-louvain | Hand-rolled Louvain (~300 lines) | Graphology is only ~50KB, well-tested; hand-rolling risks bugs in modularity calculation |
| graphology-communities-louvain | Leiden algorithm | No maintained JS Leiden implementation; Louvain is sufficient for <1000 node graphs |
| LATERAL JOIN KNN | CROSS JOIN all-pairs | CROSS JOIN is O(n^2) and cannot use HNSW index; LATERAL preserves index usage |

**Installation:**
```bash
cd /home/dev/projects/relay/packages/db && pnpm add graphology graphology-communities-louvain graphology-types
```

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/
  schema/
    skill-communities.ts     # New table: skill_communities
  services/
    community-detection.ts   # Core detection logic (KNN fetch, graph build, Louvain, persist)
  migrations/
    0040_create_skill_communities.sql  # Migration for new table

apps/web/app/api/cron/
  community-detection/
    route.ts                 # Cron endpoint to trigger detection
```

### Pattern 1: LATERAL JOIN for KNN Edge Extraction
**What:** Fetch K nearest neighbors per skill using pgvector's HNSW index, avoiding quadratic CROSS JOIN
**When to use:** Building the similarity graph from embeddings
**Example:**
```typescript
// Source: pgvector docs + PostGIS LATERAL JOIN pattern
const edges = await db.execute(sql`
  SELECT
    a.skill_id AS source_id,
    neighbors.skill_id AS target_id,
    1 - (a.embedding <=> neighbors.embedding) AS similarity
  FROM skill_embeddings a
  JOIN LATERAL (
    SELECT b.skill_id, b.embedding
    FROM skill_embeddings b
    WHERE b.skill_id != a.skill_id
      AND b.tenant_id = a.tenant_id
    ORDER BY a.embedding <=> b.embedding
    LIMIT ${K}
  ) neighbors ON true
  WHERE a.tenant_id = ${tenantId}
    AND 1 - (a.embedding <=> neighbors.embedding) >= ${minSimilarity}
`);
```

### Pattern 2: In-Memory Graph Construction + Louvain
**What:** Build an UndirectedGraph from edge list, run Louvain, extract community assignments
**When to use:** After fetching KNN edges from PostgreSQL
**Example:**
```typescript
// Source: graphology docs + graphology-communities-louvain docs
import { UndirectedGraph } from 'graphology';
import louvain from 'graphology-communities-louvain';

const graph = new UndirectedGraph();

// Add edges (nodes added implicitly by mergeEdge)
for (const edge of edges) {
  graph.mergeEdge(edge.source_id, edge.target_id, {
    weight: edge.similarity,
  });
}

// Run Louvain with resolution tuning
const details = louvain.detailed(graph, {
  resolution: 1.0,  // Default; increase for more granular communities
});

// details.communities: { [skillId: string]: number }
// details.count: number of communities
// details.modularity: quality score (-0.5 to 1.0)
```

### Pattern 3: Atomic Community Refresh with Double-Buffering
**What:** Replace community assignments atomically to avoid serving stale/partial data during refresh
**When to use:** Persisting community detection results
**Example:**
```typescript
// Source: Project pattern from integrity-check cron
await db.transaction(async (tx) => {
  // Delete old assignments for this tenant
  await tx.execute(sql`
    DELETE FROM skill_communities WHERE tenant_id = ${tenantId}
  `);

  // Insert new assignments in bulk
  if (assignments.length > 0) {
    await tx.insert(skillCommunities).values(assignments);
  }
});
```

### Pattern 4: Cron Endpoint with CRON_SECRET Auth
**What:** HTTP GET endpoint with Bearer token auth, matching existing cron pattern
**When to use:** Triggering community detection refresh
**Example:**
```typescript
// Source: apps/web/app/api/cron/daily-digest/route.ts (existing pattern)
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ skipped: true, reason: "CRON_SECRET not configured" });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... run detection
}
```

### Anti-Patterns to Avoid
- **CROSS JOIN for similarity:** Never `SELECT ... FROM skill_embeddings a, skill_embeddings b WHERE a.id < b.id`. This is O(n^2) and cannot use the HNSW index. With 200 skills, this generates 19,900 pairs; with 1,000 skills it becomes 499,500 pairs.
- **Running detection on every request:** Community detection is expensive. Run it via cron (daily or on-demand), serve cached results from the database.
- **Global detection across tenants:** Always scope by `tenant_id`. Never cluster skills from different tenants together (violates tenant isolation).
- **Treating community IDs as stable:** Louvain assigns arbitrary integer community IDs that change between runs. Never store references to specific community IDs externally -- only store the current assignment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Community detection algorithm | Custom modularity optimization | graphology-communities-louvain | Louvain has subtle edge cases (resolution limit, oscillation); library is battle-tested |
| In-memory graph structure | Custom adjacency list | graphology UndirectedGraph | Need weighted edges, merge semantics, TypeScript types |
| KNN similarity extraction | Application-level cosine distance loops | pgvector LATERAL JOIN + HNSW index | Database handles the heavy vector math with hardware-optimized operations |
| Edge deduplication | Manual tracking of (A,B) vs (B,A) | graphology's mergeEdge | UndirectedGraph handles bidirectional edge deduplication automatically |

**Key insight:** The graph construction and community detection are well-solved problems. The engineering challenge is the glue: extracting KNN edges efficiently from pgvector, feeding them into graphology, and persisting results with proper tenant isolation.

## Common Pitfalls

### Pitfall 1: Quadratic CROSS JOIN for Similarity Graph
**What goes wrong:** Using `FROM embeddings a CROSS JOIN embeddings b` to compute all pairwise similarities. For N=200, this is 40,000 distance computations; for N=1000, it's 1,000,000.
**Why it happens:** Naive approach to "find all similar pairs."
**How to avoid:** Use LATERAL JOIN with LIMIT K per skill. This leverages the HNSW index and is O(N * K * log(N)) instead of O(N^2).
**Warning signs:** Query taking >5 seconds, high memory usage.

### Pitfall 2: Single Giant Community on Sparse Graphs
**What goes wrong:** Louvain assigns all skills to one community when the graph is too dense (every skill connected to every other) or too sparse (too few edges to form structure).
**Why it happens:** Minimum similarity threshold too low (everything connected) or too high (too few edges).
**How to avoid:** Use a minimum similarity threshold of 0.3 for edge creation. If fewer than 20 skills have embeddings, skip detection and return gracefully. Validate `details.count > 1` or modularity > 0.1 as a sanity check.
**Warning signs:** `details.count === 1` or `details.modularity < 0.1`.

### Pitfall 3: Inconsistent Community Assignments During Refresh
**What goes wrong:** If you delete old communities and insert new ones non-atomically, queries during the gap see no communities or partial data.
**Why it happens:** Not wrapping delete + insert in a transaction.
**How to avoid:** Use a single database transaction for the delete-then-insert cycle.
**Warning signs:** Intermittent "no communities found" errors in the UI.

### Pitfall 4: Forgetting Tenant Isolation
**What goes wrong:** Clustering skills across tenants, producing communities that mix different organizations' data.
**Why it happens:** Missing `WHERE tenant_id = $1` in the KNN query.
**How to avoid:** Always filter by `tenant_id` in the LATERAL JOIN query. The `skill_communities` table must also have `tenant_id` with RLS policy.
**Warning signs:** Community containing skills from multiple organizations.

### Pitfall 5: Not Filtering by Published Status + Visibility
**What goes wrong:** Private/draft skills included in communities, exposing them in community views.
**Why it happens:** Using all embeddings rather than filtering to published, org-visible skills.
**How to avoid:** Join with `skills` table and filter `status = 'published'` and `visibility IN ('global_approved', 'tenant')` before building edges.
**Warning signs:** Draft skills appearing in community listings.

### Pitfall 6: graphology Import Issues in ESM/CJS Environment
**What goes wrong:** `import Graph from 'graphology'` fails or returns undefined.
**Why it happens:** graphology ships both CJS and ESM; Next.js + Drizzle package may have module resolution conflicts.
**How to avoid:** Use named imports: `import { UndirectedGraph } from 'graphology'`. This works reliably in both ESM and CJS contexts. The community detection service lives in `packages/db` which is `"type": "module"`.
**Warning signs:** `TypeError: Graph is not a constructor` or `Cannot find module`.

## Code Examples

### Complete KNN Edge Extraction Query
```typescript
// Source: pgvector HNSW docs + PostGIS LATERAL JOIN pattern
// Fetch top-K nearest neighbors per skill within a tenant

const K = 10;
const MIN_SIMILARITY = 0.3;

const edgeRows = await db.execute(sql`
  SELECT
    a.skill_id AS source_id,
    nn.skill_id AS target_id,
    (1 - (a.embedding <=> nn.embedding))::float AS similarity
  FROM skill_embeddings a
  JOIN skills sa ON sa.id = a.skill_id
  JOIN LATERAL (
    SELECT b.skill_id, b.embedding
    FROM skill_embeddings b
    JOIN skills sb ON sb.id = b.skill_id
    WHERE b.skill_id != a.skill_id
      AND b.tenant_id = a.tenant_id
      AND sb.status = 'published'
      AND sb.visibility IN ('global_approved', 'tenant')
    ORDER BY a.embedding <=> b.embedding
    LIMIT ${K}
  ) nn ON true
  WHERE a.tenant_id = ${tenantId}
    AND sa.status = 'published'
    AND sa.visibility IN ('global_approved', 'tenant')
    AND (1 - (a.embedding <=> nn.embedding)) >= ${MIN_SIMILARITY}
`);
```

### Complete Louvain Clustering
```typescript
// Source: graphology docs, graphology-communities-louvain docs
import { UndirectedGraph } from 'graphology';
import louvain from 'graphology-communities-louvain';

interface Edge { source_id: string; target_id: string; similarity: number; }

function clusterSkills(edges: Edge[]): {
  communities: Record<string, number>;
  count: number;
  modularity: number;
} {
  const graph = new UndirectedGraph();

  for (const edge of edges) {
    // mergeEdge auto-creates nodes and deduplicates undirected edges
    graph.mergeEdge(edge.source_id, edge.target_id, {
      weight: edge.similarity,
    });
  }

  // Bail out for trivial graphs
  if (graph.order < 3) {
    return { communities: {}, count: 0, modularity: 0 };
  }

  const details = louvain.detailed(graph, {
    resolution: 1.0,
  });

  return {
    communities: details.communities,
    count: details.count,
    modularity: details.modularity,
  };
}
```

### Schema: skill_communities Table
```typescript
// Source: Existing project patterns (skill-embeddings.ts, user-skill-views.ts)
import { pgTable, text, integer, real, timestamp, index, uniqueIndex, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { skills } from "./skills";
import { tenants } from "./tenants";

export const skillCommunities = pgTable(
  "skill_communities",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    skillId: text("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    communityId: integer("community_id").notNull(), // Louvain-assigned community index
    communityLabel: text("community_label"), // Optional human-readable label (future)
    modularity: real("modularity"), // Overall modularity score for this detection run
    detectedAt: timestamp("detected_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("skill_communities_tenant_skill_unique").on(table.tenantId, table.skillId),
    index("skill_communities_tenant_id_idx").on(table.tenantId),
    index("skill_communities_community_idx").on(table.tenantId, table.communityId),
    pgPolicy("tenant_isolation", {
      as: "restrictive",
      for: "all",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)`,
    }),
  ]
);

export type SkillCommunity = typeof skillCommunities.$inferSelect;
export type NewSkillCommunity = typeof skillCommunities.$inferInsert;
```

### Migration SQL
```sql
-- Migration 0040_create_skill_communities.sql
CREATE TABLE IF NOT EXISTS skill_communities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  community_id INTEGER NOT NULL,
  community_label TEXT,
  modularity REAL,
  detected_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX skill_communities_tenant_skill_unique ON skill_communities(tenant_id, skill_id);
CREATE INDEX skill_communities_tenant_id_idx ON skill_communities(tenant_id);
CREATE INDEX skill_communities_community_idx ON skill_communities(tenant_id, community_id);

ALTER TABLE skill_communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON skill_communities
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All-pairs cosine similarity (CROSS JOIN) | KNN via LATERAL JOIN + HNSW index | pgvector 0.5+ (2023) | O(N*K*logN) instead of O(N^2) |
| Python sidecar for NetworkX/igraph | graphology in-process JS | graphology 0.25+ (2023) | No Python dependency, same runtime as app |
| IVFFlat indexes | HNSW indexes | pgvector 0.5.0 (Aug 2023) | Better recall, no need to retrain after inserts |

**Deprecated/outdated:**
- `graphology-communities` (luccitan/graphology-communities): OBSOLETE. Replaced by `graphology-communities-louvain` in the main graphology org.
- IVFFlat indexes for vector search: HNSW is preferred for this use case (already using HNSW in the project).

## Open Questions

1. **Optimal K value and minimum similarity threshold**
   - What we know: K=10 is standard for small graphs (<1000 nodes). Minimum similarity of 0.3 should prune noise.
   - What's unclear: With 768-dim nomic-embed-text embeddings, the typical similarity distribution is unknown. Threshold may need tuning.
   - Recommendation: Start with K=10, minSimilarity=0.3, log the actual similarity distribution in the first run, adjust if communities are too few or too many.

2. **Resolution parameter tuning**
   - What we know: Resolution=1.0 is default. Higher values produce more communities. With 145 published skills, expecting 5-15 communities.
   - What's unclear: Optimal resolution depends on the actual embedding space distribution.
   - Recommendation: Start with resolution=1.0, expose as a parameter in the service function for future tuning without code changes.

3. **Community labeling strategy**
   - What we know: Louvain only assigns numeric IDs. Human-readable labels require post-processing (e.g., extracting common tags/categories from community members).
   - What's unclear: Whether to generate labels now or defer.
   - Recommendation: Store `communityLabel` as nullable text in schema. Defer label generation to a future phase. The `community_id` integer is sufficient for grouping.

4. **Multi-tenant cron execution**
   - What we know: Current cron endpoints don't iterate over tenants. Single-tenant deployment uses DEFAULT_TENANT_ID.
   - What's unclear: Whether to detect communities for all tenants or just the default tenant.
   - Recommendation: Accept `tenantId` as a query parameter with DEFAULT_TENANT_ID as fallback. Future multi-tenant support can iterate tenants.

## Sources

### Primary (HIGH confidence)
- pgvector GitHub (v0.6.0) - HNSW index, cosine distance operator `<=>`, KNN query pattern
- graphology official docs (graphology.github.io) - UndirectedGraph API, mergeEdge, TypeScript types
- graphology-communities-louvain official docs - Algorithm API, options, resolution parameter, detailed return
- npm registry - graphology 0.26.0, graphology-communities-louvain 2.0.2, graphology-types 0.24.8

### Secondary (MEDIUM confidence)
- PostGIS LATERAL JOIN documentation (postgis.net/workshops) - LATERAL JOIN pattern for per-row KNN, verified applicable to pgvector
- Crunchy Data blog - Deep dive into LATERAL JOIN for nearest neighbor, confirms index usage within LATERAL subqueries

### Tertiary (LOW confidence)
- Graphology benchmark claims (1000 nodes in 52ms) - from community discussion, not formally benchmarked in this project's context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified via npm registry, APIs verified via official docs
- Architecture: HIGH - LATERAL JOIN pattern well-documented, project already uses raw SQL via `db.execute(sql`...`)`
- Pitfalls: HIGH - quadratic CROSS JOIN is a known pgvector anti-pattern, tenant isolation follows established project patterns
- Code examples: HIGH - based on existing project patterns (hybrid-search.ts, daily-digest cron, user-skill-views migration)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - stable domain, libraries are mature)

## Existing Codebase Reference

Key files the planner needs to know about:

| File | Relevance |
|------|-----------|
| `packages/db/src/schema/skill-embeddings.ts` | Embeddings schema with 768-dim vectors, HNSW index, tenant_id |
| `packages/db/src/services/semantic-search.ts` | Existing cosineDistance usage pattern |
| `packages/db/src/services/hybrid-search.ts` | Best example of `db.execute(sql`...`)` for complex queries |
| `packages/db/src/lib/visibility.ts` | Visibility filtering logic (use `orgVisibleSQL()` for community-eligible skills) |
| `packages/db/src/client.ts` | DB client with DEFAULT_TENANT_ID |
| `packages/db/src/tenant-context.ts` | `withTenant()` helper for tenant-scoped transactions |
| `packages/db/src/schema/index.ts` | Schema exports -- must add new table here |
| `packages/db/src/services/index.ts` | Service exports -- must add new service here |
| `packages/db/src/relations/index.ts` | Relations -- must add new relations here |
| `apps/web/app/api/cron/daily-digest/route.ts` | Cron endpoint pattern (CRON_SECRET auth) |
| `apps/web/app/api/cron/integrity-check/route.ts` | Cron endpoint with query params pattern |
| `packages/db/src/migrations/0039_create_user_skill_views.sql` | Most recent migration -- next is 0040 |

**Current data state:** 145 published skills, 211 embeddings (768-dim nomic-embed-text), pgvector 0.6.0 with HNSW index.
