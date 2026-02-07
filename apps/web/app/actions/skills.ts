"use server";

import { auth } from "@/auth";
import { db, skills } from "@relay/db";
import { skillVersions } from "@relay/db/schema/skill-versions";
import { createSkillEmbedding } from "@relay/db/services";
import { generateUploadUrl } from "@relay/storage";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateUniqueSlug } from "@/lib/slug";
import { hashContent } from "@/lib/content-hash";
import { generateEmbedding, EMBEDDING_MODEL, EMBEDDING_VERSION } from "@/lib/embeddings";

// Zod schema for form validation
const createSkillSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(2000, "Description must be 2000 characters or less"),
  category: z.enum(["prompt", "workflow", "agent", "mcp"], {
    errorMap: () => ({ message: "Please select a valid category" }),
  }),
  tags: z
    .string()
    .transform((val: string) =>
      val
        .split(",")
        .map((tag: string) => tag.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string()).max(10, "Maximum 10 tags allowed")),
  usageInstructions: z
    .string()
    .max(5000, "Usage instructions must be 5000 characters or less")
    .optional(),
  hoursSaved: z.coerce
    .number()
    .min(0, "Hours saved must be at least 0")
    .max(1000, "Hours saved must be 1000 or less")
    .default(1),
  content: z.string().min(1, "Content is required"),
});

import { checkSimilarSkills } from "@/lib/similar-skills";
import type { SimilarSkillResult } from "@relay/db/services";

export type CreateSkillState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export type CheckSimilarityState = {
  errors?: Record<string, string[]>;
  similarSkills?: SimilarSkillResult[];
};

/** Combined state for the check-and-create flow (single form action). */
export type SkillFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  similarSkills?: SimilarSkillResult[];
  similarityCheckFailed?: boolean;
  /** Cached embedding from similarity check — reused on "Publish Anyway" to avoid a second API call. */
  _cachedEmbedding?: number[];
};

/**
 * Combined action: validates, checks similarity, and creates skill in one call.
 * If _skipCheck is "true" in formData, skips similarity check (for "Publish Anyway").
 * Returns similarSkills if duplicates found; otherwise creates skill and redirects.
 */
