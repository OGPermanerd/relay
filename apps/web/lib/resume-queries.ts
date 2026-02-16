import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";
import { calculateQualityScore, QUALITY_TIERS, type QualityTier } from "@/lib/quality-score";
import { HOURLY_RATE } from "@/lib/ip-valuation";

// =============================================================================
// Types
// =============================================================================

export interface ResumeSkill {
  id: string;
  name: string;
  category: string;
  totalUses: number;
  hoursSaved: number;
  totalHoursSaved: number;
  avgRating: string | null;
  visibility: string;
  createdAt: string;
  qualityTier: string; // "Gold", "Silver", "Bronze", "Unrated", "No Badge"
  qualityScore: number;
  totalRatings: number;
}

export interface ResumeData {
  userName: string;
  skillsAuthored: number;
  totalHoursSaved: number;
  peopleHelped: number;
  estimatedValue: number; // totalHoursSaved * HOURLY_RATE
  skills: ResumeSkill[];
  qualityAchievements: { gold: number; silver: number; bronze: number };
  contributionSpan: { first: string | null; latest: string | null }; // ISO dates
}

// =============================================================================
// Resume Data Query
// =============================================================================

/**
 * Get aggregated resume data for a user's published skills.
 *
 * Runs 4 parallel queries:
 * 1. Stats (skills authored, total hours saved)
 * 2. Skills list with total_ratings subquery for quality scoring
 * 3. People helped (distinct users of the author's skills)
 * 4. User name
 *
 * For each skill, computes quality tier via calculateQualityScore().
 *
 * @param userId - The author whose resume to generate
 * @param includeCompanySkills - If true, include all skills; if false, only personal
 */
