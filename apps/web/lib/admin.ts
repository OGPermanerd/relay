import type { Session } from "next-auth";

/**
 * Check if a user has the admin role.
 * Reads from session.user.role which is populated by the JWT callback
 * from the users.role column (see auth.ts).
 *
 * Note: This signature change intentionally breaks callers that pass
 * email strings. Those callers are migrated in plan 32-06.
 */
export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === "admin";
}
