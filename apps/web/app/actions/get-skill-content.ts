"use server";

import { db, skills } from "@everyskill/db";
import { eq } from "drizzle-orm";

export async function getSkillContent(
  skillId: string
): Promise<{ content: string; slug: string; name: string } | null> {
  if (!db) return null;

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { content: true, slug: true, name: true },
  });

  return skill ?? null;
}
