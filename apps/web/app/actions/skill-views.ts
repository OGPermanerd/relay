"use server";

import { auth } from "@/auth";
import { recordSkillView } from "@everyskill/db/services";

/**
 * Record that the current user viewed a skill.
 * Fire-and-forget semantics — never throws.
 */
export async function recordView(skillId: string, currentVersion: number | null): Promise<void> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
      return;
    }
    await recordSkillView(session.user.tenantId, session.user.id, skillId, currentVersion);
  } catch {
    // Fire-and-forget: view recording failures are non-critical
  }
}
