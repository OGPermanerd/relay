import { z } from "zod";
import { server } from "../server.js";
import { db } from "@everyskill/db";
import { trackUsage } from "../tracking/events.js";
import { getUserId, shouldNudge, incrementAnonymousCount, getFirstAuthMessage } from "../auth.js";

/**
 * Build YAML frontmatter with PostToolUse hooks for automatic usage tracking.
 * Self-contained (no cross-package imports) since MCP app runs standalone.
 */
function buildHookFrontmatter(
  skillId: string,
  skillName: string,
  category: string,
  hoursSaved: number
): string {
  const trackingUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/api/track`
    : "https://everyskill.ai/api/track";

  return [
    "---",
    `everyskill_skill_id: ${skillId}`,
    `everyskill_skill_name: ${skillName}`,
    `everyskill_category: ${category}`,
    `everyskill_hours_saved: ${hoursSaved}`,
    "hooks:",
    "  PostToolUse:",
    '    - matcher: "*"',
    "      hooks:",
    "        - type: command",
    "          command: >-",
    "            bash -c '",
    "            INPUT=$(cat);",
    '            TN=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null || echo "$INPUT" | grep -o "\\"tool_name\\":\\"[^\\"]*\\"" | cut -d\\" -f4 || echo "unknown");',
    `            PL="{\\"skill_id\\":\\"${skillId}\\",\\"tool_name\\":\\"$TN\\",\\"ts\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",\\"hook_event\\":\\"PostToolUse\\"}";`,
    '            SIG=$(echo -n "$PL" | openssl dgst -sha256 -hmac "${EVERYSKILL_API_KEY:-none}" 2>/dev/null | awk "{print \\$NF}");',
    `            RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log);`,
    `            if [ "$RESP" != "200" ] && [ "$RESP" != "000" ]; then sleep 5; curl -s -o /dev/null -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log; fi;`,
    "            true",
    "            '",
    "          async: true",
    "          timeout: 30",
    "---",
    "",
  ].join("\n");
}

/**
 * Check if content's YAML frontmatter already contains PostToolUse hooks.
 */
function hasTrackingHooks(content: string): boolean {
  return /hooks:\s*\n\s+PostToolUse:/m.test(content);
}

/**
 * Strip existing YAML frontmatter (---\n...\n---\n) from content.
 */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length);
  }
  return content;
}

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

  // Ensure skill content has PostToolUse hooks for automatic usage tracking
  const contentWithHooks = hasTrackingHooks(skill.content)
    ? skill.content
    : buildHookFrontmatter(skill.id, skill.name, skill.category, skill.hoursSaved) +
      stripFrontmatter(skill.content);

  // For stdio transport, use hook-enriched content; for HTTP, use original content
  const contentWithFrontmatter = transport === "stdio" ? contentWithHooks : skill.content;

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
      "This skill is now available in this conversation. Usage tracking is automatic via PostToolUse hooks in the skill frontmatter.";
  } else {
    // Stdio transport: Claude Code will save the file locally
    responseBody.instructions = [
      `Save this skill to .claude/skills/${skill.slug}.md`,
      "After saving, call confirm_install with the skillId to log the installation",
      "Usage tracking is automatic via PostToolUse hooks in the skill frontmatter",
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
