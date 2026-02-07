/**
 * Ollama API client — pure fetch, no npm packages.
 * Also manages the Ollama server process lifecycle.
 */

import { spawn, execSync } from "child_process";

export interface OllamaEmbedConfig {
  url: string;
  model: string;
}

/**
 * Generate an embedding vector from text via Ollama's /api/embed endpoint.
 * Returns null on any failure (timeout, network, bad response).
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

    const data = await response.json();
    // Ollama returns { embeddings: [[...]] } for single input
    const embeddings = data?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length === 0) return null;
    return embeddings[0];
  } catch {
    return null;
  }
}

/**
 * Check if the Ollama server is reachable at the given URL.
 */
async function isOllamaRunning(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start the Ollama systemd service. Waits up to 8 seconds for it to become
 * reachable. Returns true if the server is responsive afterwards.
 */
export async function startOllama(url = "http://localhost:11434"): Promise<boolean> {
  if (await isOllamaRunning(url)) return true;

  try {
    execSync("sudo -n systemctl start ollama", { timeout: 5000 });
  } catch {
    // systemctl might not be available; try ollama serve directly
    try {
      spawn("ollama", ["serve"], { detached: true, stdio: "ignore" }).unref();
    } catch {
      return false;
    }
  }

  // Wait for it to come up
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isOllamaRunning(url)) return true;
  }
  return false;
}

/**
 * Stop the Ollama systemd service.
 */
export function stopOllama(): boolean {
  try {
    execSync("sudo -n systemctl stop ollama", { timeout: 5000 });
    return true;
  } catch {
    // Fallback: kill by process name
    try {
      execSync("pkill -f 'ollama serve'", { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

export interface TestConnectionResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

/**
 * Test connectivity to an Ollama server by hitting GET /api/tags.
 */
export async function testOllamaConnection(url: string): Promise<TestConnectionResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const models = (data?.models || []).map((m: { name: string }) => m.name);

    return { ok: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { ok: false, error: message };
  }
}
