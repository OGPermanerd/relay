import { db } from "../client";
import { siteSettings, type SiteSettings } from "../schema/site-settings";
import { eq, and } from "drizzle-orm";

const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedSettings: Map<string, { data: SiteSettings; timestamp: number }> = new Map();

/**
 * Get site settings with 60s in-memory cache.
 * Returns null if DB is unavailable or no row exists.
 */
export async function getSiteSettings(tenantId?: string): Promise<SiteSettings | null> {
  const cacheKey = tenantId ?? "__legacy__";
  const now = Date.now();
  const cached = cachedSettings.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!db) return null;

  try {
    const row = tenantId
      ? await db.query.siteSettings.findFirst({
          where: (t, { eq: e, and: a }) => a(e(t.id, "default"), e(t.tenantId, tenantId)),
        })
      : await db.query.siteSettings.findFirst({
          where: (t, { eq: e }) => e(t.id, "default"),
        });
    if (row) {
      cachedSettings.set(cacheKey, { data: row, timestamp: now });
    }
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert site settings (insert or update on conflict).
 * Invalidates the in-memory cache after writing.
 */
export async function updateSiteSettings(
  updates: Partial<Omit<SiteSettings, "id">>,
  tenantId?: string
): Promise<SiteSettings | null> {
  if (!db) return null;

  // tenantId is required at the schema level; callers should pass it.
  // Fallback to "default" for legacy single-tenant compat during migration.
  const tid = tenantId ?? updates.tenantId ?? "default";

  const [row] = await db
    .insert(siteSettings)
    .values({ id: "default", tenantId: tid, ...updates, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { ...updates, updatedAt: new Date() },
    })
    .returning();

  const cacheKey = tenantId ?? "__legacy__";
  cachedSettings.set(cacheKey, { data: row, timestamp: Date.now() });
  return row;
}

/** Force-clear the settings cache (useful after external updates). */
export function invalidateSettingsCache(): void {
  cachedSettings.clear();
}
