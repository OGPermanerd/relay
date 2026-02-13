"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db, skills } from "@everyskill/db";
import { eq } from "drizzle-orm";

export async function getSkillContent(
  skillId: string
): Promise<{ content: string; slug: string; name: string } | null> {
  if (!db) return null;

  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: { content: true, slug: true, name: true, visibility: true, authorId: true },
  });

  if (!skill) return null;

  // Visibility check: personal skills only accessible to author and admins
  if (skill.visibility === "personal") {
    const session = await auth();
    if (session?.user?.id !== skill.authorId && !isAdmin(session)) {
      return null;
    }
  }

  return { content: skill.content, slug: skill.slug, name: skill.name };
}
