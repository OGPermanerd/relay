import { db } from "../client";
import { tokenMeasurements } from "../schema/token-measurements";
import { skills } from "../schema/skills";
import { eq, sql } from "drizzle-orm";
import { estimateCostMicrocents } from "./pricing";

export interface InsertTokenMeasurementInput {
  tenantId: string;
  skillId: string;
  userId?: string;
  usageEventId?: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
}

export interface SkillCostStats {
  totalCostMicrocents: number;
  avgCostPerUseMicrocents: number;
  measurementCount: number;
  predominantModel: string | null;
}

/**
 * Insert a token measurement and update the skill's avgTokenCostMicrocents.
 * Fire-and-forget safe: catches all errors, never throws.
 */
export async function insertTokenMeasurement(input: InsertTokenMeasurementInput): Promise<void> {
  if (!db) return;

  try {
    const totalTokens = input.inputTokens + input.outputTokens;
    const costMicrocents = estimateCostMicrocents(
      input.modelName,
      input.inputTokens,
      input.outputTokens
    );

    // Insert the measurement
    await db.insert(tokenMeasurements).values({
      tenantId: input.tenantId,
      skillId: input.skillId,
      userId: input.userId ?? null,
      usageEventId: input.usageEventId ?? null,
      modelName: input.modelName,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens,
      estimatedCostMicrocents: costMicrocents,
      latencyMs: input.latencyMs ?? null,
      source: "hook",
    });

    // Update skill's aggregate avgTokenCostMicrocents
    await db
      .update(skills)
      .set({
        avgTokenCostMicrocents: sql<number>`(
          SELECT COALESCE(AVG(${tokenMeasurements.estimatedCostMicrocents})::int, 0)
          FROM ${tokenMeasurements}
          WHERE ${tokenMeasurements.skillId} = ${input.skillId}
            AND ${tokenMeasurements.estimatedCostMicrocents} IS NOT NULL
        )`,
      })
      .where(eq(skills.id, input.skillId));
  } catch (error) {
    console.error("Failed to insert token measurement:", error);
  }
}

/**
 * Get aggregated cost statistics for a skill.
 */
export async function getSkillCostStats(skillId: string): Promise<SkillCostStats> {
  const defaultStats: SkillCostStats = {
    totalCostMicrocents: 0,
    avgCostPerUseMicrocents: 0,
    measurementCount: 0,
    predominantModel: null,
  };

  if (!db) return defaultStats;

  try {
    const [stats] = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${tokenMeasurements.estimatedCostMicrocents}), 0)::int`,
        avgCost: sql<number>`COALESCE(AVG(${tokenMeasurements.estimatedCostMicrocents}), 0)::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(tokenMeasurements)
      .where(eq(tokenMeasurements.skillId, skillId));

    // Get predominant model (mode)
    const [modelResult] = await db
      .select({
        modelName: tokenMeasurements.modelName,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(tokenMeasurements)
      .where(eq(tokenMeasurements.skillId, skillId))
      .groupBy(tokenMeasurements.modelName)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(1);

    return {
      totalCostMicrocents: stats?.totalCost ?? 0,
      avgCostPerUseMicrocents: stats?.avgCost ?? 0,
      measurementCount: stats?.count ?? 0,
      predominantModel: modelResult?.modelName ?? null,
    };
  } catch (error) {
    console.error("Failed to get skill cost stats:", error);
    return defaultStats;
  }
}
