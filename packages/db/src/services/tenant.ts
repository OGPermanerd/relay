import { db } from "../client";
import { tenants } from "../schema";
import { eq, and } from "drizzle-orm";

// Re-export Tenant type for convenience
export type { Tenant, NewTenant } from "../schema/tenants";

/**
 * Look up an active tenant by slug.
 * Returns the tenant record or null if not found / inactive.
 */
export async function getTenantBySlug(slug: string) {
  if (!db) return null;

  try {
    const [row] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.slug, slug), eq(tenants.isActive, true)))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Look up an active tenant by custom domain.
 * Returns the tenant record or null if not found / inactive / no domain set.
 */
export async function getTenantByDomain(domain: string) {
  if (!db) return null;

  try {
    const [row] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.domain, domain), eq(tenants.isActive, true)))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}
