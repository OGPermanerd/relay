import { eq, and, sql, inArray, gt, desc } from "drizzle-orm";
import { db } from "../client";
import { userSkillViews, type UserSkillView } from "../schema/user-skill-views";
import { skills } from "../schema/skills";
import { skillVersions } from "../schema/skill-versions";
import { skillFeedback } from "../schema/skill-feedback";

/**
 * Item returned by getWhatsNewForUser — a skill updated since the user last viewed it.
 */
export interface WhatsNewItem {
  skillId: string;
  skillName: string;
  skillSlug: string;
  category: string;
  updatedAt: string; // ISO string
  lastViewedAt: string; // ISO string
  viewCount: number;
}

/**
 * Record (or re-record) a user viewing a skill.
 * UPSERT: inserts on first view, updates lastViewedAt/lastViewedVersion and increments viewCount on repeat.
 */
export async function recordSkillView(
  tenantId: string,
  userId: string,
  skillId: string,
  currentVersion: number | null
): Promise<void> {
  if (!db) {
    console.warn("Database not configured, skipping recordSkillView");
    return;
  }

  await db
    .insert(userSkillViews)
    .values({
      tenantId,
      userId,
      skillId,
      lastViewedAt: new Date(),
      lastViewedVersion: currentVersion,
      viewCount: 1,
    })
    .onConflictDoUpdate({
      target: [userSkillViews.tenantId, userSkillViews.userId, userSkillViews.skillId],
      set: {
        lastViewedAt: new Date(),
        lastViewedVersion: currentVersion,
        viewCount: sql`${userSkillViews.viewCount} + 1`,
      },
    });
}

/**
 * Get a single user's view record for a specific skill.
 * Used BEFORE recording a view to compute changes (version bump, new feedback, etc.).
 */
export async function getUserView(
  userId: string,
  skillId: string
): Promise<UserSkillView | undefined> {
  if (!db) return undefined;

  const [row] = await db
    .select()
    .from(userSkillViews)
    .where(and(eq(userSkillViews.userId, userId), eq(userSkillViews.skillId, skillId)))
    .limit(1);

  return row;
}

/**
 * Batch query: get all views for a user across multiple skills.
 * Returns a Map keyed by skillId for O(1) lookup per skill.
 * Used by "Updated" badge rendering to avoid N+1 queries.
 */
export async function getUserViewsForSkills(
  userId: string,
  skillIds: string[]
): Promise<Map<string, UserSkillView>> {
  if (!db || skillIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(userSkillViews)
    .where(and(eq(userSkillViews.userId, userId), inArray(userSkillViews.skillId, skillIds)));

  const map = new Map<string, UserSkillView>();
  for (const row of rows) {
    map.set(row.skillId, row);
  }
  return map;
}

/**
 * Get skills that have been updated since the user last viewed them.
 * Returns up to `limit` items within a 30-day window, newest first.
 * Used for the "What's New" feed.
 */
export async function getWhatsNewForUser(
  userId: string,
  limit: number = 10
): Promise<WhatsNewItem[]> {
  if (!db) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db
    .select({
      skillId: skills.id,
      skillName: skills.name,
      skillSlug: skills.slug,
      category: skills.category,
      updatedAt: skills.updatedAt,
      lastViewedAt: userSkillViews.lastViewedAt,
      viewCount: userSkillViews.viewCount,
    })
    .from(userSkillViews)
    .innerJoin(skills, eq(userSkillViews.skillId, skills.id))
    .where(
      and(
        eq(userSkillViews.userId, userId),
        gt(skills.updatedAt, userSkillViews.lastViewedAt),
        eq(skills.status, "published"),
        gt(skills.updatedAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(skills.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    skillId: row.skillId,
    skillName: row.skillName,
    skillSlug: row.skillSlug,
    category: row.category,
    updatedAt: row.updatedAt.toISOString(),
    lastViewedAt: row.lastViewedAt.toISOString(),
    viewCount: row.viewCount,
  }));
}

/**
 * Get the version number for a specific skill version ID.
 * Used when recording a view and when detecting version bumps.
 * Returns null if the version ID is not found.
 */
export async function getVersionNumber(versionId: string): Promise<number | null> {
  if (!db) return null;

  const [row] = await db
    .select({ version: skillVersions.version })
    .from(skillVersions)
    .where(eq(skillVersions.id, versionId))
    .limit(1);

  return row?.version ?? null;
}

/**
 * Count feedback items for a skill created after a given date.
 * Used by change detection (TEMP-03) to show "N new feedback" since last view.
 */
export async function countFeedbackSince(skillId: string, since: Date): Promise<number> {
  if (!db) return 0;

  const [result] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(skillFeedback)
    .where(and(eq(skillFeedback.skillId, skillId), gt(skillFeedback.createdAt, since)));

  return result?.count ?? 0;
}
