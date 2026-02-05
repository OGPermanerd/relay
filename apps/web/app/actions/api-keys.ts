"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { generateRawApiKey, hashApiKey, extractPrefix } from "@/lib/api-key-crypto";
import { db, apiKeys, users } from "@relay/db";
import { revokeApiKey, listUserKeys, setKeyExpiry } from "@relay/db/services/api-keys";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or less");

/**
 * Generate a new API key. Returns the raw key exactly once.
 * If forUserId is provided and differs from session user, requires admin.
 */
export async function generateApiKey(
  formData: FormData
): Promise<{ key?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to generate an API key" };
  }

  const rawName = formData.get("name");
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const name = parsed.data;

  const forUserId = formData.get("forUserId") as string | null;
  const targetUserId = forUserId || session.user.id;

  if (targetUserId !== session.user.id) {
    if (!isAdmin(session.user.email)) {
      return { error: "Only admins can generate keys for other users" };
    }
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = extractPrefix(rawKey);

  try {
    await db.insert(apiKeys).values({
      userId: targetUserId,
      keyHash,
      keyPrefix,
      name,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to insert API key:", error);
    }
    return { error: "Failed to generate API key. Please try again." };
  }

  revalidatePath("/profile");
  return { key: rawKey };
}

/**
 * Revoke an API key by id. Requires ownership or admin.
 */
export async function revokeApiKeyAction(
  keyId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to revoke an API key" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  // Verify ownership or admin status
  const existing = await db.query.apiKeys.findFirst({
    columns: { id: true, userId: true },
    where: eq(apiKeys.id, keyId),
  });

  if (!existing) {
    return { error: "API key not found" };
  }

  if (existing.userId !== session.user.id && !isAdmin(session.user.email)) {
    return { error: "You can only revoke your own API keys" };
  }

  const revoked = await revokeApiKey(keyId);
  if (!revoked) {
    return { error: "Key is already revoked" };
  }

  revalidatePath("/profile");
  return { success: true };
}

/**
 * Rotate API keys: expire all existing keys with a 24h grace period,
 * then generate a new key. Returns the raw key exactly once.
 */
export async function rotateApiKey(formData: FormData): Promise<{ key?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to rotate API keys" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  const rawName = formData.get("name");
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "Default";

  // Expire existing active keys with 24h grace period
  await setKeyExpiry(session.user.id, 24);

  // Generate new key
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = extractPrefix(rawKey);

  try {
    await db.insert(apiKeys).values({
      userId: session.user.id,
      keyHash,
      keyPrefix,
      name,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to insert rotated API key:", error);
    }
    return { error: "Failed to rotate API key. Please try again." };
  }

  revalidatePath("/profile");
  return { key: rawKey };
}

/**
 * List all API keys for the current user.
 * Never returns keyHash.
 */
export async function listApiKeysAction(): Promise<{
  keys?: Array<{
    id: string;
    keyPrefix: string;
    name: string;
    lastUsedAt: Date | null;
    createdAt: Date;
    revokedAt: Date | null;
    expiresAt: Date | null;
  }>;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to list API keys" };
  }

  const keys = await listUserKeys(session.user.id);
  return { keys };
}

/**
 * List all API keys across all users. Admin only.
 * Joins with users table to include name/email.
 */
export async function listAllApiKeysAction(): Promise<{
  keys?: Array<{
    id: string;
    userId: string;
    keyPrefix: string;
    name: string;
    lastUsedAt: Date | null;
    createdAt: Date;
    revokedAt: Date | null;
    expiresAt: Date | null;
    userName: string | null;
    userEmail: string | null;
  }>;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  if (!isAdmin(session.user.email)) {
    return { error: "Admin access required" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .orderBy(desc(apiKeys.createdAt));

  return { keys };
}
