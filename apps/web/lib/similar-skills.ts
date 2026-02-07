"use server";

import { db, skills, getSiteSettings, getSkillEmbedding } from "@everyskill/db";
import { sql, and, ne, or } from "drizzle-orm";
import { generateEmbedding } from "./ollama";

export interface SimilarSkillResult {
  skillId: string;
  skillName: string;
  skillSlug: string;
  matchType?: "semantic" | "name";
  similarityPct?: number;
  description?: string;
  category?: string;
  totalUses?: number;
  averageRating?: number | null;
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
 * Try semantic similarity search via Ollama embeddings.
 * Returns matches or null if semantic search is unavailable / disabled.
 */
async function trySemanticSearch(
  text: string,
  excludeSkillId?: string
): Promise<SimilarSkillResult[] | null> {
  try {
    const settings = await getSiteSettings();
    if (!settings?.semanticSimilarityEnabled) return null;
    if (!db) return null;

    const embedding = await generateEmbedding(text, {
      url: settings.ollamaUrl,
      model: settings.ollamaModel,
    });
    if (!embedding) return null;

    const vectorStr = `[${embedding.join(",")}]`;
    const threshold = 0.35;

    let results;
    if (excludeSkillId) {
      results = await db.execute(sql`
        SELECT s.id AS "skillId", s.name AS "skillName", s.slug AS "skillSlug",
               s.description, s.category, s.total_uses AS "totalUses",
               s.average_rating AS "averageRating",
               ROUND(100 * (1 - (se.embedding <=> ${vectorStr}::vector) / 2))::int AS "similarityPct"
        FROM skill_embeddings se
        JOIN skills s ON s.id = se.skill_id
        WHERE (se.embedding <=> ${vectorStr}::vector) < ${threshold}
          AND s.id != ${excludeSkillId}
        ORDER BY se.embedding <=> ${vectorStr}::vector
        LIMIT 5
      `);
    } else {
      results = await db.execute(sql`
        SELECT s.id AS "skillId", s.name AS "skillName", s.slug AS "skillSlug",
               s.description, s.category, s.total_uses AS "totalUses",
               s.average_rating AS "averageRating",
               ROUND(100 * (1 - (se.embedding <=> ${vectorStr}::vector) / 2))::int AS "similarityPct"
        FROM skill_embeddings se
        JOIN skills s ON s.id = se.skill_id
        WHERE (se.embedding <=> ${vectorStr}::vector) < ${threshold}
        ORDER BY se.embedding <=> ${vectorStr}::vector
        LIMIT 5
      `);
    }

    if (results.length > 0) {
      return (results as unknown as SimilarSkillResult[]).map((r) => ({
        ...r,
        matchType: "semantic" as const,
      }));
    }
    return null; // fall through to ILIKE
  } catch {
    return null; // fall through to ILIKE
  }
}

/**
 * Try semantic similarity for an existing skill using its stored embedding.
 * Returns matches or null if unavailable.
 */
async function trySemanticSearchBySkill(skillId: string): Promise<SimilarSkillResult[] | null> {
  try {
    const settings = await getSiteSettings();
    if (!settings?.semanticSimilarityEnabled) return null;
    if (!db) return null;

    const existing = await getSkillEmbedding(skillId);
    if (!existing) return null;

    const vectorStr = `[${existing.embedding.join(",")}]`;
    const threshold = 0.35;

    const results = await db.execute(sql`
      SELECT s.id AS "skillId", s.name AS "skillName", s.slug AS "skillSlug",
             s.description, s.category, s.total_uses AS "totalUses",
             s.average_rating AS "averageRating",
             ROUND(100 * (1 - (se.embedding <=> ${vectorStr}::vector) / 2))::int AS "similarityPct"
      FROM skill_embeddings se
      JOIN skills s ON s.id = se.skill_id
      WHERE (se.embedding <=> ${vectorStr}::vector) < ${threshold}
        AND s.id != ${skillId}
      ORDER BY se.embedding <=> ${vectorStr}::vector
      LIMIT 5
    `);

    if (results.length > 0) {
      return (results as unknown as SimilarSkillResult[]).map((r) => ({
        ...r,
        matchType: "semantic" as const,
      }));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check for similar existing skills before publishing.
 *
 * If semantic similarity is enabled, tries vector search first.
 * Always falls back to ILIKE text matching.
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

    // Try semantic search first
    const semanticResults = await trySemanticSearch(`${input.name} ${input.description}`);
    if (semanticResults) {
      return { similarSkills: semanticResults, checkFailed: false };
    }

    // Fallback: ILIKE text matching
    const namePattern = `%${escapeLike(input.name)}%`;
    const descPattern = `%${escapeLike(input.description)}%`;

    const results = await db
      .select({
        skillId: skills.id,
        skillName: skills.name,
        skillSlug: skills.slug,
        description: skills.description,
        category: skills.category,
        totalUses: skills.totalUses,
        averageRating: skills.averageRating,
      })
      .from(skills)
      .where(
        or(
          sql`${skills.name} ILIKE ${namePattern}`,
          sql`${skills.description} ILIKE ${descPattern}`
        )
      )
      .limit(5);

    return {
      similarSkills: results.map((r) => ({ ...r, matchType: "name" as const })),
      checkFailed: false,
    };
  } catch (error) {
    console.warn("Failed to check similar skills:", error);
    return { similarSkills: [], checkFailed: true };
  }
}

/**
 * Find skills similar to an existing skill by name keywords.
 * Used on the skill detail page to show related skills.
 *
 * If semantic similarity is enabled, tries vector search using
 * the skill's stored embedding first, then falls back to ILIKE.
 */
export async function findSimilarSkillsByName(
  skillId: string,
  skillName: string
): Promise<SimilarSkillResult[]> {
  try {
    if (!db) return [];

    // Try semantic search using stored embedding
    const semanticResults = await trySemanticSearchBySkill(skillId);
    if (semanticResults) {
      return semanticResults;
    }

    // Fallback: ILIKE keyword matching
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
        description: skills.description,
        category: skills.category,
        totalUses: skills.totalUses,
        averageRating: skills.averageRating,
      })
      .from(skills)
      .where(and(ne(skills.id, skillId), or(...conditions)))
      .limit(5);

    return results.map((r) => ({ ...r, matchType: "name" as const }));
  } catch (error) {
    console.warn("Failed to find similar skills:", error);
    return [];
  }
}