export async function getResumeData(
  userId: string,
  includeCompanySkills: boolean = false
): Promise<ResumeData> {
  if (!db) {
    return {
      userName: "",
      skillsAuthored: 0,
      totalHoursSaved: 0,
      peopleHelped: 0,
      estimatedValue: 0,
      skills: [],
      qualityAchievements: { gold: 0, silver: 0, bronze: 0 },
      contributionSpan: { first: null, latest: null },
    };
  }

  const visibilityClause = includeCompanySkills ? sql`` : sql`AND s.visibility = 'personal'`;

  const [statsResult, skillsResult, peopleResult, userResult] = await Promise.all([
    // 1. Stats query
    db.execute(sql`
      SELECT
        COUNT(*)::integer AS skills_authored,
        COALESCE(SUM(total_uses * COALESCE(hours_saved, 1)), 0)::double precision AS total_hours_saved
      FROM skills s
      WHERE s.author_id = ${userId}
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        ${visibilityClause}
    `),

    // 2. Skills list with total_ratings for quality scoring
    db.execute(sql`
      SELECT
        s.id,
        s.name,
        s.category,
        COALESCE(s.total_uses, 0)::integer AS total_uses,
        COALESCE(s.hours_saved, 1)::integer AS hours_saved,
        (COALESCE(s.total_uses, 0) * COALESCE(s.hours_saved, 1))::double precision AS total_hours_saved,
        CASE
          WHEN s.average_rating IS NOT NULL AND s.average_rating > 0
            THEN (s.average_rating / 100.0)::numeric(3,1)::text
          ELSE NULL
        END AS avg_rating,
        s.average_rating AS avg_rating_raw,
        s.visibility,
        s.created_at,
        s.description,
        s.category AS has_category,
        (SELECT COUNT(*)::integer FROM ratings r WHERE r.skill_id = s.id) AS total_ratings
      FROM skills s
      WHERE s.author_id = ${userId}
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        ${visibilityClause}
      ORDER BY total_hours_saved DESC
    `),

    // 3. People helped (distinct users of author's skills)
    db.execute(sql`
      SELECT COUNT(DISTINCT ue.user_id)::integer AS people_helped
      FROM usage_events ue
      JOIN skills s ON s.id = ue.skill_id
      WHERE s.author_id = ${userId}
        AND s.published_version_id IS NOT NULL
        AND s.status = 'published'
        ${visibilityClause}
    `),

    // 4. User name
    db.execute(sql`
      SELECT name FROM users WHERE id = ${userId} LIMIT 1
    `),
  ]);

  // Parse stats
  const statsRows = statsResult as unknown as Record<string, unknown>[];
  const statsRow = statsRows[0];
  const skillsAuthored = Number(statsRow?.skills_authored ?? 0);
  const totalHoursSaved = Number(statsRow?.total_hours_saved ?? 0);

  // Parse people helped
  const peopleRows = peopleResult as unknown as Record<string, unknown>[];
  const peopleHelped = Number(peopleRows[0]?.people_helped ?? 0);

  // Parse user name
  const userRows = userResult as unknown as Record<string, unknown>[];
  const userName = userRows[0]?.name ? String(userRows[0].name) : "";

  // Parse skills and compute quality tiers
  const skillRows = skillsResult as unknown as Record<string, unknown>[];
  const qualityAchievements = { gold: 0, silver: 0, bronze: 0 };

  const skills: ResumeSkill[] = skillRows.map((row) => {
    const totalUses = Number(row.total_uses ?? 0);
    const avgRatingRaw = row.avg_rating_raw != null ? Number(row.avg_rating_raw) : null;
    const totalRatings = Number(row.total_ratings ?? 0);
    const hasDescription = !!row.description;
    const hasCategory = !!row.has_category;

    const qualityResult = calculateQualityScore({
      totalUses,
      averageRating: avgRatingRaw,
      totalRatings,
      hasDescription,
      hasCategory,
    });

    const tier = qualityResult.tier as QualityTier;
    const qualityTier = QUALITY_TIERS[tier].label;

    // Count achievements
    if (tier === "gold") qualityAchievements.gold++;
    else if (tier === "silver") qualityAchievements.silver++;
    else if (tier === "bronze") qualityAchievements.bronze++;

    return {
      id: String(row.id),
      name: String(row.name),
      category: String(row.category),
      totalUses,
      hoursSaved: Number(row.hours_saved ?? 1),
      totalHoursSaved: Number(row.total_hours_saved ?? 0),
      avgRating: row.avg_rating ? String(row.avg_rating) : null,
      visibility: String(row.visibility),
      createdAt: new Date(String(row.created_at)).toISOString(),
      qualityTier,
      qualityScore: qualityResult.score,
      totalRatings,
    };
  });

  // Compute contribution span from skills list
  let first: string | null = null;
  let latest: string | null = null;
  if (skills.length > 0) {
    const dates = skills.map((s) => new Date(s.createdAt).getTime());
    first = new Date(Math.min(...dates)).toISOString();
    latest = new Date(Math.max(...dates)).toISOString();
  }

  return {
    userName,
    skillsAuthored,
    totalHoursSaved,
    peopleHelped,
    estimatedValue: totalHoursSaved * HOURLY_RATE,
    skills,
    qualityAchievements,
    contributionSpan: { first, latest },
  };
}

// =============================================================================
// Public Token Resolution
// =============================================================================

/**
 * Resolve a public resume share token to resume data.
 *
 * Validates the token is:
 * - Not revoked (revoked_at IS NULL)
 * - Not expired (expires_at IS NULL OR expires_at > NOW())
 *
 * @param token - The share token from the URL
 * @returns Resume data if token is valid, null otherwise
 */
export async function getResumeByToken(token: string): Promise<ResumeData | null> {
  if (!db) return null;

  const result = await db.execute(sql`
    SELECT user_id, tenant_id, include_company_skills
    FROM resume_shares
    WHERE token = ${token}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `);

  const rows = result as unknown as Record<string, unknown>[];
  const row = rows[0];

  if (!row) return null;

  const userId = String(row.user_id);
  const includeCompanySkills = Boolean(row.include_company_skills);

  return getResumeData(userId, includeCompanySkills);
}
