import { db } from "../client";
import { gmailTokens } from "../schema/gmail-tokens";
import { encryptToken, decryptToken } from "../lib/crypto";
import { eq, and, or, lt, isNull } from "drizzle-orm";

// ---------- Types ----------

export interface UpsertGmailTokensParams {
  userId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface DecryptedGmailToken {
  id: string;
  userId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  keyVersion: number;
  connectedAt: Date;
}

// ---------- Custom Errors ----------

export class GmailNotConnectedError extends Error {
  constructor(userId?: string) {
    super(userId ? `No Gmail connection for user ${userId}` : "No Gmail connection");
    this.name = "GmailNotConnectedError";
  }
}

export class GmailTokenRevokedError extends Error {
  constructor() {
    super("Gmail token has been revoked — user must re-authenticate");
    this.name = "GmailTokenRevokedError";
  }
}

// ---------- Constants ----------

/** Refresh tokens 5 minutes before they expire */
const REFRESH_BUFFER_MS = 300_000;

/** Lock timeout: if a refreshing_at is older than 30s, consider the lock stale */
const LOCK_TIMEOUT_MS = 30_000;

/** Maximum retry count for waiting on a concurrent refresh */
const MAX_RETRIES = 3;

/** Wait time between retries when another process holds the refresh lock */
const RETRY_DELAY_MS = 2_000;

// ---------- Service Functions ----------

/**
 * Upsert Gmail OAuth tokens for a user.
 * Encrypts access and refresh tokens at rest.
 * ON CONFLICT (user_id) updates tokens and clears any refresh lock.
 */
export async function upsertGmailTokens(params: UpsertGmailTokensParams): Promise<void> {
  if (!db) throw new Error("Database not configured");

  const encryptedAccess = encryptToken(params.accessToken);
  const encryptedRefresh = encryptToken(params.refreshToken);

  await db
    .insert(gmailTokens)
    .values({
      tenantId: params.tenantId,
      userId: params.userId,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      expiresAt: params.expiresAt,
      scope: params.scope,
    })
    .onConflictDoUpdate({
      target: gmailTokens.userId,
      set: {
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        expiresAt: params.expiresAt,
        scope: params.scope,
        updatedAt: new Date(),
        refreshingAt: null,
      },
    });
}

/**
 * Read and decrypt Gmail tokens for a user.
 * Returns null if no connection exists.
 */
export async function getGmailTokenDecrypted(userId: string): Promise<DecryptedGmailToken | null> {
  if (!db) throw new Error("Database not configured");

  const row = await db.query.gmailTokens.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
  });

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    tenantId: row.tenantId,
    accessToken: decryptToken(row.encryptedAccessToken),
    refreshToken: decryptToken(row.encryptedRefreshToken),
    expiresAt: row.expiresAt,
    scope: row.scope,
    keyVersion: row.keyVersion,
    connectedAt: row.connectedAt,
  };
}

/**
 * Delete Gmail tokens for a user (disconnect).
 */
export async function deleteGmailTokens(userId: string): Promise<void> {
  if (!db) throw new Error("Database not configured");
  await db.delete(gmailTokens).where(eq(gmailTokens.userId, userId));
}

/**
 * Check if a user has an active Gmail connection.
 */
export async function hasActiveGmailConnection(userId: string): Promise<boolean> {
  if (!db) return false;

  const row = await db.query.gmailTokens.findFirst({
    where: (t, { eq: e }) => e(t.userId, userId),
    columns: { id: true },
  });

  return Boolean(row);
}

/**
 * Get a valid (non-expired) Gmail token, refreshing if needed.
 * Uses `refreshing_at` as a mutex to prevent concurrent refresh races.
 *
 * @throws GmailNotConnectedError if no tokens exist
 * @throws GmailTokenRevokedError if Google revoked the refresh token
 */
export async function getValidGmailToken(
  userId: string,
  retryCount = 0
): Promise<DecryptedGmailToken> {
  if (!db) throw new Error("Database not configured");

  const token = await getGmailTokenDecrypted(userId);
  if (!token) throw new GmailNotConnectedError(userId);

  // Token still valid (with buffer)
  if (token.expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
    return token;
  }

  // Token needs refresh — attempt to acquire lock
  const now = new Date();
  const lockCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);

  const lockResult = await db
    .update(gmailTokens)
    .set({ refreshingAt: now })
    .where(
      and(
        eq(gmailTokens.userId, userId),
        or(isNull(gmailTokens.refreshingAt), lt(gmailTokens.refreshingAt, lockCutoff))
      )
    )
    .returning({ id: gmailTokens.id });

  if (lockResult.length === 0) {
    // Another process holds the lock — wait and retry
    if (retryCount >= MAX_RETRIES) {
      throw new Error("Gmail token refresh timed out — concurrent refresh took too long");
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return getValidGmailToken(userId, retryCount + 1);
  }

  // Lock acquired — refresh the token
  try {
    const { OAuth2Client } = await import("google-auth-library");
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: token.refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const newAccessToken = credentials.access_token!;
    const newRefreshToken = credentials.refresh_token ?? token.refreshToken;
    const newExpiresAt = new Date(credentials.expiry_date ?? Date.now() + 3600_000);

    // Update with fresh tokens and release lock
    const encryptedAccess = encryptToken(newAccessToken);
    const encryptedRefresh = encryptToken(newRefreshToken);

    await db
      .update(gmailTokens)
      .set({
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
        refreshingAt: null,
      })
      .where(eq(gmailTokens.userId, userId));

    return {
      ...token,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    };
  } catch (error: unknown) {
    // Release lock on error
    await db.update(gmailTokens).set({ refreshingAt: null }).where(eq(gmailTokens.userId, userId));

    // If Google revoked the token, clean up and throw specific error
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("invalid_grant")) {
      await deleteGmailTokens(userId);
      throw new GmailTokenRevokedError();
    }

    throw error;
  }
}
