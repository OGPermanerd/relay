import { db } from "../client";
import { siteSettings, type SiteSettings } from "../schema/site-settings";

const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedSettings: SiteSettings | null = null;
let cacheTimestamp = 0;

/**
 * Get site settings with 60s in-memory cache.
 * Returns null if DB is unavailable or no row exists.
 */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  if (!db) return null;

  try {
    const row = await db.query.siteSettings.findFirst({
      where: (t, { eq }) => eq(t.id, "default"),
    });
    cachedSettings = row ?? null;
    cacheTimestamp = now;
    return cachedSettings;
  } catch {
    return null;
  }
}

/**
 * Upsert site settings (insert or update on conflict).
 * Invalidates the in-memory cache after writing.
 */
export async function updateSiteSettings(
  updates: Partial<Omit<SiteSettings, "id">>
): Promise<SiteSettings | null> {
  if (!db) return null;

  const [row] = await db
    .insert(siteSettings)
    .values({ id: "default", ...updates, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { ...updates, updatedAt: new Date() },
    })
    .returning();

  cachedSettings = row;
  cacheTimestamp = Date.now();
  return row;
}

/** Force-clear the settings cache (useful after external updates). */
export function invalidateSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}
