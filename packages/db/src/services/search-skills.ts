import { sql, eq, and } from "drizzle-orm";
import { db } from "../client";
import { skills } from "../schema/skills";
import { users } from "../schema/users";

/**
 * Escape special ILIKE characters to prevent injection via % and _ in user input.
 * Backslash is also escaped since it serves as the escape character in LIKE patterns.
 */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

export interface SearchSkillsParams {
  query: string;
  category?: string;
  limit?: number; // default 50
}

export interface SearchSkillResult {
  id: string;
  name: string;
  description: string;
  category: string;
  hoursSaved: number | null;
}

/**
 * Search skills using ILIKE matching across name, description, author name, and tags.
 *
 * Results are ordered by field-weighted relevance scoring:
 *   - Name match: 4 points
 *   - Description match: 3 points
 *   - Author name match: 2 points
 *   - Tags match: 1 point
 *
 * Uses LEFT JOIN on users so skills without an author still appear in results.
 * The escapeLike helper prevents ILIKE injection via % and _ characters.
 *
 * @param params - query string (required), optional category filter and limit
 * @returns Array of matching skills ordered by relevance score descending
 */
export async function searchSkillsByQuery(
  params: SearchSkillsParams
): Promise<SearchSkillResult[]> {
  if (!db) {
    console.warn("Database not configured, skipping searchSkillsByQuery");
    return [];
  }

  const { query, category, limit = 50 } = params;
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const likePattern = `%${escapeLike(trimmed)}%`;

  // WHERE: match any of the 4 fields
  const matchCondition = sql`(
    ${skills.name} ILIKE ${likePattern}
    OR ${skills.description} ILIKE ${likePattern}
    OR ${users.name} ILIKE ${likePattern}
    OR array_to_string(${skills.tags}, ' ') ILIKE ${likePattern}
  )`;

  const conditions = [matchCondition];

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  // Field-weighted relevance scoring
  const scoreSql = sql<number>`(
    CASE WHEN ${skills.name} ILIKE ${likePattern} THEN 4 ELSE 0 END
    + CASE WHEN ${skills.description} ILIKE ${likePattern} THEN 3 ELSE 0 END
    + CASE WHEN ${users.name} ILIKE ${likePattern} THEN 2 ELSE 0 END
    + CASE WHEN array_to_string(${skills.tags}, ' ') ILIKE ${likePattern} THEN 1 ELSE 0 END
  )`;

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      category: skills.category,
      hoursSaved: skills.hoursSaved,
    })
    .from(skills)
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(and(...conditions))
    .orderBy(sql`${scoreSql} DESC`)
    .limit(limit);

  return results;
}
