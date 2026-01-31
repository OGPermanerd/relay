import { z } from "zod";
import { server } from "../server.js";
import { db } from "@relay/db";
import { trackUsage } from "../tracking/events.js";

server.registerTool(
  "deploy_skill",
  {
    description:
      "Deploy a skill from Relay to your local Claude environment. Returns the skill content and filename for you to save. Use the skill ID from list_skills or search_skills results.",
    inputSchema: {
      skillId: z.string().describe("Skill ID from search/list results"),
    },
  },
  async ({ skillId }) => {
    if (!db) {
      return {
        content: [
          {
            type: "text",
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
            type: "text",
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

    // Track deployment
    await trackUsage({
      toolName: "deploy_skill",
      skillId: skill.id,
      metadata: {
        skillName: skill.name,
        skillCategory: skill.category,
      },
    });

    // Return skill content for Claude to save
    // Claude Code will handle file writing with user confirmation
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              skill: {
                id: skill.id,
                name: skill.name,
                category: skill.category,
                filename: `${skill.slug}.md`,
                content: skill.content,
                hoursSaved: skill.hoursSaved,
              },
              instructions: [
                `Save this skill to your project's .claude/skills/ directory`,
                `Suggested path: .claude/skills/${skill.slug}.md`,
                `After saving, the skill will be available in your Claude Code session`,
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  }
);
