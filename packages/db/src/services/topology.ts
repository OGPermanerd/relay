import { db } from "../client";
import { sql } from "drizzle-orm";

// --- Tunable constants (match community-detection.ts) ---
const K = 10;
const MIN_SIMILARITY = 0.3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopologyNode {
  id: string;
  name: string;
  slug: string;
  category: string;
  tags: string[];
  totalUses: number;
  averageRating: number | null;
  communityId: number | null;
  communityLabel: string | null;
  /** The current user authored this skill */
  authored: boolean;
  /** The current user has used this skill (via MCP) */
  used: boolean;
}

export interface TopologyEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface TopologyCommunity {
  communityId: number;
  label: string | null;
  memberCount: number;
}

export interface TopologyResponse {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  communities: TopologyCommunity[];
  stats: { nodeCount: number; edgeCount: number; communityCount: number };
}

// ---------------------------------------------------------------------------
// getTopologyGraph - Full company-wide graph with per-user highlights
// ---------------------------------------------------------------------------

export async function getTopologyGraph(
  tenantId: string,
  userId: string
): Promise<TopologyResponse> {
  if (!db) {
    return {
      nodes: [],
      edges: [],
      communities: [],
      stats: { nodeCount: 0, edgeCount: 0, communityCount: 0 },
    };
  }

  // Nodes: ALL published skills in the tenant, with user relationship flags
  const nodeRows = await db.execute(sql`
    SELECT
      s.id,
      s.name,
      s.slug,
      s.category,
      s.tags,
      s.total_uses,
      s.average_rating,
      sc.community_id,
      sc.community_label,
      (s.author_id = ${userId})::bool AS authored,
      EXISTS (
        SELECT 1 FROM usage_events ue
        WHERE ue.skill_id = s.id AND ue.user_id = ${userId}
      )::bool AS used
    FROM skills s
    LEFT JOIN skill_communities sc ON sc.skill_id = s.id AND sc.tenant_id = s.tenant_id
    WHERE s.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.visibility IN ('global_approved', 'tenant')
  `);

  const nodes: TopologyNode[] = (nodeRows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    category: String(r.category),
    tags: (r.tags as string[]) || [],
    totalUses: Number(r.total_uses ?? 0),
    averageRating: r.average_rating != null ? Number(r.average_rating) : null,
    communityId: r.community_id != null ? Number(r.community_id) : null,
    communityLabel: (r.community_label as string) ?? null,
    authored: Boolean(r.authored),
    used: Boolean(r.used),
  }));

  if (nodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      communities: [],
      stats: { nodeCount: 0, edgeCount: 0, communityCount: 0 },
    };
  }

  // Edges: KNN via LATERAL JOIN (reuse HNSW index pattern from community-detection.ts)
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

  // Deduplicate undirected edges (A→B and B→A become one edge)
  const edgeSet = new Set<string>();
  const edges: TopologyEdge[] = [];
  for (const r of edgeRows as unknown as Array<{
    source_id: string;
    target_id: string;
    similarity: number;
  }>) {
    const key = [r.source_id, r.target_id].sort().join("|");
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({
        source: r.source_id,
        target: r.target_id,
        similarity: Number(r.similarity),
      });
    }
  }

  // Communities aggregate
  const communityMap = new Map<number, TopologyCommunity>();
  for (const node of nodes) {
    if (node.communityId != null) {
      const existing = communityMap.get(node.communityId);
      if (existing) {
        existing.memberCount++;
      } else {
        communityMap.set(node.communityId, {
          communityId: node.communityId,
          label: node.communityLabel,
          memberCount: 1,
        });
      }
    }
  }
  const communities = Array.from(communityMap.values()).sort(
    (a, b) => b.memberCount - a.memberCount
  );

  return {
    nodes,
    edges,
    communities,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      communityCount: communities.length,
    },
  };
}
