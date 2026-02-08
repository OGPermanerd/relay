"use server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { db, tenants } from "@everyskill/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const tenantSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  domain: z.string().max(100).optional().or(z.literal("")),
  logo: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export type TenantSettingsState = {
  success?: boolean;
  error?: string;
};

export async function updateTenantSettingsAction(
  _prev: TenantSettingsState,
  formData: FormData
): Promise<TenantSettingsState> {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session)) {
    return { error: "Unauthorized" };
  }

  if (!session.user.tenantId) {
    return { error: "No tenant associated with your account" };
  }

  if (!db) {
    return { error: "Database not configured" };
  }

  const raw = {
    name: formData.get("name") as string,
    domain: formData.get("domain") as string,
    logo: formData.get("logo") as string,
  };

  const parsed = tenantSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return { error: firstError?.message ?? "Invalid input" };
  }

  try {
    await db
      .update(tenants)
      .set({
        name: parsed.data.name,
        domain: parsed.data.domain || null,
        logo: parsed.data.logo || null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, session.user.tenantId));

    revalidatePath("/admin/settings");
    return { success: true };
  } catch {
    return { error: "Failed to update tenant settings" };
  }
}
