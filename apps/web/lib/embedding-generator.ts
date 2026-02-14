import { getSiteSettings, upsertSkillEmbedding } from "@everyskill/db";
import { generateEmbedding } from "./ollama";

/**
 * Generate and store a skill embedding. Designed for fire-and-forget usage.
 *
 * - Checks site settings to see if semantic similarity is enabled
 * - Calls Ollama to generate the embedding
 * - Upserts the embedding into the database
 * - Fully swallows all errors — skill creation must never be blocked
 */
export async function generateSkillEmbedding(
  skillId: string,
  name: string,
  description: string,
  tenantId: string
): Promise<void> {
  try {
    const settings = await getSiteSettings();
    if (!settings?.semanticSimilarityEnabled) return;

    const inputText = `${name} ${description}`;
    const embedding = await generateEmbedding(inputText, {
      url: settings.ollamaUrl,
      model: settings.ollamaModel,
    });

    if (!embedding) return;

    // Simple hash of input for cache invalidation
    const encoder = new TextEncoder();
    const data = encoder.encode(inputText);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const inputHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    await upsertSkillEmbedding({
      tenantId,
      skillId,
      embedding,
      modelName: settings.ollamaModel,
      dimensions: settings.embeddingDimensions,
      inputHash,
    });
  } catch {
    // Intentionally swallowed — embedding is optional
  }
}
