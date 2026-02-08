"use server";

import { auth } from "@/auth";
import {
  getOrCreatePreferences,
  updatePreferences,
} from "@everyskill/db/services/notification-preferences";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

export type PreferencesResult = {
  groupingProposalEmail: boolean;
  groupingProposalInApp: boolean;
  trendingDigest: "none" | "daily" | "weekly";
  platformUpdatesEmail: boolean;
  platformUpdatesInApp: boolean;
} | null;

/**
 * Get the current user's notification preferences, creating defaults if needed.
 * Returns a plain object (no Date objects) safe for client serialization.
 */
export async function getMyPreferences(): Promise<PreferencesResult> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const tenantId = session.user.tenantId || DEFAULT_TENANT_ID;
  const prefs = await getOrCreatePreferences(session.user.id, tenantId);
  if (!prefs) return null;

  return {
    groupingProposalEmail: prefs.groupingProposalEmail,
    groupingProposalInApp: prefs.groupingProposalInApp,
    trendingDigest: prefs.trendingDigest,
    platformUpdatesEmail: prefs.platformUpdatesEmail,
    platformUpdatesInApp: prefs.platformUpdatesInApp,
  };
}

export type SavePreferencesResult = {
  success?: boolean;
  error?: string;
};

/**
 * Save the current user's notification preferences from form data.
 * Checkboxes send "on" when checked, absent when unchecked.
 */
export async function saveMyPreferences(formData: FormData): Promise<SavePreferencesResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to save preferences" };
  }

  try {
    const updates = {
      groupingProposalEmail: formData.get("groupingProposalEmail") === "on",
      groupingProposalInApp: formData.get("groupingProposalInApp") === "on",
      trendingDigest: (formData.get("trendingDigest") as "none" | "daily" | "weekly") || "none",
      platformUpdatesEmail: formData.get("platformUpdatesEmail") === "on",
      platformUpdatesInApp: formData.get("platformUpdatesInApp") === "on",
    };

    await updatePreferences(session.user.id, updates);
    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("Failed to save notification preferences:", error);
    }
    return { error: "Failed to save preferences. Please try again." };
  }
}
