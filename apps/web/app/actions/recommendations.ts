"use server";

import { auth } from "@/auth";
import {
  getLatestDiagnostic,
  type CategoryBreakdownItem,
} from "@everyskill/db/services/email-diagnostics";
import {
  generateSkillRecommendations,
  type SkillRecommendation,
} from "@/lib/skill-recommendations";

/**
 * Server action: Generate skill recommendations based on latest diagnostic scan
 *
 * Loads user's most recent email diagnostic data and generates AI-powered
 * skill recommendations using the recommendation engine.
 *
 * @returns Recommendations array or error message
 */
export async function getRecommendations(): Promise<
  | { recommendations: SkillRecommendation[]; error?: never }
  | { error: string; recommendations?: never }
> {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  // Load latest diagnostic scan
  const diagnostic = await getLatestDiagnostic(session.user.id);
  if (!diagnostic) {
    return { error: "No diagnostic scan found. Run a scan first." };
  }

  // Generate recommendations
  try {
    const recommendations = await generateSkillRecommendations(
      diagnostic.categoryBreakdown as CategoryBreakdownItem[],
      diagnostic.estimatedHoursPerWeek / 10, // stored as tenths
      session.user.id,
      session.user.tenantId || "default-tenant-000-0000-000000000000"
    );
    return { recommendations };
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    return { error: "Failed to generate recommendations. Please try again." };
  }
}
