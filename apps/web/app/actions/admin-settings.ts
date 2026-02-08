"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db, skills, updateSiteSettings, getSiteSettings } from "@everyskill/db";
import { testOllamaConnection, startOllama, stopOllama } from "@/lib/ollama";
import { generateSkillEmbedding } from "@/lib/embedding-generator";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";

export type SaveSettingsState = {
  success?: boolean;
  error?: string;
};

export async function saveSettingsAction(
  prevState: SaveSettingsState,
  formData: FormData
): Promise<SaveSettingsState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }

  const semanticSimilarityEnabled = formData.get("semanticSimilarityEnabled") === "on";
  const ollamaUrl = (formData.get("ollamaUrl") as string)?.trim() || "http://localhost:11434";
  const ollamaModel = (formData.get("ollamaModel") as string)?.trim() || "nomic-embed-text";
  const embeddingDimensions = parseInt(formData.get("embeddingDimensions") as string, 10) || 768;

  if (embeddingDimensions < 1 || embeddingDimensions > 4096) {
    return { error: "Embedding dimensions must be between 1 and 4096" };
  }

  try {
    // Validate URL format
    new URL(ollamaUrl);
  } catch {
    return { error: "Invalid Ollama URL" };
  }

  try {
    // Start or stop Ollama based on the toggle
    if (semanticSimilarityEnabled) {
      const started = await startOllama(ollamaUrl);
      if (!started) {
        return { error: "Failed to start Ollama server. Is it installed?" };
      }
    } else {
      stopOllama();
    }

    await updateSiteSettings({
      semanticSimilarityEnabled,
      ollamaUrl,
      ollamaModel,
      embeddingDimensions,
    });
    revalidatePath("/admin/settings");
    return { success: true };
  } catch {
    return { error: "Failed to save settings" };
  }
}

export type TestConnectionState = {
  success?: boolean;
  models?: string[];
  error?: string;
};

export async function testConnectionAction(
  prevState: TestConnectionState,
  formData: FormData
): Promise<TestConnectionState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }

  const ollamaUrl = (formData.get("ollamaUrl") as string)?.trim() || "http://localhost:11434";

  try {
    new URL(ollamaUrl);
  } catch {
    return { error: "Invalid URL" };
  }

  // Ensure Ollama is running before testing
  await startOllama(ollamaUrl);

  const result = await testOllamaConnection(ollamaUrl);

  if (result.ok) {
    // Update last successful connection timestamp
    await updateSiteSettings({
      lastSuccessfulConnection: new Date(),
    });
    return { success: true, models: result.models };
  }

  return { error: result.error || "Connection failed" };
}

export type BackfillState = {
  success?: boolean;
  generated?: number;
  total?: number;
  error?: string;
};

export async function backfillEmbeddingsAction(
  _prevState: BackfillState,
  _formData: FormData
): Promise<BackfillState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }

  if (!db) return { error: "Database not configured" };

  const settings = await getSiteSettings();
  if (!settings?.semanticSimilarityEnabled) {
    return { error: "Enable semantic similarity first" };
  }

  // Ensure Ollama is running
  const started = await startOllama(settings.ollamaUrl);
  if (!started) {
    return { error: "Failed to start Ollama server" };
  }

  // Find skills without embeddings
  const missing = await db
    .select({ id: skills.id, name: skills.name, description: skills.description })
    .from(skills)
    .where(sql`${skills.id} NOT IN (SELECT skill_id FROM skill_embeddings)`);

  let generated = 0;
  for (const skill of missing) {
    await generateSkillEmbedding(skill.id, skill.name, skill.description);
    generated++;
  }

  return { success: true, generated, total: missing.length };
}
