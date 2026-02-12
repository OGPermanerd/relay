import { sql } from "drizzle-orm";
import { db } from "../client";

export interface IntegrityIssue {
  check: string;
  severity: "warning" | "error";
  details: Record<string, unknown>;
}

export interface IntegrityReport {
  timestamp: string;
  duration: number;
  checks: number;
  issues: IntegrityIssue[];
  repaired: number;
}

/**
 * Check skills.totalUses vs actual COUNT(*) from usage_events
 */
async function checkUsageCounts(): Promise<IntegrityIssue[]> {
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.total_uses AS denormalized_count,
      COALESCE(ue.actual_count, 0)::int AS actual_count
    FROM skills s
    LEFT JOIN (
      SELECT skill_id, COUNT(*) AS actual_count
      FROM usage_events
      WHERE skill_id IS NOT NULL
      GROUP BY skill_id
    ) ue ON s.id = ue.skill_id
    WHERE s.total_uses != COALESCE(ue.actual_count, 0)
  `)) as unknown as {
    skill_id: string;
    skill_name: string;
    denormalized_count: number;
    actual_count: number;
  }[];

  return rows.map((r) => ({
    check: "usage_count_drift",
    severity: "warning" as const,
    details: {
      skillId: r.skill_id,
      skillName: r.skill_name,
      denormalized: r.denormalized_count,
      actual: r.actual_count,
      drift: r.denormalized_count - r.actual_count,
    },
  }));
}

/**
 * Check skills.averageRating vs actual AVG(rating)*100 from ratings
 */
async function checkRatingAverages(): Promise<IntegrityIssue[]> {
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.average_rating AS denormalized_rating,
      ROUND(AVG(r.rating) * 100)::int AS actual_rating
    FROM skills s
    INNER JOIN ratings r ON s.id = r.skill_id
    GROUP BY s.id, s.name, s.average_rating
    HAVING s.average_rating IS DISTINCT FROM ROUND(AVG(r.rating) * 100)::int
  `)) as unknown as {
    skill_id: string;
    skill_name: string;
    denormalized_rating: number | null;
    actual_rating: number;
  }[];

  return rows.map((r) => ({
    check: "rating_average_drift",
    severity: "warning" as const,
    details: {
      skillId: r.skill_id,
      skillName: r.skill_name,
      denormalized: r.denormalized_rating,
      actual: r.actual_rating,
    },
  }));
}

/**
 * Check tenant_id mismatches: usage_events referencing users in a different tenant
 */
async function checkTenantAlignment(): Promise<IntegrityIssue[]> {
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT
      ue.id AS event_id,
      ue.tenant_id AS event_tenant,
      ue.user_id,
      u.tenant_id AS user_tenant
    FROM usage_events ue
    INNER JOIN users u ON ue.user_id = u.id
    WHERE ue.tenant_id != u.tenant_id
    LIMIT 100
  `)) as unknown as {
    event_id: string;
    event_tenant: string;
    user_id: string;
    user_tenant: string;
  }[];

  return rows.map((r) => ({
    check: "tenant_mismatch_usage_events",
    severity: "error" as const,
    details: {
      eventId: r.event_id,
      userId: r.user_id,
      eventTenant: r.event_tenant,
      userTenant: r.user_tenant,
    },
  }));
}

/**
 * Check skills with author_id pointing to a user in a different tenant
 */
async function checkSkillAuthorTenant(): Promise<IntegrityIssue[]> {
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT
      s.id AS skill_id,
      s.name AS skill_name,
      s.tenant_id AS skill_tenant,
      s.author_id,
      u.tenant_id AS author_tenant
    FROM skills s
    INNER JOIN users u ON s.author_id = u.id
    WHERE s.tenant_id != u.tenant_id
    LIMIT 100
  `)) as unknown as {
    skill_id: string;
    skill_name: string;
    skill_tenant: string;
    author_id: string;
    author_tenant: string;
  }[];

  return rows.map((r) => ({
    check: "tenant_mismatch_skill_author",
    severity: "error" as const,
    details: {
      skillId: r.skill_id,
      skillName: r.skill_name,
      skillTenant: r.skill_tenant,
      authorId: r.author_id,
      authorTenant: r.author_tenant,
    },
  }));
}

