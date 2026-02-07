"use server";

import { generateEmbedding } from "@/lib/embeddings";
import { findSimilarSkills } from "@relay/db/services";
import type { SimilarSkillResult } from "@relay/db/services";

export interface CheckSimilarSkillsInput {
  name: string;
  description: string;
  content: string;
  tags?: string[];
}

export interface SimilarityCheckResult {
  similarSkills: SimilarSkillResult[];
  checkFailed: boolean;
  embedding?: number[];
}

/**
 * Check for similar existing skills before publishing.
 *
 * This function should NEVER throw. Any failure is reported via
 * `checkFailed: true`, allowing the publish flow to proceed while
 * giving the UI visibility that the check didn't run.
 *
 * @param input - The skill data to check for similarity
 * @returns Similar skills array and whether the check failed
 */
export async function checkSimilarSkills(
  input: CheckSimilarSkillsInput
): Promise<SimilarityCheckResult> {
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

    // Find similar skills (threshold 0.7, limit 5)
    const similarSkills = await findSimilarSkills(embedding, {
      threshold: 0.7,
      limit: 5,
    });

    return { similarSkills, checkFailed: false, embedding };
  } catch (error) {
    // Log but never throw - similarity check is advisory only
    console.warn("Failed to check similar skills:", error);
    return { similarSkills: [], checkFailed: true };
  }
}
