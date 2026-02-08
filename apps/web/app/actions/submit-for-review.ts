"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { eq, and } from "drizzle-orm";
import { canTransition, type SkillStatus } from "@everyskill/db/services/skill-status";
import { revalidatePath } from "next/cache";

export async function submitForReview(skillId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }
  if (!db) return { error: "Database not configured" };

  const skill = await db.query.skills.findFirst({
    where: and(eq(skills.id, skillId), eq(skills.authorId, session.user.id)),
    columns: { id: true, status: true },
  });

  if (!skill) return { error: "Skill not found" };

  if (!canTransition(skill.status as SkillStatus, "pending_review")) {
    return { error: `Cannot submit for review from status '${skill.status}'` };
  }

  await db
    .update(skills)
    .set({ status: "pending_review", updatedAt: new Date() })
    .where(eq(skills.id, skillId));

  revalidatePath("/my-skills");
  return { success: true };
}