/**
 * Check ratings with tenant_id mismatch vs user or skill
 */
async function checkRatingTenantAlignment(): Promise<IntegrityIssue[]> {
  if (!db) return [];

  const rows = (await db.execute(sql`
    SELECT
      r.id AS rating_id,
      r.tenant_id AS rating_tenant,
      r.user_id,
      u.tenant_id AS user_tenant,
      r.skill_id,
      s.tenant_id AS skill_tenant
    FROM ratings r
    INNER JOIN users u ON r.user_id = u.id
    INNER JOIN skills s ON r.skill_id = s.id
    WHERE r.tenant_id != u.tenant_id OR r.tenant_id != s.tenant_id
    LIMIT 100
  `)) as unknown as {
    rating_id: string;
    rating_tenant: string;
    user_id: string;
    user_tenant: string;
    skill_id: string;
    skill_tenant: string;
  }[];

  return rows.map((r) => ({
    check: "tenant_mismatch_ratings",
    severity: "error" as const,
    details: {
      ratingId: r.rating_id,
      ratingTenant: r.rating_tenant,
      userId: r.user_id,
      userTenant: r.user_tenant,
      skillId: r.skill_id,
      skillTenant: r.skill_tenant,
    },
  }));
}

/**
 * Repair drifted usage counts by recalculating from usage_events
 */
async function repairUsageCounts(): Promise<number> {
  if (!db) return 0;

  const result = await db.execute(sql`
    UPDATE skills s
    SET total_uses = COALESCE(ue.actual_count, 0),
        updated_at = NOW()
    FROM (
      SELECT skill_id, COUNT(*) AS actual_count
      FROM usage_events
      WHERE skill_id IS NOT NULL
      GROUP BY skill_id
    ) ue
    WHERE s.id = ue.skill_id
      AND s.total_uses != ue.actual_count
  `);

  // Also zero out skills with totalUses > 0 but no usage_events
  await db.execute(sql`
    UPDATE skills s
    SET total_uses = 0, updated_at = NOW()
    WHERE s.total_uses > 0
      AND NOT EXISTS (
        SELECT 1 FROM usage_events ue WHERE ue.skill_id = s.id
      )
  `);

  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

/**
 * Repair drifted rating averages by recalculating from ratings table
 */
async function repairRatingAverages(): Promise<number> {
  if (!db) return 0;

  const result = await db.execute(sql`
    UPDATE skills s
    SET average_rating = sub.actual_rating,
        updated_at = NOW()
    FROM (
      SELECT skill_id, ROUND(AVG(rating) * 100)::int AS actual_rating
      FROM ratings
      GROUP BY skill_id
    ) sub
    WHERE s.id = sub.skill_id
      AND s.average_rating IS DISTINCT FROM sub.actual_rating
  `);

  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

/**
 * Run all integrity checks and optionally auto-repair drifted counters.
 */
export async function runIntegrityCheck(options?: {
  autoRepair?: boolean;
}): Promise<IntegrityReport> {
  const start = Date.now();
  const autoRepair = options?.autoRepair ?? false;

  const [usageIssues, ratingIssues, tenantIssues, authorIssues, ratingTenantIssues] =
    await Promise.all([
      checkUsageCounts(),
      checkRatingAverages(),
      checkTenantAlignment(),
      checkSkillAuthorTenant(),
      checkRatingTenantAlignment(),
    ]);

  const issues = [
    ...usageIssues,
    ...ratingIssues,
    ...tenantIssues,
    ...authorIssues,
    ...ratingTenantIssues,
  ];

  let repaired = 0;

  if (autoRepair) {
    const [usageRepaired, ratingRepaired] = await Promise.all([
      usageIssues.length > 0 ? repairUsageCounts() : 0,
      ratingIssues.length > 0 ? repairRatingAverages() : 0,
    ]);
    repaired = usageRepaired + ratingRepaired;
  }

  return {
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
    checks: 5,
    issues,
    repaired,
  };
}