export async function checkAndCreateSkill(
  prevState: SkillFormState,
  formData: FormData
): Promise<SkillFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { errors: { _form: ["You must be signed in to create a skill"] } };
  }

  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    tags: formData.get("tags"),
    usageInstructions: formData.get("usageInstructions"),
    hoursSaved: formData.get("hoursSaved"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Step 1: check for similar skills (unless skipped)
  const skipCheck = formData.get("_skipCheck") === "true";
  let similarityCheckFailed = false;
  let cachedEmbedding: number[] | undefined;
  if (!skipCheck) {
    const result = await checkSimilarSkills({
      name: parsed.data.name,
      description: parsed.data.description,
      content: parsed.data.content,
      tags: parsed.data.tags,
    });
    if (result.similarSkills.length > 0) {
      return { similarSkills: result.similarSkills, _cachedEmbedding: result.embedding };
    }
    similarityCheckFailed = result.checkFailed;
    cachedEmbedding = result.embedding;
  } else {
    // "Publish Anyway" — reuse embedding from previous similarity check
    cachedEmbedding = prevState._cachedEmbedding;
  }

  // Step 2: create the skill (same logic as createSkill)
  const { name, description, category, hoursSaved, content } = parsed.data;
  const slug = await generateUniqueSlug(name, db);

  if (!db) {
    return { message: "Database not configured. Please contact support." };
  }

  let newSkill: { id: string; slug: string };
  try {
    const [inserted] = await db
      .insert(skills)
      .values({ name, slug, description, category, content, hoursSaved, authorId: session.user.id })
      .returning({ id: skills.id, slug: skills.slug });
    newSkill = inserted;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to create skill:", error);
    }
    return { message: "Failed to create skill. Please try again." };
  }

  const contentHash = await hashContent(content);
  const uploadResult = await generateUploadUrl(newSkill.id, 1, "text/markdown");

  if (uploadResult) {
    const uploadResponse = await fetch(uploadResult.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: content,
    });

    if (uploadResponse.ok) {
      const [version] = await db
        .insert(skillVersions)
        .values({
          skillId: newSkill.id,
          version: 1,
          contentUrl: uploadResult.objectKey,
          contentHash,
          contentType: "text/markdown",
          name,
          description,
          metadata: { tags: parsed.data.tags, usageInstructions: parsed.data.usageInstructions },
          createdBy: session.user.id,
        })
        .returning({ id: skillVersions.id });

      await db
        .update(skills)
        .set({ publishedVersionId: version.id })
        .where(eq(skills.id, newSkill.id));
    } else {
      // eslint-disable-next-line no-console
      console.warn("R2 upload failed, skill created without version record");
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn("R2 not configured, skill created without version record");
  }

  const embeddingInput = [name, description, content, ...(parsed.data.tags || [])].join(" ");
  try {
    // Reuse cached embedding from similarity check if available, otherwise generate fresh
    const embedding = cachedEmbedding ?? (await generateEmbedding(embeddingInput));
    const inputHash = await hashContent(embeddingInput);
    await createSkillEmbedding({
      skillId: newSkill.id,
      embedding,
      modelName: EMBEDDING_MODEL,
      modelVersion: EMBEDDING_VERSION,
      inputHash,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to generate embedding:", error);
    await db.delete(skills).where(eq(skills.id, newSkill.id));
    return {
      message: "Failed to generate embedding for skill. Please try again.",
      similarityCheckFailed,
    };
  }

  revalidatePath("/skills");
  revalidatePath("/");
  redirect(`/skills/${newSkill.slug}`);
}

/**
 * Check for similar skills before publishing.
 * Validates form data and returns similar skills if found.
 */
export async function checkSimilarity(
  prevState: CheckSimilarityState,
  formData: FormData
): Promise<CheckSimilarityState> {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { errors: { _form: ["You must be signed in to create a skill"] } };
  }

  // Parse and validate form data
  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    tags: formData.get("tags"),
    usageInstructions: formData.get("usageInstructions"),
    hoursSaved: formData.get("hoursSaved"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // Check for similar skills
  const result = await checkSimilarSkills({
    name: parsed.data.name,
    description: parsed.data.description,
    content: parsed.data.content,
    tags: parsed.data.tags,
  });

  return { similarSkills: result.similarSkills };
}

export async function createSkill(
  prevState: CreateSkillState,
  formData: FormData
): Promise<CreateSkillState> {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { message: "You must be signed in to create a skill" };
  }

  // Parse and validate form data
  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    tags: formData.get("tags"),
    usageInstructions: formData.get("usageInstructions"),
    hoursSaved: formData.get("hoursSaved"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    name,
    description,
    category,
    hoursSaved,
    content,
    tags: _tags,
    usageInstructions: _usageInstructions,
  } = parsed.data;

  // Generate unique slug
  const slug = await generateUniqueSlug(name, db);

  // Check database availability
  if (!db) {
    return {
      message: "Database not configured. Please contact support.",
    };
  }

  // Insert skill into database
  let newSkill: { id: string; slug: string };
  try {
    const [inserted] = await db
      .insert(skills)
      .values({
        name,
        slug,
        description,
        category,
        content,
        hoursSaved,
        authorId: session.user.id,
      })
      .returning({ id: skills.id, slug: skills.slug });

    newSkill = inserted;
  } catch (error) {
    // Log error for debugging but don't expose details to user
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to create skill:", error);
    }
    return {
      message: "Failed to create skill. Please try again.",
    };
  }

  // Generate content hash
  const contentHash = await hashContent(content);

  // Attempt R2 upload (gracefully handles missing config)
  const uploadResult = await generateUploadUrl(newSkill.id, 1, "text/markdown");

  if (uploadResult) {
    // Upload content to R2
    const uploadResponse = await fetch(uploadResult.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: content,
    });

    if (uploadResponse.ok) {
      // Create version record
      const [version] = await db
        .insert(skillVersions)
        .values({
          skillId: newSkill.id,
          version: 1,
          contentUrl: uploadResult.objectKey,
          contentHash,
          contentType: "text/markdown",
          name,
          description,
          metadata: {
            tags: parsed.data.tags,
            usageInstructions: parsed.data.usageInstructions,
          },
          createdBy: session.user.id,
        })
        .returning({ id: skillVersions.id });

      // Update skill with published version reference
      await db
        .update(skills)
        .set({ publishedVersionId: version.id })
        .where(eq(skills.id, newSkill.id));
    } else {
      // eslint-disable-next-line no-console
      console.warn("R2 upload failed, skill created without version record");
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn("R2 not configured, skill created without version record");
  }

  // Generate and store embedding for the skill
  // Combines name, description, content, and tags for semantic search
  const embeddingInput = [name, description, content, ...(parsed.data.tags || [])].join(" ");

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
    // Log error for debugging
    // eslint-disable-next-line no-console
    console.error("Failed to generate embedding:", error);
    // Per CONTEXT.md: embedding failure should fail skill creation
    // Delete the skill we just created to maintain consistency
    await db.delete(skills).where(eq(skills.id, newSkill.id));
    return {
      message: "Failed to generate embedding for skill. Please try again.",
    };
  }

  // Revalidate relevant paths
  revalidatePath("/skills");
  revalidatePath("/");

  // Redirect to the new skill page
  // NOTE: redirect() throws a special Next.js error - do not wrap in try/catch
  redirect(`/skills/${newSkill.slug}`);
}
