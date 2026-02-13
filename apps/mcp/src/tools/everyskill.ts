import { z } from "zod";
import { server } from "../server.js";
import { getUserId } from "../auth.js";
import { handleSearchSkills } from "./search.js";
import { handleListSkills } from "./list.js";
import { handleRecommendSkills } from "./recommend.js";
import { handleDescribeSkill } from "./describe.js";
import { handleDeploySkill } from "./deploy.js";
import { handleGuideSkill } from "./guide.js";
import { handleCreateSkill } from "./create.js";
import { handleUpdateSkill } from "./update-skill.js";
import { handleReviewSkill } from "./review-skill.js";
import { handleSubmitForReview } from "./submit-for-review.js";
import { handleCheckReviewStatus } from "./check-review-status.js";
import { handleCheckSkillStatus } from "./check-skill-status.js";

// ---------------------------------------------------------------------------
// Unified everyskill tool — single tool with action discriminator
// ---------------------------------------------------------------------------

const ACTIONS = [
  "search",
  "list",
  "recommend",
  "describe",
  "install",
  "guide",
  "create",
  "update",
  "review",
  "submit_review",
  "check_review",
  "check_status",
] as const;

type Action = (typeof ACTIONS)[number];

function missingParam(action: string, param: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "Missing required parameter",
          message: `"${action}" action requires "${param}" parameter`,
        }),
      },
    ],
    isError: true,
  };
}

function missingParams(action: string, params: string[]) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "Missing required parameters",
          message: `"${action}" action requires ${params.map((p) => `"${p}"`).join(", ")} parameters`,
        }),
      },
    ],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Input schema (exported for testing)
// ---------------------------------------------------------------------------

const EverySkillInputSchema = {
  action: z
    .enum(ACTIONS)
    .describe(
      "Action to perform: search, list, recommend, describe, install, guide, create, update, review, submit_review, check_review, check_status"
    ),
  query: z.string().optional().describe("Search query (required for: search, recommend)"),
  category: z
    .enum(["prompt", "workflow", "agent", "mcp"])
    .optional()
    .describe("Skill category filter (used by: search, list, recommend, create)"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum results (used by: search, list, recommend)"),
  skillId: z
    .string()
    .optional()
    .describe(
      "Skill ID (required for: describe, install, guide, update, review, submit_review, check_status; optional for: check_review)"
    ),
  name: z.string().optional().describe("Skill name (required for: create)"),
  description: z
    .string()
    .optional()
    .describe("Skill description (required for: create; optional for: update)"),
  content: z
    .string()
    .optional()
    .describe("Skill content in markdown (required for: create, update)"),
  tags: z.array(z.string()).optional().describe("Tags for discovery (optional for: create)"),
  hoursSaved: z
    .number()
    .optional()
    .describe("Estimated hours saved per use (required for: create)"),
  visibility: z
    .enum(["tenant", "personal"])
    .optional()
    .describe("Skill visibility (optional for: create, update)"),
  filePath: z.string().optional().describe("Custom local file path (optional for: check_status)"),
};

export type EverySkillArgs = {
  action: Action;
  query?: string;
  category?: "prompt" | "workflow" | "agent" | "mcp";
  limit?: number;
  skillId?: string;
  name?: string;
  description?: string;
  content?: string;
  tags?: string[];
  hoursSaved?: number;
  visibility?: "tenant" | "personal";
  filePath?: string;
};

// ---------------------------------------------------------------------------
// Action router (exported for testing)
// ---------------------------------------------------------------------------

export async function routeEveryskillAction(args: EverySkillArgs) {
  const action = args.action;
  const userId = getUserId() ?? undefined;

  switch (action) {
    case "search": {
      if (!args.query) return missingParam(action, "query");
      return handleSearchSkills({
        query: args.query,
        category: args.category,
        limit: args.limit ?? 10,
        userId,
        skipNudge: true,
      });
    }

    case "list": {
      return handleListSkills({
        category: args.category,
        limit: args.limit ?? 20,
        userId,
        skipNudge: true,
      });
    }

    case "recommend": {
      if (!args.query) return missingParam(action, "query");
      return handleRecommendSkills({
        query: args.query,
        category: args.category,
        limit: args.limit ?? 5,
        userId,
        skipNudge: true,
      });
    }

    case "describe": {
      if (!args.skillId) return missingParam(action, "skillId");
      return handleDescribeSkill({ skillId: args.skillId, userId });
    }

    case "install": {
      if (!args.skillId) return missingParam(action, "skillId");
      return handleDeploySkill({ skillId: args.skillId, userId, skipNudge: true });
    }

    case "guide": {
      if (!args.skillId) return missingParam(action, "skillId");
      return handleGuideSkill({ skillId: args.skillId });
    }

    case "create": {
      const missing: string[] = [];
      if (!args.name) missing.push("name");
      if (!args.description) missing.push("description");
      if (!args.content) missing.push("content");
      if (!args.category) missing.push("category");
      if (args.hoursSaved === undefined || args.hoursSaved === null) missing.push("hoursSaved");
      if (missing.length > 0) return missingParams(action, missing);
      return handleCreateSkill({
        name: args.name!,
        description: args.description!,
        category: args.category!,
        content: args.content!,
        tags: args.tags,
        hoursSaved: args.hoursSaved!,
        userId,
        visibility: args.visibility,
      });
    }

    case "update": {
      const missing: string[] = [];
      if (!args.skillId) missing.push("skillId");
      if (!args.content) missing.push("content");
      if (missing.length > 0) return missingParams(action, missing);
      return handleUpdateSkill({
        skillId: args.skillId!,
        content: args.content!,
        description: args.description,
        visibility: args.visibility,
      });
    }

    case "review": {
      if (!args.skillId) return missingParam(action, "skillId");
      return handleReviewSkill({ skillId: args.skillId });
    }

    case "submit_review": {
      if (!args.skillId) return missingParam(action, "skillId");
      return handleSubmitForReview({ skillId: args.skillId });
    }

    case "check_review": {
      return handleCheckReviewStatus({ skillId: args.skillId });
    }

    case "check_status": {
      if (!args.skillId) return missingParam(action, "skillId");
      return handleCheckSkillStatus({ skillId: args.skillId, filePath: args.filePath });
    }

    default: {
      const _exhaustive: never = action;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Unknown action", action: _exhaustive }),
          },
        ],
        isError: true,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

server.registerTool(
  "everyskill",
  {
    description:
      "EverySkill - AI skill marketplace. Search, discover, install, create, and manage reusable AI skills " +
      "(prompts, workflows, agents, MCP configurations). IMPORTANT: Use this tool proactively whenever the " +
      "user needs help with AI prompts, coding workflows, agent configurations, or asks about available skills. " +
      "Actions: search (keyword search), list (browse all), recommend (AI-powered discovery), describe (full " +
      "details + reviews), install (deploy to local env), guide (usage instructions), create (publish new skill), " +
      "update (push changes), review (AI quality review), submit_review (full review pipeline), check_review " +
      "(pipeline status), check_status (local vs published diff).",
    inputSchema: EverySkillInputSchema,
  },
  async (args) => routeEveryskillAction(args as unknown as EverySkillArgs)
);
