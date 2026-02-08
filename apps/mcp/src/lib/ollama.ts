/**
 * Ollama embedding client for the MCP app.
 *
 * Self-contained copy of the embedding function (no cross-app imports).
 * CRITICAL: No console.log — only console.error for debug logging.
 * The MCP protocol uses stdio, so any stdout output corrupts the protocol.
 */

export interface OllamaEmbedConfig {
  url: string;
  model: string;
}

export const OLLAMA_DEFAULTS: OllamaEmbedConfig = {
  url: "http://localhost:11434",
  model: "nomic-embed-text",
};

/**
 * Generate an embedding vector from text via Ollama's /api/embed endpoint.
 * Returns null on any failure (timeout, network, bad response).
 *
 * @param text - The text to embed
 * @param config - Ollama server URL and model name
 * @returns Embedding vector as number[] or null on failure
 */
export async function generateEmbedding(
  text: string,
  config: OllamaEmbedConfig
): Promise<number[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.url}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, input: text }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as { embeddings?: number[][] };
    // Ollama returns { embeddings: [[...]] } for single input
    const embeddings = data?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length === 0) return null;
    return embeddings[0];
  } catch {
    return null;
  }
}
