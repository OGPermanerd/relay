"use server";

import { auth } from "@/auth";
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

// =============================================================================
// Validation Schemas
// =============================================================================

const createArtifactSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["document", "email", "template", "script", "other"]),
  artifactDate: z.string().min(1, "Artifact date is required"),
  fileName: z.string().max(500).optional(),
  fileType: z.string().max(100).optional(),
  extractedText: z.string().max(100000).optional(),
  estimatedHoursSaved: z.coerce.number().min(0).max(10000).optional(),
});

const updateArtifactSchema = z.object({
  id: z.string().min(1, "Artifact ID is required"),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(["document", "email", "template", "script", "other"]).optional(),
  artifactDate: z.string().min(1).optional(),
  estimatedHoursSaved: z.coerce.number().min(0).max(10000).optional(),
});

// =============================================================================
// Create Work Artifact
// =============================================================================

/**
 * Create a new work artifact for the current user.
 * Limited to 50 artifacts per user.
 */
export async function createWorkArtifact(
  formData: FormData
): Promise<{ success: true; id: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to create a work artifact" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { error: "Tenant not resolved" };
  }

  if (!db) {
    return { error: "Database not available" };
  }

  // Parse form data
  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    category: formData.get("category") as string,
    artifactDate: formData.get("artifactDate") as string,
    fileName: (formData.get("fileName") as string) || undefined,
    fileType: (formData.get("fileType") as string) || undefined,
    extractedText: (formData.get("extractedText") as string) || undefined,
    estimatedHoursSaved: formData.get("estimatedHoursSaved")
      ? Number(formData.get("estimatedHoursSaved"))
      : undefined,
  };

  const parsed = createArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const data = parsed.data;
  const userId = session.user.id;

  // Enforce 50-artifact limit
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::integer AS cnt
    FROM work_artifacts
    WHERE user_id = ${userId}
  `);
  const countRows = countResult as unknown as Record<string, unknown>[];
  const count = Number(countRows[0]?.cnt ?? 0);

  if (count >= 50) {
    return { error: "Maximum 50 artifacts allowed" };
  }

  const id = crypto.randomUUID();
  const artifactDate = new Date(data.artifactDate).toISOString();

  await db.execute(sql`
    INSERT INTO work_artifacts (
      id, tenant_id, user_id, title, description, category,
      artifact_date, file_name, file_type, extracted_text,
      estimated_hours_saved
    ) VALUES (
      ${id}, ${tenantId}, ${userId}, ${data.title},
      ${data.description ?? null}, ${data.category},
      ${artifactDate}, ${data.fileName ?? null},
      ${data.fileType ?? null}, ${data.extractedText ?? null},
      ${data.estimatedHoursSaved ?? null}
    )
  `);

  return { success: true, id };
}

// =============================================================================
// Update Work Artifact
// =============================================================================

/**
 * Update an existing work artifact owned by the current user.
 * Only updates fields that are present in the form data.
 */
export async function updateWorkArtifact(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to update a work artifact" };
  }

  if (!db) {
    return { error: "Database not available" };
  }

  const raw: Record<string, unknown> = {
    id: formData.get("id") as string,
  };

  // Only include fields that are present in formData
  if (formData.has("title")) raw.title = formData.get("title") as string;
  if (formData.has("description")) raw.description = formData.get("description") as string;
  if (formData.has("category")) raw.category = formData.get("category") as string;
  if (formData.has("artifactDate")) raw.artifactDate = formData.get("artifactDate") as string;
  if (formData.has("estimatedHoursSaved")) {
    raw.estimatedHoursSaved = Number(formData.get("estimatedHoursSaved"));
  }

  const parsed = updateArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const data = parsed.data;
  const userId = session.user.id;

  // Build dynamic SET clause
  const setClauses: ReturnType<typeof sql>[] = [];
  if (data.title !== undefined) setClauses.push(sql`title = ${data.title}`);
  if (data.description !== undefined) setClauses.push(sql`description = ${data.description}`);
  if (data.category !== undefined) setClauses.push(sql`category = ${data.category}`);
  if (data.artifactDate !== undefined) {
    const d = new Date(data.artifactDate).toISOString();
    setClauses.push(sql`artifact_date = ${d}`);
  }
  if (data.estimatedHoursSaved !== undefined) {
    setClauses.push(sql`estimated_hours_saved = ${data.estimatedHoursSaved}`);
  }

  if (setClauses.length === 0) {
    return { error: "No fields to update" };
  }

  // Always update updated_at
  setClauses.push(sql`updated_at = NOW()`);

  const setClause = sql.join(setClauses, sql`, `);

  await db.execute(sql`
    UPDATE work_artifacts
    SET ${setClause}
    WHERE id = ${data.id} AND user_id = ${userId}
  `);

  return { success: true };
}

// =============================================================================
// Delete Work Artifact
// =============================================================================

/**
 * Delete a work artifact owned by the current user.
 */
export async function deleteWorkArtifact(
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to delete a work artifact" };
  }

  if (!db) {
    return { error: "Database not available" };
  }

  const id = formData.get("id") as string;
  if (!id) {
    return { error: "Artifact ID is required" };
  }

  await db.execute(sql`
    DELETE FROM work_artifacts
    WHERE id = ${id} AND user_id = ${session.user.id}
  `);

  return { success: true };
}
