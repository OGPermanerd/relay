import { eq, and } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { db } from "../client";
import { skills } from "../schema/skills";
import { skillEmbeddings } from "../schema/skill-embeddings";
import { buildVisibilityFilter } from "../lib/visibility";

export interface SemanticSearchResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  similarity: number; // 0-1, higher = more similar (1 - cosineDistance)
}

/**
 * Search skills by semantic similarity using cosine distance on pgvector embeddings.
 *
 * Returns published skills ranked by cosine similarity to the query embedding.
 * Supports optional category and tenantId filters. Returns empty array gracefully
 * if database is not configured or no embeddings exist.
 *
 * @param params.queryEmbedding - The embedding vector to compare against
 * @param params.limit - Maximum results to return (default 10)
 * @param params.category - Optional category filter
 * @param params.tenantId - Optional tenant filter
 * @returns Array of skills with similarity scores, ordered by similarity descending
 */
export async function semanticSearchSkills(params: {
  queryEmbedding: number[];
  limit?: number;
  category?: string;
  tenantId?: string;
  userId?: string;
}): Promise<SemanticSearchResult[]> {
  if (!db) return [];

  const { queryEmbedding, limit = 10, category, tenantId, userId } = params;

  // Convert to pgvector string format
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // Compute cosine distance for ordering and similarity calculation
  const distance = cosineDistance(skillEmbeddings.embedding, vectorStr);

  // Build conditions: always filter to published skills (DISC-06) + visibility
  const conditions = [eq(skills.status, "published"), buildVisibilityFilter(userId)];

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  if (tenantId) {
    conditions.push(eq(skills.tenantId, tenantId));
  }

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      description: skills.description,
      category: skills.category,
      totalUses: skills.totalUses,
      averageRating: skills.averageRating,
      distance,
    })
    .from(skillEmbeddings)
    .innerJoin(skills, eq(skillEmbeddings.skillId, skills.id))
    .where(and(...conditions))
    .orderBy(distance)
    .limit(limit);

  // Convert distance to similarity (1 - distance) and strip raw distance
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    category: r.category,
    totalUses: r.totalUses,
    averageRating: r.averageRating,
    similarity: 1 - Number(r.distance),
  }));
}
