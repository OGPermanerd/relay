import { z } from "zod";

/**
 * Skill format types matching the category field in skills table
 */
export const skillFormats = ["prompt", "workflow", "agent", "mcp"] as const;
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
 * Prompt-specific metadata
 * Prompts are simple text templates with optional variables
 */
const promptMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("prompt"),
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
 * Workflow-specific metadata
 * Workflows are multi-step processes with defined stages
 */
const workflowMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("workflow"),
  steps: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  estimatedDuration: z.string().optional(), // e.g., "5-10 minutes"
});

/**
 * Agent-specific metadata
 * Agents are Claude configurations with specific behaviors
 */
const agentMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("agent"),
  systemPromptSummary: z.string().max(500).optional(),
  capabilities: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
});

/**
 * MCP-specific metadata
 * MCP skills are server configurations for Claude Code
 */
const mcpMetadataSchema = baseMetadataSchema.extend({
  format: z.literal("mcp"),
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
 * Discriminated union of all skill format schemas
 * Use skillMetadataSchema.parse(data) to validate and get typed result
 */
export const skillMetadataSchema = z.discriminatedUnion("format", [
  promptMetadataSchema,
  workflowMetadataSchema,
  agentMetadataSchema,
  mcpMetadataSchema,
]);

export type SkillMetadata = z.infer<typeof skillMetadataSchema>;
export type PromptMetadata = z.infer<typeof promptMetadataSchema>;
export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;
export type AgentMetadata = z.infer<typeof agentMetadataSchema>;
export type McpMetadata = z.infer<typeof mcpMetadataSchema>;

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
