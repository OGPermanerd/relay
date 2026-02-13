/**
 * Backfill embedding vectors for all published skills.
 *
 * Run with: npx tsx packages/db/src/scripts/backfill-embeddings.ts
 *
 * - Processes skills sequentially (Ollama is single-threaded)
 * - Uses upsertSkillEmbedding to insert or update embedding rows
 * - Ensures site_settings has semanticSimilarityEnabled = true
 * - Logs progress and handles individual failures gracefully
 */

import { createHash } from "crypto";
import { db, DEFAULT_TENANT_ID } from "../client";
import { skills } from "../schema/skills";
import { eq } from "drizzle-orm";
import { upsertSkillEmbedding } from "../services/skill-embeddings";
import { updateSiteSettings } from "../services/site-settings";

const OLLAMA_URL = "http://localhost:11434";
const MODEL = "nomic-embed-text";
const DIMENSIONS = 768;
const TIMEOUT_MS = 10_000;

async function generateEmbeddingDirect(text: string): Promise<number[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: text }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`  Ollama returned HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const embeddings = data?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length === 0) return null;
    return embeddings[0];
  } catch (err) {
    console.error(
      `  Embedding request failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

async function main() {
  if (!db) {
    console.error("Database not configured. Set DATABASE_URL.");
    process.exit(1);
  }

  // Step 1: Ensure site_settings has semanticSimilarityEnabled = true
  console.log("Ensuring site_settings.semanticSimilarityEnabled = true ...");
  await updateSiteSettings({ semanticSimilarityEnabled: true }, DEFAULT_TENANT_ID);
  console.log("Site settings updated.");

  // Step 2: Fetch all published skills
  const publishedSkills = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      tenantId: skills.tenantId,
    })
    .from(skills)
    .where(eq(skills.status, "published"));

  const total = publishedSkills.length;
  console.log(`Found ${total} published skills.`);

  if (total === 0) {
    console.log("No skills to embed. Done.");
    process.exit(0);
  }

  // Step 3: Process sequentially
  let success = 0;
  let failures = 0;

  for (let i = 0; i < total; i++) {
    const skill = publishedSkills[i];
    const text = `${skill.name} ${skill.description}`;

    const embedding = await generateEmbeddingDirect(text);

    if (!embedding) {
      console.warn(`[${i + 1}/${total}] FAILED: ${skill.name}`);
      failures++;
      continue;
    }

    const inputHash = createHash("sha256").update(text).digest("hex");

    try {
      await upsertSkillEmbedding({
        tenantId: skill.tenantId,
        skillId: skill.id,
        embedding,
        modelName: MODEL,
        dimensions: DIMENSIONS,
        inputHash,
      });
      success++;
      console.log(`[${i + 1}/${total}] Embedded: ${skill.name}`);
    } catch (err) {
      console.warn(
        `[${i + 1}/${total}] DB error for ${skill.name}: ${err instanceof Error ? err.message : String(err)}`
      );
      failures++;
    }
  }

  console.log(`\nDone. Embedded ${success}/${total} skills. ${failures} failures.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill script crashed:", err);
  process.exit(1);
});
