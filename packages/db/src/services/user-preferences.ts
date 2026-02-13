import { eq } from "drizzle-orm";
import { db } from "../client";
import { userPreferences, type UserPreferencesData } from "../schema/user-preferences";

/**
 * Default values for user preferences.
 * Mirrored from apps/web/lib/preferences-defaults.ts to avoid cross-package imports.
 */
const PREFERENCES_DEFAULTS: UserPreferencesData = {
  preferredCategories: [],
  defaultSort: "days_saved",
  claudeMdWorkflowNotes: "",
};

/**
 * Get user preferences, creating a default row if none exists.
 * Uses ON CONFLICT DO NOTHING to handle concurrent inserts safely.
 * Returns preferences merged with code defaults (so new fields always have values).
 */
export async function getOrCreateUserPreferences(
  userId: string,
  tenantId: string
): Promise<UserPreferencesData | null> {
  if (!db) return null;

  // Try to find existing preferences
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));

  if (existing) {
    return { ...PREFERENCES_DEFAULTS, ...existing.preferences };
  }

  // Insert defaults, ON CONFLICT DO NOTHING for race condition safety
  await db
    .insert(userPreferences)
    .values({ userId, tenantId, preferences: PREFERENCES_DEFAULTS })
    .onConflictDoNothing({ target: userPreferences.userId });

  // Re-fetch to get the full row (handles both insert and conflict cases)
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));

  if (!row) return null;
  return { ...PREFERENCES_DEFAULTS, ...row.preferences };
}

/**
 * Update user preferences JSONB column.
 * Validation is expected to happen in the server action layer (apps/web).
 */
export async function updateUserPreferences(
  userId: string,
  preferences: UserPreferencesData
): Promise<void> {
  if (!db) return;
  await db
    .update(userPreferences)
    .set({ preferences, updatedAt: new Date() })
    .where(eq(userPreferences.userId, userId));
}
