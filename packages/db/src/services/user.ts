import { db } from "../client";
import { users } from "../schema";
import { eq, asc, and } from "drizzle-orm";

/**
 * Check if this would be the first user in a tenant.
 * Useful for auto-assigning admin role on first sign-up.
 */
export async function isFirstUserInTenant(tenantId: string): Promise<boolean> {
  if (!db) return false;

  try {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .limit(1);
    return !row;
  } catch {
    return false;
  }
}

/**
 * Get the role of a specific user by ID.
 * Returns 'admin' | 'member' or null if user not found.
 */
export async function getUserRole(userId: string): Promise<"admin" | "member" | null> {
  if (!db) return null;

  try {
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Set the role of a specific user.
 * Returns true on success, false on failure.
 */
export async function setUserRole(userId: string, role: "admin" | "member"): Promise<boolean> {
  if (!db) return false;

  try {
    const result = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return (result?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Get all users in a tenant, ordered by creation date.
 * Returns user id, email, name, role, and createdAt.
 */
export async function getUsersInTenant(tenantId: string) {
  if (!db) return [];

  try {
    return await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        image: users.image,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(asc(users.createdAt));
  } catch {
    return [];
  }
}

/**
 * Get all admin users in a tenant.
 * Returns id, email, and name for notification dispatch.
 */
export async function getAdminsInTenant(tenantId: string) {
  if (!db) return [];
  try {
    return await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")));
  } catch {
    return [];
  }
}
