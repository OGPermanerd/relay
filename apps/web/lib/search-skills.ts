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
}

/**
 * Search skills using PostgreSQL full-text search
 *
 * When query is provided: Uses websearch_to_tsquery for parsing and ts_rank for ordering
 * When query is empty: Returns all skills ordered by totalUses descending
 *
 * @param params - Search parameters (query, category, tags)
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

  // TODO: Tag filtering will be added in Plan 03
  // Tags are stored in metadata JSONB field

  // Build query
  const baseQuery = db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      description: skills.description,
      category: skills.category,
      totalUses: skills.totalUses,
      averageRating: skills.averageRating,
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

  // Order by relevance (when searching) or totalUses (when browsing)
  if (params.query && params.query.trim()) {
    return filteredQuery.orderBy(
      sql`ts_rank(${skills.searchVector}, websearch_to_tsquery('english', ${params.query})) DESC`
    );
  }

  return filteredQuery.orderBy(desc(skills.totalUses));
}
