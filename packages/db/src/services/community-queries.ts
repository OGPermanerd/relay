import { db } from "../client";
import { sql } from "drizzle-orm";

/**
 * Community query services for browse and detail pages.
 *
 * getCommunities: Overview list with member counts and top skills.
 * getCommunityDetail: Full member list with centroid similarity scores.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommunityOverview {
  communityId: number;
  label: string | null;
  description: string | null;
  memberCount: number;
  topSkills: { name: string; slug: string; category: string }[];
  modularity: number;
}

export interface CommunityDetail {
  communityId: number;
  label: string | null;
  description: string | null;
  modularity: number;
  skills: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    totalUses: number;
    averageRating: number | null;
    similarityPct: number;
  }[];
}

// ---------------------------------------------------------------------------
// getCommunities - Browse page data
// ---------------------------------------------------------------------------

export async function getCommunities(tenantId: string): Promise<CommunityOverview[]> {
  if (!db) return [];

  const rows = await db.execute(sql`
    SELECT
      sc.community_id,
      MAX(sc.community_label) AS label,
      MAX(sc.community_description) AS description,
      COUNT(*)::int AS member_count,
      MAX(sc.modularity) AS modularity,
      json_agg(
        json_build_object('name', s.name, 'slug', s.slug, 'category', s.category)
        ORDER BY s.total_uses DESC NULLS LAST
      ) AS top_skills
    FROM skill_communities sc
    JOIN skills s ON s.id = sc.skill_id
    WHERE sc.tenant_id = ${tenantId}
      AND s.status = 'published'
      AND s.visibility IN ('global_approved', 'tenant')
    GROUP BY sc.community_id
    ORDER BY member_count DESC
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    communityId: Number(r.community_id),
    label: r.label as string | null,
    description: r.description as string | null,
    memberCount: Number(r.member_count),
    topSkills: ((r.top_skills as { name: string; slug: string; category: string }[]) || []).slice(
      0,
      3
    ),
    modularity: Number(r.modularity),
  }));
}

// ---------------------------------------------------------------------------
// getCommunityDetail - Detail page data with centroid similarity
// ---------------------------------------------------------------------------

export async function getCommunityDetail(
  tenantId: string,
  communityId: number
): Promise<CommunityDetail | null> {
  if (!db) return null;

  const rows = await db.execute(sql`
    WITH community_skills AS (
      SELECT sc.skill_id
      FROM skill_communities sc
      WHERE sc.tenant_id = ${tenantId}
        AND sc.community_id = ${communityId}
    ),
    centroid AS (
      SELECT AVG(se.embedding) AS center
      FROM skill_embeddings se
      WHERE se.skill_id IN (SELECT skill_id FROM community_skills)
        AND se.tenant_id = ${tenantId}
    ),
    meta AS (
      SELECT
        MAX(sc.community_label) AS label,
        MAX(sc.community_description) AS description,
        MAX(sc.modularity) AS modularity
      FROM skill_communities sc
      WHERE sc.tenant_id = ${tenantId}
        AND sc.community_id = ${communityId}
    )
    SELECT
      s.id, s.name, s.slug, s.description, s.category,
      s.total_uses, s.average_rating,
      ROUND(100 * (1 - (se.embedding <=> c.center) / 2))::int AS similarity_pct,
      m.label, m.description AS community_description, m.modularity
    FROM community_skills cs
    JOIN skills s ON s.id = cs.skill_id
    JOIN skill_embeddings se ON se.skill_id = s.id AND se.tenant_id = ${tenantId}
    CROSS JOIN centroid c
    CROSS JOIN meta m
    WHERE s.status = 'published'
      AND s.visibility IN ('global_approved', 'tenant')
    ORDER BY se.embedding <=> c.center ASC
  `);

  const rowsTyped = rows as unknown as Record<string, unknown>[];

  if (rowsTyped.length === 0) return null;

  const first = rowsTyped[0];
  return {
    communityId,
    label: first.label as string | null,
    description: first.community_description as string | null,
    modularity: Number(first.modularity),
    skills: rowsTyped.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description),
      category: String(r.category),
      totalUses: Number(r.total_uses ?? 0),
      averageRating: r.average_rating != null ? Number(r.average_rating) : null,
      similarityPct: Number(r.similarity_pct),
    })),
  };
}
