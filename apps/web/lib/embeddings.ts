import { VoyageAIClient, VoyageAIError } from "voyageai";

// Embedding model configuration
export const EMBEDDING_MODEL = "voyage-code-3";
export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDING_VERSION = "1.0";

function getClient(): VoyageAIClient {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY environment variable is not set. " +
        "Get your API key from https://dash.voyageai.com/api-keys"
    );
  }
  return new VoyageAIClient({ apiKey });
}

/**
 * Generate a vector embedding for a single text.
 * @param text - The text to embed (skill name + description + content + tags)
 * @returns A 1024-dimension vector embedding
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();

  try {
    const response = await client.embed({
      input: [text],
      model: EMBEDDING_MODEL,
      inputType: "document",
    });

    const embedding = response.data?.[0]?.embedding;
    if (!embedding) {
      throw new Error("No embedding returned from Voyage AI");
    }

    return embedding;
  } catch (error) {
    if (error instanceof VoyageAIError) {
      throw new Error(`Voyage AI embedding failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generate vector embeddings for multiple texts with throttling.
 * Used for backfill migration to avoid rate limits.
 * @param texts - Array of texts to embed
 * @param delayMs - Delay between batches in milliseconds (default 150ms)
 * @returns Array of 1024-dimension vector embeddings in same order as input
 */
export async function generateEmbeddingsBatch(texts: string[], delayMs = 150): Promise<number[][]> {
  const client = getClient();
  const BATCH_SIZE = 128; // Optimal per Voyage AI docs
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await client.embed({
        input: batch,
        model: EMBEDDING_MODEL,
        inputType: "document",
      });

      const embeddings = response.data?.map((d) => d.embedding) || [];
      if (embeddings.length !== batch.length) {
        throw new Error(`Expected ${batch.length} embeddings, got ${embeddings.length}`);
      }

      // Filter out any undefined embeddings
      for (const embedding of embeddings) {
        if (!embedding) {
          throw new Error("Received undefined embedding from Voyage AI");
        }
        results.push(embedding);
      }
    } catch (error) {
      if (error instanceof VoyageAIError) {
        throw new Error(`Voyage AI batch embedding failed: ${error.message}`);
      }
      throw error;
    }

    // Throttle between batches to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
