"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { skillVersions } from "@everyskill/db/schema/skill-versions";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateUniqueSlug } from "@/lib/slug";
import { generateSkillEmbedding } from "@/lib/embedding-generator";
import { hashContent } from "@/lib/content-hash";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export type ForkSkillState = {
  error?: string;
};

/**
 * Fork a skill — creates a new skill with content copied from the parent,
 * pre-filled as a draft in the publish form.
 */
export async function forkSkill(
  prevState: ForkSkillState,
  formData: FormData
): Promise<ForkSkillState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to fork a skill" };
  }

  const skillId = formData.get("skillId") as string;
  if (!skillId || !db) {
    return { error: "Invalid request" };
  }

  // Fetch the parent skill
  const parent = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: {
      id: true,
      name: true,
      description: true,
      category: true,
      content: true,
      tags: true,
      visibility: true,
      authorId: true,
    },
  });

  if (!parent) {
    return { error: "Skill not found" };
  }

  // Visibility check: cannot fork another user's personal skill
  if (parent.visibility === "personal" && parent.authorId !== session.user.id) {
    return { error: "This skill is not available for forking" };
  }

  // Create forked skill
  const tenantId = session.user.tenantId ?? DEFAULT_TENANT_ID;
  const forkName = `${parent.name} (Fork)`;
  const slug = await generateUniqueSlug(forkName, db);

  // Compute forkedAtContentHash from stripped body (no frontmatter) for drift detection
  const frontmatterMatch = parent.content.match(/^---\n[\s\S]*?\n---\n/);
  const strippedBody = frontmatterMatch
    ? parent.content.slice(frontmatterMatch[0].length)
    : parent.content;
  const parentBodyHash = await hashContent(strippedBody);

  let newSkill: { id: string; slug: string };
  try {
    const [inserted] = await db
      .insert(skills)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        name: forkName,
        slug,
        description: parent.description,
        category: parent.category,
        content: parent.content,
        tags: parent.tags,
        hoursSaved: 0,
        forkedFromId: parent.id,
        forkedAtContentHash: parentBodyHash,
        authorId: session.user.id,
        status: "draft",
        visibility: "personal",
      })
      .returning({ id: skills.id, slug: skills.slug });

    newSkill = inserted;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to fork skill:", error);
    }
    return { error: "Failed to fork skill. Please try again." };
  }

  // Create skill_versions record so the fork is not orphaned from the version system
  try {
    const versionId = crypto.randomUUID();
    const contentHash = await hashContent(parent.content);
    const [version] = await db
      .insert(skillVersions)
      .values({
        id: versionId,
        tenantId: DEFAULT_TENANT_ID,
        skillId: newSkill.id,
        version: 1,
        contentUrl: "",
        contentHash,
        contentType: "text/markdown",
        name: forkName,
        description: parent.description,
        createdBy: session.user.id,
      })
      .returning({ id: skillVersions.id });

    // Set publishedVersionId on the fork
    await db
      .update(skills)
      .set({ publishedVersionId: version.id })
      .where(eq(skills.id, newSkill.id));
  } catch (versionError) {
    // Non-fatal: fork is still usable without version record (matches pattern in create.ts)
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to create version record for fork:", versionError);
    }
  }

  // Fire-and-forget: generate embedding for semantic similarity
  generateSkillEmbedding(newSkill.id, forkName, parent.description, tenantId).catch(() => {});

  revalidatePath("/skills");
  revalidatePath(`/skills/${slug}`);

  // Redirect to the new forked skill page
  const improve = formData.get("improve") === "1";
  redirect(`/skills/${newSkill.slug}${improve ? "?improve=1" : ""}`);
}
