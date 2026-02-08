"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { deleteSkill } from "@everyskill/db/services";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";

export type DeleteSkillState = {
  success?: boolean;
  error?: string;
};

export async function deleteSkillAction(
  prevState: DeleteSkillState,
  formData: FormData
): Promise<DeleteSkillState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const skillId = formData.get("skillId") as string;
  if (!skillId || !db) {
    return { error: "Invalid request" };
  }

  // Fetch skill to check ownership
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { id: true, authorId: true, slug: true },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Check authorization: must be author or admin
  const userIsAdmin = isAdmin(session);
  if (skill.authorId !== session.user.id && !userIsAdmin) {
    return { error: "You don't have permission to delete this skill" };
  }

  const result = await deleteSkill(skillId);

  if (!result.success) {
    return result;
  }

  revalidatePath("/skills");
  revalidatePath("/my-skills");
  redirect("/my-skills");
}
