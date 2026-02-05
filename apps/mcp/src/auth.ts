import { validateApiKey } from "@relay/db/services/api-keys";

/**
 * MCP auth module — resolves userId from RELAY_API_KEY env var.
 * Provides anonymous usage nudge counter for unauthenticated users.
 *
 * IMPORTANT: All logging uses console.error (never console.log) to
 * avoid corrupting the stdio MCP transport protocol.
 */

let cachedUserId: string | null = null;
let resolved = false;
let anonymousCallCount = 0;
let firstAuthShown = false;

/**
 * Resolve userId from RELAY_API_KEY environment variable.
 * Calls validateApiKey once and caches the result.
 * Must be called before server.connect() so userId is ready for first tool call.
 */
export async function resolveUserId(): Promise<string | null> {
  if (resolved) return cachedUserId;
  resolved = true;

  const apiKey = process.env.RELAY_API_KEY;
  if (!apiKey) {
    console.error("RELAY_API_KEY not set — running in anonymous mode");
    return null;
  }

  try {
    const result = await validateApiKey(apiKey);
    if (result) {
      cachedUserId = result.userId;
      console.error("Authenticated as userId:", cachedUserId);
    } else {
      console.error("RELAY_API_KEY is invalid or expired — running in anonymous mode");
    }
  } catch (error) {
    console.error("Failed to validate RELAY_API_KEY:", error);
  }

  return cachedUserId;
}

/**
 * Synchronous getter for cached userId.
 * Returns null if not authenticated or resolveUserId() hasn't been called.
 */
export function getUserId(): string | null {
  return cachedUserId;
}

/**
 * Increment and return the anonymous call counter.
 * Only call when getUserId() is null.
 */
export function incrementAnonymousCount(): number {
  return ++anonymousCallCount;
}

/**
 * Returns true when it's time to nudge an anonymous user to authenticate.
 * Triggers every 5th anonymous tool call.
 */
export function shouldNudge(): boolean {
  return cachedUserId === null && anonymousCallCount > 0 && anonymousCallCount % 5 === 0;
}

/**
 * Returns a one-time confirmation message on first authenticated tool call.
 * Returns null on subsequent calls or if not authenticated.
 */
export function getFirstAuthMessage(): string | null {
  if (cachedUserId !== null && !firstAuthShown) {
    firstAuthShown = true;
    return "Tracking active for your account";
  }
  return null;
}
