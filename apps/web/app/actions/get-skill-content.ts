"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db, skills, DEFAULT_TENANT_ID } from "@everyskill/db";
import { usageEvents } from "@everyskill/db/schema";
import { eq } from "drizzle-orm";

export async function getSkillContent(
  skillId: string
): Promise<{ content: string; slug: string; name: string } | null> {
  if (!db) return null;

  const [skill, session] = await Promise.all([
    db.query.skills.findFirst({
      where: eq(skills.id, skillId),
      columns: { content: true, slug: true, name: true, visibility: true, authorId: true },
    }),
    auth(),
  ]);

  if (!skill) return null;

  // Visibility check: personal skills only accessible to author and admins
  if (skill.visibility === "personal") {
    if (session?.user?.id !== skill.authorId && !isAdmin(session)) {
      return null;
    }
  }

  // Fire-and-forget: log download event
  if (session?.user?.id) {
    db.insert(usageEvents)
      .values({
        tenantId: session.user.tenantId ?? DEFAULT_TENANT_ID,
        toolName: "skill_download",
        skillId,
        userId: session.user.id,
        metadata: {
          skillName: skill.name,
          skillSlug: skill.slug,
          source: "web_download",
          serverTimestamp: new Date().toISOString(),
        },
      })
      .catch((err) => console.error("[download-tracking] Failed:", err));
  }

  return { content: skill.content, slug: skill.slug, name: skill.name };
}
