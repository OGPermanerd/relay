import { getSiteSettings, upsertSkillEmbedding } from "@everyskill/db";
import { generateEmbedding } from "./ollama";
import { createHash } from "crypto";

/**
 * Generate and store an embedding for a skill. Fire-and-forget safe.
 * Returns true if embedding was stored, false on any failure.
 *
 * This is the canonical embedding generator for Plan 45-01.
 * Also see: @/lib/embedding-generator.ts (legacy, used by skill creation actions).
 */
export async function generateAndStoreSkillEmbedding(params: {
  skillId: string;
  tenantId: string;
  name: string;
  description: string;
}): Promise<boolean> {
  try {
    const settings = await getSiteSettings();
    if (!settings?.semanticSimilarityEnabled) return false;

    const text = `${params.name} ${params.description}`;
    const embedding = await generateEmbedding(text, {
      url: settings.ollamaUrl,
      model: settings.ollamaModel,
    });
    if (!embedding) return false;

    const inputHash = createHash("sha256").update(text).digest("hex");
    await upsertSkillEmbedding({
      tenantId: params.tenantId,
      skillId: params.skillId,
      embedding,
      modelName: settings.ollamaModel,
      dimensions: settings.embeddingDimensions,
      inputHash,
    });
    return true;
  } catch {
    return false;
  }
}
