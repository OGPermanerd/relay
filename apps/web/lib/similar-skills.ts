"use server";

import { generateEmbedding } from "@/lib/embeddings";
import { findSimilarSkills, type SimilarSkillResult } from "@relay/db/services";

export type { SimilarSkillResult };

export interface CheckSimilarSkillsInput {
  name: string;
  description: string;
  content: string;
  tags?: string[];
}

/**
 * Check for similar existing skills before publishing.
 *
 * This function should NEVER throw. Any failure results in an empty array,
 * allowing the publish flow to proceed without friction.
 *
 * @param input - The skill data to check for similarity
 * @returns Array of similar skills (empty if none found or on any error)
 */
export async function checkSimilarSkills(
  input: CheckSimilarSkillsInput
): Promise<SimilarSkillResult[]> {
  try {
    // Combine fields for embedding (same as createSkill in skills.ts)
    const embeddingInput = [
      input.name,
      input.description,
      input.content,
      ...(input.tags || []),
    ].join(" ");

    // Generate embedding for the new skill content
    const embedding = await generateEmbedding(embeddingInput);

    // Find similar skills (threshold 0.7, limit 3)
    const similarSkills = await findSimilarSkills(embedding, {
      threshold: 0.7,
      limit: 3,
    });

    return similarSkills;
  } catch (error) {
    // Log but never throw - similarity check is advisory only
    console.warn("Failed to check similar skills:", error);
    return [];
  }
}
