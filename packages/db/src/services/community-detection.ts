import { db } from "../client";
import { sql, eq } from "drizzle-orm";
import { skillCommunities } from "../schema";
import { UndirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";

// --- Tunable constants ---
const K = 10; // Nearest neighbors per skill
const MIN_SIMILARITY = 0.3; // Edge threshold (cosine similarity)
const MIN_SKILLS_FOR_DETECTION = 5; // Below this, skip gracefully
const RESOLUTION = 1.0; // Louvain resolution parameter (higher = more communities)

export interface CommunityDetectionResult {
  communities: number;
  modularity: number;
  skills: number;
  edges: number;
  skipped?: string;
}

/**
 * Detect skill communities for a tenant using:
 *   1. KNN edge extraction from pgvector via LATERAL JOIN
 *   2. In-memory graph construction with graphology
 *   3. Louvain community detection
 *   4. Atomic persist (delete + insert in transaction)
 *
 * Safe to call repeatedly -- each run replaces prior results atomically.
 */
export async function detectCommunities(tenantId: string): Promise<CommunityDetectionResult> {
  if (!db) {
    return {
      communities: 0,
      modularity: 0,
      skills: 0,
      edges: 0,
      skipped: "Database not configured",
    };
  }

  // Step 1: Count eligible skills
  const countResult = await db.execute(sql`
    SELECT COUNT(DISTINCT se.skill_id)::int AS cnt
    FROM skill_embeddings se
    JOIN skills s ON s.id = se.skill_id
    WHERE se.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.visibility IN ('global_approved', 'tenant')
  `);

  const skillCount = Number((countResult as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);

  if (skillCount < MIN_SKILLS_FOR_DETECTION) {
    return {
      communities: 0,
      modularity: 0,
      skills: skillCount,
      edges: 0,
      skipped: `Too few skills for community detection (${skillCount} < ${MIN_SKILLS_FOR_DETECTION})`,
    };
  }

  // Step 2: KNN edge extraction via LATERAL JOIN
  // Uses the existing HNSW index on skill_embeddings.embedding for efficient KNN
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

  const edges = edgeRows as unknown as Array<{
    source_id: string;
    target_id: string;
    similarity: number;
  }>;

  if (edges.length === 0) {
    return {
      communities: 0,
      modularity: 0,
      skills: skillCount,
      edges: 0,
      skipped: "No edges above similarity threshold",
    };
  }

  // Step 3: Build in-memory graph
  const graph = new UndirectedGraph();

  for (const edge of edges) {
    // mergeEdge auto-creates nodes and deduplicates undirected edges
    graph.mergeEdge(edge.source_id, edge.target_id, {
      weight: Number(edge.similarity),
    });
  }

  // Bail out for trivial graphs
  if (graph.order < 3) {
    return {
      communities: 0,
      modularity: 0,
      skills: graph.order,
      edges: graph.size,
      skipped: `Graph too small for community detection (${graph.order} nodes)`,
    };
  }

  // Step 4: Run Louvain community detection
  const details = louvain.detailed(graph, {
    resolution: RESOLUTION,
  });

  if (details.count <= 1 || details.modularity < 0.1) {
    console.warn(
      `[COMMUNITY DETECTION] Low quality partition: ${details.count} communities, modularity=${details.modularity.toFixed(3)}. Persisting anyway.`
    );
  }

  // Step 5: Persist atomically (delete old + insert new in one transaction)
  const now = new Date();
  const assignments = Object.entries(details.communities).map(([skillId, communityIndex]) => ({
    tenantId,
    skillId,
    communityId: communityIndex,
    modularity: details.modularity,
    detectedAt: now,
  }));

  await db.transaction(async (tx) => {
    // Delete all existing communities for this tenant
    await tx.delete(skillCommunities).where(eq(skillCommunities.tenantId, tenantId));

    // Insert new assignments
    if (assignments.length > 0) {
      await tx.insert(skillCommunities).values(assignments);
    }
  });

  return {
    communities: details.count,
    modularity: details.modularity,
    skills: graph.order,
    edges: graph.size,
  };
}
