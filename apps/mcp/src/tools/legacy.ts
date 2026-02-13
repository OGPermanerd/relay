// ---------------------------------------------------------------------------
// Legacy tool registrations — DEPRECATED
//
// All individual tools are deprecated in favor of the unified `everyskill`
// tool with action discriminator. These registrations remain for backward
// compatibility with MCP clients that reference tools by their old names.
//
// Each wrapper delegates to the same handler function used by everyskill.ts.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { server } from "../server.js";
import { getUserId } from "../auth.js";

// Handler imports
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
import { handleConfirmInstall } from "./confirm-install.js";

// ---------------------------------------------------------------------------
// 1. list_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "list_skills",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'list') instead] " +
      "List all available skills in the EverySkill marketplace. Returns skill ID, name, description, category, and estimated hours saved.",
    inputSchema: {
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(50).default(20).describe("Maximum number of results"),
    },
  },
  async ({ category, limit }) =>
    handleListSkills({ category, limit, userId: getUserId() ?? undefined })
);

// ---------------------------------------------------------------------------
// 2. search_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "search_skills",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'search') instead] " +
      "Search for skills in the EverySkill marketplace by query. Matches against name, description, author name, and tags.",
    inputSchema: {
      query: z.string().min(1).describe("Search query (matches name, description, author, tags)"),
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(50).default(10).describe("Maximum number of results"),
    },
  },
  async ({ query, category, limit }) =>
    handleSearchSkills({ query, category, limit, userId: getUserId() ?? undefined })
);

// ---------------------------------------------------------------------------
// 3. recommend_skills
// ---------------------------------------------------------------------------

server.registerTool(
  "recommend_skills",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'recommend') instead] " +
      "Discover skills using natural language. Describe what you need and get semantically relevant recommendations. Uses AI-powered search when available, falls back to text matching.",
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe(
          "Natural language description of what you need (e.g., 'help me write better code reviews')"
        ),
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .optional()
        .describe("Filter by skill category"),
      limit: z.number().min(1).max(20).default(5).describe("Maximum number of recommendations"),
    },
  },
  async ({ query, category, limit }) =>
    handleRecommendSkills({
      query,
      category,
      limit,
      userId: getUserId() ?? undefined,
    })
);

// ---------------------------------------------------------------------------
// 4. describe_skill
// ---------------------------------------------------------------------------

server.registerTool(
  "describe_skill",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'describe') instead] " +
      "Get comprehensive details about a skill including AI review scores, ratings, usage statistics, similar skills, and install instructions. Use a skill ID from search_skills or recommend_skills results.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to describe"),
    },
  },
  async ({ skillId }) => handleDescribeSkill({ skillId, userId: getUserId() ?? undefined })
);

// ---------------------------------------------------------------------------
// 5. deploy_skill
// ---------------------------------------------------------------------------

server.registerTool(
  "deploy_skill",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'install') instead] " +
      "Deploy a skill from EverySkill to your local Claude environment. Returns the skill content and filename for you to save. Use the skill ID from list_skills or search_skills results.",
    inputSchema: {
      skillId: z.string().describe("Skill ID from search/list results"),
    },
  },
  async ({ skillId }) => handleDeploySkill({ skillId, userId: getUserId() ?? undefined })
);

// ---------------------------------------------------------------------------
// 6. guide_skill
// ---------------------------------------------------------------------------

server.registerTool(
  "guide_skill",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'guide') instead] " +
      "Get usage guidance and implementation instructions for an installed skill. Returns the skill content along with category-specific tips on how to use it effectively.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to get guidance for"),
    },
  },
  async ({ skillId }) => handleGuideSkill({ skillId })
);

// ---------------------------------------------------------------------------
// 7. create_skill
// ---------------------------------------------------------------------------

server.registerTool(
  "create_skill",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'create') instead] " +
      "Create and publish a new skill on EverySkill. Takes a process, workflow, or prompt and publishes it as a reusable skill. The skill is saved locally and published to the marketplace. Requires EVERYSKILL_API_KEY.",
    inputSchema: {
      name: z.string().min(1).max(100).describe("Skill name (e.g. 'Git PR Review Automation')"),
      description: z.string().min(1).max(2000).describe("What this skill does and when to use it"),
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .describe("Skill type: prompt, workflow, agent, or mcp"),
      content: z.string().min(1).describe("The full skill content (markdown)"),
      tags: z.array(z.string()).max(10).optional().describe("Optional tags for discovery (max 10)"),
      hoursSaved: z
        .number()
        .min(0)
        .max(1000)
        .default(1)
        .describe("Estimated hours saved per use (default: 1)"),
      visibility: z
        .enum(["tenant", "personal"])
        .optional()
        .describe("Skill visibility: 'tenant' (default, visible to org) or 'personal' (only you)"),
    },
  },
  async ({ name, description, category, content, tags, hoursSaved, visibility }) =>
    handleCreateSkill({
      name,
      description,
      category,
      content,
      tags,
      hoursSaved,
      userId: getUserId() ?? undefined,
      visibility,
    })
);

