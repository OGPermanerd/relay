import { db } from "../client";
import { sql } from "drizzle-orm";
import { visibilitySQL } from "../lib/visibility";

export interface HybridSearchResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  authorId: string | null;
  ftRank: number | null;
  smRank: number | null;
  rrfScore: number;
}

/**
 * Hybrid search combining full-text (tsvector) and semantic (pgvector) via RRF.
 * Uses k=60 (industry standard). Each CTE limited to 20 results.
 * FULL OUTER JOIN ensures results from either method are included.
 */
export async function hybridSearchSkills(params: {
  query: string;
  queryEmbedding: number[];
  userId?: string;
  limit?: number;
}): Promise<HybridSearchResult[]> {
  if (!db) return [];
  const { query, queryEmbedding, userId, limit = 10 } = params;
  const vectorStr = `[${queryEmbedding.join(",")}]`;
  const vis = visibilitySQL(userId);

  const results = await db.execute(sql`
    WITH full_text AS (
      SELECT s.id, s.name, s.slug, s.description, s.category,
             s.total_uses, s.average_rating, s.author_id,
             row_number() OVER (
               ORDER BY ts_rank(s.search_vector, websearch_to_tsquery('english', ${query})) DESC
             ) AS rank_ix
      FROM skills s
      WHERE s.search_vector @@ websearch_to_tsquery('english', ${query})
        AND s.status = 'published'
        AND ${vis}
      ORDER BY rank_ix
      LIMIT 20
    ),
    semantic AS (
      SELECT s.id, s.name, s.slug, s.description, s.category,
             s.total_uses, s.average_rating, s.author_id,
             row_number() OVER (
               ORDER BY se.embedding <=> ${vectorStr}::vector
             ) AS rank_ix
      FROM skill_embeddings se
      JOIN skills s ON s.id = se.skill_id
      WHERE s.status = 'published'
        AND ${vis}
      ORDER BY rank_ix
      LIMIT 20
    )
    SELECT
      COALESCE(ft.id, sm.id) AS id,
      COALESCE(ft.name, sm.name) AS name,
      COALESCE(ft.slug, sm.slug) AS slug,
      COALESCE(ft.description, sm.description) AS description,
      COALESCE(ft.category, sm.category) AS category,
      COALESCE(ft.total_uses, sm.total_uses) AS total_uses,
      COALESCE(ft.average_rating, sm.average_rating) AS average_rating,
      COALESCE(ft.author_id, sm.author_id) AS author_id,
      ft.rank_ix AS ft_rank,
      sm.rank_ix AS sm_rank,
      COALESCE(1.0 / (60 + ft.rank_ix), 0.0) +
      COALESCE(1.0 / (60 + sm.rank_ix), 0.0) AS rrf_score
    FROM full_text ft
    FULL OUTER JOIN semantic sm ON ft.id = sm.id
    ORDER BY rrf_score DESC
    LIMIT ${limit}
  `);

  return (results as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description),
    category: String(row.category),
    totalUses: Number(row.total_uses) || 0,
    averageRating: row.average_rating != null ? Number(row.average_rating) : null,
    authorId: row.author_id ? String(row.author_id) : null,
    ftRank: row.ft_rank != null ? Number(row.ft_rank) : null,
    smRank: row.sm_rank != null ? Number(row.sm_rank) : null,
    rrfScore: Number(row.rrf_score) || 0,
  }));
}

/**
 * Keyword-only search fallback when semantic search is unavailable.
 * Uses the same tsvector full-text search with ILIKE fallback.
 */
export async function keywordSearchSkills(params: {
  query: string;
  userId?: string;
  limit?: number;
}): Promise<HybridSearchResult[]> {
  if (!db) return [];
  const { query, userId, limit = 10 } = params;
  const vis = visibilitySQL(userId);
  const likePattern = `%${query}%`;

  const results = await db.execute(sql`
    SELECT s.id, s.name, s.slug, s.description, s.category,
           s.total_uses, s.average_rating, s.author_id,
           row_number() OVER (
             ORDER BY ts_rank(s.search_vector, websearch_to_tsquery('english', ${query})) DESC
           ) AS rank_ix
    FROM skills s
    WHERE s.status = 'published'
      AND ${vis}
      AND (
        s.search_vector @@ websearch_to_tsquery('english', ${query})
        OR s.name ILIKE ${likePattern}
        OR s.description ILIKE ${likePattern}
      )
    ORDER BY rank_ix
    LIMIT ${limit}
  `);

  return (results as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description),
    category: String(row.category),
    totalUses: Number(row.total_uses) || 0,
    averageRating: row.average_rating != null ? Number(row.average_rating) : null,
    authorId: row.author_id ? String(row.author_id) : null,
    ftRank: Number(row.rank_ix),
    smRank: null,
    rrfScore: 1.0 / (60 + Number(row.rank_ix)),
  }));
}
