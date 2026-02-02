import { eq, sql, gt, desc } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";
import { db } from "../client";
import { skillEmbeddings, skills } from "../schema";
import type { SkillEmbedding } from "../schema";

export interface CreateEmbeddingParams {
  skillId: string;
  embedding: number[];
  modelName: string;
  modelVersion: string;
  inputHash: string;
}

export interface FindSimilarOptions {
  threshold?: number;
  limit?: number;
  excludeSkillId?: string;
}

export interface SimilarSkillResult {
  skillId: string;
  skillName: string;
  skillSlug: string;
  similarity: number;
}

/**
 * Create a new skill embedding record
 * Called after a skill is published to store its vector embedding
 */
export async function createSkillEmbedding(params: CreateEmbeddingParams): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping createSkillEmbedding");
    return;
  }

  await db.insert(skillEmbeddings).values({
    skillId: params.skillId,
    embedding: params.embedding,
    modelName: params.modelName,
    modelVersion: params.modelVersion,
    inputHash: params.inputHash,
  });
}

/**
 * Get the embedding record for a skill
 * Returns null if no embedding exists
 */
export async function getSkillEmbedding(skillId: string): Promise<SkillEmbedding | null> {
  if (!db) {
    console.warn("Database not configured, skipping getSkillEmbedding");
    return null;
  }

  const result = await db
    .select()
    .from(skillEmbeddings)
    .where(eq(skillEmbeddings.skillId, skillId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Find skills similar to a query embedding
 * Uses cosine similarity for comparison
 *
 * @param queryEmbedding - The vector to find similar skills to
 * @param options - Optional parameters for threshold, limit, and exclusions
 * @returns Array of similar skills with similarity scores (0-1, higher is more similar)
 */
export async function findSimilarSkills(
  queryEmbedding: number[],
  options: FindSimilarOptions = {}
): Promise<SimilarSkillResult[]> {
  if (!db) {
    console.warn("Database not configured, skipping findSimilarSkills");
    return [];
  }

  const { threshold = 0.7, limit = 10, excludeSkillId } = options;

  // Cosine distance is 1 - cosine_similarity, so similarity = 1 - distance
  const similarity = sql<number>`1 - ${cosineDistance(skillEmbeddings.embedding, queryEmbedding)}`;

  const query = db
    .select({
      skillId: skillEmbeddings.skillId,
      skillName: skills.name,
      skillSlug: skills.slug,
      similarity,
    })
    .from(skillEmbeddings)
    .innerJoin(skills, eq(skillEmbeddings.skillId, skills.id))
    .where(gt(similarity, threshold))
    .orderBy(desc(similarity))
    .limit(limit);

  // If we need to exclude a specific skill (e.g., when finding similar to itself)
  if (excludeSkillId) {
    const results = await query;
    return results.filter((r) => r.skillId !== excludeSkillId);
  }

  return await query;
}

/**
 * Update an existing skill embedding
 * Used when skill content changes and needs re-embedding
 */
export async function updateSkillEmbedding(
  skillId: string,
  params: Omit<CreateEmbeddingParams, "skillId">
): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping updateSkillEmbedding");
    return;
  }

  await db
    .update(skillEmbeddings)
    .set({
      embedding: params.embedding,
      modelName: params.modelName,
      modelVersion: params.modelVersion,
      inputHash: params.inputHash,
      updatedAt: new Date(),
    })
    .where(eq(skillEmbeddings.skillId, skillId));
}

/**
 * Delete a skill embedding
 * Note: This is typically handled by cascade delete when skill is deleted
 */
export async function deleteSkillEmbedding(skillId: string): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping deleteSkillEmbedding");
    return;
  }

  await db.delete(skillEmbeddings).where(eq(skillEmbeddings.skillId, skillId));
}
