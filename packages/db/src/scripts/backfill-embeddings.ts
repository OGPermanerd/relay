/**
 * Backfill embeddings for existing skills
 *
 * This script generates vector embeddings for all skills that don't have one.
 * Run with: pnpm --filter @relay/db db:backfill-embeddings
 *
 * Per CONTEXT.md decisions:
 * - If any embedding fails, the transaction rolls back (all or nothing)
 * - 150ms delay between batches to respect rate limits
 * - Exit with code 1 on failure (for CI/deployment scripts)
 */

import { config } from "dotenv";
// Load .env.local from project root
config({ path: "../../.env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull } from "drizzle-orm";
import { VoyageAIClient } from "voyageai";
import { skills } from "../schema/skills";
import { skillEmbeddings } from "../schema/skill-embeddings";

// Embedding constants (match apps/web/lib/embeddings.ts)
const EMBEDDING_MODEL = "voyage-code-3";
const EMBEDDING_VERSION = "1.0";
const BATCH_SIZE = 128;

// Verify DATABASE_URL is set
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Verify VOYAGE_API_KEY is set
const voyageApiKey = process.env.VOYAGE_API_KEY;
if (!voyageApiKey) {
  console.error("Error: VOYAGE_API_KEY environment variable is not set");
  console.error("Get your API key from: https://dash.voyageai.com/api-keys");
  process.exit(1);
}

// Create database connection
const client = postgres(connectionString);
const db = drizzle(client);

// Create Voyage AI client
const voyageClient = new VoyageAIClient({ apiKey: voyageApiKey });

/**
 * Generate SHA-256 hash of content
 */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate embeddings for multiple texts with throttling
 */
async function generateEmbeddingsBatch(texts: string[], delayMs = 150): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await voyageClient.embed({
      input: batch,
      model: EMBEDDING_MODEL,
      inputType: "document",
    });

    const embeddings = response.data?.map((d) => d.embedding) || [];
    if (embeddings.length !== batch.length) {
      throw new Error(`Expected ${batch.length} embeddings, got ${embeddings.length}`);
    }

    for (const embedding of embeddings) {
      if (!embedding) {
        throw new Error("Received undefined embedding from Voyage AI");
      }
      results.push(embedding);
    }

    // Throttle between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

async function backfillEmbeddings() {
  console.log("Starting embedding backfill...\n");

  // Find skills without embeddings
  const skillsWithoutEmbeddings = await db
    .select({
      id: skills.id,
      name: skills.name,
      description: skills.description,
      content: skills.content,
      tags: skills.tags,
    })
    .from(skills)
    .leftJoin(skillEmbeddings, eq(skills.id, skillEmbeddings.skillId))
    .where(isNull(skillEmbeddings.id));

  console.log(`Found ${skillsWithoutEmbeddings.length} skills without embeddings\n`);

  if (skillsWithoutEmbeddings.length === 0) {
    console.log("All skills already have embeddings. Nothing to do.");
    return;
  }

  // Build embedding inputs
  const inputs = skillsWithoutEmbeddings.map((skill) => {
    return [skill.name, skill.description, skill.content, ...(skill.tags || [])].join(" ");
  });

  // Generate embeddings in batches (150ms delay between batches)
  console.log("Generating embeddings via Voyage AI...");
  const embeddings = await generateEmbeddingsBatch(inputs, 150);
  console.log(`Generated ${embeddings.length} embeddings\n`);

  // Insert embeddings in a transaction
  console.log("Storing embeddings in database...");
  await db.transaction(async (tx) => {
    for (let i = 0; i < skillsWithoutEmbeddings.length; i++) {
      const skill = skillsWithoutEmbeddings[i];
      const inputHash = await hashContent(inputs[i]);

      await tx.insert(skillEmbeddings).values({
        skillId: skill.id,
        embedding: embeddings[i],
        modelName: EMBEDDING_MODEL,
        modelVersion: EMBEDDING_VERSION,
        inputHash,
      });

      console.log(`  [${i + 1}/${skillsWithoutEmbeddings.length}] ${skill.name}`);
    }
  });

  console.log("\nBackfill complete!");
}

// Run backfill
backfillEmbeddings()
  .then(() => {
    console.log("\nClosing database connection...");
    client.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nBackfill failed:", error);
    client.end();
    process.exit(1);
  });