// ---------------------------------------------------------------------------
// 8. update_skill
// ---------------------------------------------------------------------------

server.registerTool(
  "update_skill",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'update') instead] " +
      "Push local skill modifications back to EverySkill. If you are the skill author, creates a new version (set to draft for re-review). If not the author, creates a fork. Requires EVERYSKILL_API_KEY.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to update"),
      content: z.string().describe("Updated skill content (full markdown)"),
      description: z
        .string()
        .optional()
        .describe("Updated description (optional, keeps existing if omitted)"),
      visibility: z
        .enum(["tenant", "personal"])
        .optional()
        .describe("Skill visibility (optional, only applies when you are the author)"),
    },
  },
  async ({ skillId, content, description, visibility }) =>
    handleUpdateSkill({ skillId, content, description, visibility })
);

// ---------------------------------------------------------------------------
// 9. review_skill
// ---------------------------------------------------------------------------

server.registerTool(
  "review_skill",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'review') instead] " +
      "Run an advisory AI review on a skill. Returns quality, clarity, and completeness scores (1-10) " +
      "with actionable suggestions. This is advisory-only — it does NOT change the skill's status. " +
      "Any authenticated user can review any published skill. Requires EVERYSKILL_API_KEY and ANTHROPIC_API_KEY.",
    inputSchema: {
      skillId: z.string().describe("The skill ID to review"),
    },
  },
  async ({ skillId }) => handleReviewSkill({ skillId })
);

// ---------------------------------------------------------------------------
// 10. submit_for_review
// ---------------------------------------------------------------------------

server.registerTool(
  "submit_for_review",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'submit_review') instead] " +
      "Submit a skill for the full review pipeline. Triggers AI review, stores scores, and " +
      "auto-approves + publishes if all scores meet the threshold (7/10). " +
      "The skill must be in 'draft' or 'changes_requested' status. " +
      "Requires EVERYSKILL_API_KEY and ANTHROPIC_API_KEY.",
    inputSchema: {
      skillId: z.string().describe("The skill ID to submit for review"),
    },
  },
  async ({ skillId }) => handleSubmitForReview({ skillId })
);

// ---------------------------------------------------------------------------
// 11. check_review_status
// ---------------------------------------------------------------------------

server.registerTool(
  "check_review_status",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'check_review') instead] " +
      "Check the review pipeline status and AI review scores for your skills. " +
      "Without a skillId, returns all skills currently in the review pipeline " +
      "(pending_review, ai_reviewed, approved, rejected, changes_requested). " +
      "With a skillId, returns detailed status for that specific skill. " +
      "Requires EVERYSKILL_API_KEY.",
    inputSchema: {
      skillId: z.string().optional().describe("Optional: check a specific skill by ID"),
    },
  },
  async ({ skillId }) => handleCheckReviewStatus({ skillId })
);

// ---------------------------------------------------------------------------
// 12. check_skill_status
// ---------------------------------------------------------------------------

server.registerTool(
  "check_skill_status",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'check_status') instead] " +
      "Check if a locally installed skill has diverged from the published version. Compares content (ignoring frontmatter tracking hooks) to detect modifications.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to check"),
      filePath: z
        .string()
        .optional()
        .describe("Custom file path. Defaults to ~/.claude/skills/{slug}.md"),
    },
  },
  async ({ skillId, filePath }) => handleCheckSkillStatus({ skillId, filePath })
);

// ---------------------------------------------------------------------------
// 13. confirm_install (no unified action equivalent — internal follow-up)
// ---------------------------------------------------------------------------

server.registerTool(
  "confirm_install",
  {
    description:
      "[DEPRECATED - use everyskill(action: 'install') instead] " +
      "Confirm that a skill has been saved/installed locally. Call this after saving a deployed skill file to log the installation.",
    inputSchema: {
      skillId: z.string().describe("The skill ID that was installed"),
    },
  },
  async ({ skillId }) => handleConfirmInstall({ skillId })
);
