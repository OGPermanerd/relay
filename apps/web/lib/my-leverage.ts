import { db } from "@relay/db";
import { sql } from "drizzle-orm";

/**
 * Timeline entry for a skill the user has used
 */
export interface TimelineEntry {
  skillId: string | null;
  skillName: string | null;
  category: string | null;
  action: string; // toolName from usage_events
  timestamp: Date;
  hoursSaved: number; // COALESCE(rating estimate, creator estimate, 1)
}

/**
 * Aggregate stats for skills the user has used
 */
export interface SkillsUsedStats {
  totalSkills: number;
  totalHoursSaved: number;
  totalActions: number;
  mostUsedSkill: string | null;
}

/**
 * Entry for a skill the user has created (authored)
 */
export interface CreatedSkillEntry {
  skillId: string;
  name: string;
  category: string;
  totalUses: number;
  hoursPerUse: number;
  totalHoursSaved: number;
  uniqueUsers: number;
  avgRating: number | null; // null if no ratings
}

/**
 * Aggregate stats for skills the user has created
 */
export interface SkillsCreatedStats {
  skillsPublished: number;
  hoursSavedByOthers: number;
  uniqueUsers: number;
  avgRating: number | null;
}

/**
 * Get paginated timeline of skills used by a specific user
 *
 * Returns usage events with skill details and hours saved estimates.
 * Uses COALESCE fallback chain: rating estimate -> creator estimate -> 1 hour.
 * Uses COUNT(*) OVER() window function for efficient total count.
 *
 * @param userId The user whose usage to retrieve
 * @param limit Maximum entries per page (default: 20)
 * @param offset Pagination offset (default: 0)
 * @returns Paginated timeline entries with total count
 */
export async function getSkillsUsed(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ items: TimelineEntry[]; total: number }> {
  if (!db) return { items: [], total: 0 };

  const result = await db.execute(sql`
    SELECT
      ue.skill_id,
      s.name AS skill_name,
      s.category,
      ue.tool_name AS action,
      ue.created_at AS timestamp,
      COALESCE(r.hours_saved_estimate, s.hours_saved, 1) AS hours_saved,
      COUNT(*) OVER() AS total_count
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    WHERE ue.user_id = ${userId}
    ORDER BY ue.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows = result as unknown as Record<string, unknown>[];

  if (rows.length === 0) {
    return { items: [], total: 0 };
  }

  const total = Number(rows[0].total_count);

  const items: TimelineEntry[] = rows.map((row) => ({
    skillId: row.skill_id ? String(row.skill_id) : null,
    skillName: row.skill_name ? String(row.skill_name) : null,
    category: row.category ? String(row.category) : null,
    action: String(row.action),
    timestamp: new Date(String(row.timestamp)),
    hoursSaved: Number(row.hours_saved),
  }));

  return { items, total };
}

/**
 * Get aggregate stats for skills used by a specific user
 *
 * Returns total unique skills used, total hours saved, total actions,
 * and the name of the most-used skill.
 * Uses COALESCE fallback chain for hours: rating estimate -> creator estimate -> 1.
 *
 * @param userId The user whose stats to retrieve
 * @returns Aggregate usage statistics
 */
export async function getSkillsUsedStats(userId: string): Promise<SkillsUsedStats> {
  if (!db) {
    return { totalSkills: 0, totalHoursSaved: 0, totalActions: 0, mostUsedSkill: null };
  }

  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ue.skill_id) AS total_skills,
      COALESCE(SUM(COALESCE(r.hours_saved_estimate, s.hours_saved, 1)), 0) AS total_hours_saved,
      COUNT(*) AS total_actions,
      (
        SELECT s2.name
        FROM usage_events ue2
        LEFT JOIN skills s2 ON s2.id = ue2.skill_id
        WHERE ue2.user_id = ${userId}
        GROUP BY ue2.skill_id, s2.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS most_used_skill
    FROM usage_events ue
    LEFT JOIN skills s ON s.id = ue.skill_id
    LEFT JOIN ratings r ON r.skill_id = ue.skill_id AND r.user_id = ue.user_id
    WHERE ue.user_id = ${userId}
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  return {
    totalSkills: Number(row?.total_skills ?? 0),
    totalHoursSaved: Number(row?.total_hours_saved ?? 0),
    totalActions: Number(row?.total_actions ?? 0),
    mostUsedSkill: row?.most_used_skill ? String(row.most_used_skill) : null,
  };
}

/**
 * Get skills created (authored and published) by a specific user with impact metrics
 *
 * Returns published skills with usage counts, hours saved, unique users, and ratings.
 * Only includes skills with a published version (published_version_id IS NOT NULL).
 * Hours per use uses COALESCE(s.hours_saved, 1) fallback.
 *
 * @param userId The author whose skills to retrieve
 * @returns List of created skills with impact metrics
 */
export async function getSkillsCreated(userId: string): Promise<{ items: CreatedSkillEntry[] }> {
  if (!db) return { items: [] };

  const result = await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name,
      s.category,
      COUNT(ue.id)::integer AS total_uses,
      COALESCE(s.hours_saved, 1) AS hours_per_use,
      (COUNT(ue.id) * COALESCE(s.hours_saved, 1))::double precision AS total_hours_saved,
      COUNT(DISTINCT ue.user_id)::integer AS unique_users,
      CASE
        WHEN s.average_rating IS NOT NULL THEN (s.average_rating / 100.0)::double precision
        ELSE NULL
      END AS avg_rating
    FROM skills s
    LEFT JOIN usage_events ue ON ue.skill_id = s.id
    WHERE s.author_id = ${userId}
      AND s.published_version_id IS NOT NULL
    GROUP BY s.id, s.name, s.category, s.hours_saved, s.average_rating
    ORDER BY total_hours_saved DESC
  `);

  const rows = result as unknown as Record<string, unknown>[];

  const items: CreatedSkillEntry[] = rows.map((row) => ({
    skillId: String(row.skill_id),
    name: String(row.name),
    category: String(row.category),
    totalUses: Number(row.total_uses),
    hoursPerUse: Number(row.hours_per_use),
    totalHoursSaved: Number(row.total_hours_saved),
    uniqueUsers: Number(row.unique_users),
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
  }));

  return { items };
}

/**
 * Get aggregate stats for skills created by a specific user
 *
 * Returns total published skills, hours saved by others using those skills,
 * unique users across all skills, and average rating.
 *
 * @param userId The author whose stats to retrieve
 * @returns Aggregate creation statistics
 */
export async function getSkillsCreatedStats(userId: string): Promise<SkillsCreatedStats> {
  if (!db) {
    return { skillsPublished: 0, hoursSavedByOthers: 0, uniqueUsers: 0, avgRating: null };
  }

  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT s.id)::integer AS skills_published,
      COALESCE(SUM(s.total_uses * COALESCE(s.hours_saved, 1)), 0)::double precision AS hours_saved_by_others,
      COUNT(DISTINCT ue.user_id)::integer AS unique_users,
      CASE
        WHEN AVG(s.average_rating) IS NOT NULL THEN (AVG(s.average_rating) / 100.0)::double precision
        ELSE NULL
      END AS avg_rating
    FROM skills s
    LEFT JOIN usage_events ue ON ue.skill_id = s.id
    WHERE s.author_id = ${userId}
      AND s.published_version_id IS NOT NULL
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  return {
    skillsPublished: Number(row?.skills_published ?? 0),
    hoursSavedByOthers: Number(row?.hours_saved_by_others ?? 0),
    uniqueUsers: Number(row?.unique_users ?? 0),
    avgRating: row?.avg_rating != null ? Number(row.avg_rating) : null,
  };
}
