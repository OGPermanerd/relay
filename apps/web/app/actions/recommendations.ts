"use server";

import { auth } from "@/auth";
import { getLatestDiagnostic } from "@everyskill/db/services/email-diagnostics";
import {
  generateSkillRecommendations,
  type SkillRecommendation,
} from "@/lib/skill-recommendations";
import type { WorkContext } from "@/lib/email-work-context";

/**
 * Server action: Generate skill recommendations based on latest diagnostic scan
 *
 * Loads user's most recent email diagnostic data and generates AI-powered
 * skill recommendations by matching work activity to the skill catalog.
 *
 * @returns Recommendations array or error message
 */
export async function getRecommendations(): Promise<
  | { recommendations: SkillRecommendation[]; error?: never }
  | { error: string; recommendations?: never }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  const diagnostic = await getLatestDiagnostic(session.user.id);
  if (!diagnostic) {
    return { error: "No diagnostic scan found. Run a scan first." };
  }

  const patternInsights = diagnostic.patternInsights as Record<string, unknown> | null;
  const workContext = patternInsights?.workContext as WorkContext | undefined;
  if (!workContext) {
    return { error: "No work context available. Run a new diagnostic scan." };
  }

  try {
    const recommendations = await generateSkillRecommendations(
      session.user.id,
      session.user.tenantId || "default-tenant-000-0000-000000000000",
      workContext
    );
    return { recommendations };
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    return { error: "Failed to generate recommendations. Please try again." };
  }
}
