"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { skillVersions } from "@everyskill/db/schema/skill-versions";
import { generateUploadUrl } from "@everyskill/storage";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateUniqueSlug } from "@/lib/slug";
import { isAdmin } from "@/lib/admin";
import { hashContent } from "@/lib/content-hash";
import { generateSkillEmbedding } from "@/lib/embedding-generator";
import { generateSkillReview, generateSkillSummary, REVIEW_MODEL } from "@/lib/ai-review";
import { upsertSkillReview } from "@everyskill/db/services/skill-reviews";
import { buildEverySkillFrontmatter, stripEverySkillFrontmatter } from "@/lib/frontmatter";

// Zod schema for form validation
const createSkillSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(2000, "Description must be 2000 characters or less"),
  category: z.enum(["productivity", "wiring", "doc-production", "data-viz", "code"], {
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
  visibility: z.enum(["global_approved", "tenant", "personal", "private"]).default("tenant"),
  loomUrl: z
    .string()
    .url("Must be a valid URL")
    .regex(
      /^https?:\/\/(www\.)?loom\.com\/(share|embed|i)\/[a-f0-9]{32}(\?.*)?$/,
      "Must be a Loom video URL (e.g. https://www.loom.com/share/...)"
    )
    .optional()
    .or(z.literal("")),
});

import { checkSimilarSkills } from "@/lib/similar-skills";
import type { SimilarSkillResult } from "@/lib/similar-skills";

/**
 * Fire-and-forget AI review generation after skill creation.
 * Failures are intentionally swallowed -- review is advisory, not blocking.
 */
