"use server";

import { auth } from "@/auth";
import { db, skills } from "@relay/db";
import { mergeSkills } from "@relay/db/services";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { ilike, or, sql } from "drizzle-orm";

export type MergeSkillsState = {
  success?: boolean;
  error?: string;
};

export async function mergeSkillsAction(
  prevState: MergeSkillsState,
  formData: FormData
): Promise<MergeSkillsState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.email)) {
    return { error: "Admin access required" };
  }

  const sourceId = formData.get("sourceId") as string;
  const targetId = formData.get("targetId") as string;

  if (!sourceId || !targetId) {
    return { error: "Both source and target skills are required" };
  }

  const result = await mergeSkills(sourceId, targetId);

  if (result.success) {
    revalidatePath("/skills");
    revalidatePath("/my-skills");
  }

  return result;
}

export type MergeSearchResult = {
  id: string;
  name: string;
  slug: string;
  totalUses: number;
  authorName: string | null;
};

export async function searchSkillsForMerge(query: string): Promise<MergeSearchResult[]> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.email)) {
    return [];
  }

  if (!db || !query.trim()) return [];

  const results = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      totalUses: skills.totalUses,
      authorName: sql<string | null>`(SELECT name FROM users WHERE id = ${skills.authorId})`,
    })
    .from(skills)
    .where(or(ilike(skills.name, `%${query}%`), ilike(skills.slug, `%${query}%`)))
    .limit(10);

  return results;
}
