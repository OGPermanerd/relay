"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db, skills, users, deleteSkill, mergeSkills } from "@everyskill/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type AdminSkill = {
  id: string;
  name: string;
  slug: string;
  totalUses: number;
  authorName: string | null;
  createdAt: string;
};

export async function getAdminSkills(): Promise<AdminSkill[]> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return [];
  }
  if (!db) return [];

  const tenantId = session.user.tenantId || "default-tenant-000-0000-000000000000";

  const rows = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      totalUses: skills.totalUses,
      authorName: users.name,
      createdAt: skills.createdAt,
    })
    .from(skills)
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(eq(skills.tenantId, tenantId));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    totalUses: r.totalUses,
    authorName: r.authorName,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type DeleteSkillState = {
  success?: boolean;
  error?: string;
};

export async function deleteSkillAdminAction(
  prevState: DeleteSkillState,
  formData: FormData
): Promise<DeleteSkillState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }

  const skillId = formData.get("skillId") as string;
  if (!skillId) {
    return { error: "Skill ID is required" };
  }

  const result = await deleteSkill(skillId);
  if (!result.success) {
    return { error: result.error || "Failed to delete skill" };
  }

  revalidatePath("/admin/skills");
  return { success: true };
}

export type BulkMergeState = {
  success?: boolean;
  merged?: number;
  errors?: string[];
};

export async function bulkMergeSkillsAction(
  prevState: BulkMergeState,
  formData: FormData
): Promise<BulkMergeState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { errors: ["Unauthorized"] };
  }

  const targetId = formData.get("targetId") as string;
  const skillIdsRaw = formData.get("skillIds") as string;

  if (!targetId || !skillIdsRaw) {
    return { errors: ["Target skill and source skills are required"] };
  }

  const skillIds = skillIdsRaw.split(",").filter(Boolean);
  // Filter out the target from source IDs
  const sourceIds = skillIds.filter((id) => id !== targetId);

  if (sourceIds.length === 0) {
    return { errors: ["No source skills to merge (target cannot be merged into itself)"] };
  }

  const errors: string[] = [];
  let merged = 0;

  for (const sourceId of sourceIds) {
    const result = await mergeSkills(sourceId, targetId);
    if (result.success) {
      merged++;
    } else {
      errors.push(`Failed to merge skill ${sourceId}: ${result.error}`);
    }
  }

  revalidatePath("/admin/skills");

  if (errors.length > 0) {
    return { success: merged > 0, merged, errors };
  }

  return { success: true, merged };
}
