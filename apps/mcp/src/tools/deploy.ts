import { z } from "zod";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { trackUsage } from "../tracking/events.js";
import { getUserId, shouldNudge, incrementAnonymousCount, getFirstAuthMessage } from "../auth.js";

export async function handleDeploySkill({
  skillId,
  userId,
  skipNudge,
  transport,
}: {
  skillId: string;
  userId?: string;
  skipNudge?: boolean;
  transport?: "stdio" | "http";
}) {
  if (!db) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Database not configured" }),
        },
      ],
      isError: true,
    };
  }

  // Fetch all skills and find by ID in-memory to avoid TypeScript module resolution issues
  const allSkills = await db.query.skills.findMany();
  const skill = allSkills.find((s) => s.id === skillId);

  if (!skill) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: false,
              error: "Skill not found",
              message: `No skill found with ID: ${skillId}. Use list_skills or search_skills to find valid skill IDs.`,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  if (!userId && !skipNudge) {
    incrementAnonymousCount();
  }

  // Track deployment
  await trackUsage({
    toolName: "deploy_skill",
    skillId: skill.id,
    userId,
    metadata: {
      skillName: skill.name,
      skillCategory: skill.category,
    },
  });

  // For stdio transport, prepend YAML frontmatter so the skill ID travels with the content
  const contentWithFrontmatter =
    transport === "stdio"
      ? `---\neveryskill_skill_id: ${skill.id}\neveryskill_skill_name: ${skill.name}\neveryskill_category: ${skill.category}\neveryskill_hours_saved: ${skill.hoursSaved}\n---\n${skill.content}`
      : skill.content;

  // Build response based on transport
  const skillPayload: Record<string, unknown> = {
    id: skill.id,
    name: skill.name,
    category: skill.category,
    filename: `${skill.slug}.md`,
    content: contentWithFrontmatter,
    hoursSaved: skill.hoursSaved,
  };

  const responseBody: Record<string, unknown> = {
    success: true,
    skill: skillPayload,
  };

  if (transport === "http") {
    // HTTP transport: skill is used in-conversation, no file-save instructions
    responseBody.message =
      "This skill is now available in this conversation. When you use it, call log_skill_usage with the skillId to track usage.";
  } else {
    // Stdio transport: Claude Code will save the file locally
    responseBody.instructions = [
      `Save this skill to .claude/skills/${skill.slug}.md`,
      "After saving, call confirm_install with the skillId to log the installation",
      "When you use this skill in a conversation, call log_skill_usage with the skillId",
      "The frontmatter contains everyskill_skill_id for future attribution",
    ];
  }

  // Return skill content for Claude to save
  // Claude Code will handle file writing with user confirmation
  const content: Array<{ type: "text"; text: string }> = [
    {
      type: "text" as const,
      text: JSON.stringify(responseBody, null, 2),
    },
  ];

  if (!skipNudge) {
    const firstAuthMsg = getFirstAuthMessage();
    if (firstAuthMsg) {
      content.push({ type: "text" as const, text: firstAuthMsg });
    }

    if (shouldNudge()) {
      content.push({
        type: "text" as const,
        text: "Tip: Set EVERYSKILL_API_KEY to track your usage and unlock analytics.",
      });
    }
  }

  return { content };
}

server.registerTool(
  "deploy_skill",
  {
    description:
      "Deploy a skill from EverySkill to your local Claude environment. Returns the skill content and filename for you to save. Use the skill ID from list_skills or search_skills results.",
    inputSchema: {
      skillId: z.string().describe("Skill ID from search/list results"),
    },
  },
  async ({ skillId }) => handleDeploySkill({ skillId, userId: getUserId() ?? undefined })
);
