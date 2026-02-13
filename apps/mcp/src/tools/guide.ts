import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema/skills";
import { eq, and } from "drizzle-orm";
import { trackUsage } from "../tracking/events.js";
import { getUserId, getTenantId } from "../auth.js";

/**
 * Returns category-specific usage guidance for a skill.
 */
function getCategoryGuidance(category: string): string {
  switch (category) {
    case "prompt":
      return "This is a prompt skill. To use it:\n1. Copy the content below into your conversation\n2. Customize any placeholder values marked with [brackets]\n3. The prompt will guide Claude's response format and approach";
    case "workflow":
      return "This is a workflow skill. To use it:\n1. Follow the steps outlined in the content below\n2. Each step builds on the previous one\n3. Adapt the workflow to your specific context";
    case "agent":
      return "This is an agent configuration. To use it:\n1. The content defines Claude's behavior and capabilities\n2. It will be active for the duration of your conversation\n3. You can reference the agent's specific instructions as needed";
    case "mcp":
      return "This is an MCP tool skill. To use it:\n1. The skill is already installed and available as an MCP tool\n2. You can invoke it directly in conversation\n3. Check the content below for usage examples and parameters";
    default:
      return "Review the skill content below for usage instructions.";
  }
}

export async function handleGuideSkill({ skillId }: { skillId: string }) {
  if (!db) {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) },
      ],
      isError: true,
    };
  }

  // Build where conditions — always filter by published status
  const conditions = [eq(skills.id, skillId), eq(skills.status, "published")];
  const tenantId = getTenantId();
  if (tenantId) {
    conditions.push(eq(skills.tenantId, tenantId));
  }

  const skill = await db.query.skills.findFirst({
    where: and(...conditions),
    columns: {
      id: true,
      name: true,
      slug: true,
      category: true,
      content: true,
      hoursSaved: true,
      tags: true,
    },
  });

  if (!skill) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Skill not found or not published" }),
        },
      ],
      isError: true,
    };
  }

  const response = {
    skill: { id: skill.id, name: skill.name, category: skill.category },
    guidance: getCategoryGuidance(skill.category),
    estimatedTimeSaved: `${skill.hoursSaved ?? 1} hour(s) per use`,
    tags: skill.tags ?? [],
    content: skill.content,
    tips: [
      "Rate this skill after use to help others discover quality content",
      "Fork this skill if you want to customize it for your specific needs",
      "Usage is automatically tracked when deployed via MCP",
    ],
  };

  await trackUsage({
    toolName: "guide_skill",
    skillId,
    userId: getUserId() ?? undefined,
    metadata: { skillName: skill.name },
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}
