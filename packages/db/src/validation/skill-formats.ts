import { z } from "zod";

/**
 * Skill format types matching the category field in skills table
 */
export const skillFormats = [
  "productivity",
  "wiring",
  "doc-production",
  "data-viz",
  "code",
] as const;
export type SkillFormat = (typeof skillFormats)[number];

/**
 * Base metadata common to all skill formats
 */
const baseMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  tags: z.array(z.string().max(50)).max(10).optional(),
  usageInstructions: z.string().max(5000).optional(),
});

/**
 * Productivity-specific metadata
 * Skills that save time on everyday tasks
 */
const productivityMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("productivity"),
  variables: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean().default(true),
      })
    )
    .optional(),
});

/**
 * Wiring-specific metadata
 * Skills that connect tools and automate flows
 */
const wiringMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("wiring"),
  steps: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  estimatedDuration: z.string().optional(),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  resources: z.array(z.string()).optional(),
  requiredEnvVars: z.array(z.string()).optional(),
});

/**
 * Doc Production-specific metadata
 * Skills that generate docs and reports
 */
const docProductionMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("doc-production"),
  outputFormats: z.array(z.string()).optional(),
});

/**
 * Data & Viz-specific metadata
 * Skills that analyze data and create visuals
 */
const dataVizMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("data-viz"),
  dataSources: z.array(z.string()).optional(),
});

/**
 * Code-specific metadata
 * Skills for writing, reviewing, and shipping code
 */
const codeMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("code"),
  systemPromptSummary: z.string().max(500).optional(),
  capabilities: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
});

/**
 * Discriminated union of all skill format schemas
 * Use skillMetadataSchema.parse(data) to validate and get typed result
 */
export const skillMetadataSchema = z.discriminatedUnion("format", [
  productivityMetadataSchema,
  wiringMetadataSchema,
  docProductionMetadataSchema,
  dataVizMetadataSchema,
  codeMetadataSchema,
]);

export type SkillMetadata = z.infer<typeof skillMetadataSchema>;
export type ProductivityMetadata = z.infer<typeof productivityMetadataSchema>;
export type WiringMetadata = z.infer<typeof wiringMetadataSchema>;
export type DocProductionMetadata = z.infer<typeof docProductionMetadataSchema>;
export type DataVizMetadata = z.infer<typeof dataVizMetadataSchema>;
export type CodeMetadata = z.infer<typeof codeMetadataSchema>;

/**
 * Validate skill metadata with detailed error reporting
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateSkillMetadata(
  data: unknown
): { success: true; data: SkillMetadata } | { success: false; errors: z.ZodError } {
  const result = skillMetadataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Check if a string is a valid skill format
 */
export function isValidSkillFormat(format: string): format is SkillFormat {
  return skillFormats.includes(format as SkillFormat);
}
