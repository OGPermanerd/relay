import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema";
import { sql, eq, isNotNull, and } from "drizzle-orm";

/**
 * Get per-category counts of published skills.
 *
 * Returns an object like { prompt: 12, workflow: 8, agent: 5, mcp: 3 }.
 * Only counts skills that are published and visible to the tenant.
 */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  if (!db) {
    return { productivity: 0, wiring: 0, "doc-production": 0, "data-viz": 0, code: 0 };
  }

  const result = await db
    .select({
      category: skills.category,
      count: sql<number>`COUNT(*)`,
    })
    .from(skills)
    .where(
      and(
        isNotNull(skills.publishedVersionId),
        eq(skills.status, "published"),
        eq(skills.visibility, "tenant")
      )
    )
    .groupBy(skills.category);

  const counts: Record<string, number> = {
    productivity: 0,
    wiring: 0,
    "doc-production": 0,
    "data-viz": 0,
    code: 0,
  };

  for (const row of result) {
    counts[row.category] = Number(row.count);
  }

  return counts;
}
