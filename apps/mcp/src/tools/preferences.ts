import { getTenantId } from "../auth.js";
import { trackUsage } from "../tracking/events.js";
import {
  getOrCreateUserPreferences,
  updateUserPreferences,
} from "@everyskill/db/services/user-preferences";
import type { UserPreferencesData } from "@everyskill/db/schema/user-preferences";

function authError() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "Authentication required",
          message: "Set EVERYSKILL_API_KEY to access your preferences",
        }),
      },
    ],
    isError: true,
  };
}

/**
 * MCP action handler for reading user preferences.
 * Returns preferredCategories and defaultSort for the authenticated user.
 */
export async function handleGetPreferences({ userId }: { userId?: string }) {
  if (!userId) return authError();

  const tenantId = getTenantId();
  if (!tenantId) return authError();

  const prefs = await getOrCreateUserPreferences(userId, tenantId);

  // Track usage (non-critical, fire-and-forget)
  trackUsage({
    toolName: "get_preferences",
    userId,
    metadata: {},
  }).catch(() => {});

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            preferredCategories: prefs?.preferredCategories ?? [],
            defaultSort: prefs?.defaultSort ?? "days_saved",
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * MCP action handler for updating user preferences.
 * Uses read-modify-write to preserve claudeMdWorkflowNotes and trainingDataConsent.
 */
export async function handleSetPreferences({
  userId,
  preferredCategories,
  defaultSort,
}: {
  userId?: string;
  preferredCategories?: ("productivity" | "wiring" | "doc-production" | "data-viz" | "code")[];
  defaultSort?: "uses" | "quality" | "rating" | "days_saved";
}) {
  if (!userId) return authError();

  const tenantId = getTenantId();
  if (!tenantId) return authError();

  // Read-modify-write: preserve claudeMdWorkflowNotes and trainingDataConsent
  const current = await getOrCreateUserPreferences(userId, tenantId);
  const merged: UserPreferencesData = {
    preferredCategories: current?.preferredCategories ?? [],
    defaultSort: current?.defaultSort ?? "days_saved",
    claudeMdWorkflowNotes: current?.claudeMdWorkflowNotes ?? "",
    trainingDataConsent: current?.trainingDataConsent ?? false,
    ...(preferredCategories !== undefined ? { preferredCategories } : {}),
    ...(defaultSort !== undefined ? { defaultSort } : {}),
  };

  await updateUserPreferences(userId, merged);

  // Track usage (non-critical, fire-and-forget)
  trackUsage({
    toolName: "set_preferences",
    userId,
    metadata: {
      hasCategories: preferredCategories !== undefined,
      hasSort: defaultSort !== undefined,
    },
  }).catch(() => {});

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: true,
            preferredCategories: merged.preferredCategories,
            defaultSort: merged.defaultSort,
          },
          null,
          2
        ),
      },
    ],
  };
}
