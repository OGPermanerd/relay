import { sql, eq, or, and, type SQL } from "drizzle-orm";
import { skills } from "../schema/skills";

/**
 * Build a Drizzle query-builder visibility filter.
 *
 * - No userId (anonymous): only tenant-visible skills
 * - With userId: tenant-visible + own personal skills
 */
export function buildVisibilityFilter(userId?: string): SQL {
  if (!userId) {
    return eq(skills.visibility, "tenant");
  }

  return or(
    eq(skills.visibility, "tenant"),
    and(eq(skills.visibility, "personal"), eq(skills.authorId, userId))
  )!;
}

/**
 * Build a raw SQL visibility clause for template-string queries.
 *
 * - No userId (anonymous): only tenant-visible skills
 * - With userId: tenant-visible + own personal skills
 */
export function visibilitySQL(userId?: string): SQL {
  if (!userId) {
    return sql`visibility = 'tenant'`;
  }

  return sql`(visibility = 'tenant' OR (visibility = 'personal' AND author_id = ${userId}))`;
}
