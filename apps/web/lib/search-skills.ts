import { db, skills, users } from "@relay/db";
import { sql, eq, desc, and } from "drizzle-orm";

export interface SearchSkillResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  averageRating: number | null;
  totalRatings: number;
  hoursSaved: number | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

export interface SearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  qualityTier?: "gold" | "silver" | "bronze";
  sortBy?: "uses" | "quality" | "rating";
}

// Quality tier thresholds
const TIER_THRESHOLDS = {
  gold: { min: 75, max: 100 },
  silver: { min: 50, max: 74.99 },
  bronze: { min: 25, max: 49.99 },
} as const;

/**
 * Search skills using PostgreSQL full-text search
 *
 * When query is provided: Uses websearch_to_tsquery for parsing and ts_rank for ordering
 * When query is empty: Returns all skills ordered by totalUses descending
 *
 * Supports quality tier filtering (gold/silver/bronze) and sorting by quality score.
 *
 * @param params - Search parameters (query, category, tags, qualityTier, sortBy)
 * @returns Array of matching skills with author info
 */
export async function searchSkills(params: SearchParams): Promise<SearchSkillResult[]> {
  // Handle null db case
  if (!db) {
    return [];
  }

  const conditions = [];

  // Full-text search condition
  if (params.query && params.query.trim()) {
    conditions.push(
      sql`${skills.searchVector} @@ websearch_to_tsquery('english', ${params.query})`
    );
  }

  // Category filter
  if (params.category) {
    conditions.push(eq(skills.category, params.category));
  }

  // Tag filtering - match skills containing ANY of the selected tags
  if (params.tags && params.tags.length > 0) {
    // Format as PostgreSQL array literal: {tag1,tag2,tag3}
    const tagsArrayLiteral = `{${params.tags.join(",")}}`;
    conditions.push(sql`${skills.tags} && ${tagsArrayLiteral}::text[]`);
  }

  // Quality score computation as SQL expression
  // Formula: usage (50%) + rating (35%) + metadata (15%)
  // Returns -1 if fewer than 3 ratings (unranked)
  const qualityScoreSql = sql<number>`
    CASE
      WHEN (SELECT count(*) FROM ratings WHERE skill_id = ${skills.id}) < 3 THEN -1
      ELSE (
        LEAST(${skills.totalUses}::float / 100.0, 1) * 50 +
        COALESCE(${skills.averageRating}::float / 500.0, 0) * 35 +
        CASE WHEN ${skills.description} != '' AND ${skills.category} != '' THEN 15 ELSE 0 END
      )
    END
  `;

  // Quality tier filter - inline the score calculation to avoid nesting issues
  if (params.qualityTier) {
    const { min, max } = TIER_THRESHOLDS[params.qualityTier];
    conditions.push(sql`(
      CASE
        WHEN (SELECT count(*) FROM ratings WHERE ratings.skill_id = ${skills.id}) < 3 THEN -1
        ELSE (
          LEAST(${skills.totalUses}::float / 100.0, 1) * 50 +
          COALESCE(${skills.averageRating}::float / 500.0, 0) * 35 +
          CASE WHEN ${skills.description} != '' AND ${skills.category} != '' THEN 15 ELSE 0 END
        )
      END
    ) >= ${min} AND (
      CASE
        WHEN (SELECT count(*) FROM ratings WHERE ratings.skill_id = ${skills.id}) < 3 THEN -1
        ELSE (
          LEAST(${skills.totalUses}::float / 100.0, 1) * 50 +
          COALESCE(${skills.averageRating}::float / 500.0, 0) * 35 +
          CASE WHEN ${skills.description} != '' AND ${skills.category} != '' THEN 15 ELSE 0 END
        )
      END
    ) <= ${max}`);
  }

  // Build query with rating count subquery
  const baseQuery = db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      description: skills.description,
      category: skills.category,
      totalUses: skills.totalUses,
      averageRating: skills.averageRating,
      totalRatings: sql<number>`(SELECT count(*) FROM ratings WHERE skill_id = ${skills.id})`.as(
        "totalRatings"
      ),
      hoursSaved: skills.hoursSaved,
      author: {
        id: users.id,
        name: users.name,
        image: users.image,
      },
    })
    .from(skills)
    .leftJoin(users, eq(skills.authorId, users.id));

  // Apply conditions if any
  const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  // Determine sort order
  if (params.sortBy === "quality") {
    // Sort by quality score descending, unranked (-1) at the end
    return filteredQuery.orderBy(sql`(${qualityScoreSql}) DESC NULLS LAST`);
  } else if (params.sortBy === "rating") {
    return filteredQuery.orderBy(desc(skills.averageRating));
  } else if (params.query && params.query.trim()) {
    // Order by relevance when searching
    return filteredQuery.orderBy(
      sql`ts_rank(${skills.searchVector}, websearch_to_tsquery('english', ${params.query})) DESC`
    );
  }

  // Default: order by totalUses
  return filteredQuery.orderBy(desc(skills.totalUses));
}

/**
 * Get all unique tags from skills
 *
 * Extracts tags from the tags TEXT[] column across all skills.
 * Returns sorted array of unique tag strings.
 *
 * @returns Array of tag strings
 */
export async function getAvailableTags(): Promise<string[]> {
  // Handle null db case
  if (!db) {
    return [];
  }

  // Use unnest to flatten arrays, then select distinct
  const result = await db.execute(
    sql`SELECT DISTINCT unnest(tags) as tag FROM skills WHERE tags IS NOT NULL ORDER BY tag`
  );

  // db.execute returns RowList which is array-like, cast to array for mapping
  return (result as unknown as Record<string, unknown>[]).map((row) => String(row.tag));
}
