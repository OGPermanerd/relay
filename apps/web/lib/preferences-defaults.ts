import { z } from "zod";

/**
 * Skill category constants for user preference filtering
 */
export const SKILL_CATEGORIES = [
  "productivity",
  "wiring",
  "doc-production",
  "data-viz",
  "code",
] as const;

/**
 * Sort option constants for skill listing preferences
 */
export const SORT_OPTIONS = ["uses", "quality", "rating", "days_saved"] as const;

/**
 * Zod schema for validating user preferences JSONB data.
 * Used in server actions for write validation and in client components for type safety.
 */
export const userPreferencesSchema = z.object({
  preferredCategories: z.array(z.enum(SKILL_CATEGORIES)).default([]),
  defaultSort: z.enum(SORT_OPTIONS).default("days_saved"),
  claudeMdWorkflowNotes: z.string().max(2000).default(""),
  trainingDataConsent: z.boolean().default(false),
});

/**
 * TypeScript type inferred from the Zod schema
 */
export type UserPreferencesData = z.infer<typeof userPreferencesSchema>;

/**
 * Default values for user preferences.
 * Used as fallback when merging with stored preferences.
 */
export const PREFERENCES_DEFAULTS: UserPreferencesData = {
  preferredCategories: [],
  defaultSort: "days_saved",
  claudeMdWorkflowNotes: "",
  trainingDataConsent: false,
};
