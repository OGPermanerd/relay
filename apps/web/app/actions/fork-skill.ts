"use server";

import { auth } from "@/auth";
import { db, skills } from "@relay/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateUniqueSlug } from "@/lib/slug";
import { hashContent } from "@/lib/content-hash";
import { generateEmbedding, EMBEDDING_MODEL, EMBEDDING_VERSION } from "@/lib/embeddings";
import { createSkillEmbedding } from "@relay/db/services";

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
    },
  });

  if (!parent) {
    return { error: "Skill not found" };
  }

  // Create forked skill
  const forkName = `${parent.name} (Fork)`;
  const slug = await generateUniqueSlug(forkName, db);

  let newSkill: { id: string; slug: string };
  try {
    const [inserted] = await db
      .insert(skills)
      .values({
        name: forkName,
        slug,
        description: parent.description,
        category: parent.category,
        content: parent.content,
        tags: parent.tags,
        hoursSaved: 0,
        forkedFromId: parent.id,
        authorId: session.user.id,
      })
      .returning({ id: skills.id, slug: skills.slug });

    newSkill = inserted;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to fork skill:", error);
    }
    return { error: "Failed to fork skill. Please try again." };
  }

  // Generate embedding for the forked skill
  const embeddingInput = [
    forkName,
    parent.description,
    parent.content,
    ...(parent.tags || []),
  ].join(" ");

  try {
    const embedding = await generateEmbedding(embeddingInput);
    const inputHash = await hashContent(embeddingInput);
    await createSkillEmbedding({
      skillId: newSkill.id,
      embedding,
      modelName: EMBEDDING_MODEL,
      modelVersion: EMBEDDING_VERSION,
      inputHash,
    });
  } catch (error) {
    console.error("Failed to generate embedding for fork:", error);
    // Clean up the skill we just created
    await db.delete(skills).where(eq(skills.id, newSkill.id));
    return { error: "Failed to generate embedding for fork. Please try again." };
  }

  revalidatePath("/skills");
  revalidatePath(`/skills/${slug}`);

  // Redirect to the new forked skill page
  redirect(`/skills/${newSkill.slug}`);
}
