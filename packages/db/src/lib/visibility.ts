import { sql, eq, or, and, type SQL } from "drizzle-orm";
import { skills } from "../schema/skills";

/**
 * The 4 visibility levels for skills:
 * - global_approved: Visible across all tenants (curated/marketplace skills)
 * - tenant: Visible to all users within the same tenant (company-visible)
 * - personal: Visible to the author and org members browsing the author's profile
 * - private: Visible only to the author (draft/hidden)
 */
export const VISIBILITY_LEVELS = ["global_approved", "tenant", "personal", "private"] as const;

export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

/**
 * Levels that are visible at the org/tenant scope (browsable by all org members).
 */
export const ORG_VISIBLE_LEVELS = ["global_approved", "tenant"] as const;

/**
 * Returns true if the given visibility level is org-visible
 * (visible to all members of a tenant without needing to be the author).
 */
export function isOrgVisible(visibility: string): boolean {
  return visibility === "global_approved" || visibility === "tenant";
}

/**
 * Raw SQL clause that matches only org-visible skills.
 * Use in template-string queries.
 */
export function orgVisibleSQL(): SQL {
  return sql`visibility IN ('global_approved', 'tenant')`;
}

/**
 * Build a Drizzle query-builder visibility filter.
 *
 * - No userId (anonymous): global_approved and tenant skills only
 * - With userId: global_approved, tenant, own personal, and own private skills
 */
export function buildVisibilityFilter(userId?: string): SQL {
  if (!userId) {
    return or(eq(skills.visibility, "global_approved"), eq(skills.visibility, "tenant"))!;
  }

  return or(
    eq(skills.visibility, "global_approved"),
    eq(skills.visibility, "tenant"),
    and(eq(skills.visibility, "personal"), eq(skills.authorId, userId)),
    and(eq(skills.visibility, "private"), eq(skills.authorId, userId))
  )!;
}

/**
 * Build a raw SQL visibility clause for template-string queries.
 *
 * - No userId (anonymous): global_approved and tenant skills only
 * - With userId: global_approved, tenant, own personal, and own private skills
 */
export function visibilitySQL(userId?: string): SQL {
  if (!userId) {
    return sql`visibility IN ('global_approved', 'tenant')`;
  }

  return sql`(visibility IN ('global_approved', 'tenant') OR (visibility IN ('personal', 'private') AND author_id = ${userId}))`;
}
