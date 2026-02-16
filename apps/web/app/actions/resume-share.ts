"use server";

import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

// =============================================================================
// Create Resume Share
// =============================================================================

/**
 * Create a new resume share token.
 *
 * Revokes any existing active share for the user before creating a new one
 * (revoke-and-replace pattern). This ensures only one active share exists.
 *
 * @param includeCompanySkills - Whether to include company (tenant) skills in the resume
 * @returns The new share token and URL, or an error
 */
export async function createResumeShare(
  includeCompanySkills: boolean = false
): Promise<{ token: string; url: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to create a resume share" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { error: "Tenant not resolved" };
  }

  if (!db) {
    return { error: "Database not available" };
  }

  const userId = session.user.id;
  const token = crypto.randomUUID();
  const id = crypto.randomUUID();

  // Revoke any existing active shares for this user
  await db.execute(sql`
    UPDATE resume_shares
    SET revoked_at = NOW()
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
  `);

  // Insert new share
  await db.execute(sql`
    INSERT INTO resume_shares (id, tenant_id, user_id, token, include_company_skills)
    VALUES (${id}, ${tenantId}, ${userId}, ${token}, ${includeCompanySkills})
  `);

  return { token, url: `/r/${token}` };
}

// =============================================================================
// Revoke Resume Share
// =============================================================================

/**
 * Revoke all active resume shares for the current user.
 * Sets revoked_at = NOW() on any shares that haven't been revoked yet.
 */
export async function revokeResumeShare(): Promise<{ success: boolean } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to revoke a resume share" };
  }

  if (!db) {
    return { error: "Database not available" };
  }

  await db.execute(sql`
    UPDATE resume_shares
    SET revoked_at = NOW()
    WHERE user_id = ${session.user.id}
      AND revoked_at IS NULL
  `);

  return { success: true };
}

// =============================================================================
// Get Active Share
// =============================================================================

/**
 * Get the current user's active (non-revoked, non-expired) resume share.
 *
 * @returns The active share details, or null if no active share exists
 */
export async function getActiveShare(): Promise<{
  token: string;
  includeCompanySkills: boolean;
  url: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!db) return null;

  const result = await db.execute(sql`
    SELECT token, include_company_skills
    FROM resume_shares
    WHERE user_id = ${session.user.id}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  if (!row) return null;

  const token = String(row.token);
  return {
    token,
    includeCompanySkills: Boolean(row.include_company_skills),
    url: `/r/${token}`,
  };
}
