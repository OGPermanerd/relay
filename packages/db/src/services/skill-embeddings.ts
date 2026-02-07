import { db } from "../client";
import { skillEmbeddings } from "../schema/skill-embeddings";
import { eq } from "drizzle-orm";

export interface UpsertSkillEmbeddingParams {
  tenantId: string;
  skillId: string;
  embedding: number[];
  modelName: string;
  dimensions: number;
  inputHash: string;
}

/**
 * Insert or update a skill's embedding vector.
 * Uses ON CONFLICT on the unique skillId column.
 */
export async function upsertSkillEmbedding(params: UpsertSkillEmbeddingParams): Promise<void> {
  if (!db) return;

  await db
    .insert(skillEmbeddings)
    .values({
      tenantId: params.tenantId,
      skillId: params.skillId,
      embedding: params.embedding,
      modelName: params.modelName,
      dimensions: params.dimensions,
      inputHash: params.inputHash,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [skillEmbeddings.tenantId, skillEmbeddings.skillId],
      set: {
        embedding: params.embedding,
        modelName: params.modelName,
        dimensions: params.dimensions,
        inputHash: params.inputHash,
        updatedAt: new Date(),
      },
    });
}

/**
 * Fetch the embedding for a given skill.
 */
export async function getSkillEmbedding(skillId: string) {
  if (!db) return null;

  const row = await db.query.skillEmbeddings.findFirst({
    where: eq(skillEmbeddings.skillId, skillId),
  });

  return row ?? null;
}
