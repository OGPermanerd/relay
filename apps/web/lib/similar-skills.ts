"use server";

import { db, skills } from "@relay/db";
import { sql, and, ne, or } from "drizzle-orm";

export interface SimilarSkillResult {
  skillId: string;
  skillName: string;
  skillSlug: string;
}

export interface CheckSimilarSkillsInput {
  name: string;
  description: string;
}

export interface SimilarityCheckResult {
  similarSkills: SimilarSkillResult[];
  checkFailed: boolean;
}

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * Check for similar existing skills before publishing using ILIKE text matching.
 *
 * This function should NEVER throw. Any failure is reported via
 * `checkFailed: true`, allowing the publish flow to proceed while
 * giving the UI visibility that the check didn't run.
 */
export async function checkSimilarSkills(
  input: CheckSimilarSkillsInput
): Promise<SimilarityCheckResult> {
  try {
    if (!db) {
      return { similarSkills: [], checkFailed: true };
    }

    const namePattern = `%${escapeLike(input.name)}%`;
    const descPattern = `%${escapeLike(input.description)}%`;

    const results = await db
      .select({
        skillId: skills.id,
        skillName: skills.name,
        skillSlug: skills.slug,
      })
      .from(skills)
      .where(
        or(
          sql`${skills.name} ILIKE ${namePattern}`,
          sql`${skills.description} ILIKE ${descPattern}`
        )
      )
      .limit(5);

    return { similarSkills: results, checkFailed: false };
  } catch (error) {
    console.warn("Failed to check similar skills:", error);
    return { similarSkills: [], checkFailed: true };
  }
}

/**
 * Find skills similar to an existing skill by name keywords.
 * Used on the skill detail page to show related skills.
 */
export async function findSimilarSkillsByName(
  skillId: string,
  skillName: string
): Promise<SimilarSkillResult[]> {
  try {
    if (!db) return [];

    // Split name into keywords (3+ chars) for broader matching
    const keywords = skillName
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    const conditions = keywords.map((kw) => sql`${skills.name} ILIKE ${`%${escapeLike(kw)}%`}`);

    const results = await db
      .select({
        skillId: skills.id,
        skillName: skills.name,
        skillSlug: skills.slug,
      })
      .from(skills)
      .where(and(ne(skills.id, skillId), or(...conditions)))
      .limit(5);

    return results;
  } catch (error) {
    console.warn("Failed to find similar skills:", error);
    return [];
  }
}
