import { db } from "../client";
import { skills } from "../schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface ForkInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  averageRating: number | null;
  author: { id: string; name: string | null } | null;
  createdAt: Date;
}

/**
 * Get the fork count for a skill (how many skills forked from it)
 */
export async function getForkCount(skillId: string): Promise<number> {
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(skills)
    .where(and(eq(skills.forkedFromId, skillId), eq(skills.status, "published")));

  return result[0]?.count ?? 0;
}

/**
 * Get top forks for a skill, ordered by highest rating first
 */
export async function getTopForks(skillId: string, limit: number = 5): Promise<ForkInfo[]> {
  if (!db) return [];

  const forks = await db.query.skills.findMany({
    where: and(eq(skills.forkedFromId, skillId), eq(skills.status, "published")),
    with: {
      author: {
        columns: { id: true, name: true },
      },
    },
    columns: {
      id: true,
      name: true,
      slug: true,
      description: true,
      averageRating: true,
      createdAt: true,
    },
    orderBy: [desc(skills.averageRating), desc(skills.createdAt)],
    limit,
  });

  return forks;
}

/**
 * Get the parent skill info for a forked skill
 */
export async function getParentSkill(forkedFromId: string): Promise<{
  id: string;
  name: string;
  slug: string;
  author: { id: string; name: string | null } | null;
} | null> {
  if (!db) return null;

  const parent = await db.query.skills.findFirst({
    where: eq(skills.id, forkedFromId),
    with: {
      author: {
        columns: { id: true, name: true },
      },
    },
    columns: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return parent ?? null;
}
