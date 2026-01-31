"use server";

import { auth } from "@/auth";
import { db, skills } from "@relay/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateUniqueSlug } from "@/lib/slug";

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

export type CreateSkillState = {
  errors?: Record<string, string[]>;
  message?: string;
};

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

  const { name, description, category, hoursSaved, content } = parsed.data;

  // Generate unique slug
  const slug = await generateUniqueSlug(name, db);

  // Check database availability
  if (!db) {
    return {
      message: "Database not configured. Please contact support.",
    };
  }

  // Insert skill into database
  try {
    const [newSkill] = await db
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

    // Revalidate relevant paths
    revalidatePath("/skills");
    revalidatePath("/");

    // Redirect to the new skill page
    redirect(`/skills/${newSkill.slug}`);
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
}
