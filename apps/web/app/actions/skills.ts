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
import { hashContent } from "@/lib/content-hash";
import { generateSkillEmbedding } from "@/lib/embedding-generator";
import { generateSkillReview, REVIEW_MODEL } from "@/lib/ai-review";
import { upsertSkillReview } from "@everyskill/db/services/skill-reviews";

// ---------------------------------------------------------------------------
// EverySkill frontmatter helpers
// ---------------------------------------------------------------------------

function buildEverySkillFrontmatter(fields: {
  skillId: string;
  name: string;
  category: string;
  hoursSaved: number;
}): string {
  const trackingUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/api/track`
    : "http://localhost:2000/api/track";

  return [
    "---",
    `everyskill_skill_id: ${fields.skillId}`,
    `everyskill_skill_name: ${fields.name}`,
    `everyskill_category: ${fields.category}`,
    `everyskill_hours_saved: ${fields.hoursSaved}`,
    "hooks:",
    "  PostToolUse:",
    '    - matcher: "*"',
    "      hooks:",
    "        - type: command",
    "          command: >-",
    "            bash -c '",
    "            INPUT=$(cat);",
    '            TN=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null || echo "$INPUT" | grep -o "\\"tool_name\\":\\"[^\\"]*\\"" | cut -d\\" -f4 || echo "unknown");',
    `            PL="{\\"skill_id\\":\\"${fields.skillId}\\",\\"tool_name\\":\\"$TN\\",\\"ts\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",\\"hook_event\\":\\"PostToolUse\\"}";`,
    '            SIG=$(echo -n "$PL" | openssl dgst -sha256 -hmac "${EVERYSKILL_API_KEY:-none}" 2>/dev/null | awk "{print \\$NF}");',
    `            RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log);`,
    `            if [ "$RESP" != "200" ] && [ "$RESP" != "000" ]; then sleep 5; curl -s -o /dev/null -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log; fi;`,
    "            true",
    "            '",
    "          async: true",
    "          timeout: 30",
    "---",
    "",
  ].join("\n");
}

function stripEverySkillFrontmatter(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return content;
  // Only strip if the frontmatter contains a everyskill_ field
  if (/^relay_/m.test(match[1])) {
    return content.slice(match[0].length);
  }
  return content;
}

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
  visibility: z.enum(["tenant", "personal"]).default("tenant"),
});

import { checkSimilarSkills } from "@/lib/similar-skills";
import type { SimilarSkillResult } from "@/lib/similar-skills";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

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
    generateSkillEmbedding(skillId, name, `${description} ${reviewOutput.summary}`).catch(() => {});
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

  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    tags: formData.get("tags"),
    usageInstructions: formData.get("usageInstructions"),
    hoursSaved: formData.get("hoursSaved"),
    content: formData.get("content"),
    visibility: formData.get("visibility"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
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
        tenantId: DEFAULT_TENANT_ID,
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
          tenantId: DEFAULT_TENANT_ID,
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
  generateSkillEmbedding(newSkill.id, name, description).catch(() => {});

  // Fire-and-forget: auto-generate AI review
  autoGenerateReview(
    newSkill.id,
    name,
    description || "",
    rawContent,
    category,
    session.user.id,
    DEFAULT_TENANT_ID
  ).catch(() => {});

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
        tenantId: DEFAULT_TENANT_ID,
        name,
        slug,
        description,
        category,
        content: rawContent,
        hoursSaved,
        authorId: session.user.id,
        status: "draft",
        visibility,
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
          tenantId: DEFAULT_TENANT_ID,
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
  generateSkillEmbedding(newSkill.id, name, description).catch(() => {});

  // Fire-and-forget: auto-generate AI review
  autoGenerateReview(
    newSkill.id,
    name,
    description || "",
    rawContent,
    category,
    session.user.id,
    DEFAULT_TENANT_ID
  ).catch(() => {});

  // Revalidate relevant paths
  revalidatePath("/skills");
  revalidatePath("/");

  // Redirect to the new skill page
  // NOTE: redirect() throws a special Next.js error - do not wrap in try/catch
  redirect(`/skills/${newSkill.slug}`);
}
