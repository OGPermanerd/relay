"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
} from "@everyskill/db/services/user-preferences";
import { userPreferencesSchema, SKILL_CATEGORIES } from "@/lib/preferences-defaults";

export type UserPreferencesResult = {
  preferredCategories: string[];
  defaultSort: string;
  claudeMdWorkflowNotes: string;
  trainingDataConsent: boolean;
} | null;

/**
 * Get the current user's preferences, creating defaults if needed.
 * Returns a plain object (no Date objects) safe for client serialization.
 */
export async function getMyUserPreferences(): Promise<UserPreferencesResult> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const tenantId = session.user.tenantId;
  if (!tenantId) return null;
  const prefs = await getOrCreateUserPreferences(session.user.id, tenantId);
  if (!prefs) return null;

  return {
    preferredCategories: prefs.preferredCategories,
    defaultSort: prefs.defaultSort,
    claudeMdWorkflowNotes: prefs.claudeMdWorkflowNotes,
    trainingDataConsent: prefs.trainingDataConsent,
  };
}

export type SaveUserPreferencesResult = {
  success?: boolean;
  error?: string;
};

/**
 * Save the current user's preferences from form data.
 * Checkboxes send "on" when checked, absent when unchecked.
 */
export async function saveMyUserPreferences(
  formData: FormData
): Promise<SaveUserPreferencesResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to save preferences" };
  }

  try {
    const preferredCategories = SKILL_CATEGORIES.filter(
      (cat) => formData.get("cat_" + cat) === "on"
    );
    const defaultSort = (formData.get("defaultSort") as string) || "days_saved";
    const claudeMdWorkflowNotes = (formData.get("claudeMdWorkflowNotes") as string) || "";
    const trainingDataConsent = formData.get("trainingDataConsent") === "on";

    const parsed = userPreferencesSchema.safeParse({
      preferredCategories,
      defaultSort,
      claudeMdWorkflowNotes,
      trainingDataConsent,
    });

    if (!parsed.success) {
      return { error: "Invalid preferences" };
    }

    await updateUserPreferences(session.user.id, parsed.data);
    revalidatePath("/settings/preferences");
    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to save user preferences:", error);
    }
    return { error: "Failed to save preferences. Please try again." };
  }
}
