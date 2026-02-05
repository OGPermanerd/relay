import { createHash } from "crypto";
import { eq, and, isNull, or, gt } from "drizzle-orm";
import { db } from "../client";
import { apiKeys } from "../schema";

/**
 * Validate an API key by hashing the raw key and looking up the hash.
 * Uses timing-safe comparison to prevent timing attacks.
 * Fire-and-forget updates lastUsedAt on successful validation.
 *
 * @returns { userId, keyId } if valid, null otherwise
 */
export async function validateApiKey(
  rawKey: string
): Promise<{ userId: string; keyId: string } | null> {
  if (!db) {
    console.warn("Database not configured, skipping validateApiKey");
    return null;
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const now = new Date();
  const result = await db.query.apiKeys.findFirst({
    columns: { id: true, userId: true, keyHash: true },
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt),
      or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))
    ),
  });

  if (!result) return null;

  // Timing-safe comparison of computed hash vs stored hash
  const computedBuf = Buffer.from(keyHash, "hex");
  const storedBuf = Buffer.from(result.keyHash, "hex");

  if (computedBuf.length !== storedBuf.length) return null;

  const { timingSafeEqual } = await import("crypto");
  if (!timingSafeEqual(computedBuf, storedBuf)) return null;

  // Fire-and-forget: update lastUsedAt
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, result.id))
    .then(() => {})
    .catch(console.error);

  return { userId: result.userId, keyId: result.id };
}

/**
 * List all API keys for a user.
 * NEVER returns keyHash — only safe metadata columns.
 */
export async function listUserKeys(userId: string) {
  if (!db) {
    console.warn("Database not configured, skipping listUserKeys");
    return [];
  }

  return db.query.apiKeys.findMany({
    columns: {
      id: true,
      keyPrefix: true,
      name: true,
      lastUsedAt: true,
      createdAt: true,
      revokedAt: true,
      expiresAt: true,
    },
    where: eq(apiKeys.userId, userId),
    orderBy: (keys, { desc }) => [desc(keys.createdAt)],
  });
}

/**
 * Revoke an API key by setting revokedAt.
 * Only revokes if not already revoked.
 *
 * @returns true if a row was affected (key was active and is now revoked)
 */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  if (!db) {
    console.warn("Database not configured, skipping revokeApiKey");
    return false;
  }

  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)));

  return (result.count ?? 0) > 0;
}

/**
 * Set expiry on all active (non-revoked, non-expired) keys for a user.
 * Used when a user deletes their account to provide a grace period.
 *
 * @param userId - The user whose keys to expire
 * @param gracePeriodHours - Hours from now until keys expire
 */
export async function setKeyExpiry(userId: string, gracePeriodHours: number): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping setKeyExpiry");
    return;
  }

  const expiresAt = new Date(Date.now() + gracePeriodHours * 3600000);

  await db
    .update(apiKeys)
    .set({ expiresAt })
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt), isNull(apiKeys.expiresAt)));
}