async function autoGenerateReview(
  skillId: string,
  name: string,
  description: string,
  content: string,
  category: string,
  userId: string,
  tenantId: string
): Promise<void> {
  try {
    const reviewOutput = await generateSkillReview(name, description, content, category);
    const { summary, suggestedDescription, ...categories } = reviewOutput;
    const contentHash = await hashContent(content);
    await upsertSkillReview({
      skillId,
      tenantId,
      requestedBy: userId,
      categories,
      summary,
      suggestedDescription,
      reviewedContentHash: contentHash,
      modelName: REVIEW_MODEL,
    });

    // SKILL-07: Enriched embedding improves future similarity detection.
    // Current upload's check already completed before AI review ran.
    // Re-embed with enriched text (description + review summary) for better matching.
    generateSkillEmbedding(skillId, name, `${description} ${reviewOutput.summary}`, tenantId).catch(
      () => {}
    );
  } catch {
    // Intentionally swallowed -- review is fire-and-forget
  }
}

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

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { errors: { _form: ["Tenant not resolved"] } };
  }

  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    tags: formData.get("tags"),
    usageInstructions: formData.get("usageInstructions"),
    hoursSaved: formData.get("hoursSaved"),
    content: formData.get("content"),
    visibility: formData.get("visibility"),
    loomUrl: formData.get("loomUrl"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Admin gate: only admins can set global_approved visibility
  if (parsed.data.visibility === "global_approved" && !isAdmin(session)) {
    return { errors: { visibility: ["Only admins can set global visibility"] } };
  }

  // Read optional variation-of link (from "Create as Variation" flow)
  const variationOf = (formData.get("_variationOf") as string) || null;

  // Step 1: check for similar skills (unless skipped)
  const skipCheck = formData.get("_skipCheck") === "true";
  if (!skipCheck) {
    const result = await checkSimilarSkills(
      {
        name: parsed.data.name,
        description: parsed.data.description,
      },
      session.user.id
    );
    if (result.similarSkills.length > 0) {
      return { similarSkills: result.similarSkills };
    }
  }

  // Step 2: create the skill
  const { name, description, category, hoursSaved, visibility } = parsed.data;
  const rawContent = stripEverySkillFrontmatter(parsed.data.content);
  const slug = await generateUniqueSlug(name, db);

  if (!db) {
    return { message: "Database not configured. Please contact support." };
  }

  let newSkill: { id: string; slug: string };
  try {
    const [inserted] = await db
      .insert(skills)
      .values({
        tenantId,
        name,
        slug,
        description,
        category,
        content: rawContent,
        hoursSaved,
        authorId: session.user.id,
        forkedFromId: variationOf || undefined,
        status: "draft",
        visibility,
        loomUrl: parsed.data.loomUrl || null,
      })
      .returning({ id: skills.id, slug: skills.slug });
    newSkill = inserted;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to create skill:", error);
    }
    return { message: "Failed to create skill. Please try again." };
  }

  // Build content with embedded frontmatter for storage and R2
  const contentWithFrontmatter =
    buildEverySkillFrontmatter({ skillId: newSkill.id, name, category, hoursSaved }) + rawContent;

  // Update skill content to include frontmatter
  await db
    .update(skills)
    .set({ content: contentWithFrontmatter })
    .where(eq(skills.id, newSkill.id));

  const contentHash = await hashContent(contentWithFrontmatter);
  const uploadResult = await generateUploadUrl(newSkill.id, 1, "text/markdown");

  if (uploadResult) {
    const uploadResponse = await fetch(uploadResult.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: contentWithFrontmatter,
    });

    if (uploadResponse.ok) {
      const [version] = await db
        .insert(skillVersions)
        .values({
          tenantId,
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

  // Fire-and-forget: generate embedding for semantic similarity
  generateSkillEmbedding(newSkill.id, name, description, tenantId).catch(() => {});

  // Fire-and-forget: auto-generate AI review
  autoGenerateReview(
    newSkill.id,
    name,
    description || "",
    rawContent,
    category,
    session.user.id,
    tenantId
  ).catch(() => {});

  // Fire-and-forget: generate skill summary (inputs/outputs/activities)
  autoGenerateSummary(newSkill.id, name, description || "", rawContent, category).catch(() => {});

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
    visibility: formData.get("visibility"),
    loomUrl: formData.get("loomUrl"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // Check for similar skills
  const result = await checkSimilarSkills(
    {
      name: parsed.data.name,
      description: parsed.data.description,
    },
    session.user.id
  );

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

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { message: "Tenant not resolved" };
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
    visibility: formData.get("visibility"),
    loomUrl: formData.get("loomUrl"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // Admin gate: only admins can set global_approved visibility
  if (parsed.data.visibility === "global_approved" && !isAdmin(session)) {
    return { errors: { visibility: ["Only admins can set global visibility"] } };
  }

  const {
    name,
    description,
    category,
    hoursSaved,
    visibility,
    tags: _tags,
    usageInstructions: _usageInstructions,
  } = parsed.data;
  const rawContent = stripEverySkillFrontmatter(parsed.data.content);

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
        tenantId,
        name,
        slug,
        description,
        category,
        content: rawContent,
        hoursSaved,
        authorId: session.user.id,
        status: "draft",
        visibility,
        loomUrl: parsed.data.loomUrl || null,
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

  // Build content with embedded frontmatter for storage and R2
  const contentWithFrontmatter =
    buildEverySkillFrontmatter({ skillId: newSkill.id, name, category, hoursSaved }) + rawContent;

  // Update skill content to include frontmatter
  await db
    .update(skills)
    .set({ content: contentWithFrontmatter })
    .where(eq(skills.id, newSkill.id));

  // Generate content hash
  const contentHash = await hashContent(contentWithFrontmatter);

  // Attempt R2 upload (gracefully handles missing config)
  const uploadResult = await generateUploadUrl(newSkill.id, 1, "text/markdown");

  if (uploadResult) {
    // Upload content to R2
    const uploadResponse = await fetch(uploadResult.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: contentWithFrontmatter,
    });

    if (uploadResponse.ok) {
      // Create version record
      const [version] = await db
        .insert(skillVersions)
        .values({
          tenantId,
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

  // Fire-and-forget: generate embedding for semantic similarity
  generateSkillEmbedding(newSkill.id, name, description, tenantId).catch(() => {});

  // Fire-and-forget: auto-generate AI review
  autoGenerateReview(
    newSkill.id,
    name,
    description || "",
    rawContent,
    category,
    session.user.id,
    tenantId
  ).catch(() => {});

  // Revalidate relevant paths
  revalidatePath("/skills");
  revalidatePath("/");

  // Redirect to the new skill page
  // NOTE: redirect() throws a special Next.js error - do not wrap in try/catch
  redirect(`/skills/${newSkill.slug}`);
}

// ---------------------------------------------------------------------------
// Fire-and-forget AI summary generation
// ---------------------------------------------------------------------------

async function autoGenerateSummary(
  skillId: string,
  name: string,
  description: string,
  content: string,
  category: string
): Promise<void> {
  try {
    const summary = await generateSkillSummary(name, description, content, category);
    if (db) {
      await db
        .update(skills)
        .set({
          inputs: summary.inputs,
          outputs: summary.outputs,
          activitiesSaved: summary.activitiesSaved,
        })
        .where(eq(skills.id, skillId));
    }
  } catch {
    // Intentionally swallowed — summary is fire-and-forget
  }
}

// ---------------------------------------------------------------------------
// Update skill summary (author inline editing)
// ---------------------------------------------------------------------------

const updateSummarySchema = z.object({
  skillId: z.string().min(1),
  inputs: z.array(z.string()).max(10),
  outputs: z.array(z.string()).max(10),
  activitiesSaved: z.array(z.string()).max(10),
});

export async function updateSkillSummary(
  data: z.infer<typeof updateSummarySchema>
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const parsed = updateSummarySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  if (!db) {
    return { success: false, error: "Database not configured" };
  }

  // Verify the user is the author
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, parsed.data.skillId),
    columns: { authorId: true },
  });

  if (!skill || skill.authorId !== session.user.id) {
    return { success: false, error: "Only the author can edit the summary" };
  }

  await db
    .update(skills)
    .set({
      inputs: parsed.data.inputs,
      outputs: parsed.data.outputs,
      activitiesSaved: parsed.data.activitiesSaved,
    })
    .where(eq(skills.id, parsed.data.skillId));

  revalidatePath(`/skills`);
  return { success: true };
}
